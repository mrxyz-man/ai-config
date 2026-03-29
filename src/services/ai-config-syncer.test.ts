import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import YAML from "yaml";
import { describe, expect, it } from "@jest/globals";

import { AiConfigResolver } from "./ai-config-resolver";
import { AiConfigSyncer } from "./ai-config-syncer";

const copyAiFolderToTempProject = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-sync-test-"));
  const sourceAiDir = path.resolve(__dirname, "../../ai");
  const targetAiDir = path.join(tempRoot, "ai");
  fs.cpSync(sourceAiDir, targetAiDir, { recursive: true });
  return tempRoot;
};

describe("AiConfigSyncer", () => {
  it("returns error when project is not initialized", () => {
    const tempProject = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-sync-test-no-ai-"));
    const syncer = new AiConfigSyncer(new AiConfigResolver());

    const report = syncer.sync(tempProject, { dryRun: true });

    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.file === "ai")).toBe(true);
  });

  it("dry-run reports planned changes and does not mutate files", () => {
    const projectRoot = copyAiFolderToTempProject();
    const managedFile = path.join(projectRoot, "ai/ai.yaml");
    const original = fs.readFileSync(managedFile, "utf8");
    fs.writeFileSync(managedFile, `${original}\n# local drift`, "utf8");

    const syncer = new AiConfigSyncer(new AiConfigResolver());
    const report = syncer.sync(projectRoot, { dryRun: true });

    expect(report.ok).toBe(true);
    expect(report.dryRun).toBe(true);
    expect(report.plannedChanges.length).toBeGreaterThan(0);
    expect(report.appliedChanges.length).toBe(0);
    expect(fs.readFileSync(managedFile, "utf8")).toContain("# local drift");
  });

  it("sync overwrites managed files and preserves custom files", () => {
    const projectRoot = copyAiFolderToTempProject();
    const managedFile = path.join(projectRoot, "ai/ai.yaml");
    const templateManaged = fs.readFileSync(path.resolve(__dirname, "../../ai/ai.yaml"), "utf8");
    fs.writeFileSync(managedFile, "version: broken\n", "utf8");

    const customFile = path.join(projectRoot, "ai/custom/local-note.md");
    fs.writeFileSync(customFile, "do-not-touch", "utf8");

    const syncer = new AiConfigSyncer(new AiConfigResolver());
    const report = syncer.sync(projectRoot);

    expect(report.ok).toBe(true);
    expect(report.appliedChanges.length).toBeGreaterThan(0);
    expect(report.preservedCustomFiles).toContain("ai/custom/local-note.md");
    expect(fs.readFileSync(customFile, "utf8")).toBe("do-not-touch");
    expect(fs.readFileSync(managedFile, "utf8")).toBe(templateManaged);
    expect(fs.existsSync(path.join(projectRoot, "ai/resolved.yaml"))).toBe(true);
  });

  it("fails on version mismatch when --with-migrations is not enabled", () => {
    const projectRoot = copyAiFolderToTempProject();
    const aiConfigPath = path.join(projectRoot, "ai/ai.yaml");
    const aiConfig = YAML.parse(fs.readFileSync(aiConfigPath, "utf8")) as Record<string, unknown>;
    aiConfig.schema_version = "0.9";
    fs.writeFileSync(aiConfigPath, YAML.stringify(aiConfig), "utf8");

    const syncer = new AiConfigSyncer(new AiConfigResolver());
    const report = syncer.sync(projectRoot);

    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.message.includes("requires --with-migrations"))).toBe(true);
  });

  it("applies versioned migration and writes migration-state when enabled", () => {
    const projectRoot = copyAiFolderToTempProject();
    const aiConfigPath = path.join(projectRoot, "ai/ai.yaml");
    const aiConfig = YAML.parse(fs.readFileSync(aiConfigPath, "utf8")) as Record<string, unknown>;
    aiConfig.schema_version = "0.9";
    fs.writeFileSync(aiConfigPath, YAML.stringify(aiConfig), "utf8");

    const syncer = new AiConfigSyncer(new AiConfigResolver());
    const report = syncer.sync(projectRoot, { withMigrations: true });

    expect(report.ok).toBe(true);
    expect(report.migrationSummary.some((item) => item.includes("migration required: 0.9 -> 1.0"))).toBe(true);
    expect(report.migrationSummary.some((item) => item.includes("initialized migration state tracking"))).toBe(true);
    expect(report.appliedChanges).toContain("ai/state/migration-state.yaml");
    const migrationState = YAML.parse(
      fs.readFileSync(path.join(projectRoot, "ai/state/migration-state.yaml"), "utf8")
    ) as {
      current_version: string;
      history: Array<{ from: string; to: string; steps: string[] }>;
    };
    expect(migrationState.current_version).toBe("1.0");
    expect(migrationState.history.some((item) => item.from === "0.9" && item.to === "1.0")).toBe(true);
  });

  it("recovers from malformed sync-state and lock files", () => {
    const projectRoot = copyAiFolderToTempProject();
    fs.writeFileSync(path.join(projectRoot, "ai/state/sync-state.yaml"), "last_sync_at: [broken", "utf8");
    fs.writeFileSync(path.join(projectRoot, "ai/lock.yaml"), "modules: [broken", "utf8");

    const syncer = new AiConfigSyncer(new AiConfigResolver());
    const report = syncer.sync(projectRoot);

    expect(report.ok).toBe(true);
    expect(report.warnings.some((warning) => warning.file === "ai/state/sync-state.yaml")).toBe(true);
    expect(report.warnings.some((warning) => warning.file === "ai/lock.yaml")).toBe(true);
    expect(report.appliedChanges).toContain("ai/state/sync-state.yaml");
    expect(report.appliedChanges).toContain("ai/lock.yaml");
  });
});
