import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";
import { z } from "zod";
import { ConfigValidatorPort, ValidationIssue, ValidationReport } from "../core/ports";

import {
  AiConfig,
  AiConfigSchema,
  IgnoreConfig,
  IgnoreConfigSchema,
  ModulesConfig,
  ModulesConfigSchema,
  ProjectConfig,
  ProjectConfigSchema,
  QuestionsConfig,
  QuestionsConfigSchema,
  ResolvedConfig,
  ResolvedConfigSchema,
  TasksConfig,
  TasksConfigSchema,
  TextEncoding,
  TextEncodingSchema,
  TextLocale,
  TextLocaleSchema
} from "../domain/contracts";

type ConfigFileKey = "ai" | "modules" | "project" | "resolved" | "ignore";
type ValidateScope = "all" | "schemas" | "rules" | "text" | "tasks" | "questions";

type ParsedConfigs = {
  ai?: AiConfig;
  modules?: ModulesConfig;
  project?: ProjectConfig;
  resolved?: ResolvedConfig;
  ignore?: IgnoreConfig;
  tasks?: TasksConfig;
  textEncoding?: TextEncoding;
  textLocale?: TextLocale;
  questions?: QuestionsConfig;
};

type ConfigHandler<T> = {
  schema: z.ZodType<T>;
  set: (configs: ParsedConfigs, value: T | undefined) => void;
};

const REQUIRED_FILES: Record<ConfigFileKey, string> = {
  ai: "ai/ai.yaml",
  modules: "ai/modules.yaml",
  project: "ai/project.yaml",
  resolved: "ai/resolved.yaml",
  ignore: "ai/rules/ignore.yaml"
};
const TASKS_FILE = "ai/tasks/config.yaml";
const TEXT_ENCODING_FILE = "ai/text/encoding.yaml";
const TEXT_LOCALE_FILE = "ai/text/locale.yaml";
const QUESTIONS_FILE = "ai/questions/config.yaml";

const CONFIG_HANDLERS: Record<ConfigFileKey, ConfigHandler<unknown>> = {
  ai: {
    schema: AiConfigSchema,
    set: (configs, value) => {
      configs.ai = value as AiConfig | undefined;
    }
  },
  modules: {
    schema: ModulesConfigSchema,
    set: (configs, value) => {
      configs.modules = value as ModulesConfig | undefined;
    }
  },
  project: {
    schema: ProjectConfigSchema,
    set: (configs, value) => {
      configs.project = value as ProjectConfig | undefined;
    }
  },
  resolved: {
    schema: ResolvedConfigSchema,
    set: (configs, value) => {
      configs.resolved = value as ResolvedConfig | undefined;
    }
  },
  ignore: {
    schema: IgnoreConfigSchema,
    set: (configs, value) => {
      configs.ignore = value as IgnoreConfig | undefined;
    }
  }
};

const toRelativePath = (projectRoot: string, absoluteFilePath: string): string =>
  path.relative(projectRoot, absoluteFilePath).replace(/\\/g, "/");

const parseYamlFile = (absoluteFilePath: string): unknown => {
  const raw = fs.readFileSync(absoluteFilePath, "utf8");
  return YAML.parse(raw);
};

const parseAndValidateFile = <T>(
  projectRoot: string,
  absoluteFilePath: string,
  schema: z.ZodType<T>,
  errors: ValidationIssue[]
): T | undefined => {
  try {
    const parsed = parseYamlFile(absoluteFilePath);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          file: toRelativePath(projectRoot, absoluteFilePath),
          path: issue.path.length ? issue.path.map((segment) => String(segment)).join(".") : undefined,
          message: issue.message
        });
      }
      return undefined;
    }
    return result.data;
  } catch (error) {
    errors.push({
      file: toRelativePath(projectRoot, absoluteFilePath),
      message: `Failed to parse YAML: ${(error as Error).message}`
    });
    return undefined;
  }
};

const parseAndValidateRequiredFile = <T>(
  absoluteProjectRoot: string,
  relativeFilePath: string,
  schema: z.ZodType<T>,
  errors: ValidationIssue[],
  validatedFiles: string[]
): T | undefined => {
  const absoluteFilePath = path.join(absoluteProjectRoot, relativeFilePath);
  if (!fs.existsSync(absoluteFilePath)) {
    errors.push({
      file: relativeFilePath,
      message: "Required config file is missing"
    });
    return undefined;
  }

  validatedFiles.push(relativeFilePath);
  return parseAndValidateFile(absoluteProjectRoot, absoluteFilePath, schema, errors);
};

