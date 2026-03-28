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
  ResolvedConfig,
  ResolvedConfigSchema
} from "../domain/contracts";

type ConfigFileKey = "ai" | "modules" | "project" | "resolved" | "ignore";

type ParsedConfigs = {
  ai?: AiConfig;
  modules?: ModulesConfig;
  project?: ProjectConfig;
  resolved?: ResolvedConfig;
  ignore?: IgnoreConfig;
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

export const validateAiConfigContracts = (projectRoot: string): ValidationReport => {
  const absoluteProjectRoot = path.resolve(projectRoot);
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const validatedFiles: string[] = [];

  const configs: ParsedConfigs = {};
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

  return {
    ok: errors.length === 0,
    validatedFiles,
    errors,
    warnings
  };
};

export class AiConfigValidator implements ConfigValidatorPort {
  validate(projectRoot: string): ValidationReport {
    return validateAiConfigContracts(projectRoot);
  }
}
