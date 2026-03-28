import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";

import { ToolCallingPolicyGate } from "./tool-calling-policy";

const createTempProject = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-policy-test-"));
  const sourcePolicy = path.resolve(__dirname, "../../ai/rules/tool-calling-policy.yaml");
  const targetPolicyDir = path.join(tempRoot, "ai/rules");
  fs.mkdirSync(targetPolicyDir, { recursive: true });
  fs.copyFileSync(sourcePolicy, path.join(targetPolicyDir, "tool-calling-policy.yaml"));
  return tempRoot;
};

describe("ToolCallingPolicyGate", () => {
  it("allows auto-run command", () => {
    const gate = new ToolCallingPolicyGate();
    const projectRoot = createTempProject();
    const result = gate.check(projectRoot, "resolve", false);

    expect(result.allowed).toBe(true);
    expect(result.decision).toBe("auto-run");
  });

  it("requires confirmation for gated command", () => {
    const gate = new ToolCallingPolicyGate();
    const projectRoot = createTempProject();
    const result = gate.check(projectRoot, "sync", false);

    expect(result.allowed).toBe(false);
    expect(result.decision).toBe("confirm-required");
  });

  it("allows confirmed command when confirmation is provided", () => {
    const gate = new ToolCallingPolicyGate();
    const projectRoot = createTempProject();
    const result = gate.check(projectRoot, "sync", true);

    expect(result.allowed).toBe(true);
    expect(result.decision).toBe("confirmed");
  });

  it("denies command listed in deny section", () => {
    const gate = new ToolCallingPolicyGate();
    const projectRoot = createTempProject();
    const result = gate.check(projectRoot, "unknown_command", false);

    expect(result.allowed).toBe(false);
    expect(result.decision).toBe("deny");
  });
});

