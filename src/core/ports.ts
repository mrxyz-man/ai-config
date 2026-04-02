import type { AgentKey } from "./agents";

export type InitIssue = {
  file: string;
  message: string;
};

export type InitReport = {
  ok: boolean;
  projectRoot: string;
  selectedAgent: AgentKey;
  uiLocale: string;
  createdFiles: string[];
  warnings: InitIssue[];
  errors: InitIssue[];
};

export interface ConfigInitializerPort {
  init(
    projectRoot: string,
    options?: { force?: boolean; agent?: AgentKey; uiLocale?: string }
  ): InitReport;
}
