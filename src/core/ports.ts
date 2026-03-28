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

export interface ConfigResolverPort<TResolved = unknown> {
  resolve(projectRoot: string): TResolved;
}

