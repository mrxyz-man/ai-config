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
const TASKS_BOARD_DIR = "ai/tasks/board";
const DEFAULT_EXTERNAL_BOARD_PATH = "ai/tasks/integrations/custom-board.yaml";

const STATUS_FILE_MAP = {
  inbox: "inbox.yaml",
  ready: "ready.yaml",
  in_progress: "in-progress.yaml",
  review: "review.yaml",
  done: "done.yaml"
} as const;

const TASK_STATUSES = Object.keys(STATUS_FILE_MAP) as Array<keyof typeof STATUS_FILE_MAP>;

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
  provider: z.enum(["custom"]).nullable(),
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

type ReconciliationPolicy = {
  conflictStrategy: "latest-timestamp" | "prefer-local" | "prefer-external";
  timestampField: "updated_at" | "created_at";
  onEqualTimestamp: "prefer-local" | "prefer-external";
  dedupeById: boolean;
};

const DEFAULT_RECONCILIATION_POLICY: ReconciliationPolicy = {
  conflictStrategy: "latest-timestamp",
  timestampField: "updated_at",
  onEqualTimestamp: "prefer-external",
  dedupeById: true
};

const SyncTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["task", "bug", "epic"]).default("task"),
  priority: z.enum(["P0", "P1", "P2", "P3"]).default("P2"),
  status: z.enum(["inbox", "ready", "in_progress", "review", "done"]).default("inbox"),
  description: z.string().default(""),
  acceptance_criteria: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  owner_role: z.string().optional(),
  estimate: z.string().optional(),
  created_at: z.string().default(() => new Date().toISOString()),
  updated_at: z.string().optional(),
  source: z.string().optional()
});

type SyncTask = z.infer<typeof SyncTaskSchema>;

const TasksBoardFileSchema = z.object({
  tasks: z.array(SyncTaskSchema).default([])
});

