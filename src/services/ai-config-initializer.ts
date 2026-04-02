import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as toYaml } from "yaml";

import {
  AGENT_TO_BRIDGE_FILES,
  BRIDGE_CONTENT_BY_FILE,
  DEFAULT_AGENT,
  type AgentKey
} from "../core/agents";
import { ConfigInitializerPort, InitOptions, InitReport } from "../core/ports";
import { DEFAULT_CONFIG_ROOT, DEFAULT_TEMPLATE_ROOT } from "../core/config-paths";
import {
  DEFAULTS_BY_PROFILE,
  PROFILE_TO_MODULES,
  type InitModuleName,
  type InitProfile,
  type McpProviderId
} from "../core/init-config";
import { DEFAULT_UI_LOCALE } from "../core/locales";
import { detectPreflightState } from "../core/preflight";

const resolveTemplateDir = (): string => path.resolve(__dirname, `../../${DEFAULT_TEMPLATE_ROOT}`);
const MANIFEST_FILE_NAME = "manifest.yaml";
const SCHEMA_VERSION = "1";
const TEMPLATE_VERSION = "0.1.0";
const REQUIRED_ROOT_FILES = [
  ".aiignore",
  "README.md",
  "config.yaml",
  "modules.yaml",
  "qa.yaml",
  "manifest.yaml"
] as const;

const readYamlObject = (absolutePath: string): Record<string, unknown> | null => {
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(absolutePath, "utf8");
    const parsed = parseYaml(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const writeYamlObject = (absolutePath: string, content: Record<string, unknown>): void => {
  fs.writeFileSync(absolutePath, toYaml(content), "utf8");
};

const updateConfigFile = (params: {
  targetDir: string;
  profile: InitProfile;
  taskMode: string;
  questionnaireOnInit: boolean;
  errors: InitReport["errors"];
}): void => {
  const absolutePath = path.join(params.targetDir, "config.yaml");
  const current = readYamlObject(absolutePath);
  if (!current) {
    params.errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/config.yaml`,
      message: "Failed to parse config.yaml as YAML object."
    });
    return;
  }

  const profile = current.profile;
  const behavior = current.behavior;
  const modules = current.modules;

  const nextProfile =
    profile && typeof profile === "object" && !Array.isArray(profile)
      ? (profile as Record<string, unknown>)
      : {};
  nextProfile.name = params.profile;
  nextProfile.mode = "bootstrap";

  const nextBehavior =
    behavior && typeof behavior === "object" && !Array.isArray(behavior)
      ? (behavior as Record<string, unknown>)
      : {};
  nextBehavior.task_mode = params.taskMode;
  nextBehavior.questionnaire_on_init = params.questionnaireOnInit;

  const nextModules =
    modules && typeof modules === "object" && !Array.isArray(modules)
      ? (modules as Record<string, unknown>)
      : {};
  nextModules.strict_enabled_only = DEFAULTS_BY_PROFILE[params.profile].strictEnabledOnly;

  current.profile = nextProfile;
  current.behavior = nextBehavior;
  current.modules = nextModules;
  writeYamlObject(absolutePath, current);
};

const updateModulesFile = (params: {
  targetDir: string;
  enabledModules: InitModuleName[];
  errors: InitReport["errors"];
}): void => {
  const absolutePath = path.join(params.targetDir, "modules.yaml");
  const current = readYamlObject(absolutePath);
  if (!current) {
    params.errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/modules.yaml`,
      message: "Failed to parse modules.yaml as YAML object."
    });
    return;
  }

  const modules = current.modules;
  if (!Array.isArray(modules)) {
    params.errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/modules.yaml`,
      message: "modules.yaml must contain modules list."
    });
    return;
  }

  const enabledSet = new Set<InitModuleName>(params.enabledModules);
  for (const moduleDef of modules) {
    if (!moduleDef || typeof moduleDef !== "object" || Array.isArray(moduleDef)) {
      continue;
    }
    const moduleRecord = moduleDef as Record<string, unknown>;
    const moduleName = moduleRecord.name;
    if (typeof moduleName !== "string") {
      continue;
    }
    moduleRecord.enabled = enabledSet.has(moduleName as InitModuleName);
  }

  writeYamlObject(absolutePath, current);
};

const updateQaFile = (params: {
  targetDir: string;
  questionnaireOnInit: boolean;
  errors: InitReport["errors"];
}): void => {
  const absolutePath = path.join(params.targetDir, "qa.yaml");
  const current = readYamlObject(absolutePath);
  if (!current) {
    params.errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/qa.yaml`,
      message: "Failed to parse qa.yaml as YAML object."
    });
    return;
  }

  current.status = params.questionnaireOnInit ? "in_progress" : "not_started";
  writeYamlObject(absolutePath, current);
};

