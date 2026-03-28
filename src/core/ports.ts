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
