import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";

import { AiConfigExplainer } from "./ai-config-explainer";

const copyAiFolderToTempProject = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-explain-test-"));
  const sourceAiDir = path.resolve(__dirname, "../../ai");
  const targetAiDir = path.join(tempRoot, "ai");
  fs.cpSync(sourceAiDir, targetAiDir, { recursive: true });
  return tempRoot;
};

describe("AiConfigExplainer", () => {
  it("returns explain matches for a valid key", () => {
    const projectRoot = copyAiFolderToTempProject();
    const explainer = new AiConfigExplainer();

    const report = explainer.explain(projectRoot, { key: "tasks.mode" });

    expect(report.ok).toBe(true);
    expect(report.matches).toHaveLength(1);
    expect(report.matches[0].module).toBe("tasks");
    expect(report.matches[0].sources).toContain("ai/tasks/config.yaml");
  });

  it("returns error for unknown key filter", () => {
    const projectRoot = copyAiFolderToTempProject();
    const explainer = new AiConfigExplainer();

    const report = explainer.explain(projectRoot, { key: "unknown.path" });

    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.message.includes("Unknown key path"))).toBe(true);
  });

  it("returns error for unknown module filter", () => {
    const projectRoot = copyAiFolderToTempProject();
    const explainer = new AiConfigExplainer();

    const report = explainer.explain(projectRoot, { module: "unknown-module" });

    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.message.includes("Unknown module"))).toBe(true);
  });
});
