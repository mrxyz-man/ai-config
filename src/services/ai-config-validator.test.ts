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
    expect(report.scope).toBe("all");
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

  it("validates only tasks scope and catches missing required status", () => {
    const projectRoot = createTempProject();
    fs.writeFileSync(
      path.join(projectRoot, "ai/tasks/config.yaml"),
      [
        "enabled: true",
        'mode: "local"',
        "always_offer_task_creation: true",
        "epic_auto_decomposition: true",
        "statuses:",
        "  - inbox",
        "  - ready",
        "  - review",
        "  - done",
        "required_fields:",
        "  - title",
        "  - type",
        "  - description"
      ].join("\n"),
      "utf8"
    );

    const report = validateAiConfigContracts(projectRoot, { scope: "tasks" });

    expect(report.scope).toBe("tasks");
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.message.includes("Missing required task status"))).toBe(
      true
    );
    expect(report.validatedFiles).toEqual(["ai/tasks/config.yaml"]);
  });

  it("validates only text scope and catches utf-8 mismatch", () => {
    const projectRoot = createTempProject();
    fs.writeFileSync(
      path.join(projectRoot, "ai/text/encoding.yaml"),
      [
        'default_encoding: "windows-1251"',
        "enforce_utf8: true",
        "reject_unknown_encoding: true",
        "mojibake_signals:",
        '  - "Гђ"'
      ].join("\n"),
      "utf8"
    );

    const report = validateAiConfigContracts(projectRoot, { scope: "text" });

    expect(report.scope).toBe("text");
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.path === "default_encoding")).toBe(true);
    expect(report.validatedFiles).toEqual(
      expect.arrayContaining(["ai/text/encoding.yaml", "ai/text/locale.yaml"])
    );
  });
});
