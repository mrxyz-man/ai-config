import type { AgentKey } from "./agents";
import type { InitModuleName, InitProfile, McpProviderId, TaskMode } from "./init-config";
import type { PreflightState } from "./preflight";

export type InitIssue = {
  file: string;
  message: string;
};

export type InitReport = {
  ok: boolean;
  preflightState: PreflightState;
  projectRoot: string;
  selectedAgent: AgentKey;
  uiLocale: string;
  createdFiles: string[];
  warnings: InitIssue[];
  errors: InitIssue[];
};

export type InitOptions = {
  force?: boolean;
  agent?: AgentKey;
  uiLocale?: string;
  profile?: InitProfile;
  modules?: InitModuleName[];
  taskMode?: TaskMode;
  questionnaireOnInit?: boolean;
  enableMcpProviders?: McpProviderId[];
};

export interface ConfigInitializerPort {
  init(projectRoot: string, options?: InitOptions): InitReport;
}
