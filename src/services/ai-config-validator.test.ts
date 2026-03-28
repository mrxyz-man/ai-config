import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";

import { validateAiConfigContracts } from "./ai-config-validator";

const createTempProject = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-test-"));
  const sourceAiDir = path.resolve(__dirname, "../../ai");
  const targetAiDir = path.join(tempRoot, "ai");
  fs.cpSync(sourceAiDir, targetAiDir, { recursive: true });
  return tempRoot;
};

describe("validateAiConfigContracts", () => {
  it("returns ok=true for current project baseline", () => {
    const projectRoot = path.resolve(__dirname, "../..");
    const report = validateAiConfigContracts(projectRoot);

    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.validatedFiles).toEqual(
      expect.arrayContaining([
        "ai/ai.yaml",
        "ai/modules.yaml",
        "ai/project.yaml",
        "ai/resolved.yaml",
        "ai/rules/ignore.yaml"
      ])
    );
  });

  it("fails when a required file is missing", () => {
    const projectRoot = createTempProject();
    fs.rmSync(path.join(projectRoot, "ai/modules.yaml"), { force: true });

    const report = validateAiConfigContracts(projectRoot);

    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.file === "ai/modules.yaml")).toBe(true);
  });

  it("fails when YAML content violates schema", () => {
    const projectRoot = createTempProject();
    const modulesPath = path.join(projectRoot, "ai/modules.yaml");
    const invalidModules = `version: "1.0"\nactive_modules:\n  - not-a-valid-module\nmodule_modes:\n  tasks: "local"\n`;
    fs.writeFileSync(modulesPath, invalidModules, "utf8");

    const report = validateAiConfigContracts(projectRoot);

    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.file === "ai/modules.yaml")).toBe(true);
  });
});