interface TaskMcpProvider {
  readonly name: McpProviderName;
  health(projectRoot: string, config: McpConfig): ProviderHealth;
  sync(projectRoot: string, config: McpConfig): ProviderHealth;
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

const toRelative = (projectRoot: string, absolutePath: string): string =>
  path.relative(projectRoot, absolutePath).replace(/\\/g, "/");

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

const readLocalBoardByStatus = (
  projectRoot: string
): Record<keyof typeof STATUS_FILE_MAP, SyncTask[]> => {
  const byStatus = {
    inbox: [] as SyncTask[],
    ready: [] as SyncTask[],
    in_progress: [] as SyncTask[],
    review: [] as SyncTask[],
    done: [] as SyncTask[]
  };

  for (const status of TASK_STATUSES) {
    const absolutePath = path.join(projectRoot, TASKS_BOARD_DIR, STATUS_FILE_MAP[status]);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    try {
      const parsed = TasksBoardFileSchema.safeParse(parseYamlFile(absolutePath));
      if (!parsed.success) {
        continue;
      }
      byStatus[status] = parsed.data.tasks.map((task) => ({
        ...task,
        status
      }));
    } catch {
      continue;
    }
  }

  return byStatus;
};

const writeLocalBoardByStatus = (
  projectRoot: string,
  byStatus: Record<keyof typeof STATUS_FILE_MAP, SyncTask[]>
): string[] => {
  const updatedFiles: string[] = [];
  for (const status of TASK_STATUSES) {
    const absolutePath = path.join(projectRoot, TASKS_BOARD_DIR, STATUS_FILE_MAP[status]);
    const payload = {
      tasks: byStatus[status].map((task) => {
        const { updated_at, ...rest } = task;
        return updated_at ? { ...rest, updated_at } : rest;
      })
    };
    writeYamlAtomic(absolutePath, payload);
    updatedFiles.push(toRelative(projectRoot, absolutePath));
  }
  return updatedFiles;
};

const flattenByStatus = (
  byStatus: Record<keyof typeof STATUS_FILE_MAP, SyncTask[]>
): SyncTask[] => TASK_STATUSES.flatMap((status) => byStatus[status]);

const readExternalTasks = (projectRoot: string, mcpConfig: McpConfig): SyncTask[] => {
  const externalRelativePath =
    typeof mcpConfig.provider_config.external_board_file === "string"
      ? mcpConfig.provider_config.external_board_file
      : DEFAULT_EXTERNAL_BOARD_PATH;
  const absolutePath = path.join(projectRoot, externalRelativePath);
  if (!fs.existsSync(absolutePath)) {
    return [];
  }
  const parsed = TasksBoardFileSchema.safeParse(parseYamlFile(absolutePath));
  if (!parsed.success) {
    return [];
  }
  return parsed.data.tasks;
};

const writeExternalTasks = (
  projectRoot: string,
  mcpConfig: McpConfig,
  tasks: SyncTask[]
): string => {
  const externalRelativePath =
    typeof mcpConfig.provider_config.external_board_file === "string"
      ? mcpConfig.provider_config.external_board_file
      : DEFAULT_EXTERNAL_BOARD_PATH;
  const absolutePath = path.join(projectRoot, externalRelativePath);
  writeYamlAtomic(absolutePath, { tasks });
  return toRelative(projectRoot, absolutePath);
};

const taskTimestamp = (task: SyncTask, field: ReconciliationPolicy["timestampField"]): number => {
  const source = field === "updated_at" ? task.updated_at ?? task.created_at : task.created_at;
  const value = Date.parse(source);
  return Number.isNaN(value) ? 0 : value;
};

const parseReconciliationPolicy = (
  mcpConfig: McpConfig,
  warnings: McpIntegrationMutationReport["warnings"]
): ReconciliationPolicy => {
  const rawPolicy =
    mcpConfig.provider_config &&
    typeof mcpConfig.provider_config === "object" &&
    !Array.isArray(mcpConfig.provider_config) &&
    "reconciliation" in mcpConfig.provider_config &&
    typeof mcpConfig.provider_config.reconciliation === "object" &&
    mcpConfig.provider_config.reconciliation !== null
      ? (mcpConfig.provider_config.reconciliation as Record<string, unknown>)
      : {};

  const nextPolicy: ReconciliationPolicy = {
    ...DEFAULT_RECONCILIATION_POLICY
  };

  const conflictStrategy = rawPolicy.conflict_strategy;
  if (
    conflictStrategy === "latest-timestamp" ||
    conflictStrategy === "prefer-local" ||
    conflictStrategy === "prefer-external"
  ) {
    nextPolicy.conflictStrategy = conflictStrategy;
  } else if (conflictStrategy !== undefined) {
    warnings.push({
      file: MCP_CONFIG_PATH,
      path: "provider_config.reconciliation.conflict_strategy",
      message: `Unsupported conflict strategy "${String(conflictStrategy)}"; fallback to ${DEFAULT_RECONCILIATION_POLICY.conflictStrategy}`
    });
  }

  const timestampField = rawPolicy.timestamp_field;
  if (timestampField === "updated_at" || timestampField === "created_at") {
    nextPolicy.timestampField = timestampField;
  } else if (timestampField !== undefined) {
    warnings.push({
      file: MCP_CONFIG_PATH,
      path: "provider_config.reconciliation.timestamp_field",
      message: `Unsupported timestamp field "${String(timestampField)}"; fallback to ${DEFAULT_RECONCILIATION_POLICY.timestampField}`
    });
  }

  const onEqualTimestamp = rawPolicy.on_equal_timestamp;
  if (onEqualTimestamp === "prefer-local" || onEqualTimestamp === "prefer-external") {
    nextPolicy.onEqualTimestamp = onEqualTimestamp;
  } else if (onEqualTimestamp !== undefined) {
    warnings.push({
      file: MCP_CONFIG_PATH,
      path: "provider_config.reconciliation.on_equal_timestamp",
      message: `Unsupported on_equal_timestamp "${String(onEqualTimestamp)}"; fallback to ${DEFAULT_RECONCILIATION_POLICY.onEqualTimestamp}`
    });
  }

  if (typeof rawPolicy.dedupe_by_id === "boolean") {
    nextPolicy.dedupeById = rawPolicy.dedupe_by_id;
  } else if (rawPolicy.dedupe_by_id !== undefined) {
    warnings.push({
      file: MCP_CONFIG_PATH,
      path: "provider_config.reconciliation.dedupe_by_id",
      message: `Unsupported dedupe_by_id value "${String(rawPolicy.dedupe_by_id)}"; fallback to ${String(DEFAULT_RECONCILIATION_POLICY.dedupeById)}`
    });
  }

  return nextPolicy;
};

const mergeTasksBidirectional = (
  localTasks: SyncTask[],
  externalTasks: SyncTask[],
  policy: ReconciliationPolicy
): { merged: SyncTask[]; conflicts: string[] } => {
  const conflicts: string[] = [];
  const localMap = new Map(
    localTasks.map((task) => [`${policy.dedupeById ? task.id : `${task.id}:${task.created_at}`}`, task])
  );
  const externalMap = new Map(
    externalTasks.map((task) => [`${policy.dedupeById ? task.id : `${task.id}:${task.created_at}`}`, task])
  );
  const ids = new Set([...localMap.keys(), ...externalMap.keys()]);
  const merged: SyncTask[] = [];

  for (const id of ids) {
    const local = localMap.get(id);
    const external = externalMap.get(id);
    if (!local && external) {
      merged.push(external);
      continue;
    }
    if (!external && local) {
      merged.push(local);
      continue;
    }
    if (!local || !external) {
      continue;
    }

    const localSerialized = JSON.stringify(local);
    const externalSerialized = JSON.stringify(external);
    if (localSerialized === externalSerialized) {
      merged.push(local);
      continue;
    }

    let resolved: SyncTask;
    if (policy.conflictStrategy === "prefer-local") {
      resolved = local;
    } else if (policy.conflictStrategy === "prefer-external") {
      resolved = external;
    } else {
      const localTime = taskTimestamp(local, policy.timestampField);
      const externalTime = taskTimestamp(external, policy.timestampField);
      if (localTime === externalTime) {
        resolved = policy.onEqualTimestamp === "prefer-local" ? local : external;
      } else {
        resolved = localTime > externalTime ? local : external;
      }
    }

    conflicts.push(
      `Conflict resolved for task "${id}" using ${policy.conflictStrategy} (${resolved === local ? "local" : "external"})`
    );
    merged.push(resolved);
  }

  merged.sort((left, right) => left.id.localeCompare(right.id));
  return { merged, conflicts };
};

const groupByStatus = (tasks: SyncTask[]): Record<keyof typeof STATUS_FILE_MAP, SyncTask[]> => {
  const grouped = {
    inbox: [] as SyncTask[],
    ready: [] as SyncTask[],
    in_progress: [] as SyncTask[],
    review: [] as SyncTask[],
    done: [] as SyncTask[]
  };
  for (const task of tasks) {
    grouped[task.status].push(task);
  }
  return grouped;
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

  constructor(providers: TaskMcpProvider[] = [new CustomMcpProvider()]) {
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
        provider_config: {
          strategy: "delegate",
          adapter_hint: "user-managed-mcp",
          reconciliation: {
            conflict_strategy: "latest-timestamp",
            timestamp_field: "updated_at",
            on_equal_timestamp: "prefer-external",
            dedupe_by_id: true
          }
        },
        notes: "Connected custom provider (external user-managed MCP)"
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

      const localByStatus = readLocalBoardByStatus(projectRoot);
      const localTasks = flattenByStatus(localByStatus);
      const externalTasks = readExternalTasks(projectRoot, mcpConfig);
      const warnings: McpIntegrationMutationReport["warnings"] = [];
      const errors: McpIntegrationMutationReport["errors"] = [];
      const updatedFiles: string[] = [];
      const reconciliationPolicy = parseReconciliationPolicy(mcpConfig, warnings);

      if (mcpConfig.sync_direction === "pull") {
        const grouped = groupByStatus(externalTasks);
        updatedFiles.push(...writeLocalBoardByStatus(projectRoot, grouped));
      } else if (mcpConfig.sync_direction === "push") {
        updatedFiles.push(writeExternalTasks(projectRoot, mcpConfig, localTasks));
      } else if (mcpConfig.sync_direction === "bidirectional") {
        const { merged, conflicts } = mergeTasksBidirectional(
          localTasks,
          externalTasks,
          reconciliationPolicy
        );
        const grouped = groupByStatus(merged);
        updatedFiles.push(...writeLocalBoardByStatus(projectRoot, grouped));
        updatedFiles.push(writeExternalTasks(projectRoot, mcpConfig, merged));
        warnings.push(
          ...conflicts.map((message) => ({
            file: MCP_CONFIG_PATH,
            message
          }))
        );
      } else {
        warnings.push({
          file: MCP_CONFIG_PATH,
          path: "sync_direction",
          message: "sync_direction is none; sync skipped"
        });
      }

      const syncResult = provider.sync(projectRoot, mcpConfig);
      if (!syncResult.ok) {
        errors.push({
          file: MCP_CONFIG_PATH,
          message: syncResult.message
        });
      }

      return {
        ok: errors.length === 0,
        provider: mcpConfig.provider,
        mode: mcpConfig.mode,
        syncDirection: mcpConfig.sync_direction,
        updatedFiles,
        warnings,
        errors
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