const checkCrossFileConsistency = (
  configs: ParsedConfigs,
  warnings: ValidationIssue[],
  errors: ValidationIssue[]
): void => {
  const aiConfig = configs.ai;
  const modulesConfig = configs.modules;
  const resolvedConfig = configs.resolved;
  const projectConfig = configs.project;

  if (aiConfig && modulesConfig) {
    const enabledModules = Object.entries(aiConfig.modules)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);

    for (const moduleName of modulesConfig.active_modules) {
      if (!enabledModules.includes(moduleName)) {
        errors.push({
          file: "ai/modules.yaml",
          path: `active_modules.${moduleName}`,
          message: `Module "${moduleName}" is active in modules.yaml but disabled in ai.yaml`
        });
      }
    }
  }

  if (resolvedConfig && modulesConfig) {
    for (const moduleName of resolvedConfig.active_modules) {
      if (!modulesConfig.active_modules.includes(moduleName)) {
        warnings.push({
          file: "ai/resolved.yaml",
          path: `active_modules.${moduleName}`,
          message: `Resolved module "${moduleName}" is not listed as active in modules.yaml`
        });
      }
    }
  }

  if (projectConfig && projectConfig.repository_map.ai_root !== "./ai") {
    warnings.push({
      file: "ai/project.yaml",
      path: "repository_map.ai_root",
      message: 'Recommended value for repository_map.ai_root is "./ai"'
    });
  }
};

const validateTextSemantics = (
  textEncoding: TextEncoding | undefined,
  textLocale: TextLocale | undefined,
  warnings: ValidationIssue[],
  errors: ValidationIssue[]
): void => {
  if (!textEncoding || !textLocale) {
    return;
  }

  if (textEncoding.enforce_utf8 && textEncoding.default_encoding.toLowerCase() !== "utf-8") {
    errors.push({
      file: TEXT_ENCODING_FILE,
      path: "default_encoding",
      message: 'default_encoding must be "utf-8" when enforce_utf8 is true'
    });
  }

  if (textEncoding.mojibake_signals.length === 0) {
    warnings.push({
      file: TEXT_ENCODING_FILE,
      path: "mojibake_signals",
      message: "mojibake_signals is empty; text corruption detection may be weak"
    });
  }

  const knownPolicies = ["match_user_language", "primary_only", "bilingual"];
  if (!knownPolicies.includes(textLocale.response_language_policy)) {
    warnings.push({
      file: TEXT_LOCALE_FILE,
      path: "response_language_policy",
      message: `Unknown response_language_policy "${textLocale.response_language_policy}"`
    });
  }

  if (
    textLocale.require_readable_cyrillic &&
    textLocale.primary_language !== "ru" &&
    textLocale.secondary_language !== "ru"
  ) {
    warnings.push({
      file: TEXT_LOCALE_FILE,
      path: "require_readable_cyrillic",
      message: "Cyrillic readability is required, but neither primary nor secondary language is ru"
    });
  }
};

const validateTasksSemantics = (
  tasks: TasksConfig | undefined,
  warnings: ValidationIssue[],
  errors: ValidationIssue[]
): void => {
  if (!tasks) {
    return;
  }

  const uniqueStatuses = new Set(tasks.statuses);
  if (uniqueStatuses.size !== tasks.statuses.length) {
    errors.push({
      file: TASKS_FILE,
      path: "statuses",
      message: "Task statuses must be unique"
    });
  }

  const requiredStatuses = ["inbox", "ready", "in_progress", "review", "done"];
  for (const status of requiredStatuses) {
    if (!tasks.statuses.includes(status)) {
      errors.push({
        file: TASKS_FILE,
        path: "statuses",
        message: `Missing required task status "${status}"`
      });
    }
  }

  const requiredFields = ["title", "type", "description"];
  for (const field of requiredFields) {
    if (!tasks.required_fields.includes(field)) {
      errors.push({
        file: TASKS_FILE,
        path: "required_fields",
        message: `Missing required task field "${field}"`
      });
    }
  }

  if (!tasks.enabled) {
    warnings.push({
      file: TASKS_FILE,
      path: "enabled",
      message: "Tasks module is disabled; task-first workflow is not enforced"
    });
  }
};