const updateMcpRegistryFile = (params: {
  targetDir: string;
  enabledModules: InitModuleName[];
  enableMcpProviders: McpProviderId[];
  errors: InitReport["errors"];
}): void => {
  const absolutePath = path.join(params.targetDir, "mcp", "registry.yaml");
  if (!fs.existsSync(absolutePath)) {
    return;
  }
  const current = readYamlObject(absolutePath);
  if (!current) {
    params.errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/mcp/registry.yaml`,
      message: "Failed to parse mcp/registry.yaml as YAML object."
    });
    return;
  }

  const mcpEnabled = params.enabledModules.includes("mcp");
  const enabledProvidersSet = new Set<McpProviderId>(params.enableMcpProviders);
  const defaults = current.defaults;
  const providers = current.providers;

  const nextDefaults =
    defaults && typeof defaults === "object" && !Array.isArray(defaults)
      ? (defaults as Record<string, unknown>)
      : {};
  nextDefaults.enabled_by_default = mcpEnabled && enabledProvidersSet.size > 0;

  if (Array.isArray(providers)) {
    for (const providerDef of providers) {
      if (!providerDef || typeof providerDef !== "object" || Array.isArray(providerDef)) {
        continue;
      }
      const providerRecord = providerDef as Record<string, unknown>;
      const providerId = providerRecord.id;
      if (typeof providerId !== "string") {
        continue;
      }
      providerRecord.enabled = mcpEnabled && enabledProvidersSet.has(providerId as McpProviderId);
    }
  }

  current.defaults = nextDefaults;
  writeYamlObject(absolutePath, current);
};

const updateToggleInYamlFile = (params: {
  targetDir: string;
  relativePath: string;
  enabled: boolean;
  errors: InitReport["errors"];
}): void => {
  const absolutePath = path.join(params.targetDir, params.relativePath);
  if (!fs.existsSync(absolutePath)) {
    return;
  }
  const current = readYamlObject(absolutePath);
  if (!current) {
    params.errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/${params.relativePath.replace(/\\/g, "/")}`,
      message: `Failed to parse ${params.relativePath.replace(/\\/g, "/")} as YAML object.`
    });
    return;
  }

  current.enabled = params.enabled;
  writeYamlObject(absolutePath, current);
};

const applyResolvedConfiguration = (params: {
  targetDir: string;
  options: InitOptions;
  errors: InitReport["errors"];
}): void => {
  const profile = params.options.profile ?? "standard";
  const taskMode = params.options.taskMode ?? DEFAULTS_BY_PROFILE[profile].taskMode;
  const questionnaireOnInit =
    params.options.questionnaireOnInit ?? DEFAULTS_BY_PROFILE[profile].questionnaireOnInit;
  const enabledModules =
    params.options.modules && params.options.modules.length > 0
      ? params.options.modules
      : [...PROFILE_TO_MODULES[profile]];
  const enableMcpProviders = params.options.enableMcpProviders ?? [];

  updateConfigFile({
    targetDir: params.targetDir,
    profile,
    taskMode,
    questionnaireOnInit,
    errors: params.errors
  });
  updateModulesFile({
    targetDir: params.targetDir,
    enabledModules,
    errors: params.errors
  });
  updateQaFile({
    targetDir: params.targetDir,
    questionnaireOnInit,
    errors: params.errors
  });
  updateMcpRegistryFile({
    targetDir: params.targetDir,
    enabledModules,
    enableMcpProviders,
    errors: params.errors
  });

  updateToggleInYamlFile({
    targetDir: params.targetDir,
    relativePath: path.join("orchestration", "orchestration.yaml"),
    enabled: enabledModules.includes("orchestration"),
    errors: params.errors
  });
  updateToggleInYamlFile({
    targetDir: params.targetDir,
    relativePath: path.join("memory", "profile.yaml"),
    enabled: enabledModules.includes("memory"),
    errors: params.errors
  });
  updateToggleInYamlFile({
    targetDir: params.targetDir,
    relativePath: path.join("logs", "policy.yaml"),
    enabled: enabledModules.includes("logs"),
    errors: params.errors
  });
};

