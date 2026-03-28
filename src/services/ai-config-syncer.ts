import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { ConfigResolverPort, ConfigSyncPort, SyncIssue, SyncReport } from "../core/ports";

const TEMPLATE_AI_DIR = path.resolve(__dirname, "../../ai");

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
  "ai/agents",
  "ai/state/sync-state.yaml",
  "ai/lock.yaml"
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

    if (options?.withMigrations) {
      migrationSummary.push("with-migrations flag accepted (no-op in current v1 baseline)");
    }
    if (options?.fromVersion) {
      migrationSummary.push(`from-version hint received: ${options.fromVersion}`);
    }

    for (const managedPath of MANAGED_ROOTS) {
      const templatePath = path.join(TEMPLATE_AI_DIR, managedPath.replace(/^ai\//, ""));
      const targetPath = path.join(absoluteRoot, managedPath);
      copyManagedPath(templatePath, targetPath, plannedChanges, appliedChanges, absoluteRoot, dryRun);
    }

    if (!dryRun) {
      const syncStatePath = path.join(absoluteRoot, "ai/state/sync-state.yaml");
      if (fs.existsSync(syncStatePath)) {
        const syncState = YAML.parse(fs.readFileSync(syncStatePath, "utf8")) as Record<string, unknown>;
        syncState.last_sync_at = new Date().toISOString();
        syncState.last_sync_result = "sync_completed";
        fs.writeFileSync(syncStatePath, YAML.stringify(syncState), "utf8");
        appliedChanges.push("ai/state/sync-state.yaml");
      }

      const lockPath = path.join(absoluteRoot, "ai/lock.yaml");
      if (fs.existsSync(lockPath)) {
        const lock = YAML.parse(fs.readFileSync(lockPath, "utf8")) as Record<string, unknown>;
        lock.locked_at = new Date().toISOString();
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