const validateQuestionsSemantics = (
  questions: QuestionsConfig | undefined,
  errors: ValidationIssue[]
): void => {
  if (!questions) {
    return;
  }

  const knownModes = ["auto_with_confirmation", "manual", "disabled"];
  if (!knownModes.includes(questions.language_detection.mode)) {
    errors.push({
      file: QUESTIONS_FILE,
      path: "language_detection.mode",
      message: `Unsupported language_detection.mode "${questions.language_detection.mode}"`
    });
  }

  if (questions.enabled && questions.required_blocks.length === 0) {
    errors.push({
      file: QUESTIONS_FILE,
      path: "required_blocks",
      message: "required_blocks must contain at least one block when questions are enabled"
    });
  }
};

export const validateAiConfigContracts = (
  projectRoot: string,
  options?: { scope?: ValidateScope }
): ValidationReport => {
  const absoluteProjectRoot = path.resolve(projectRoot);
  const scope = options?.scope ?? "all";
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const validatedFiles: string[] = [];

  const configs: ParsedConfigs = {};
  if (scope === "all" || scope === "schemas") {
    for (const [key, relativeFilePath] of Object.entries(REQUIRED_FILES) as Array<
      [ConfigFileKey, string]
    >) {
      const absoluteFilePath = path.join(absoluteProjectRoot, relativeFilePath);
      if (!fs.existsSync(absoluteFilePath)) {
        errors.push({
          file: relativeFilePath,
          message: "Required config file is missing"
        });
        continue;
      }

      validatedFiles.push(relativeFilePath);

      const handler = CONFIG_HANDLERS[key];
      const value = parseAndValidateFile(
        absoluteProjectRoot,
        absoluteFilePath,
        handler.schema,
        errors
      );
      handler.set(configs, value);
    }
    checkCrossFileConsistency(configs, warnings, errors);
  }

  if (scope === "all" || scope === "rules") {
    configs.ignore = parseAndValidateRequiredFile(
      absoluteProjectRoot,
      REQUIRED_FILES.ignore,
      IgnoreConfigSchema,
      errors,
      validatedFiles
    );
    if (configs.ignore) {
      for (const allowlistEntry of configs.ignore.allowlist_overrides) {
        if (configs.ignore.ignore.includes(allowlistEntry)) {
          errors.push({
            file: REQUIRED_FILES.ignore,
            path: "allowlist_overrides",
            message: `allowlist_overrides entry "${allowlistEntry}" duplicates ignore rule`
          });
        }
      }
    }
  }

  if (scope === "all" || scope === "text") {
    configs.textEncoding = parseAndValidateRequiredFile(
      absoluteProjectRoot,
      TEXT_ENCODING_FILE,
      TextEncodingSchema,
      errors,
      validatedFiles
    );
    configs.textLocale = parseAndValidateRequiredFile(
      absoluteProjectRoot,
      TEXT_LOCALE_FILE,
      TextLocaleSchema,
      errors,
      validatedFiles
    );
    validateTextSemantics(configs.textEncoding, configs.textLocale, warnings, errors);
  }

  if (scope === "all" || scope === "tasks") {
    configs.tasks = parseAndValidateRequiredFile(
      absoluteProjectRoot,
      TASKS_FILE,
      TasksConfigSchema,
      errors,
      validatedFiles
    );
    validateTasksSemantics(configs.tasks, warnings, errors);
  }

  if (scope === "all" || scope === "questions") {
    configs.questions = parseAndValidateRequiredFile(
      absoluteProjectRoot,
      QUESTIONS_FILE,
      QuestionsConfigSchema,
      errors,
      validatedFiles
    );
    validateQuestionsSemantics(configs.questions, errors);
  }

  return {
    scope,
    ok: errors.length === 0,
    validatedFiles: [...new Set(validatedFiles)],
    errors,
    warnings
  };
};

export class AiConfigValidator implements ConfigValidatorPort {
  validate(
    projectRoot: string,
    options?: { scope?: ValidateScope }
  ): ValidationReport {
    return validateAiConfigContracts(projectRoot, options);
  }
}
