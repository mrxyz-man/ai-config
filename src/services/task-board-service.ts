import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";
import { z } from "zod";

import {
  TaskBoardPort,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  TaskType,
  TaskMode,
  TasksIntakeReport,
  TasksListReport,
  TasksToggleReport
} from "../core/ports";

const TASKS_CONFIG_PATH = "ai/tasks/config.yaml";
const TASKS_BOARD_DIR = "ai/tasks/board";

const STATUS_FILE_MAP: Record<TaskStatus, string> = {
  inbox: "inbox.yaml",
  ready: "ready.yaml",
  in_progress: "in-progress.yaml",
  review: "review.yaml",
  done: "done.yaml"
};

const TaskConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["local", "hybrid", "remote-first"]),
  always_offer_task_creation: z.boolean(),
  epic_auto_decomposition: z.boolean(),
  statuses: z.array(z.enum(["inbox", "ready", "in_progress", "review", "done"])).min(1),
  required_fields: z.array(z.string().min(1)).min(1)
});

const TaskRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["task", "bug", "epic"]),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  status: z.enum(["inbox", "ready", "in_progress", "review", "done"]),
  description: z.string().min(1),
  acceptance_criteria: z.array(z.string()),
  risks: z.array(z.string()),
  dependencies: z.array(z.string()),
  owner_role: z.string().optional(),
  estimate: z.string().optional(),
  created_at: z.string().min(1),
  source: z.string().optional()
});

const TasksBoardFileSchema = z.object({
  tasks: z.array(TaskRecordSchema)
});

type TaskConfig = z.infer<typeof TaskConfigSchema>;
type TasksBoardFile = z.infer<typeof TasksBoardFileSchema>;

const parseYaml = (absolutePath: string): unknown => YAML.parse(fs.readFileSync(absolutePath, "utf8"));

const writeYamlAtomic = (absolutePath: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const tempPath = `${absolutePath}.tmp`;
  fs.writeFileSync(tempPath, YAML.stringify(value), "utf8");
  if (fs.existsSync(absolutePath)) {
    fs.rmSync(absolutePath, { force: true });
  }
  fs.renameSync(tempPath, absolutePath);
};

const readTaskConfig = (projectRoot: string): TaskConfig => {
  const absolutePath = path.join(projectRoot, TASKS_CONFIG_PATH);
  return TaskConfigSchema.parse(parseYaml(absolutePath));
};

const writeTaskConfig = (projectRoot: string, config: TaskConfig): void => {
  const absolutePath = path.join(projectRoot, TASKS_CONFIG_PATH);
  writeYamlAtomic(absolutePath, config);
};

const readBoardFile = (projectRoot: string, status: TaskStatus): TasksBoardFile => {
  const absolutePath = path.join(projectRoot, TASKS_BOARD_DIR, STATUS_FILE_MAP[status]);
  if (!fs.existsSync(absolutePath)) {
    return { tasks: [] };
  }
  const parsed = parseYaml(absolutePath);
  const result = TasksBoardFileSchema.safeParse(parsed);
  if (!result.success) {
    return { tasks: [] };
  }
  return result.data;
};

const writeBoardFile = (projectRoot: string, status: TaskStatus, board: TasksBoardFile): void => {
  const absolutePath = path.join(projectRoot, TASKS_BOARD_DIR, STATUS_FILE_MAP[status]);
  writeYamlAtomic(absolutePath, board);
};

const normalizeTitle = (text: string): string => {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 72) {
    return cleaned;
  }
  return `${cleaned.slice(0, 69)}...`;
};

const inferTaskType = (text: string, explicitType?: TaskType): TaskType => {
  if (explicitType) {
    return explicitType;
  }
  const normalized = text.toLowerCase();
  if (normalized.includes("bug") || normalized.includes("fix")) {
    return "bug";
  }
  if (normalized.includes("epic")) {
    return "epic";
  }
  return "task";
};

const inferPriority = (text: string, explicitPriority?: TaskPriority): TaskPriority => {
  if (explicitPriority) {
    return explicitPriority;
  }
  const normalized = text.toLowerCase();
  if (normalized.includes("urgent") || normalized.includes("critical")) {
    return "P0";
  }
  if (normalized.includes("important")) {
    return "P1";
  }
  return "P2";
};

const nextTaskId = (tasks: TaskRecord[]): string => {
  let max = 0;
  for (const task of tasks) {
    const match = /^T(\d+)$/.exec(task.id);
    if (!match) {
      continue;
    }
    const value = Number.parseInt(match[1], 10);
    if (!Number.isNaN(value) && value > max) {
      max = value;
    }
  }
  return `T${max + 1}`;
};

