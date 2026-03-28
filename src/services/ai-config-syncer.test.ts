import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
});
