import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";
import YAML from "yaml";

import { TaskMcpIntegrationService } from "./task-mcp-integration";

const createTempProject = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-mcp-test-"));
  const sourceAiDir = path.resolve(__dirname, "../../ai");
  const targetAiDir = path.join(tempRoot, "ai");
  fs.cpSync(sourceAiDir, targetAiDir, { recursive: true });
  return tempRoot;
};

describe("TaskMcpIntegrationService", () => {
  const mcpConfigPath = (projectRoot: string): string =>
    path.join(projectRoot, "ai/tasks/integrations/mcp.yaml");
  const inboxPath = (projectRoot: string): string =>
    path.join(projectRoot, "ai/tasks/board/inbox.yaml");
  const externalBoardPath = (projectRoot: string): string =>
    path.join(projectRoot, "ai/tasks/integrations/custom-board.yaml");

  it("returns current mcp status", () => {
    const projectRoot = createTempProject();
    const service = new TaskMcpIntegrationService();

    const report = service.status(projectRoot);

    expect(report.ok).toBe(true);
    expect(report.enabled).toBe(false);
    expect(report.provider).toBeNull();
    expect(report.mode).toBe("local");
  });

  it("reports health/capabilities for custom provider", () => {
    const projectRoot = createTempProject();
    const service = new TaskMcpIntegrationService();
    service.connect(projectRoot, { provider: "custom", mode: "hybrid" });

    const report = service.status(projectRoot);

    expect(report.ok).toBe(true);
    expect(report.warnings).toHaveLength(0);
    expect(report.providerHealth).toContain("auth=ok");
    expect(report.providerHealth).toContain("tasks.sync");
  });

  it("connects custom provider and switches tasks mode", () => {
    const projectRoot = createTempProject();
    const service = new TaskMcpIntegrationService();

    const report = service.connect(projectRoot, { provider: "custom", mode: "hybrid" });

    expect(report.ok).toBe(true);
    const tasksYaml = YAML.parse(fs.readFileSync(path.join(projectRoot, "ai/tasks/config.yaml"), "utf8")) as {
      mode: string;
    };
    const mcpYaml = YAML.parse(
      fs.readFileSync(path.join(projectRoot, "ai/tasks/integrations/mcp.yaml"), "utf8")
    ) as { enabled: boolean; provider: string | null; mode: string };
    expect(tasksYaml.mode).toBe("hybrid");
    expect(mcpYaml.enabled).toBe(true);
    expect(mcpYaml.provider).toBe("custom");
    expect(mcpYaml.mode).toBe("hybrid");
  });

  it("disconnects provider and restores local mode", () => {
    const projectRoot = createTempProject();
    const service = new TaskMcpIntegrationService();
    service.connect(projectRoot, { provider: "custom", mode: "hybrid" });

    const report = service.disconnect(projectRoot);

    expect(report.ok).toBe(true);
    const tasksYaml = YAML.parse(fs.readFileSync(path.join(projectRoot, "ai/tasks/config.yaml"), "utf8")) as {
      mode: string;
    };
    expect(tasksYaml.mode).toBe("local");
  });

  it("writes provider_config for user-managed MCP strategy", () => {
    const projectRoot = createTempProject();
    const service = new TaskMcpIntegrationService();

    const report = service.connect(projectRoot, { provider: "custom", mode: "hybrid" });

    expect(report.ok).toBe(true);
    expect(report.provider).toBe("custom");
    const mcpYaml = YAML.parse(
      fs.readFileSync(path.join(projectRoot, "ai/tasks/integrations/mcp.yaml"), "utf8")
    ) as {
      provider: string | null;
      enabled: boolean;
      provider_config?: {
        strategy?: string;
        reconciliation?: {
          conflict_strategy?: string;
          timestamp_field?: string;
          on_equal_timestamp?: string;
          dedupe_by_id?: boolean;
        };
      };
    };
    expect(mcpYaml.enabled).toBe(true);
    expect(mcpYaml.provider).toBe("custom");
    expect(mcpYaml.provider_config?.strategy).toBe("delegate");
    expect(mcpYaml.provider_config?.reconciliation?.conflict_strategy).toBe("latest-timestamp");
    expect(mcpYaml.provider_config?.reconciliation?.timestamp_field).toBe("updated_at");
    expect(mcpYaml.provider_config?.reconciliation?.on_equal_timestamp).toBe("prefer-external");
    expect(mcpYaml.provider_config?.reconciliation?.dedupe_by_id).toBe(true);
  });

  it("returns no-op sync warning when provider is not connected", () => {
    const projectRoot = createTempProject();
    const service = new TaskMcpIntegrationService();

    const report = service.sync(projectRoot);

    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.warnings[0]?.message).toContain("Sync skipped");
  });

  it("sync push writes local tasks into external board", () => {
    const projectRoot = createTempProject();
    const service = new TaskMcpIntegrationService();
    service.connect(projectRoot, { provider: "custom", mode: "hybrid" });
    const mcpConfig = YAML.parse(fs.readFileSync(mcpConfigPath(projectRoot), "utf8")) as Record<
      string,
      unknown
    >;
    mcpConfig.sync_direction = "push";
    fs.writeFileSync(mcpConfigPath(projectRoot), YAML.stringify(mcpConfig), "utf8");

    fs.writeFileSync(
      inboxPath(projectRoot),
      YAML.stringify({
        tasks: [
          {
            id: "T100",
            title: "Push Task",
            type: "task",
            priority: "P1",
            status: "inbox",
            description: "From local board",
            acceptance_criteria: [],
            risks: [],
            dependencies: [],
            created_at: "2026-03-29T00:00:00.000Z"
          }
        ]
      }),
      "utf8"
    );

    const report = service.sync(projectRoot);
    const external = YAML.parse(fs.readFileSync(externalBoardPath(projectRoot), "utf8")) as {
      tasks: Array<{ id: string }>;
    };

    expect(report.ok).toBe(true);
    expect(external.tasks.some((task) => task.id === "T100")).toBe(true);
  });

  it("sync pull imports external tasks into local board", () => {
    const projectRoot = createTempProject();
    const service = new TaskMcpIntegrationService();
    service.connect(projectRoot, { provider: "custom", mode: "hybrid" });
    const mcpConfig = YAML.parse(fs.readFileSync(mcpConfigPath(projectRoot), "utf8")) as Record<
      string,
      unknown
    >;
    mcpConfig.sync_direction = "pull";
    fs.writeFileSync(mcpConfigPath(projectRoot), YAML.stringify(mcpConfig), "utf8");

    fs.writeFileSync(
      externalBoardPath(projectRoot),
      YAML.stringify({
        tasks: [
          {
            id: "T200",
            title: "External Task",
            type: "task",
            priority: "P2",
            status: "inbox",
            description: "From external board",
            acceptance_criteria: [],
            risks: [],
            dependencies: [],
            created_at: "2026-03-29T00:00:00.000Z"
          }
        ]
      }),
      "utf8"
    );

    const report = service.sync(projectRoot);
    const inbox = YAML.parse(fs.readFileSync(inboxPath(projectRoot), "utf8")) as {
      tasks: Array<{ id: string }>;
    };

    expect(report.ok).toBe(true);
    expect(inbox.tasks.some((task) => task.id === "T200")).toBe(true);
  });

  it("sync bidirectional merges tasks and emits conflict warning", () => {
    const projectRoot = createTempProject();
    const service = new TaskMcpIntegrationService();
    service.connect(projectRoot, { provider: "custom", mode: "hybrid" });
    const mcpConfig = YAML.parse(fs.readFileSync(mcpConfigPath(projectRoot), "utf8")) as Record<
      string,
      unknown
    >;
    mcpConfig.sync_direction = "bidirectional";
    fs.writeFileSync(mcpConfigPath(projectRoot), YAML.stringify(mcpConfig), "utf8");

    fs.writeFileSync(
      inboxPath(projectRoot),
      YAML.stringify({
        tasks: [
          {
            id: "T300",
            title: "Local",
            type: "task",
            priority: "P2",
            status: "inbox",
            description: "Local version",
            acceptance_criteria: [],
            risks: [],
            dependencies: [],
            created_at: "2026-03-29T00:00:00.000Z",
            updated_at: "2026-03-29T00:00:01.000Z"
          }
        ]
      }),
      "utf8"
    );

    fs.writeFileSync(
      externalBoardPath(projectRoot),
      YAML.stringify({
        tasks: [
          {
            id: "T300",
            title: "External",
            type: "task",
            priority: "P2",
            status: "inbox",
            description: "External version",
            acceptance_criteria: [],
            risks: [],
            dependencies: [],
            created_at: "2026-03-29T00:00:00.000Z",
            updated_at: "2026-03-29T00:00:02.000Z"
          }
        ]
      }),
      "utf8"
    );

    const report = service.sync(projectRoot);
    const inbox = YAML.parse(fs.readFileSync(inboxPath(projectRoot), "utf8")) as {
      tasks: Array<{ id: string; description: string }>;
    };

    expect(report.ok).toBe(true);
    expect(report.warnings.some((warning) => warning.message.includes("Conflict resolved"))).toBe(true);
    expect(inbox.tasks.find((task) => task.id === "T300")?.description).toBe("External version");
  });

  it("sync bidirectional respects prefer-local reconciliation policy", () => {
    const projectRoot = createTempProject();
    const service = new TaskMcpIntegrationService();
    service.connect(projectRoot, { provider: "custom", mode: "hybrid" });
    const mcpConfig = YAML.parse(fs.readFileSync(mcpConfigPath(projectRoot), "utf8")) as Record<
      string,
      unknown
    >;
    mcpConfig.sync_direction = "bidirectional";
    mcpConfig.provider_config = {
      strategy: "delegate",
      reconciliation: {
        conflict_strategy: "prefer-local",
        timestamp_field: "updated_at",
        on_equal_timestamp: "prefer-external",
        dedupe_by_id: true
      }
    };
    fs.writeFileSync(mcpConfigPath(projectRoot), YAML.stringify(mcpConfig), "utf8");

    fs.writeFileSync(
      inboxPath(projectRoot),
      YAML.stringify({
        tasks: [
          {
            id: "T310",
            title: "Local preferred",
            type: "task",
            priority: "P2",
            status: "inbox",
            description: "Local winner",
            acceptance_criteria: [],
            risks: [],
            dependencies: [],
            created_at: "2026-03-29T00:00:00.000Z",
            updated_at: "2026-03-29T00:00:01.000Z"
          }
        ]
      }),
      "utf8"
    );

    fs.writeFileSync(
      externalBoardPath(projectRoot),
      YAML.stringify({
        tasks: [
          {
            id: "T310",
            title: "External candidate",
            type: "task",
            priority: "P2",
            status: "inbox",
            description: "External loser",
            acceptance_criteria: [],
            risks: [],
            dependencies: [],
            created_at: "2026-03-29T00:00:00.000Z",
            updated_at: "2026-03-29T00:00:10.000Z"
          }
        ]
      }),
      "utf8"
    );

    const report = service.sync(projectRoot);
    const inbox = YAML.parse(fs.readFileSync(inboxPath(projectRoot), "utf8")) as {
      tasks: Array<{ id: string; description: string }>;
    };

    expect(report.ok).toBe(true);
    expect(report.warnings.some((warning) => warning.message.includes("prefer-local"))).toBe(true);
    expect(inbox.tasks.find((task) => task.id === "T310")?.description).toBe("Local winner");
  });
});