const collectAllTasks = (projectRoot: string): TaskRecord[] => {
  const all: TaskRecord[] = [];
  for (const status of Object.keys(STATUS_FILE_MAP) as TaskStatus[]) {
    const board = readBoardFile(projectRoot, status);
    all.push(...board.tasks);
  }
  return all;
};

const baseToggleReport = (
  enabled: boolean,
  mode: TaskMode,
  updatedFiles: string[] = []
): TasksToggleReport => ({
  ok: true,
  enabled,
  mode,
  updatedFiles,
  warnings: [],
  errors: []
});

export class TaskBoardService implements TaskBoardPort {
  enable(projectRoot: string): TasksToggleReport {
    try {
      const config = readTaskConfig(projectRoot);
      config.enabled = true;
      writeTaskConfig(projectRoot, config);
      return baseToggleReport(true, config.mode, [TASKS_CONFIG_PATH]);
    } catch (error) {
      return {
        ok: false,
        enabled: false,
        mode: "local",
        updatedFiles: [],
        warnings: [],
        errors: [
          {
            file: TASKS_CONFIG_PATH,
            message: error instanceof Error ? error.message : "Failed to enable tasks"
          }
        ]
      };
    }
  }

  disable(projectRoot: string): TasksToggleReport {
    try {
      const config = readTaskConfig(projectRoot);
      config.enabled = false;
      writeTaskConfig(projectRoot, config);
      return baseToggleReport(false, config.mode, [TASKS_CONFIG_PATH]);
    } catch (error) {
      return {
        ok: false,
        enabled: false,
        mode: "local",
        updatedFiles: [],
        warnings: [],
        errors: [
          {
            file: TASKS_CONFIG_PATH,
            message: error instanceof Error ? error.message : "Failed to disable tasks"
          }
        ]
      };
    }
  }

  intake(
    projectRoot: string,
    input: { text: string; type?: TaskType; priority?: TaskPriority; source?: string }
  ): TasksIntakeReport {
    try {
      const text = input.text.trim();
      if (!text) {
        return {
          ok: false,
          task: null,
          targetStatus: "inbox",
          updatedFiles: [],
          warnings: [],
          errors: [{ file: TASKS_CONFIG_PATH, message: "Task text must not be empty" }]
        };
      }

      const config = readTaskConfig(projectRoot);
      if (!config.enabled) {
        return {
          ok: false,
          task: null,
          targetStatus: "inbox",
          updatedFiles: [],
          warnings: [],
          errors: [{ file: TASKS_CONFIG_PATH, message: "Tasks are disabled. Run `ai-config tasks enable`." }]
        };
      }

      const status: TaskStatus = "inbox";
      const board = readBoardFile(projectRoot, status);
      const allTasks = collectAllTasks(projectRoot);
      const taskType = inferTaskType(text, input.type);

      const newTask: TaskRecord = {
        id: nextTaskId(allTasks),
        title: normalizeTitle(text),
        type: taskType,
        priority: inferPriority(text, input.priority),
        status,
        description: text,
        acceptance_criteria: [],
        risks: [],
        dependencies: [],
        owner_role: taskType === "epic" ? "architect" : "developer",
        estimate: taskType === "epic" ? "large" : "medium",
        created_at: new Date().toISOString(),
        source: input.source
      };

      board.tasks.push(newTask);
      writeBoardFile(projectRoot, status, board);

      return {
        ok: true,
        task: newTask,
        targetStatus: status,
        updatedFiles: [`${TASKS_BOARD_DIR}/${STATUS_FILE_MAP[status]}`],
        warnings: [],
        errors: []
      };
    } catch (error) {
      return {
        ok: false,
        task: null,
        targetStatus: "inbox",
        updatedFiles: [],
        warnings: [],
        errors: [
          {
            file: TASKS_CONFIG_PATH,
            message: error instanceof Error ? error.message : "Failed to intake task"
          }
        ]
      };
    }
  }

  list(projectRoot: string, options?: { status?: TaskStatus }): TasksListReport {
    try {
      const config = readTaskConfig(projectRoot);
      const statusFilter = options?.status;
      const statuses = statusFilter
        ? [statusFilter]
        : (Object.keys(STATUS_FILE_MAP) as TaskStatus[]);

      const tasks: TaskRecord[] = [];
      for (const status of statuses) {
        const board = readBoardFile(projectRoot, status);
        tasks.push(...board.tasks);
      }

      return {
        ok: true,
        enabled: config.enabled,
        mode: config.mode,
        statusFilter,
        tasks,
        warnings: [],
        errors: []
      };
    } catch (error) {
      return {
        ok: false,
        enabled: false,
        mode: "local",
        statusFilter: options?.status,
        tasks: [],
        warnings: [],
        errors: [
          {
            file: TASKS_CONFIG_PATH,
            message: error instanceof Error ? error.message : "Failed to list tasks"
          }
        ]
      };
    }
  }
}