const runPostInitValidation = (params: {
  targetDir: string;
  selectedAgent: AgentKey;
  uiLocale: string;
  options: InitOptions;
  errors: InitReport["errors"];
}): void => {
  for (const fileName of REQUIRED_ROOT_FILES) {
    const absolutePath = path.join(params.targetDir, fileName);
    if (!fs.existsSync(absolutePath)) {
      params.errors.push({
        file: `${DEFAULT_CONFIG_ROOT}/${fileName}`,
        message: `Missing required root file after init: ${fileName}`
      });
    }
  }

  const manifestPath = path.join(params.targetDir, "manifest.yaml");
  const manifest = readYamlObject(manifestPath);
  if (!manifest) {
    params.errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/manifest.yaml`,
      message: "Failed to parse manifest.yaml after init."
    });
  } else {
    if (manifest.generator !== "ai-config") {
      params.errors.push({
        file: `${DEFAULT_CONFIG_ROOT}/manifest.yaml`,
        message: "Post-init validation failed: generator must be 'ai-config'."
      });
    }
    if (manifest.managed_by !== "ai-config") {
      params.errors.push({
        file: `${DEFAULT_CONFIG_ROOT}/manifest.yaml`,
        message: "Post-init validation failed: managed_by must be 'ai-config'."
      });
    }
    if (manifest.selected_agent !== params.selectedAgent) {
      params.errors.push({
        file: `${DEFAULT_CONFIG_ROOT}/manifest.yaml`,
        message: "Post-init validation failed: selected_agent mismatch."
      });
    }
    if (manifest.ui_locale !== params.uiLocale) {
      params.errors.push({
        file: `${DEFAULT_CONFIG_ROOT}/manifest.yaml`,
        message: "Post-init validation failed: ui_locale mismatch."
      });
    }
  }

  const configPath = path.join(params.targetDir, "config.yaml");
  const config = readYamlObject(configPath);
  if (!config) {
    params.errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/config.yaml`,
      message: "Failed to parse config.yaml after init."
    });
  } else {
    const expectedProfile = params.options.profile ?? "standard";
    const expectedTaskMode = params.options.taskMode ?? DEFAULTS_BY_PROFILE[expectedProfile].taskMode;
    const expectedQuestionnaireOnInit =
      params.options.questionnaireOnInit ?? DEFAULTS_BY_PROFILE[expectedProfile].questionnaireOnInit;
    const profile = config.profile as Record<string, unknown> | undefined;
    const behavior = config.behavior as Record<string, unknown> | undefined;
    if (!profile || profile.name !== expectedProfile) {
      params.errors.push({
        file: `${DEFAULT_CONFIG_ROOT}/config.yaml`,
        message: "Post-init validation failed: profile.name mismatch."
      });
    }
    if (!behavior || behavior.task_mode !== expectedTaskMode) {
      params.errors.push({
        file: `${DEFAULT_CONFIG_ROOT}/config.yaml`,
        message: "Post-init validation failed: behavior.task_mode mismatch."
      });
    }
    if (!behavior || behavior.questionnaire_on_init !== expectedQuestionnaireOnInit) {
      params.errors.push({
        file: `${DEFAULT_CONFIG_ROOT}/config.yaml`,
        message: "Post-init validation failed: behavior.questionnaire_on_init mismatch."
      });
    }
  }
};

const writeBridgeFiles = (
  projectRoot: string,
  agent: AgentKey,
  createdFiles: string[]
): void => {
  const files = AGENT_TO_BRIDGE_FILES[agent] ?? AGENT_TO_BRIDGE_FILES.other;
  for (const fileName of files) {
    fs.writeFileSync(path.join(projectRoot, fileName), BRIDGE_CONTENT_BY_FILE[fileName], "utf8");
    createdFiles.push(fileName);
  }
};

