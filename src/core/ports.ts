export type ValidationIssue = {
  file: string;
  message: string;
  path?: string;
};

export type ValidationReport = {
  ok: boolean;
  scope: "all" | "schemas" | "rules" | "text" | "tasks" | "questions";
  validatedFiles: string[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

export interface ConfigValidatorPort {
  validate(
    projectRoot: string,
    options?: { scope?: "all" | "schemas" | "rules" | "text" | "tasks" | "questions" }
  ): ValidationReport;
}

export type ResolveIssue = {
  file: string;
  message: string;
  path?: string;
};

export type ResolveReport<TResolved = unknown> = {
  ok: boolean;
  outputFile: string;
  resolved: TResolved | null;
  resolvedModules: string[];
  checksum: string | null;
  warnings: ResolveIssue[];
  errors: ResolveIssue[];
};

export interface ConfigResolverPort<TResolved = unknown> {
  resolve(projectRoot: string): ResolveReport<TResolved>;
}

export type PolicyDecision = "auto-run" | "confirm-required" | "confirmed" | "deny";

export type PolicyCheckResult = {
  allowed: boolean;
  decision: PolicyDecision;
  reason?: string;
};

export interface PolicyGatePort {
  check(projectRoot: string, command: string, confirmed: boolean): PolicyCheckResult;
}

export type AuditOutcome = "success" | "failed" | "denied";

export type AuditEvent = {
  actor: "agent" | "user";
  command: string;
  timestamp: string;
  decision: PolicyDecision;
  outcome: AuditOutcome;
  message?: string;
};

export interface AuditLoggerPort {
  append(projectRoot: string, event: AuditEvent): void;
}

export type InitIssue = {
  file: string;
  message: string;
  path?: string;
};

export type InitReport = {
  ok: boolean;
  projectRoot: string;
  createdFiles: string[];
  updatedFiles: string[];
  detected: {
    hasPackageJson: boolean;
    hasTypeScript: boolean;
    hasNodeModules: boolean;
  };
  unresolvedQuestions: string[];
  warnings: InitIssue[];
  errors: InitIssue[];
};

export interface ConfigInitializerPort {
  init(projectRoot: string, options?: { force?: boolean; lang?: string; skipQuestions?: boolean }): InitReport;
}

export type SyncIssue = {
  file: string;
  message: string;
  path?: string;
};

export type SyncReport = {
  ok: boolean;
  dryRun: boolean;
  appliedChanges: string[];
  plannedChanges: string[];
  preservedCustomFiles: string[];
  migrationSummary: string[];
  warnings: SyncIssue[];
  errors: SyncIssue[];
};

export interface ConfigSyncPort {
  sync(projectRoot: string, options?: { dryRun?: boolean; withMigrations?: boolean; fromVersion?: string }): SyncReport;
}

export type ExplainIssue = {
  file: string;
  message: string;
  path?: string;
};

export type ExplainMatch = {
  key: string;
  module: string;
  value: unknown;
  sources: string[];
};

export type ExplainReport = {
  ok: boolean;
  keyFilter?: string;
  moduleFilter?: string;
  matches: ExplainMatch[];
  warnings: ExplainIssue[];
  errors: ExplainIssue[];
};

export interface ConfigExplainerPort {
  explain(projectRoot: string, options?: { key?: string; module?: string }): ExplainReport;
}

export type McpProviderName = "custom";
export type TaskMode = "local" | "hybrid" | "remote-first";
export type McpSyncDirection = "none" | "push" | "pull" | "bidirectional";

export type McpIntegrationIssue = {
  file: string;
  message: string;
  path?: string;
};

export type McpIntegrationStatusReport = {
  ok: boolean;
  provider: McpProviderName | null;
  enabled: boolean;
  mode: TaskMode;
  syncDirection: McpSyncDirection;
  notes?: string;
  providerHealth?: string;
  warnings: McpIntegrationIssue[];
  errors: McpIntegrationIssue[];
};

export type McpIntegrationMutationReport = {
  ok: boolean;
  provider: McpProviderName | null;
  mode: TaskMode;
  syncDirection: McpSyncDirection;
  updatedFiles: string[];
  warnings: McpIntegrationIssue[];
  errors: McpIntegrationIssue[];
};

export interface TaskMcpIntegrationPort {
  status(projectRoot: string): McpIntegrationStatusReport;
  connect(
    projectRoot: string,
    input: { provider: McpProviderName; mode?: TaskMode }
  ): McpIntegrationMutationReport;
  disconnect(projectRoot: string): McpIntegrationMutationReport;
  sync(projectRoot: string): McpIntegrationMutationReport;
}

export type TaskPriority = "P0" | "P1" | "P2" | "P3";
export type TaskType = "task" | "bug" | "epic";
export type TaskStatus = "inbox" | "ready" | "in_progress" | "review" | "done";

export type TaskRecord = {
  id: string;
  title: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  description: string;
  acceptance_criteria: string[];
  risks: string[];
  dependencies: string[];
  owner_role?: string;
  estimate?: string;
  created_at: string;
  source?: string;
};

export type TasksIssue = {
  file: string;
  message: string;
  path?: string;
};

export type TasksToggleReport = {
  ok: boolean;
  enabled: boolean;
  mode: TaskMode;
  updatedFiles: string[];
  warnings: TasksIssue[];
  errors: TasksIssue[];
};

export type TasksIntakeReport = {
  ok: boolean;
  task: TaskRecord | null;
  targetStatus: TaskStatus;
  updatedFiles: string[];
  warnings: TasksIssue[];
  errors: TasksIssue[];
};

export type TasksListReport = {
  ok: boolean;
  enabled: boolean;
  mode: TaskMode;
  statusFilter?: TaskStatus;
  tasks: TaskRecord[];
  warnings: TasksIssue[];
  errors: TasksIssue[];
};

export type TasksPlanReport = {
  ok: boolean;
  task: TaskRecord | null;
  generatedTasks: TaskRecord[];
  updatedFiles: string[];
  warnings: TasksIssue[];
  errors: TasksIssue[];
};

export type TasksStatusReport = {
  ok: boolean;
  task: TaskRecord | null;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  updatedFiles: string[];
  warnings: TasksIssue[];
  errors: TasksIssue[];
};

export interface TaskBoardPort {
  enable(projectRoot: string): TasksToggleReport;
  disable(projectRoot: string): TasksToggleReport;
  intake(
    projectRoot: string,
    input: { text: string; type?: TaskType; priority?: TaskPriority; source?: string }
  ): TasksIntakeReport;
  list(projectRoot: string, options?: { status?: TaskStatus }): TasksListReport;
  plan(projectRoot: string, input: { taskId: string }): TasksPlanReport;
  changeStatus(
    projectRoot: string,
    input: { taskId: string; status: TaskStatus }
  ): TasksStatusReport;
}

export type TextIssue = {
  file: string;
  message: string;
  path?: string;
};

export type TextCheckReport = {
  ok: boolean;
  scanMode: "repository" | "changed-only";
  checkedFiles: number;
  violations: Array<{
    file: string;
    signal: string;
    excerpt: string;
  }>;
  warnings: TextIssue[];
  errors: TextIssue[];
};

export interface TextPolicyPort {
  check(projectRoot: string, options?: { changedOnly?: boolean }): TextCheckReport;
}

export type QuestionsIssue = {
  file: string;
  message: string;
  path?: string;
};

export type QuestionsStatusReport = {
  ok: boolean;
  enabled: boolean;
  language: string;
  completed: boolean;
  requiredBlocks: string[];
  answeredBlocks: string[];
  missingBlocks: string[];
  warnings: QuestionsIssue[];
  errors: QuestionsIssue[];
};

export type QuestionsRunReport = {
  ok: boolean;
  language: string;
  completed: boolean;
  missingBlocks: string[];
  pendingQuestions: Array<{
    id: string;
    blockId: string;
    prompt: string;
    required: boolean;
  }>;
  appliedAnswers: number;
  updatedFiles: string[];
  warnings: QuestionsIssue[];
  errors: QuestionsIssue[];
};

export interface QuestionsPort {
  status(projectRoot: string): QuestionsStatusReport;
  run(
    projectRoot: string,
    options?: {
      language?: string;
      profile?: string;
      nonInteractive?: boolean;
      providedAnswers?: Array<{ id: string; value: string; confidence?: string }>;
    }
  ): QuestionsRunReport;
}
