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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-cli-e2e-"));
  const sourceAiDir = path.join(projectRoot, "ai");
  const targetAiDir = path.join(tempRoot, "ai");
  fs.cpSync(sourceAiDir, targetAiDir, { recursive: true });
  return tempRoot;
};

const runCliJson = (args: string[]): { status: number | null; envelope: CliJsonEnvelope } => {
  const run = spawnSync("node", ["-r", "ts-node/register/transpile-only", srcCliPath, ...args], {
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

  it("validate supports scope and returns scoped data", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson([
      "validate",
      "--cwd",
      tempProject,
      "--scope",
      "tasks",
      "--format",
      "json"
    ]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.command).toBe("validate");
    expect(result.envelope.data.scope).toBe("tasks");
    expect(Array.isArray(result.envelope.data.validatedFiles)).toBe(true);
  });

  it("validate returns exit code 2 for invalid scope", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson([
      "validate",
      "--cwd",
      tempProject,
      "--scope",
      "invalid",
      "--format",
      "json"
    ]);

    expect(result.status).toBe(2);
    expect(result.envelope.ok).toBe(false);
    expect(result.envelope.command).toBe("validate");
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

  it("explain returns provenance matches in JSON envelope", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson([
      "explain",
      "--cwd",
      tempProject,
      "--key",
      "tasks.mode",
      "--format",
      "json"
    ]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.command).toBe("explain");
    expect(Array.isArray(result.envelope.data.matches)).toBe(true);
    expect((result.envelope.data.matches as unknown[]).length).toBe(1);
  });

  it("explain returns exit code 4 for unknown key", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson([
      "explain",
      "--cwd",
      tempProject,
      "--key",
      "unknown.path",
      "--format",
      "json"
    ]);

    expect(result.status).toBe(4);
    expect(result.envelope.ok).toBe(false);
    expect(result.envelope.command).toBe("explain");
    expect(result.envelope.errors.length).toBeGreaterThan(0);
  });

  it("sync without --confirm is blocked by policy with exit code 5", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson(["sync", "--cwd", tempProject, "--format", "json"]);

    expect(result.status).toBe(5);
    expect(result.envelope.ok).toBe(false);
    expect(result.envelope.command).toBe("sync");
    expect(result.envelope.data.policyDecision).toBe("confirm-required");
  });

  it("mcp status returns JSON envelope", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson(["mcp", "status", "--cwd", tempProject, "--format", "json"]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.command).toBe("mcp status");
  });

  it("mcp connect without --confirm is blocked by policy", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson([
      "mcp",
      "connect",
      "gitlab",
      "--cwd",
      tempProject,
      "--format",
      "json"
    ]);

    expect(result.status).toBe(5);
    expect(result.envelope.ok).toBe(false);
    expect(result.envelope.command).toBe("mcp connect");
  });

  it("mcp connect with --confirm updates integration config", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson([
      "mcp",
      "connect",
      "gitlab",
      "--cwd",
      tempProject,
      "--confirm",
      "--mode",
      "hybrid",
      "--format",
      "json"
    ]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.command).toBe("mcp connect");
    const mcpFile = fs.readFileSync(path.join(tempProject, "ai/tasks/integrations/mcp.yaml"), "utf8");
    expect(mcpFile).toContain("enabled: true");
    expect(mcpFile).toContain('provider: gitlab');
  });

  it("mcp connect custom with --confirm updates integration config", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson([
      "mcp",
      "connect",
      "custom",
      "--cwd",
      tempProject,
      "--confirm",
      "--mode",
      "hybrid",
      "--format",
      "json"
    ]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.command).toBe("mcp connect");
    expect(result.envelope.data.provider).toBe("custom");
    const mcpFile = fs.readFileSync(path.join(tempProject, "ai/tasks/integrations/mcp.yaml"), "utf8");
    expect(mcpFile).toContain("enabled: true");
    expect(mcpFile).toContain('provider: custom');
  });

  it("tasks list returns JSON envelope", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson(["tasks", "list", "--cwd", tempProject, "--format", "json"]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.command).toBe("tasks list");
    expect(Array.isArray(result.envelope.data.tasks)).toBe(true);
  });

  it("tasks enable without --confirm is blocked by policy", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson(["tasks", "enable", "--cwd", tempProject, "--format", "json"]);

    expect(result.status).toBe(5);
    expect(result.envelope.ok).toBe(false);
    expect(result.envelope.command).toBe("tasks enable");
  });

  it("tasks enable with --confirm updates config", () => {
    const tempProject = createTempProjectWithAiConfig();
    runCliJson(["tasks", "disable", "--cwd", tempProject, "--confirm", "--format", "json"]);
    const result = runCliJson(["tasks", "enable", "--cwd", tempProject, "--confirm", "--format", "json"]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    const tasksConfig = fs.readFileSync(path.join(tempProject, "ai/tasks/config.yaml"), "utf8");
    expect(tasksConfig).toContain("enabled: true");
  });

  it("tasks intake creates a task in inbox board", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson([
      "tasks",
      "intake",
      "Implement healthcheck endpoint",
      "--cwd",
      tempProject,
      "--format",
      "json"
    ]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.command).toBe("tasks intake");
    const inbox = fs.readFileSync(path.join(tempProject, "ai/tasks/board/inbox.yaml"), "utf8");
    expect(inbox).toContain("Implement healthcheck endpoint");
  });

  it("questions status returns JSON envelope", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson(["questions", "status", "--cwd", tempProject, "--format", "json"]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.command).toBe("questions status");
    expect(Array.isArray(result.envelope.data.missingBlocks)).toBe(true);
  });

  it("questions run without --confirm is blocked by policy", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson(["questions", "run", "--cwd", tempProject, "--format", "json"]);

    expect(result.status).toBe(5);
    expect(result.envelope.ok).toBe(false);
    expect(result.envelope.command).toBe("questions run");
  });

  it("questions run with --confirm updates language", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson([
      "questions",
      "run",
      "--cwd",
      tempProject,
      "--confirm",
      "--lang",
      "en",
      "--format",
      "json"
    ]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.data.language).toBe("en");
  });

  it("text check returns JSON envelope", () => {
    const tempProject = createTempProjectWithAiConfig();
    fs.writeFileSync(
      path.join(tempProject, "ai/questions/profiles/default.yaml"),
      'profile: "default"\nquestions: []\n',
      "utf8"
    );

    const result = runCliJson(["text", "check", "--cwd", tempProject, "--format", "json"]);

    expect(result.envelope.command).toBe("text check");
    expect(typeof result.envelope.ok).toBe("boolean");
  });

  it("sync with --confirm and --dry-run returns planned changes only", () => {
    const tempProject = createTempProjectWithAiConfig();
    const result = runCliJson([
      "sync",
      "--cwd",
      tempProject,
      "--confirm",
      "--dry-run",
      "--format",
      "json"
    ]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.command).toBe("sync");
    expect(result.envelope.data.dryRun).toBe(true);
    expect(Array.isArray(result.envelope.data.plannedChanges)).toBe(true);
    expect(Array.isArray(result.envelope.data.appliedChanges)).toBe(true);
    expect((result.envelope.data.appliedChanges as unknown[]).length).toBe(0);
  });

  it("sync with --confirm preserves ai/custom files", () => {
    const tempProject = createTempProjectWithAiConfig();
    const customFile = path.join(tempProject, "ai/custom/user-note.md");
    fs.writeFileSync(customFile, "user custom data", "utf8");

    const result = runCliJson(["sync", "--cwd", tempProject, "--confirm", "--format", "json"]);

    expect(result.status).toBe(0);
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.command).toBe("sync");
    expect(fs.readFileSync(customFile, "utf8")).toBe("user custom data");
    expect(Array.isArray(result.envelope.data.preservedCustomFiles)).toBe(true);
    expect((result.envelope.data.preservedCustomFiles as unknown[]).length).toBeGreaterThan(0);
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