const writeManifestFile = (params: {
  targetDir: string;
  selectedAgent: AgentKey;
  uiLocale: string;
  createdFiles: string[];
  errors: InitReport["errors"];
}): boolean => {
  const manifestFilePath = path.join(params.targetDir, MANIFEST_FILE_NAME);
  const manifestContent = toYaml({
    schema_version: SCHEMA_VERSION,
    generator: "ai-config",
    managed_by: "ai-config",
    created_at: new Date().toISOString(),
    selected_agent: params.selectedAgent,
    ui_locale: params.uiLocale,
    template_version: TEMPLATE_VERSION,
    qa_version: "1",
    qa_required_on_start: true,
    qa_completed: false,
    qa_completed_at: null
  });

  fs.writeFileSync(manifestFilePath, manifestContent, "utf8");
  const stats = fs.statSync(manifestFilePath);
  if (stats.size <= 0) {
    params.errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/${MANIFEST_FILE_NAME}`,
      message: "Manifest file was created but is empty."
    });
    return false;
  }

  params.createdFiles.push(`${DEFAULT_CONFIG_ROOT}/${MANIFEST_FILE_NAME}`);
  return true;
};

export class AiConfigInitializer implements ConfigInitializerPort {
  init(projectRoot: string, options?: InitOptions): InitReport {
    const absoluteRoot = path.resolve(projectRoot);
    const preflight = detectPreflightState(absoluteRoot);
    const createdFiles: string[] = [];
    const warnings: InitReport["warnings"] = [];
    const errors: InitReport["errors"] = [];
    const selectedAgent = options?.agent ?? DEFAULT_AGENT;
    const uiLocale = (options?.uiLocale ?? DEFAULT_UI_LOCALE).trim() || DEFAULT_UI_LOCALE;

    const templateDir = resolveTemplateDir();
    const targetDir = path.join(absoluteRoot, DEFAULT_CONFIG_ROOT);
    const force = options?.force === true;

    if (!fs.existsSync(templateDir)) {
      errors.push({
        file: DEFAULT_TEMPLATE_ROOT,
        message: `Template directory is missing: ${templateDir}`
      });
      return {
        ok: false,
        preflightState: preflight.state,
        projectRoot: absoluteRoot,
        selectedAgent,
        uiLocale,
        createdFiles,
        warnings,
        errors
      };
    }

    if (fs.existsSync(targetDir)) {
      if (!force) {
        const stateMessageByPreflight = {
          managed: `Target ./${DEFAULT_CONFIG_ROOT} is already managed by ai-config. Re-run with --force to re-bootstrap.`,
          foreign: `Target ./${DEFAULT_CONFIG_ROOT} exists and is not managed by ai-config. Re-run with --force to overwrite.`,
          mixed: `Target ./${DEFAULT_CONFIG_ROOT} is in mixed state (managed + foreign markers). Resolve manually or re-run with --force.`,
          fresh: `Target ./${DEFAULT_CONFIG_ROOT} already exists. Use --force to re-bootstrap.`
        } as const;
        errors.push({
          file: DEFAULT_CONFIG_ROOT,
          message: stateMessageByPreflight[preflight.state]
        });
        return {
          ok: false,
          preflightState: preflight.state,
          projectRoot: absoluteRoot,
          selectedAgent,
          uiLocale,
          createdFiles,
          warnings,
          errors
        };
      }

      warnings.push({
        file: DEFAULT_CONFIG_ROOT,
        message: `Existing ./${DEFAULT_CONFIG_ROOT} removed in force mode (previous state: ${preflight.state}).`
      });
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    fs.mkdirSync(targetDir, { recursive: true });
    fs.cpSync(templateDir, targetDir, { recursive: true });
    createdFiles.push(`${DEFAULT_CONFIG_ROOT}/**`);
    let manifestOk = false;
    try {
      manifestOk = writeManifestFile({
        targetDir,
        selectedAgent,
        uiLocale,
        createdFiles,
        errors
      });
    } catch (error) {
      errors.push({
        file: `${DEFAULT_CONFIG_ROOT}/${MANIFEST_FILE_NAME}`,
        message: `Failed to write manifest: ${error instanceof Error ? error.message : "unknown error"}`
      });
    }
    writeBridgeFiles(absoluteRoot, selectedAgent, createdFiles);
    applyResolvedConfiguration({
      targetDir,
      options: options ?? {},
      errors
    });
    runPostInitValidation({
      targetDir,
      selectedAgent,
      uiLocale,
      options: options ?? {},
      errors
    });

    return {
      ok: manifestOk && errors.length === 0,
      preflightState: preflight.state,
      projectRoot: absoluteRoot,
      selectedAgent,
      uiLocale,
      createdFiles,
      warnings,
      errors
    };
  }
}
