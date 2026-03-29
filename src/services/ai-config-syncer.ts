import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { ConfigResolverPort, ConfigSyncPort, SyncIssue, SyncReport } from "../core/ports";

const TEMPLATE_AI_DIR = path.resolve(__dirname, "../../ai");
const TEMPLATE_AI_CONFIG_PATH = path.join(TEMPLATE_AI_DIR, "ai.yaml");
const MIGRATION_STATE_PATH = "ai/state/migration-state.yaml";
const AI_CONFIG_PATH = "ai/ai.yaml";

const MANAGED_ROOTS = [
  "ai/ai.yaml",
  "ai/modules.yaml",
  "ai/project.yaml",
  "ai/rules",
  "ai/context",
  "ai/instructions",
  "ai/questions",
  "ai/text",
  "ai/tasks",
  "ai/agents"
];

const isUnderCustom = (relativePath: string): boolean =>
  relativePath === "ai/custom" || relativePath.startsWith("ai/custom/");

const toRelative = (projectRoot: string, absolutePath: string): string =>
  path.relative(projectRoot, absolutePath).replace(/\\/g, "/");

const listFilesRecursively = (absolutePath: string): string[] => {
  if (!fs.existsSync(absolutePath)) {
    return [];
  }
  const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(full));
    } else {
      files.push(full);
    }
  }
  return files;
};

const copyManagedPath = (
  templateAbsolutePath: string,
  targetAbsolutePath: string,
  plannedChanges: string[],
  appliedChanges: string[],
  projectRoot: string,
  dryRun: boolean
): void => {
  if (!fs.existsSync(templateAbsolutePath)) {
    return;
  }

  const stats = fs.statSync(templateAbsolutePath);
  if (stats.isDirectory()) {
    const templateFiles = listFilesRecursively(templateAbsolutePath);
    for (const templateFile of templateFiles) {
      const relativeFromTemplate = path
        .relative(templateAbsolutePath, templateFile)
        .replace(/\\/g, "/");
      const targetFile = path.join(targetAbsolutePath, relativeFromTemplate);
      const relativeTarget = toRelative(projectRoot, targetFile);
      if (isUnderCustom(relativeTarget)) {
        continue;
      }
      plannedChanges.push(relativeTarget);
      if (!dryRun) {
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.copyFileSync(templateFile, targetFile);
        appliedChanges.push(relativeTarget);
      }
    }
    return;
  }

  const relativeTarget = toRelative(projectRoot, targetAbsolutePath);
  if (isUnderCustom(relativeTarget)) {
    return;
  }
  plannedChanges.push(relativeTarget);
  if (!dryRun) {
    fs.mkdirSync(path.dirname(targetAbsolutePath), { recursive: true });
    fs.copyFileSync(templateAbsolutePath, targetAbsolutePath);
    appliedChanges.push(relativeTarget);
  }
};

const collectCustomFiles = (projectRoot: string): string[] => {
  const customDir = path.join(projectRoot, "ai/custom");
  return listFilesRecursively(customDir).map((absolutePath) => toRelative(projectRoot, absolutePath));
};

type MigrationRecord = {
  from: string;
  to: string;
  applied_at: string;
  steps: string[];
};

type MigrationState = {
  version: string;
  current_version: string;
  last_migrated_at: string | null;
  history: MigrationRecord[];
};

type MigrationContext = {
  projectRoot: string;
  appliedChanges: string[];
};

type MigrationStep = {
  from: string;
  to: string;
  run: (context: MigrationContext) => string[];
};

const parseVersion = (value: string): [number, number] | null => {
  const match = /^(\d+)\.(\d+)$/.exec(value.trim());
  if (!match) {
    return null;
  }
  return [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10)];
};

const compareVersions = (a: string, b: string): number => {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) {
    return a.localeCompare(b);
  }
  if (left[0] !== right[0]) {
    return left[0] - right[0];
  }
  return left[1] - right[1];
};

const readSchemaVersion = (projectRoot: string): string | null => {
  const aiConfigPath = path.join(projectRoot, AI_CONFIG_PATH);
  if (!fs.existsSync(aiConfigPath)) {
    return null;
  }
  try {
    const parsed = YAML.parse(fs.readFileSync(aiConfigPath, "utf8")) as Record<string, unknown> | null;
    if (parsed && typeof parsed.schema_version === "string") {
      return parsed.schema_version;
    }
    return null;
  } catch {
    return null;
  }
};

