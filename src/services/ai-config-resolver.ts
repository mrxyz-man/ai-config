import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { ResolveIssue, ResolveReport, ConfigResolverPort } from "../core/ports";
import {
  AgentRegistry,
  AgentRegistrySchema,
  AiConfig,
  AiConfigSchema,
  ContextSources,
  ContextSourcesSchema,
  ModulesConfig,
  ModulesConfigSchema,
  ResolvedConfig,
  ResolvedConfigSchema,
  TasksConfig,
  TasksConfigSchema,
  TextEncoding,
  TextEncodingSchema,
  TextLocale,
  TextLocaleSchema
} from "../domain/contracts";

type RequiredResolveInput = {
  ai: AiConfig;
  modules: ModulesConfig;
  agentRegistry: AgentRegistry;
  tasks: TasksConfig;
  textEncoding: TextEncoding;
  textLocale: TextLocale;
  contextSources: ContextSources;
};

type CustomOverridesFile = {
  overrides?: Record<string, unknown>;
};

const REQUIRED_INPUTS = {
  ai: "ai/ai.yaml",
  modules: "ai/modules.yaml",
  agentRegistry: "ai/agents/registry.yaml",
  tasks: "ai/tasks/config.yaml",
  textEncoding: "ai/text/encoding.yaml",
  textLocale: "ai/text/locale.yaml",
  contextSources: "ai/context/sources.yaml"
} as const;
const CUSTOM_OVERRIDES_FILE = "ai/custom/overrides.yaml";

const toRelative = (projectRoot: string, absolutePath: string): string =>
  path.relative(projectRoot, absolutePath).replace(/\\/g, "/");

const parseYaml = (absolutePath: string): unknown => {
  const raw = fs.readFileSync(absolutePath, "utf8");
  return YAML.parse(raw);
};

const parseAndValidate = <T>(
  projectRoot: string,
  absolutePath: string,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ path: Array<string | number | symbol>; message: string }> } } },
  errors: ResolveIssue[]
): T | undefined => {
  try {
    const parsed = parseYaml(absolutePath);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          file: toRelative(projectRoot, absolutePath),
          path: issue.path.length ? issue.path.map((part) => String(part)).join(".") : undefined,
          message: issue.message
        });
      }
      return undefined;
    }
    return result.data;
  } catch (error) {
    errors.push({
      file: toRelative(projectRoot, absolutePath),
      message: `Failed to parse YAML: ${(error as Error).message}`
    });
    return undefined;
  }
};

const buildResolved = (input: RequiredResolveInput): ResolvedConfig => ({
  generated_at: null,
  status: "resolved_v1",
  profile: {
    project_id: input.ai.project_id,
    language: input.ai.default_language,
    timezone: input.ai.timezone
  },
  active_modules: input.modules.active_modules,
  execution: {
    mode: input.ai.execution.mode,
    policy: input.ai.execution.policy_profile,
    require_confirmation_for_mutations: input.ai.execution.require_confirmation_for_mutations
  },
  agent_roles: {
    default: input.agentRegistry.default_role,
    enabled: input.agentRegistry.enabled_roles,
    execution_order: input.agentRegistry.execution_order
  },
  tasks: {
    enabled: input.tasks.enabled,
    mode: input.tasks.mode,
    always_offer_task_creation: input.tasks.always_offer_task_creation,
    epic_auto_decomposition: input.tasks.epic_auto_decomposition,
    statuses: input.tasks.statuses
  },
  text: {
    default_encoding: input.textEncoding.default_encoding,
    enforce_utf8: input.textEncoding.enforce_utf8,
    require_readable_cyrillic: input.textLocale.require_readable_cyrillic,
    language_policy: input.textLocale.response_language_policy
  },
  context_priorities: input.contextSources.priority_sources,
  note: "Resolved by ai-config resolver v1"
});

