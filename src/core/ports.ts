export type ValidationIssue = {
  file: string;
  message: string;
  path?: string;
};

export type ValidationReport = {
  ok: boolean;
  validatedFiles: string[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

export interface ConfigValidatorPort {
  validate(projectRoot: string): ValidationReport;
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