const readTemplateVersion = (): string => {
  const parsed = YAML.parse(fs.readFileSync(TEMPLATE_AI_CONFIG_PATH, "utf8")) as
    | Record<string, unknown>
    | null;
  if (parsed && typeof parsed.schema_version === "string") {
    return parsed.schema_version;
  }
  return "1.0";
};

const readMigrationState = (projectRoot: string, fallbackVersion: string): MigrationState => {
  const absolutePath = path.join(projectRoot, MIGRATION_STATE_PATH);
  if (!fs.existsSync(absolutePath)) {
    return {
      version: "1.0",
      current_version: fallbackVersion,
      last_migrated_at: null,
      history: []
    };
  }

  try {
    const parsed = YAML.parse(fs.readFileSync(absolutePath, "utf8")) as Partial<MigrationState> | null;
    return {
      version: typeof parsed?.version === "string" ? parsed.version : "1.0",
      current_version:
        typeof parsed?.current_version === "string" ? parsed.current_version : fallbackVersion,
      last_migrated_at: typeof parsed?.last_migrated_at === "string" ? parsed.last_migrated_at : null,
      history: Array.isArray(parsed?.history) ? (parsed?.history as MigrationRecord[]) : []
    };
  } catch {
    return {
      version: "1.0",
      current_version: fallbackVersion,
      last_migrated_at: null,
      history: []
    };
  }
};

const writeYamlAtomic = (absolutePath: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const temp = `${absolutePath}.tmp`;
  fs.writeFileSync(temp, YAML.stringify(value), "utf8");
  if (fs.existsSync(absolutePath)) {
    fs.rmSync(absolutePath, { force: true });
  }
  fs.renameSync(temp, absolutePath);
};

const writeMigrationState = (projectRoot: string, state: MigrationState, appliedChanges: string[]): void => {
  const absolutePath = path.join(projectRoot, MIGRATION_STATE_PATH);
  writeYamlAtomic(absolutePath, state);
  appliedChanges.push(MIGRATION_STATE_PATH);
};

