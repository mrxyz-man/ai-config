import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "@jest/globals";

type CliJsonEnvelope = {
  ok: boolean;
  command: string;
  timestamp: string;
  data: Record<string, unknown>;
  warnings: unknown[];
  errors: unknown[];
};

const projectRoot = path.resolve(__dirname, "../..");
const distCliPath = path.join(projectRoot, "dist/cli.js");

const createTempProjectWithAiConfig = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-cli-e2e-"));
  const sourceAiDir = path.join(projectRoot, "ai");
  const targetAiDir = path.join(tempRoot, "ai");
  fs.cpSync(sourceAiDir, targetAiDir, { recursive: true });
  return tempRoot;
};

const runCliJson = (args: string[]): { status: number | null; envelope: CliJsonEnvelope } => {
  const run = spawnSync("node", [distCliPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8"
  });

  const stdout = run.stdout?.trim() ?? "";
  const envelope = JSON.parse(stdout) as CliJsonEnvelope;

  return {
    status: run.status,
    envelope
  };
};

describe("CLI contract + e2e smoke", () => {
  it("validate returns v1 JSON envelope on success", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson(["validate", "--cwd", tempProject, "--format", "json"]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.command).toBe("validate");
    expect(Array.isArray(result.envelope.warnings)).toBe(true);
    expect(Array.isArray(result.envelope.errors)).toBe(true);
    expect(Array.isArray(result.envelope.data.validatedFiles)).toBe(true);
  });

  it("validate returns exit code 3 when required config file is missing", () => {
    const tempProject = createTempProjectWithAiConfig();
    fs.rmSync(path.join(tempProject, "ai/modules.yaml"), { force: true });

    const result = runCliJson(["validate", "--cwd", tempProject, "--format", "json"]);

    expect(result.status).toBe(3);
    expect(result.envelope.ok).toBe(false);
    expect(result.envelope.command).toBe("validate");
    expect(result.envelope.errors.length).toBeGreaterThan(0);
  });

  it("resolve returns v1 JSON envelope and writes resolved file", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson(["resolve", "--cwd", tempProject, "--format", "json"]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.command).toBe("resolve");
    expect(typeof result.envelope.data.checksum).toBe("string");
    expect(result.envelope.data.outputFile).toBe("ai/resolved.yaml");
    expect(fs.existsSync(path.join(tempProject, "ai/resolved.yaml"))).toBe(true);
  });

  it("sync without --confirm is blocked by policy with exit code 5", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson(["sync", "--cwd", tempProject, "--format", "json"]);

    expect(result.status).toBe(5);
    expect(result.envelope.ok).toBe(false);
    expect(result.envelope.command).toBe("sync");
    expect(result.envelope.data.policyDecision).toBe("confirm-required");
  });

  it("init without --confirm is blocked by policy with exit code 5", () => {
    const tempProject = createTempProjectWithAiConfig();
    fs.rmSync(path.join(tempProject, "ai"), { recursive: true, force: true });

    const result = runCliJson(["init", "--cwd", tempProject, "--format", "json"]);

    expect(result.status).toBe(5);
    expect(result.envelope.ok).toBe(false);
    expect(result.envelope.command).toBe("init");
    expect(result.envelope.data.policyDecision).toBe("confirm-required");
  });

  it("init with --confirm bootstraps ai and returns envelope", () => {
    const tempProject = createTempProjectWithAiConfig();
    fs.rmSync(path.join(tempProject, "ai"), { recursive: true, force: true });

    const result = runCliJson([
      "init",
      "--cwd",
      tempProject,
      "--confirm",
      "--skip-questions",
      "--format",
      "json"
    ]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.command).toBe("init");
    expect(fs.existsSync(path.join(tempProject, "ai/ai.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(tempProject, "ai/resolved.yaml"))).toBe(true);
  });
});
