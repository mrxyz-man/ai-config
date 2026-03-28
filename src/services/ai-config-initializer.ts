import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { ConfigInitializerPort, ConfigResolverPort, InitIssue, InitReport } from "../core/ports";

type InitOptions = {
  force?: boolean;
  lang?: string;
  skipQuestions?: boolean;
};

const TEMPLATE_AI_DIR = path.resolve(__dirname, "../../ai");

const toRelative = (projectRoot: string, absolutePath: string): string =>
  path.relative(projectRoot, absolutePath).replace(/\\/g, "/");

const readYamlObject = <T>(filePath: string): T => {
  const raw = fs.readFileSync(filePath, "utf8");
  return YAML.parse(raw) as T;
};

const writeYamlObject = (filePath: string, value: unknown): void => {
  fs.writeFileSync(filePath, YAML.stringify(value), "utf8");
};

const ensureTemplateExists = (): void => {
  if (!fs.existsSync(TEMPLATE_AI_DIR)) {
    throw new Error(`Template directory is missing: ${TEMPLATE_AI_DIR}`);
  }
};

const detectProject = (projectRoot: string): InitReport["detected"] => ({
  hasPackageJson: fs.existsSync(path.join(projectRoot, "package.json")),
  hasTypeScript: fs.existsSync(path.join(projectRoot, "tsconfig.json")),
  hasNodeModules: fs.existsSync(path.join(projectRoot, "node_modules"))
});

const copyTemplateAi = (
  projectRoot: string,
  force: boolean,
  createdFiles: string[],
  warnings: InitIssue[],
  errors: InitIssue[]
): boolean => {
  const targetAiDir = path.join(projectRoot, "ai");
  const exists = fs.existsSync(targetAiDir);
  if (exists && !force) {
    errors.push({
      file: "ai",
      message: "Target ./ai already exists. Use --force to re-bootstrap."
    });
    return false;
  }

  if (exists && force) {
    warnings.push({
      file: "ai",
      message: "Existing ./ai reused in force mode; managed files may be overwritten."
    });
  } else {
    fs.cpSync(TEMPLATE_AI_DIR, targetAiDir, { recursive: true });
    createdFiles.push("ai/**");
  }

  return true;
};

export class AiConfigInitializer implements ConfigInitializerPort {
  constructor(private readonly resolver: ConfigResolverPort) {}

  init(projectRoot: string, options?: InitOptions): InitReport {
    const absoluteRoot = path.resolve(projectRoot);
    const createdFiles: string[] = [];
    const updatedFiles: string[] = [];
    const warnings: InitIssue[] = [];
    const errors: InitIssue[] = [];
    const unresolvedQuestions: string[] = [];

    const force = options?.force === true;
    const lang = options?.lang;
    const skipQuestions = options?.skipQuestions === true;

    try {
      ensureTemplateExists();
    } catch (error) {
      errors.push({
        file: "ai",
        message: (error as Error).message
      });
      return {
        ok: false,
        projectRoot: absoluteRoot,
        createdFiles,
        updatedFiles,
        detected: detectProject(absoluteRoot),
        unresolvedQuestions,
        warnings,
        errors
      };
    }

    const copied = copyTemplateAi(absoluteRoot, force, createdFiles, warnings, errors);
    if (!copied) {
      return {
        ok: false,
        projectRoot: absoluteRoot,
        createdFiles,
        updatedFiles,
        detected: detectProject(absoluteRoot),
        unresolvedQuestions,
        warnings,
        errors
      };
    }

    const detected = detectProject(absoluteRoot);

    const projectYamlPath = path.join(absoluteRoot, "ai/project.yaml");
    if (fs.existsSync(projectYamlPath)) {
      const projectConfig = readYamlObject<Record<string, unknown>>(projectYamlPath);
      const domains = Array.isArray(projectConfig.domains)
        ? [...new Set([...(projectConfig.domains as string[]), detected.hasTypeScript ? "typescript" : "javascript"])]
        : [detected.hasTypeScript ? "typescript" : "javascript"];

      const runtimeEnvironment =
        typeof projectConfig.runtime_environment === "object" && projectConfig.runtime_environment !== null
          ? (projectConfig.runtime_environment as Record<string, unknown>)
          : {};

      runtimeEnvironment.shell = "powershell";
      runtimeEnvironment.os_family = process.platform === "win32" ? "windows" : process.platform;

      projectConfig.runtime_environment = runtimeEnvironment;
      projectConfig.domains = domains;
      writeYamlObject(projectYamlPath, projectConfig);
      updatedFiles.push(toRelative(absoluteRoot, projectYamlPath));
    }

    const answersPath = path.join(absoluteRoot, "ai/questions/answers.yaml");
    if (fs.existsSync(answersPath)) {
      const answers = readYamlObject<Record<string, unknown>>(answersPath);
      if (lang) {
        answers.language_confirmed = lang;
      }
      answers.completed = !skipQuestions;
      if (skipQuestions) {
        unresolvedQuestions.push("project-goals");
        unresolvedQuestions.push("coding-standards");
      }
      writeYamlObject(answersPath, answers);
      updatedFiles.push(toRelative(absoluteRoot, answersPath));
    }

    const syncStatePath = path.join(absoluteRoot, "ai/state/sync-state.yaml");
    if (fs.existsSync(syncStatePath)) {
      const syncState = readYamlObject<Record<string, unknown>>(syncStatePath);
      syncState.last_sync_at = new Date().toISOString();
      syncState.last_sync_result = "init_completed";
      writeYamlObject(syncStatePath, syncState);
      updatedFiles.push(toRelative(absoluteRoot, syncStatePath));
    }

    const resolveReport = this.resolver.resolve(absoluteRoot);
    if (!resolveReport.ok) {
      errors.push(
        ...resolveReport.errors.map((issue) => ({
          file: issue.file,
          message: issue.message,
          path: issue.path
        }))
      );
      warnings.push(
        ...resolveReport.warnings.map((issue) => ({
          file: issue.file,
          message: issue.message,
          path: issue.path
        }))
      );
    } else {
      updatedFiles.push(resolveReport.outputFile);
    }

    return {
      ok: errors.length === 0,
      projectRoot: absoluteRoot,
      createdFiles,
      updatedFiles,
      detected,
      unresolvedQuestions,
      warnings,
      errors
    };
  }
}