const readYamlRecordSafe = (
  absolutePath: string,
  fallback: Record<string, unknown>,
  warnings: SyncIssue[],
  relativeFilePath: string
): Record<string, unknown> => {
  try {
    const parsed = YAML.parse(fs.readFileSync(absolutePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      warnings.push({
        file: relativeFilePath,
        message: "Malformed YAML object; fallback object was used during sync"
      });
      return { ...fallback };
    }
    return parsed as Record<string, unknown>;
  } catch {
    warnings.push({
      file: relativeFilePath,
      message: "Failed to parse YAML; fallback object was used during sync"
    });
    return { ...fallback };
  }
};

const migrationStep_0_9_to_1_0: MigrationStep = {
  from: "0.9",
  to: "1.0",
  run: () => [
    "migrated schema baseline from 0.9 to 1.0",
    "initialized migration state tracking"
  ]
};

const MIGRATION_STEPS: MigrationStep[] = [migrationStep_0_9_to_1_0];

const resolveMigrationPath = (fromVersion: string, toVersion: string): MigrationStep[] | null => {
  if (fromVersion === toVersion) {
    return [];
  }

  const steps: MigrationStep[] = [];
  let cursor = fromVersion;
  const guard = 16;
  for (let index = 0; index < guard; index += 1) {
    const next = MIGRATION_STEPS.find((step) => step.from === cursor);
    if (!next) {
      return null;
    }
    steps.push(next);
    cursor = next.to;
    if (cursor === toVersion) {
      return steps;
    }
  }

  return null;
};

export class AiConfigSyncer implements ConfigSyncPort {
  constructor(private readonly resolver: ConfigResolverPort) {}

  sync(
    projectRoot: string,
    options?: { dryRun?: boolean; withMigrations?: boolean; fromVersion?: string }
  ): SyncReport {
    const absoluteRoot = path.resolve(projectRoot);
    const dryRun = options?.dryRun === true;

    const plannedChanges: string[] = [];
    const appliedChanges: string[] = [];
    const preservedCustomFiles = collectCustomFiles(absoluteRoot);
    const warnings: SyncIssue[] = [];
    const errors: SyncIssue[] = [];
    const migrationSummary: string[] = [];

    if (!fs.existsSync(path.join(absoluteRoot, "ai"))) {
      errors.push({
        file: "ai",
        message: "Project is not initialized. Run `ai-config init` first."
      });
      return {
        ok: false,
        dryRun,
        appliedChanges,
        plannedChanges,
        preservedCustomFiles,
        migrationSummary,
        warnings,
        errors
      };
    }

    const targetVersion = readTemplateVersion();
    const detectedVersion = readSchemaVersion(absoluteRoot) ?? targetVersion;
    const sourceVersion = options?.fromVersion ?? detectedVersion;
    const migrationSteps = resolveMigrationPath(sourceVersion, targetVersion);

    if (compareVersions(sourceVersion, targetVersion) > 0) {
      errors.push({
        file: AI_CONFIG_PATH,
        path: "schema_version",
        message: `Source version ${sourceVersion} is newer than supported target ${targetVersion}`
      });
      return {
        ok: false,
        dryRun,
        appliedChanges,
        plannedChanges,
        preservedCustomFiles,
        migrationSummary,
        warnings,
        errors
      };
    }

    if (sourceVersion !== targetVersion) {
      if (!options?.withMigrations) {
        errors.push({
          file: AI_CONFIG_PATH,
          path: "schema_version",
          message: `Version mismatch (${sourceVersion} -> ${targetVersion}) requires --with-migrations`
        });
        return {
          ok: false,
          dryRun,
          appliedChanges,
          plannedChanges,
          preservedCustomFiles,
          migrationSummary,
          warnings,
          errors
        };
      }

      if (!migrationSteps) {
        errors.push({
          file: AI_CONFIG_PATH,
          path: "schema_version",
          message: `No compatible migration path from ${sourceVersion} to ${targetVersion}`
        });
        return {
          ok: false,
          dryRun,
          appliedChanges,
          plannedChanges,
          preservedCustomFiles,
          migrationSummary,
          warnings,
          errors
        };
      }

      migrationSummary.push(
        `migration required: ${sourceVersion} -> ${targetVersion} (${migrationSteps.length} step(s))`
      );
    } else if (options?.withMigrations) {
      migrationSummary.push("with-migrations enabled: no migration required (already on target version)");
    }

    if (options?.fromVersion) {
      migrationSummary.push(`from-version override: ${options.fromVersion}`);
    }

    for (const managedPath of MANAGED_ROOTS) {
      const templatePath = path.join(TEMPLATE_AI_DIR, managedPath.replace(/^ai\//, ""));
      const targetPath = path.join(absoluteRoot, managedPath);
      copyManagedPath(templatePath, targetPath, plannedChanges, appliedChanges, absoluteRoot, dryRun);
    }

    if (!dryRun) {
      if (sourceVersion !== targetVersion && migrationSteps) {
        const migrationState = readMigrationState(absoluteRoot, sourceVersion);
        for (const step of migrationSteps) {
          const stepMessages = step.run({ projectRoot: absoluteRoot, appliedChanges });
          const now = new Date().toISOString();
          migrationState.history.push({
            from: step.from,
            to: step.to,
            applied_at: now,
            steps: stepMessages
          });
          migrationState.current_version = step.to;
          migrationState.last_migrated_at = now;
          migrationSummary.push(...stepMessages.map((message) => `${step.from}->${step.to}: ${message}`));
        }
        writeMigrationState(absoluteRoot, migrationState, appliedChanges);
      }

      const syncStatePath = path.join(absoluteRoot, "ai/state/sync-state.yaml");
      if (fs.existsSync(syncStatePath)) {
        const syncState = readYamlRecordSafe(
          syncStatePath,
          { schema_version: "1.0", last_sync_at: null, last_sync_result: null },
          warnings,
          "ai/state/sync-state.yaml"
        );
        syncState.last_sync_at = new Date().toISOString();
        syncState.last_sync_result = "sync_completed";
        fs.writeFileSync(syncStatePath, YAML.stringify(syncState), "utf8");
        appliedChanges.push("ai/state/sync-state.yaml");
      }

      const lockPath = path.join(absoluteRoot, "ai/lock.yaml");
      if (fs.existsSync(lockPath)) {
        const lock = readYamlRecordSafe(
          lockPath,
          { schema_version: targetVersion, locked_at: null, modules: {} },
          warnings,
          "ai/lock.yaml"
        );
        lock.locked_at = new Date().toISOString();
        lock.schema_version = targetVersion;
        lock.modules = { source: "template-sync-v1" };
        fs.writeFileSync(lockPath, YAML.stringify(lock), "utf8");
        appliedChanges.push("ai/lock.yaml");
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
      }
      warnings.push(
        ...resolveReport.warnings.map((issue) => ({
          file: issue.file,
          message: issue.message,
          path: issue.path
        }))
      );
    }

    return {
      ok: errors.length === 0,
      dryRun,
      appliedChanges,
      plannedChanges,
      preservedCustomFiles,
      migrationSummary,
      warnings,
      errors
    };
  }
}
