import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parse as parseYaml } from "yaml";

type CliResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

const REPO_ROOT = path.resolve(__dirname, "..");
const runCli = (args: string[]): CliResult => {
  const result = spawnSync(
    process.execPath,
    ["-r", "ts-node/register", "src/cli.ts", ...args],
    {
      cwd: REPO_ROOT,
      encoding: "utf8"
    }
  );

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
};

const createTempProject = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-test-"));

describe("CLI smoke flows", () => {
  test("init --non-interactive creates .ai manifest and AGENTS bridge", () => {
    const projectPath = createTempProject();
    const result = runCli([
      "init",
      "--cwd",
      projectPath,
      "--non-interactive",
      "--agent",
      "codex",
      "--ui-locale",
      "en",
      "--format",
      "json"
    ]);

    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(projectPath, ".ai", "manifest.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "AGENTS.md"))).toBe(true);

    const manifestRaw = fs.readFileSync(path.join(projectPath, ".ai", "manifest.yaml"), "utf8");
    const manifest = parseYaml(manifestRaw) as Record<string, unknown>;
    expect(manifest.selected_agent).toBe("codex");
    expect(manifest.ui_locale).toBe("en");
  });

  test("validate returns success on initialized project", () => {
    const projectPath = createTempProject();
    const initResult = runCli([
      "init",
      "--cwd",
      projectPath,
      "--non-interactive",
      "--agent",
      "claude",
      "--ui-locale",
      "ru",
      "--format",
      "json"
    ]);
    expect(initResult.status).toBe(0);

    const validateResult = runCli(["validate", "--cwd", projectPath, "--format", "json"]);
    expect(validateResult.status).toBe(0);
    expect(validateResult.stdout).toContain("\"ok\": true");
  });

  test("validate fails when .ai is missing", () => {
    const projectPath = createTempProject();
    const result = runCli(["validate", "--cwd", projectPath, "--format", "json"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("\"ok\": false");
    expect(result.stdout).toContain(`Missing ./.ai directory`);
  });

  test("init --non-interactive fails with usage error when required flags are missing", () => {
    const projectPath = createTempProject();
    const result = runCli([
      "init",
      "--cwd",
      projectPath,
      "--non-interactive",
      "--ui-locale",
      "en",
      "--format",
      "json"
    ]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("\"ok\": false");
    expect(result.stdout).toContain("Missing required option --agent");
  });
});
