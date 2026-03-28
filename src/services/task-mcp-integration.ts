import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";
import { z } from "zod";

import {
  McpIntegrationMutationReport,
  McpIntegrationStatusReport,
  McpProviderName,
  McpSyncDirection,
  TaskMcpIntegrationPort,
  TaskMode
} from "../core/ports";

const TASKS_CONFIG_PATH = "ai/tasks/config.yaml";
const MCP_CONFIG_PATH = "ai/tasks/integrations/mcp.yaml";

const TaskConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["local", "hybrid", "remote-first"]),
  always_offer_task_creation: z.boolean(),
  epic_auto_decomposition: z.boolean(),
  statuses: z.array(z.string().min(1)).min(1),
  required_fields: z.array(z.string().min(1)).min(1)
});

const McpConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(["gitlab"]).nullable(),
  mode: z.enum(["local", "hybrid", "remote-first"]),
  sync_direction: z.enum(["none", "push", "pull", "bidirectional"]),
  notes: z.string().optional()
});

type TaskConfig = z.infer<typeof TaskConfigSchema>;
type McpConfig = z.infer<typeof McpConfigSchema>;

type ProviderHealth = {
  ok: boolean;
  message: string;
};

interface TaskMcpProvider {
  readonly name: McpProviderName;
  health(projectRoot: string, config: McpConfig): ProviderHealth;
  sync(projectRoot: string, config: McpConfig): ProviderHealth;
}

class GitLabMcpProvider implements TaskMcpProvider {
  readonly name: McpProviderName = "gitlab";

  health(projectRoot: string): ProviderHealth {
    const envPath = path.join(projectRoot, ".env");
    const hasEnv = fs.existsSync(envPath);
    if (!hasEnv) {
      return {
        ok: false,
        message: "GitLab adapter skeleton: missing .env (expected MCP credentials later)"
      };
    }

    return {
      ok: false,
      message: "GitLab adapter skeleton is configured but not implemented yet"
    };
  }

  sync(projectRoot: string, config: McpConfig): ProviderHealth {
    void projectRoot;
    void config;
    return {
      ok: false,
      message: "GitLab sync skeleton is not implemented yet"
    };
  }
}

const parseYamlFile = (absolutePath: string): unknown => {
  const raw = fs.readFileSync(absolutePath, "utf8");
  return YAML.parse(raw);
};

const readTaskConfig = (projectRoot: string): TaskConfig => {
  const absolutePath = path.join(projectRoot, TASKS_CONFIG_PATH);
  const parsed = parseYamlFile(absolutePath);
  return TaskConfigSchema.parse(parsed);
};

const readMcpConfig = (projectRoot: string): McpConfig => {
  const absolutePath = path.join(projectRoot, MCP_CONFIG_PATH);
  const parsed = parseYamlFile(absolutePath);
  return McpConfigSchema.parse(parsed);
};

const writeYamlAtomic = (absolutePath: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const temp = `${absolutePath}.tmp`;
  fs.writeFileSync(temp, YAML.stringify(value), "utf8");
  if (fs.existsSync(absolutePath)) {
    fs.rmSync(absolutePath, { force: true });
  }
  fs.renameSync(temp, absolutePath);
};

const buildErrorReport = (
  error: unknown,
  file: string
): McpIntegrationStatusReport => ({
  ok: false,
  provider: null,
  enabled: false,
  mode: "local",
  syncDirection: "none",
  warnings: [],
  errors: [
    {
      file,
      message: error instanceof Error ? error.message : "Unknown MCP integration error"
    }
  ]
});

export class TaskMcpIntegrationService implements TaskMcpIntegrationPort {
  private readonly providers: Map<McpProviderName, TaskMcpProvider>;

  constructor(providers: TaskMcpProvider[] = [new GitLabMcpProvider()]) {
    this.providers = new Map(providers.map((provider) => [provider.name, provider]));
  }

  status(projectRoot: string): McpIntegrationStatusReport {
    try {
      const taskConfig = readTaskConfig(projectRoot);
      const mcpConfig = readMcpConfig(projectRoot);
      const warnings: McpIntegrationStatusReport["warnings"] = [];
      const errors: McpIntegrationStatusReport["errors"] = [];

      let providerHealth: string | undefined;
      if (mcpConfig.enabled && mcpConfig.provider) {
        const provider = this.providers.get(mcpConfig.provider);
        if (!provider) {
          errors.push({
            file: MCP_CONFIG_PATH,
            path: "provider",
            message: `Unsupported MCP provider "${mcpConfig.provider}"`
          });
        } else {
          const health = provider.health(projectRoot, mcpConfig);
          providerHealth = health.message;
          if (!health.ok) {
            warnings.push({
              file: MCP_CONFIG_PATH,
              message: health.message
            });
          }
        }
      }

      if (taskConfig.mode !== mcpConfig.mode) {
        warnings.push({
          file: TASKS_CONFIG_PATH,
          path: "mode",
          message: `tasks mode (${taskConfig.mode}) differs from mcp mode (${mcpConfig.mode})`
        });
      }

      return {
        ok: errors.length === 0,
        provider: mcpConfig.provider,
        enabled: mcpConfig.enabled,
        mode: taskConfig.mode,
        syncDirection: mcpConfig.sync_direction,
        notes: mcpConfig.notes,
        providerHealth,
        warnings,
        errors
      };
    } catch (error) {
      return buildErrorReport(error, MCP_CONFIG_PATH);
    }
  }

