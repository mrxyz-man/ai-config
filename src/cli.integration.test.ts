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
    expect(manifest.generator).toBe("ai-config");
    expect(manifest.managed_by).toBe("ai-config");
    expect(manifest.qa_required_on_start).toBe(true);
    expect(manifest.selected_agent).toBe("codex");
    expect(manifest.ui_locale).toBe("en");
    expect(result.stdout).toContain("\"preflightState\": \"fresh\"");
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
    expect(result.stdout).toContain("\"preflightState\": \"fresh\"");
    expect(result.stdout).toContain(`Missing ./.ai directory`);
  });

  test("validate fails with explicit foreign preflight when .ai is not managed", () => {
    const projectPath = createTempProject();
    const aiPath = path.join(projectPath, ".ai");
    fs.mkdirSync(aiPath, { recursive: true });
    fs.writeFileSync(path.join(aiPath, "manifest.yaml"), "schema_version: '1'\n", "utf8");

    const result = runCli(["validate", "--cwd", projectPath, "--format", "json"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("\"ok\": false");
    expect(result.stdout).toContain("\"preflightState\": \"foreign\"");
    expect(result.stdout).toContain("Detected foreign ./.ai");
  });

  test("validate warns when qa question language does not match ru locale", () => {
    const projectPath = createTempProject();
    const initResult = runCli([
      "init",
      "--cwd",
      projectPath,
      "--non-interactive",
      "--agent",
      "codex",
      "--ui-locale",
      "ru",
      "--format",
      "json"
    ]);
    expect(initResult.status).toBe(0);

    const qaPath = path.join(projectPath, ".ai", "qa.yaml");
    fs.writeFileSync(
      qaPath,
      [
        'schema_version: "1"',
        'status: "in_progress"',
        "questions:",
        '  - id: "q1"',
        '    question: "What is your project goal?"'
      ].join("\n"),
      "utf8"
    );

    const validateResult = runCli(["validate", "--cwd", projectPath, "--format", "json"]);
    expect(validateResult.status).toBe(0);
    expect(validateResult.stdout).toContain("\"ok\": true");
    expect(validateResult.stdout).toContain("\"warnings\": [");
    expect(validateResult.stdout).toContain("QA language mismatch");
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

  test("init fails on already managed .ai without --force and reports managed preflight", () => {
    const projectPath = createTempProject();
    const firstInit = runCli([
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
    expect(firstInit.status).toBe(0);

    const secondInit = runCli([
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

    expect(secondInit.status).toBe(1);
    expect(secondInit.stdout).toContain("\"preflightState\": \"managed\"");
    expect(secondInit.stdout).toContain("already managed by ai-config");
  });

  test("sync dry-run returns plan for managed project", () => {
    const projectPath = createTempProject();
    const initResult = runCli([
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
    expect(initResult.status).toBe(0);

    const readmePath = path.join(projectPath, ".ai", "README.md");
    fs.rmSync(readmePath, { force: true });

    const syncResult = runCli(["sync", "--cwd", projectPath, "--format", "json"]);
    expect(syncResult.status).toBe(0);
    expect(syncResult.stdout).toContain("\"ok\": true");
    expect(syncResult.stdout).toContain("\"preflightState\": \"managed\"");
    expect(syncResult.stdout).toContain("\"dryRun\": true");
    expect(syncResult.stdout).toContain("\"type\": \"create_file\"");
    expect(syncResult.stdout).toContain(".ai/README.md");
  });

  test("sync apply restores missing template file", () => {
    const projectPath = createTempProject();
    const initResult = runCli([
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
    expect(initResult.status).toBe(0);

    const readmePath = path.join(projectPath, ".ai", "README.md");
    fs.rmSync(readmePath, { force: true });
    expect(fs.existsSync(readmePath)).toBe(false);

    const syncResult = runCli(["sync", "--cwd", projectPath, "--no-dry-run", "--format", "json"]);
    expect(syncResult.status).toBe(0);
    expect(syncResult.stdout).toContain("\"ok\": true");
    expect(syncResult.stdout).toContain("\"dryRun\": false");
    expect(syncResult.stdout).toContain("\"createFiles\": 1");
    expect(syncResult.stdout).toContain("\"updateFiles\": 0");
    expect(fs.existsSync(readmePath)).toBe(true);
  });

  test("sync dry-run reports conflict_file for non-mergeable changed file", () => {
    const projectPath = createTempProject();
    const initResult = runCli([
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
    expect(initResult.status).toBe(0);

    const readmePath = path.join(projectPath, ".ai", "README.md");
    fs.writeFileSync(readmePath, "# custom\n", "utf8");

    const syncResult = runCli(["sync", "--cwd", projectPath, "--format", "json"]);
    expect(syncResult.status).toBe(0);
    expect(syncResult.stdout).toContain("\"type\": \"conflict_file\"");
    expect(syncResult.stdout).toContain(".ai/README.md");
    expect(syncResult.stdout).toContain("\"recommendations\": [");
    expect(syncResult.stdout).toContain("\"strategy\": \"manual_merge\"");
    expect(syncResult.stdout).toContain("ai-config validate --cwd");
  });

  test("sync --conflicts-only returns only conflict actions", () => {
    const projectPath = createTempProject();
    const initResult = runCli([
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
    expect(initResult.status).toBe(0);

    fs.writeFileSync(path.join(projectPath, ".ai", "README.md"), "# changed\n", "utf8");
    fs.rmSync(path.join(projectPath, ".ai", "project", "README.md"), { force: true });

    const syncResult = runCli([
      "sync",
      "--cwd",
      projectPath,
      "--conflicts-only",
      "--format",
      "json"
    ]);
    expect(syncResult.status).toBe(0);
    expect(syncResult.stdout).toContain("\"conflictsOnly\": true");
    expect(syncResult.stdout).toContain("\"type\": \"conflict_file\"");
    expect(syncResult.stdout).not.toContain("\"type\": \"create_file\"");
    expect(syncResult.stdout).toContain(".ai/README.md");
  });

  test("sync apply performs safe merge update for .aiignore", () => {
    const projectPath = createTempProject();
    const initResult = runCli([
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
    expect(initResult.status).toBe(0);

    const ignorePath = path.join(projectPath, ".ai", ".aiignore");
    const original = fs.readFileSync(ignorePath, "utf8");
    fs.writeFileSync(ignorePath, "custom-local-only\n", "utf8");

    const dryRun = runCli(["sync", "--cwd", projectPath, "--format", "json"]);
    expect(dryRun.status).toBe(0);
    expect(dryRun.stdout).toContain("\"type\": \"update_file\"");
    expect(dryRun.stdout).toContain(".ai/.aiignore");

    const apply = runCli(["sync", "--cwd", projectPath, "--no-dry-run", "--format", "json"]);
    expect(apply.status).toBe(0);
    expect(apply.stdout).toContain("\"updateFiles\": 1");

    const merged = fs.readFileSync(ignorePath, "utf8");
    expect(merged).toContain("custom-local-only");
    for (const templateLine of original.split(/\r?\n/)) {
      if (templateLine.trim().length === 0) {
        continue;
      }
      expect(merged).toContain(templateLine);
    }
  });

  test("sync fails on fresh project with preflight state", () => {
    const projectPath = createTempProject();
    const syncResult = runCli(["sync", "--cwd", projectPath, "--format", "json"]);

    expect(syncResult.status).toBe(1);
    expect(syncResult.stdout).toContain("\"ok\": false");
    expect(syncResult.stdout).toContain("\"preflightState\": \"fresh\"");
    expect(syncResult.stdout).toContain("Run init first");
  });

  test("sync rejects --conflicts-only in apply mode", () => {
    const projectPath = createTempProject();
    const initResult = runCli([
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
    expect(initResult.status).toBe(0);

    const syncResult = runCli([
      "sync",
      "--cwd",
      projectPath,
      "--no-dry-run",
      "--conflicts-only",
      "--format",
      "json"
    ]);
    expect(syncResult.status).toBe(1);
    expect(syncResult.stdout).toContain("\"ok\": false");
    expect(syncResult.stdout).toContain("--conflicts-only is supported only in dry-run mode");
  });

  test("init accepts extended non-interactive options", () => {
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
      "--profile",
      "standard",
      "--modules",
      "core,qa,project,rules,agents,skills,templates,mcp",
      "--task-mode",
      "assisted",
      "--questionnaire-on-init",
      "true",
      "--enable-mcp-providers",
      "context7,chrome-devtools",
      "--format",
      "json"
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("\"ok\": true");
    expect(result.stdout).toContain("\"profile\": \"standard\"");
    expect(result.stdout).toContain("\"modules\": [");
    expect(result.stdout).toContain("\"taskMode\": \"assisted\"");
    expect(result.stdout).toContain("\"questionnaireOnInit\": true");
    expect(result.stdout).toContain("\"enableMcpProviders\": [");
    expect(result.stdout).toContain("\"context7\"");

    const configRaw = fs.readFileSync(path.join(projectPath, ".ai", "config.yaml"), "utf8");
    const config = parseYaml(configRaw) as Record<string, unknown>;
    const profile = config.profile as Record<string, unknown>;
    const behavior = config.behavior as Record<string, unknown>;
    expect(profile.name).toBe("standard");
    expect(behavior.task_mode).toBe("assisted");
    expect(behavior.questionnaire_on_init).toBe(true);

    const modulesRaw = fs.readFileSync(path.join(projectPath, ".ai", "modules.yaml"), "utf8");
    const modulesConfig = parseYaml(modulesRaw) as Record<string, unknown>;
    const modules = modulesConfig.modules as Array<Record<string, unknown>>;
    const getModuleEnabled = (name: string): boolean =>
      modules.find((moduleDef) => moduleDef.name === name)?.enabled === true;
    const getModuleState = (name: string): string | undefined =>
      modules.find((moduleDef) => moduleDef.name === name)?.state as string | undefined;
    expect(getModuleEnabled("mcp")).toBe(true);
    expect(getModuleEnabled("skills")).toBe(true);
    expect(getModuleState("mcp")).toBe("bootstrap");
    expect(getModuleState("skills")).toBe("bootstrap");
    expect(getModuleState("logs")).toBe("disabled");

    const qaRaw = fs.readFileSync(path.join(projectPath, ".ai", "qa.yaml"), "utf8");
    const qa = parseYaml(qaRaw) as Record<string, unknown>;
    expect(qa.status).toBe("in_progress");

    const mcpRegistryRaw = fs.readFileSync(
      path.join(projectPath, ".ai", "mcp", "registry.yaml"),
      "utf8"
    );
    const mcpRegistry = parseYaml(mcpRegistryRaw) as Record<string, unknown>;
    const providers = mcpRegistry.providers as Array<Record<string, unknown>>;
    const getProviderEnabled = (id: string): boolean =>
      providers.find((providerDef) => providerDef.id === id)?.enabled === true;
    expect(getProviderEnabled("context7")).toBe(true);
    expect(getProviderEnabled("chrome-devtools")).toBe(true);
    expect(getProviderEnabled("gitlab-mcp-agent-server")).toBe(false);

    const orchestrationRaw = fs.readFileSync(
      path.join(projectPath, ".ai", "orchestration", "orchestration.yaml"),
      "utf8"
    );
    const orchestration = parseYaml(orchestrationRaw) as Record<string, unknown>;
    expect(orchestration.enabled).toBe(false);

    const memoryRaw = fs.readFileSync(path.join(projectPath, ".ai", "memory", "profile.yaml"), "utf8");
    const memory = parseYaml(memoryRaw) as Record<string, unknown>;
    expect(memory.enabled).toBe(false);

    const logsRaw = fs.readFileSync(path.join(projectPath, ".ai", "logs", "policy.yaml"), "utf8");
    const logs = parseYaml(logsRaw) as Record<string, unknown>;
    expect(logs.enabled).toBe(false);
  });

  test("sync provides recommendation for parse-error conflict in modules.yaml", () => {
    const projectPath = createTempProject();
    const initResult = runCli([
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
    expect(initResult.status).toBe(0);

    const modulesPath = path.join(projectPath, ".ai", "modules.yaml");
    fs.writeFileSync(modulesPath, "schema_version: '1'\nmodules: [invalid\n", "utf8");

    const syncResult = runCli(["sync", "--cwd", projectPath, "--format", "json"]);
    expect(syncResult.status).toBe(0);
    expect(syncResult.stdout).toContain("\"type\": \"conflict_file\"");
    expect(syncResult.stdout).toContain(".ai/modules.yaml");
    expect(syncResult.stdout).toContain("\"recommendations\": [");
    expect(syncResult.stdout).toContain("Parse error detected while attempting safe merge");
  });

  test("init fails with usage error on invalid profile in non-interactive mode", () => {
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
      "--profile",
      "enterprise",
      "--format",
      "json"
    ]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("\"ok\": false");
    expect(result.stdout).toContain("Invalid --profile value");
  });

  test("init fails with dependency error when skills enabled without required modules", () => {
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
      "--modules",
      "core,qa,skills",
      "--format",
      "json"
    ]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("\"ok\": false");
    expect(result.stdout).toContain("requires");
  });
});
