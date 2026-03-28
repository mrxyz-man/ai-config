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

export type McpProviderName = "gitlab";
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