const readCustomOverrides = (
  absoluteRoot: string,
  warnings: ResolveIssue[],
  errors: ResolveIssue[]
): Record<string, unknown> => {
  const absolutePath = path.join(absoluteRoot, CUSTOM_OVERRIDES_FILE);
  if (!fs.existsSync(absolutePath)) {
    return {};
  }

  try {
    const parsed = parseYaml(absolutePath) as CustomOverridesFile | null;
    if (!parsed || typeof parsed !== "object") {
      warnings.push({
        file: CUSTOM_OVERRIDES_FILE,
        message: "Custom overrides file is empty; no overrides applied"
      });
      return {};
    }
    if (!parsed.overrides) {
      return {};
    }
    if (typeof parsed.overrides !== "object" || Array.isArray(parsed.overrides)) {
      errors.push({
        file: CUSTOM_OVERRIDES_FILE,
        path: "overrides",
        message: "Expected object at overrides"
      });
      return {};
    }
    return parsed.overrides;
  } catch (error) {
    errors.push({
      file: CUSTOM_OVERRIDES_FILE,
      message: `Failed to parse YAML: ${(error as Error).message}`
    });
    return {};
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const applyOverrides = (
  target: Record<string, unknown>,
  overrides: Record<string, unknown>,
  warnings: ResolveIssue[],
  pathPrefix = ""
): void => {
  for (const [key, overrideValue] of Object.entries(overrides)) {
    const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;

    if (!(key in target)) {
      warnings.push({
        file: CUSTOM_OVERRIDES_FILE,
        path: `overrides.${fullPath}`,
        message: "Unknown override key was ignored"
      });
      continue;
    }

    const currentValue = target[key];
    if (isPlainObject(currentValue) && isPlainObject(overrideValue)) {
      applyOverrides(currentValue, overrideValue, warnings, fullPath);
      continue;
    }

    target[key] = overrideValue;
  }
};

const enforceResolvedInvariants = (
  resolved: ResolvedConfig,
  input: RequiredResolveInput,
  errors: ResolveIssue[]
): void => {
  if (!resolved.execution.require_confirmation_for_mutations) {
    errors.push({
      file: CUSTOM_OVERRIDES_FILE,
      path: "overrides.execution.require_confirmation_for_mutations",
      message: "Enforced policy violation: require_confirmation_for_mutations must remain true"
    });
  }

  const enabledByAi = Object.entries(input.ai.modules)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);

  for (const moduleName of resolved.active_modules) {
    if (!enabledByAi.includes(moduleName)) {
      errors.push({
        file: "ai/modules.yaml",
        path: `active_modules.${moduleName}`,
        message: `Module "${moduleName}" cannot be active because it is disabled in ai.yaml`
      });
    }
  }
};

export class AiConfigResolver implements ConfigResolverPort<ResolvedConfig> {
  resolve(projectRoot: string): ResolveReport<ResolvedConfig> {
    const absoluteRoot = path.resolve(projectRoot);
    const outputFile = "ai/resolved.yaml";
    const errors: ResolveIssue[] = [];
    const warnings: ResolveIssue[] = [];

    const aiPath = path.join(absoluteRoot, REQUIRED_INPUTS.ai);
    const modulesPath = path.join(absoluteRoot, REQUIRED_INPUTS.modules);
    const agentRegistryPath = path.join(absoluteRoot, REQUIRED_INPUTS.agentRegistry);
    const tasksPath = path.join(absoluteRoot, REQUIRED_INPUTS.tasks);
    const textEncodingPath = path.join(absoluteRoot, REQUIRED_INPUTS.textEncoding);
    const textLocalePath = path.join(absoluteRoot, REQUIRED_INPUTS.textLocale);
    const contextSourcesPath = path.join(absoluteRoot, REQUIRED_INPUTS.contextSources);

    const requiredFiles = [
      REQUIRED_INPUTS.ai,
      REQUIRED_INPUTS.modules,
      REQUIRED_INPUTS.agentRegistry,
      REQUIRED_INPUTS.tasks,
      REQUIRED_INPUTS.textEncoding,
      REQUIRED_INPUTS.textLocale,
      REQUIRED_INPUTS.contextSources
    ];

    for (const relativeFilePath of requiredFiles) {
      if (!fs.existsSync(path.join(absoluteRoot, relativeFilePath))) {
        errors.push({ file: relativeFilePath, message: "Required config file is missing" });
      }
    }

    if (errors.length > 0) {
      return {
        ok: false,
        outputFile,
        resolved: null,
        resolvedModules: [],
        checksum: null,
        warnings,
        errors
      };
    }

    const ai = parseAndValidate(absoluteRoot, aiPath, AiConfigSchema, errors);
    const modules = parseAndValidate(absoluteRoot, modulesPath, ModulesConfigSchema, errors);
    const agentRegistry = parseAndValidate(
      absoluteRoot,
      agentRegistryPath,
      AgentRegistrySchema,
      errors
    );
    const tasks = parseAndValidate(absoluteRoot, tasksPath, TasksConfigSchema, errors);
    const textEncoding = parseAndValidate(
      absoluteRoot,
      textEncodingPath,
      TextEncodingSchema,
      errors
    );
    const textLocale = parseAndValidate(absoluteRoot, textLocalePath, TextLocaleSchema, errors);
    const contextSources = parseAndValidate(
      absoluteRoot,
      contextSourcesPath,
      ContextSourcesSchema,
      errors
    );

    if (
      errors.length > 0 ||
      !ai ||
      !modules ||
      !agentRegistry ||
      !tasks ||
      !textEncoding ||
      !textLocale ||
      !contextSources
    ) {
      return {
        ok: false,
        outputFile,
        resolved: null,
        resolvedModules: [],
        checksum: null,
        warnings,
        errors
      };
    }

    const resolved = buildResolved({
      ai,
      modules,
      agentRegistry,
      tasks,
      textEncoding,
      textLocale,
      contextSources
    });
    const customOverrides = readCustomOverrides(absoluteRoot, warnings, errors);
    if (errors.length > 0) {
      return {
        ok: false,
        outputFile,
        resolved: null,
        resolvedModules: [],
        checksum: null,
        warnings,
        errors
      };
    }

    applyOverrides(resolved as unknown as Record<string, unknown>, customOverrides, warnings);
    enforceResolvedInvariants(resolved, { ai, modules, agentRegistry, tasks, textEncoding, textLocale, contextSources }, errors);
    if (errors.length > 0) {
      return {
        ok: false,
        outputFile,
        resolved: null,
        resolvedModules: [],
        checksum: null,
        warnings,
        errors
      };
    }

    const schemaCheck = ResolvedConfigSchema.safeParse(resolved);
    if (!schemaCheck.success) {
      for (const issue of schemaCheck.error.issues) {
        errors.push({
          file: outputFile,
          path: issue.path.length ? issue.path.map((part) => String(part)).join(".") : undefined,
          message: issue.message
        });
      }
      return {
        ok: false,
        outputFile,
        resolved: null,
        resolvedModules: [],
        checksum: null,
        warnings,
        errors
      };
    }

    const resolvedYaml = YAML.stringify(resolved);
    const checksum = crypto.createHash("sha256").update(resolvedYaml).digest("hex");
    const absoluteOutputPath = path.join(absoluteRoot, outputFile);
    fs.writeFileSync(absoluteOutputPath, resolvedYaml, "utf8");

    return {
      ok: true,
      outputFile,
      resolved,
      resolvedModules: resolved.active_modules,
      checksum,
      warnings,
      errors
    };
  }
}
