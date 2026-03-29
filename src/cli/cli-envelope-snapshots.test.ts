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
const srcCliPath = path.join(projectRoot, "src/cli.ts");

const createTempProjectWithAiConfig = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-cli-snapshot-"));
  const sourceAiDir = path.join(projectRoot, "ai");
  const targetAiDir = path.join(tempRoot, "ai");
  fs.cpSync(sourceAiDir, targetAiDir, { recursive: true });
  return tempRoot;
};

const runCliJson = (args: string[]): CliJsonEnvelope => {
  const run = spawnSync("node", ["-r", "ts-node/register/transpile-only", srcCliPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  return JSON.parse(run.stdout?.trim() ?? "") as CliJsonEnvelope;
};

const normalizeEnvelope = (envelope: CliJsonEnvelope): Omit<CliJsonEnvelope, "timestamp"> & { timestamp: string } => ({
  ...envelope,
  timestamp: "<timestamp>"
});

describe("CLI JSON envelope snapshots", () => {
  it("validate envelope shape is stable", () => {
    const tempProject = createTempProjectWithAiConfig();
    const envelope = runCliJson(["validate", "--cwd", tempProject, "--scope", "schemas", "--format", "json"]);

    expect(normalizeEnvelope(envelope)).toMatchSnapshot();
  });

  it("mcp status envelope shape is stable", () => {
    const tempProject = createTempProjectWithAiConfig();
    const envelope = runCliJson(["mcp", "status", "--cwd", tempProject, "--format", "json"]);

    expect(normalizeEnvelope(envelope)).toMatchSnapshot();
  });

  it("questions status envelope shape is stable", () => {
    const tempProject = createTempProjectWithAiConfig();
    const envelope = runCliJson(["questions", "status", "--cwd", tempProject, "--format", "json"]);

    expect(normalizeEnvelope(envelope)).toMatchSnapshot();
  });
});