  connect(
    projectRoot: string,
    input: { provider: McpProviderName; mode?: TaskMode }
  ): McpIntegrationMutationReport {
    try {
      const nextMode: TaskMode = input.mode ?? "hybrid";
      const nextDirection: McpSyncDirection =
        nextMode === "remote-first" ? "bidirectional" : nextMode === "hybrid" ? "pull" : "none";

      const taskConfig = readTaskConfig(projectRoot);
      taskConfig.mode = nextMode;

      const nextMcpConfig: McpConfig = {
        enabled: true,
        provider: input.provider,
        mode: nextMode,
        sync_direction: nextDirection,
        notes: "Connected via MCP integration service v1 skeleton"
      };

      const tasksAbsolutePath = path.join(projectRoot, TASKS_CONFIG_PATH);
      const mcpAbsolutePath = path.join(projectRoot, MCP_CONFIG_PATH);
      writeYamlAtomic(tasksAbsolutePath, taskConfig);
      writeYamlAtomic(mcpAbsolutePath, nextMcpConfig);

      return {
        ok: true,
        provider: input.provider,
        mode: nextMode,
        syncDirection: nextDirection,
        updatedFiles: [TASKS_CONFIG_PATH, MCP_CONFIG_PATH],
        warnings: [],
        errors: []
      };
    } catch (error) {
      return {
        ok: false,
        provider: null,
        mode: "local",
        syncDirection: "none",
        updatedFiles: [],
        warnings: [],
        errors: [
          {
            file: MCP_CONFIG_PATH,
            message: error instanceof Error ? error.message : "Failed to connect MCP provider"
          }
        ]
      };
    }
  }

  disconnect(projectRoot: string): McpIntegrationMutationReport {
    try {
      const taskConfig = readTaskConfig(projectRoot);
      taskConfig.mode = "local";

      const nextMcpConfig: McpConfig = {
        enabled: false,
        provider: null,
        mode: "local",
        sync_direction: "none",
        notes: "Disconnected from MCP provider"
      };

      const tasksAbsolutePath = path.join(projectRoot, TASKS_CONFIG_PATH);
      const mcpAbsolutePath = path.join(projectRoot, MCP_CONFIG_PATH);
      writeYamlAtomic(tasksAbsolutePath, taskConfig);
      writeYamlAtomic(mcpAbsolutePath, nextMcpConfig);

      return {
        ok: true,
        provider: null,
        mode: "local",
        syncDirection: "none",
        updatedFiles: [TASKS_CONFIG_PATH, MCP_CONFIG_PATH],
        warnings: [],
        errors: []
      };
    } catch (error) {
      return {
        ok: false,
        provider: null,
        mode: "local",
        syncDirection: "none",
        updatedFiles: [],
        warnings: [],
        errors: [
          {
            file: MCP_CONFIG_PATH,
            message: error instanceof Error ? error.message : "Failed to disconnect MCP provider"
          }
        ]
      };
    }
  }

  sync(projectRoot: string): McpIntegrationMutationReport {
    try {
      const mcpConfig = readMcpConfig(projectRoot);
      if (!mcpConfig.enabled || !mcpConfig.provider) {
        return {
          ok: false,
          provider: null,
          mode: "local",
          syncDirection: "none",
          updatedFiles: [],
          warnings: [],
          errors: [
            {
              file: MCP_CONFIG_PATH,
              message: "MCP sync is not enabled. Run `ai-config mcp connect <provider>` first."
            }
          ]
        };
      }

      const provider = this.providers.get(mcpConfig.provider);
      if (!provider) {
        return {
          ok: false,
          provider: mcpConfig.provider,
          mode: mcpConfig.mode,
          syncDirection: mcpConfig.sync_direction,
          updatedFiles: [],
          warnings: [],
          errors: [
            {
              file: MCP_CONFIG_PATH,
              path: "provider",
              message: `Unsupported MCP provider "${mcpConfig.provider}"`
            }
          ]
        };
      }

      const syncResult = provider.sync(projectRoot, mcpConfig);
      return {
        ok: syncResult.ok,
        provider: mcpConfig.provider,
        mode: mcpConfig.mode,
        syncDirection: mcpConfig.sync_direction,
        updatedFiles: [],
        warnings: syncResult.ok
          ? []
          : [
            {
              file: MCP_CONFIG_PATH,
              message: syncResult.message
            }
          ],
        errors: syncResult.ok
          ? []
          : [
            {
              file: MCP_CONFIG_PATH,
              message: syncResult.message
            }
          ]
      };
    } catch (error) {
      return {
        ok: false,
        provider: null,
        mode: "local",
        syncDirection: "none",
        updatedFiles: [],
        warnings: [],
        errors: [
          {
            file: MCP_CONFIG_PATH,
            message: error instanceof Error ? error.message : "Failed to sync MCP tasks"
          }
        ]
      };
    }
  }
}

