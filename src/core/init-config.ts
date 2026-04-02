export const INIT_PROFILES = ["minimal", "standard", "full"] as const;
export type InitProfile = (typeof INIT_PROFILES)[number];

export const TASK_MODES = ["off", "assisted", "enforced"] as const;
export type TaskMode = (typeof TASK_MODES)[number];

export const INIT_MODULES = [
  "core",
  "qa",
  "project",
  "rules",
  "agents",
  "mcp",
  "skills",
  "orchestration",
  "contracts",
  "checklists",
  "adr",
  "governance",
  "interfaces",
  "runbooks",
  "risk",
  "quality",
  "security",
  "observability",
  "templates",
  "memory",
  "logs"
] as const;
export type InitModuleName = (typeof INIT_MODULES)[number];

export const MODULE_LIFECYCLE_STATES = [
  "disabled",
  "bootstrap",
  "ready",
  "degraded"
] as const;
export type ModuleLifecycleState = (typeof MODULE_LIFECYCLE_STATES)[number];

export const MCP_PROVIDER_IDS = [
  "context7",
  "chrome-devtools",
  "gitlab-mcp-agent-server",
  "sequential-thinking",
  "memory-knowledge-graph"
] as const;
export type McpProviderId = (typeof MCP_PROVIDER_IDS)[number];

type InitBehaviorDefaults = {
  taskMode: TaskMode;
  questionnaireOnInit: boolean;
  strictEnabledOnly: boolean;
};

export const PROFILE_TO_MODULES: Record<InitProfile, readonly InitModuleName[]> = {
  minimal: ["core", "qa"],
  standard: [
    "core",
    "qa",
    "project",
    "rules",
    "agents",
    "skills",
    "contracts",
    "checklists",
    "adr",
    "governance",
    "interfaces",
    "runbooks",
    "risk",
    "quality",
    "security",
    "observability",
    "templates"
  ],
  full: INIT_MODULES
};

export const DEFAULTS_BY_PROFILE: Record<InitProfile, InitBehaviorDefaults> = {
  minimal: {
    taskMode: "off",
    questionnaireOnInit: false,
    strictEnabledOnly: true
  },
  standard: {
    taskMode: "assisted",
    questionnaireOnInit: true,
    strictEnabledOnly: true
  },
  full: {
    taskMode: "assisted",
    questionnaireOnInit: true,
    strictEnabledOnly: true
  }
};

export const MODULE_DEPENDENCIES: Record<InitModuleName, readonly InitModuleName[]> = {
  core: [],
  qa: [],
  project: [],
  rules: [],
  agents: [],
  mcp: [],
  skills: ["rules", "templates"],
  orchestration: ["agents"],
  contracts: [],
  checklists: [],
  adr: [],
  governance: [],
  interfaces: [],
  runbooks: [],
  risk: [],
  quality: [],
  security: [],
  observability: [],
  templates: [],
  memory: [],
  logs: []
};

export const PROVIDER_PRESETS: Record<InitProfile, readonly McpProviderId[]> = {
  minimal: [],
  standard: [],
  full: []
};

export type ResolvedInitConfig = {
  profile: InitProfile;
  modules: InitModuleName[];
  taskMode: TaskMode;
  questionnaireOnInit: boolean;
  enableMcpProviders: McpProviderId[];
  autoAddedModules: InitModuleName[];
  errors: string[];
};

export type ResolveInitConfigInput = {
  profile: InitProfile;
  modules?: InitModuleName[];
  taskMode?: TaskMode;
  questionnaireOnInit?: boolean;
  enableMcpProviders?: McpProviderId[];
};

export type ResolveInitConfigOptions = {
  autoFixDependencies: boolean;
};

export const resolveInitConfig = (
  input: ResolveInitConfigInput,
  options: ResolveInitConfigOptions
): ResolvedInitConfig => {
  const profileDefaults = DEFAULTS_BY_PROFILE[input.profile];
  const baseModules = input.modules ?? [...PROFILE_TO_MODULES[input.profile]];
  const resolvedSet = new Set<InitModuleName>(baseModules);
  const autoAddedModules = new Set<InitModuleName>();
  const errors: string[] = [];

  if (options.autoFixDependencies) {
    const queue = [...resolvedSet];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      for (const dependency of MODULE_DEPENDENCIES[current]) {
        if (resolvedSet.has(dependency)) {
          continue;
        }
        resolvedSet.add(dependency);
        autoAddedModules.add(dependency);
        queue.push(dependency);
      }
    }
  } else {
    for (const moduleName of resolvedSet) {
      for (const dependency of MODULE_DEPENDENCIES[moduleName]) {
        if (!resolvedSet.has(dependency)) {
          errors.push(`Module "${moduleName}" requires "${dependency}".`);
        }
      }
    }
  }

  const resolvedModules = INIT_MODULES.filter((moduleName) => resolvedSet.has(moduleName));
  const resolvedProviders = [...(input.enableMcpProviders ?? [])];
  if (resolvedProviders.length > 0 && !resolvedSet.has("mcp")) {
    errors.push('MCP providers require module "mcp" to be enabled.');
  }

  return {
    profile: input.profile,
    modules: resolvedModules,
    taskMode: input.taskMode ?? profileDefaults.taskMode,
    questionnaireOnInit: input.questionnaireOnInit ?? profileDefaults.questionnaireOnInit,
    enableMcpProviders: resolvedProviders,
    autoAddedModules: INIT_MODULES.filter((moduleName) => autoAddedModules.has(moduleName)),
    errors
  };
};
