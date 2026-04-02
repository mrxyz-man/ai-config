import fs from "node:fs";
import path from "node:path";
import { stringify as toYaml } from "yaml";

import {
  AGENT_TO_BRIDGE_FILES,
  BRIDGE_CONTENT_BY_FILE,
  DEFAULT_AGENT,
  type AgentKey
} from "../core/agents";
import { ConfigInitializerPort, InitReport } from "../core/ports";
import { DEFAULT_CONFIG_ROOT, DEFAULT_TEMPLATE_ROOT } from "../core/config-paths";
import { DEFAULT_UI_LOCALE } from "../core/locales";

const resolveTemplateDir = (): string => path.resolve(__dirname, `../../${DEFAULT_TEMPLATE_ROOT}`);
const MANIFEST_FILE_NAME = "manifest.yaml";
const SCHEMA_VERSION = "1";
const TEMPLATE_VERSION = "0.1.0";

const writeBridgeFiles = (
  projectRoot: string,
  agent: AgentKey,
  createdFiles: string[]
): void => {
  const files = AGENT_TO_BRIDGE_FILES[agent] ?? AGENT_TO_BRIDGE_FILES.other;
  for (const fileName of files) {
    fs.writeFileSync(path.join(projectRoot, fileName), BRIDGE_CONTENT_BY_FILE[fileName], "utf8");
    createdFiles.push(fileName);
  }
};

const writeManifestFile = (params: {
  targetDir: string;
  selectedAgent: AgentKey;
  uiLocale: string;
  createdFiles: string[];
  errors: InitReport["errors"];
}): boolean => {
  const manifestFilePath = path.join(params.targetDir, MANIFEST_FILE_NAME);
  const manifestContent = toYaml({
    schema_version: SCHEMA_VERSION,
    created_at: new Date().toISOString(),
    selected_agent: params.selectedAgent,
    ui_locale: params.uiLocale,
    template_version: TEMPLATE_VERSION,
    qa_version: "1",
    qa_completed: false,
    qa_completed_at: null
  });

  fs.writeFileSync(manifestFilePath, manifestContent, "utf8");
  const stats = fs.statSync(manifestFilePath);
  if (stats.size <= 0) {
    params.errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/${MANIFEST_FILE_NAME}`,
      message: "Manifest file was created but is empty."
    });
    return false;
  }

  params.createdFiles.push(`${DEFAULT_CONFIG_ROOT}/${MANIFEST_FILE_NAME}`);
  return true;
};

export class AiConfigInitializer implements ConfigInitializerPort {
  init(
    projectRoot: string,
    options?: { force?: boolean; agent?: AgentKey; uiLocale?: string }
  ): InitReport {
    const absoluteRoot = path.resolve(projectRoot);
    const createdFiles: string[] = [];
    const warnings: InitReport["warnings"] = [];
    const errors: InitReport["errors"] = [];
    const selectedAgent = options?.agent ?? DEFAULT_AGENT;
    const uiLocale = (options?.uiLocale ?? DEFAULT_UI_LOCALE).trim() || DEFAULT_UI_LOCALE;

    const templateDir = resolveTemplateDir();
    const targetDir = path.join(absoluteRoot, DEFAULT_CONFIG_ROOT);
    const force = options?.force === true;

    if (!fs.existsSync(templateDir)) {
      errors.push({
        file: DEFAULT_TEMPLATE_ROOT,
        message: `Template directory is missing: ${templateDir}`
      });
      return {
        ok: false,
        projectRoot: absoluteRoot,
        selectedAgent,
        uiLocale,
        createdFiles,
        warnings,
        errors
      };
    }

    if (fs.existsSync(targetDir)) {
      if (!force) {
        errors.push({
          file: DEFAULT_CONFIG_ROOT,
          message: `Target ./${DEFAULT_CONFIG_ROOT} already exists. Use --force to re-bootstrap.`
        });
        return {
          ok: false,
          projectRoot: absoluteRoot,
          selectedAgent,
          uiLocale,
          createdFiles,
          warnings,
          errors
        };
      }

      warnings.push({
        file: DEFAULT_CONFIG_ROOT,
        message: `Existing ./${DEFAULT_CONFIG_ROOT} removed in force mode.`
      });
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    fs.mkdirSync(targetDir, { recursive: true });
    fs.cpSync(templateDir, targetDir, { recursive: true });
    createdFiles.push(`${DEFAULT_CONFIG_ROOT}/**`);
    let manifestOk = false;
    try {
      manifestOk = writeManifestFile({
        targetDir,
        selectedAgent,
        uiLocale,
        createdFiles,
        errors
      });
    } catch (error) {
      errors.push({
        file: `${DEFAULT_CONFIG_ROOT}/${MANIFEST_FILE_NAME}`,
        message: `Failed to write manifest: ${error instanceof Error ? error.message : "unknown error"}`
      });
    }
    writeBridgeFiles(absoluteRoot, selectedAgent, createdFiles);

    return {
      ok: manifestOk,
      projectRoot: absoluteRoot,
      selectedAgent,
      uiLocale,
      createdFiles,
      warnings,
      errors
    };
  }
}
