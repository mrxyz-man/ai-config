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
  provider: z.enum(["gitlab", "custom"]).nullable(),
  mode: z.enum(["local", "hybrid", "remote-first"]),
  sync_direction: z.enum(["none", "push", "pull", "bidirectional"]),
  notes: z.string().optional(),
  provider_config: z.record(z.string(), z.unknown()).optional().default({})
});

type TaskConfig = z.infer<typeof TaskConfigSchema>;
type McpConfig = z.infer<typeof McpConfigSchema>;

type ProviderHealth = {
  ok: boolean;
  authOk: boolean;
  capabilities: string[];
  message: string;
};

interface TaskMcpProvider {
  readonly name: McpProviderName;
  health(projectRoot: string, config: McpConfig): ProviderHealth;
  sync(projectRoot: string, config: McpConfig): ProviderHealth;
}

class GitLabMcpProvider implements TaskMcpProvider {
  readonly name: McpProviderName = "gitlab";

  health(projectRoot: string, config: McpConfig): ProviderHealth {
    const apiUrl =
      typeof config.provider_config.api_url === "string"
        ? config.provider_config.api_url
        : "";
    const projectId =
      typeof config.provider_config.project_id === "string"
        ? config.provider_config.project_id
        : "";
    const tokenEnv =
      typeof config.provider_config.token_env === "string"
        ? config.provider_config.token_env
        : "GITLAB_TOKEN";

    if (!apiUrl || !projectId) {
      return {
        ok: false,
        authOk: false,
        capabilities: ["tasks.pull", "tasks.push", "tasks.sync"],
        message:
          "GitLab provider config incomplete: set provider_config.api_url and provider_config.project_id"
      };
    }

    const token = process.env[tokenEnv];
    if (!token) {
      return {
        ok: false,
        authOk: false,
        capabilities: ["tasks.pull", "tasks.push", "tasks.sync"],
        message: `Missing auth token in env var "${tokenEnv}"`
      };
    }

    const envPath = path.join(projectRoot, ".env");
    const hasEnv = fs.existsSync(envPath);
    if (!hasEnv) {
      return {
        ok: false,
        authOk: true,
        capabilities: ["tasks.pull", "tasks.push", "tasks.sync"],
        message: "GitLab adapter skeleton: .env file not found (optional if env is provided elsewhere)"
      };
    }

    return {
      ok: false,
      authOk: true,
      capabilities: ["tasks.pull", "tasks.push", "tasks.sync"],
      message: "GitLab adapter skeleton is configured but not implemented yet"
    };
  }

  sync(projectRoot: string, config: McpConfig): ProviderHealth {
    void projectRoot;
    void config;
    return {
      ok: false,
      authOk: true,
      capabilities: ["tasks.pull", "tasks.push", "tasks.sync"],
      message: "GitLab sync skeleton is not implemented yet"
    };
  }
}

class CustomMcpProvider implements TaskMcpProvider {
  readonly name: McpProviderName = "custom";

  health(projectRoot: string, config: McpConfig): ProviderHealth {
    void projectRoot;
    const strategy =
      typeof config.provider_config.strategy === "string"
        ? config.provider_config.strategy
        : "delegate";
    return {
      ok: true,
      authOk: true,
      capabilities: ["tasks.sync", "tasks.pull", "tasks.push"],
      message: `Custom MCP provider is user-managed (strategy: ${strategy})`
    };
  }

  sync(projectRoot: string, config: McpConfig): ProviderHealth {
    void projectRoot;
    void config;
    return {
      ok: true,
      authOk: true,
      capabilities: ["tasks.sync", "tasks.pull", "tasks.push"],
      message: "Custom MCP sync delegated to user-managed provider"
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

  constructor(providers: TaskMcpProvider[] = [new GitLabMcpProvider(), new CustomMcpProvider()]) {
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
          providerHealth = `${health.message} (auth=${health.authOk ? "ok" : "missing"}, capabilities=${health.capabilities.join(",")})`;
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
        provider_config:
          input.provider === "gitlab"
            ? {
              api_url: "https://gitlab.example.com/api/v4",
              project_id: "group/project",
              token_env: "GITLAB_TOKEN"
            }
            : {
              strategy: "delegate",
              adapter_hint: "user-managed-mcp"
            },
        notes:
          input.provider === "gitlab"
            ? "Connected via MCP integration service v1 skeleton"
            : "Connected custom provider (external user-managed MCP)"
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
        provider_config: {},
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
          ok: true,
          provider: null,
          mode: mcpConfig.mode,
          syncDirection: mcpConfig.sync_direction,
          updatedFiles: [],
          warnings: [
            {
              file: MCP_CONFIG_PATH,
              message:
                "MCP provider is not connected. Sync skipped; local task workflow remains active."
            }
          ],
          errors: []
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
