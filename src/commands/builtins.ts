import fs from "node:fs";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";

import { Command } from "commander";
import { parse as parseYaml } from "yaml";

import { createEnvelope, emitEnvelope } from "../cli/output";
import { AGENT_MENU_OPTIONS, normalizeAgentKey, type AgentKey } from "../core/agents";
import { CommandDefinition } from "../core/command-registry";
import { DEFAULT_CONFIG_ROOT } from "../core/config-paths";
import { EXIT_CODE } from "../core/exit-codes";
import {
  INIT_MODULES,
  INIT_PROFILES,
  MODULE_LIFECYCLE_STATES,
  MCP_PROVIDER_IDS,
  PROFILE_TO_MODULES,
  PROVIDER_PRESETS,
  resolveInitConfig,
  TASK_MODES,
  type InitModuleName,
  type InitProfile,
  type McpProviderId,
  type TaskMode
} from "../core/init-config";
import { UI_LOCALE_OPTIONS, normalizeUiLocale } from "../core/locales";
import { detectPreflightState } from "../core/preflight";
import { applySyncPlan, buildSyncPlan, templateExists } from "../core/sync-planner";
import type { InitIssue } from "../core/ports";

const REQUIRED_ROOT_FILES = [
  ".aiignore",
  "README.md",
  "config.yaml",
  "modules.yaml",
  "qa.yaml",
  "manifest.yaml"
] as const;

const asConfigFilePath = (fileName: string): string => `${DEFAULT_CONFIG_ROOT}/${fileName}`;

const splitCommaSeparated = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const parseBooleanOption = (value: string | undefined): boolean | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return null;
};

const selectAgentInteractive = async (): Promise<AgentKey | null> => {
  if (!input.isTTY || !output.isTTY) {
    return null;
  }

  const { isCancel, outro, select } = await import("@clack/prompts");
  const answer = await select({
    message: "Select AI agent for this project",
    options: AGENT_MENU_OPTIONS.map((option) => ({
      value: option.key,
      label: option.label,
      hint: option.description
    }))
  });

  if (isCancel(answer)) {
    outro("Operation cancelled.");
    return null;
  }

  return answer;
};

const selectLocaleInteractive = async (): Promise<string | null> => {
  if (!input.isTTY || !output.isTTY) {
    return null;
  }

  const { isCancel, outro, select, text } = await import("@clack/prompts");
  const answer = await select({
    message: "Select UI locale for user-facing AI content",
    options: UI_LOCALE_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      hint: option.hint
    }))
  });

  if (isCancel(answer)) {
    outro("Operation cancelled.");
    return null;
  }

  if (answer !== "custom") {
    return answer;
  }

  const customLocale = await text({
    message: "Enter locale code (e.g., es, de, pt-BR)",
    placeholder: "en",
    validate: (value = "") => (value.trim().length > 0 ? undefined : "Locale cannot be empty.")
  });

  if (isCancel(customLocale)) {
    outro("Operation cancelled.");
    return null;
  }

  return customLocale.trim();
};

const selectProfileInteractive = async (): Promise<InitProfile | null> => {
  if (!input.isTTY || !output.isTTY) {
    return null;
  }

  const { isCancel, outro, select } = await import("@clack/prompts");
  const answer = await select({
    message: "Select bootstrap profile",
    options: [
      { value: "minimal", label: "Minimal", hint: "core + qa" },
      {
        value: "standard",
        label: "Standard",
        hint: "recommended: project/rules/agents/skills/templates"
      },
      { value: "full", label: "Full", hint: "all modules enabled" }
    ]
  });

  if (isCancel(answer)) {
    outro("Operation cancelled.");
    return null;
  }

  return answer as InitProfile;
};

const selectSetupModeInteractive = async (): Promise<"quick" | "advanced" | null> => {
  if (!input.isTTY || !output.isTTY) {
    return null;
  }

  const { isCancel, outro, select } = await import("@clack/prompts");
  const answer = await select({
    message: "Select init setup mode",
    options: [
      {
        value: "quick",
        label: "Quick",
        hint: "profile defaults with minimal questions"
      },
      {
        value: "advanced",
        label: "Advanced",
        hint: "customize modules and runtime options"
      }
    ]
  });

  if (isCancel(answer)) {
    outro("Operation cancelled.");
    return null;
  }

  return answer as "quick" | "advanced";
};

const selectModulesInteractive = async (profile: InitProfile): Promise<InitModuleName[] | null> => {
  if (!input.isTTY || !output.isTTY) {
    return null;
  }

  const { isCancel, multiselect, outro } = await import("@clack/prompts");
  const selectedByProfile = new Set<InitModuleName>(PROFILE_TO_MODULES[profile]);
  const answer = await multiselect({
    message: "Select enabled modules",
    required: true,
    options: INIT_MODULES.map((moduleName) => ({
      value: moduleName,
      label: moduleName,
      hint: selectedByProfile.has(moduleName) ? "profile default" : undefined
    })),
    initialValues: Array.from(selectedByProfile)
  });

  if (isCancel(answer)) {
    outro("Operation cancelled.");
    return null;
  }

  const selected = Array.isArray(answer) ? answer : [];
  return INIT_MODULES.filter((moduleName) =>
    selected.includes(moduleName)
  ) as unknown as InitModuleName[];
};

const selectTaskModeInteractive = async (): Promise<TaskMode | null> => {
  if (!input.isTTY || !output.isTTY) {
    return null;
  }

  const { isCancel, outro, select } = await import("@clack/prompts");
  const answer = await select({
    message: "Select task mode",
    options: [
      { value: "off", label: "off", hint: "no task flow enforcement" },
      { value: "assisted", label: "assisted", hint: "recommended default" },
      { value: "enforced", label: "enforced", hint: "strict task process" }
    ]
  });

  if (isCancel(answer)) {
    outro("Operation cancelled.");
    return null;
  }

  return answer as TaskMode;
};

const selectQuestionnaireOnInitInteractive = async (): Promise<boolean | null> => {
  if (!input.isTTY || !output.isTTY) {
    return null;
  }

  const { confirm, isCancel, outro } = await import("@clack/prompts");
  const answer = await confirm({
    message: "Enable questionnaire on init?",
    initialValue: true
  });

  if (isCancel(answer)) {
    outro("Operation cancelled.");
    return null;
  }

  return Boolean(answer);
};

const selectMcpProvidersInteractive = async (
  profile: InitProfile
): Promise<McpProviderId[] | null> => {
  if (!input.isTTY || !output.isTTY) {
    return null;
  }

  const { isCancel, multiselect, outro } = await import("@clack/prompts");
  const preset = new Set(PROVIDER_PRESETS[profile]);
  const answer = await multiselect({
    message: "Select MCP providers to enable (optional)",
    required: false,
    options: MCP_PROVIDER_IDS.map((providerId) => ({
      value: providerId,
      label: providerId,
      hint: preset.has(providerId) ? "profile preset" : undefined
    })),
    initialValues: Array.from(preset)
  });

  if (isCancel(answer)) {
    outro("Operation cancelled.");
    return null;
  }

  const selected = Array.isArray(answer) ? answer : [];
  return MCP_PROVIDER_IDS.filter((providerId) =>
    selected.includes(providerId)
  ) as unknown as McpProviderId[];
};

const confirmInitConfigurationInteractive = async (params: {
  selectedAgent: AgentKey;
  uiLocale: string;
  profile: InitProfile;
  modules: InitModuleName[];
  taskMode: TaskMode;
  questionnaireOnInit: boolean;
  enableMcpProviders: McpProviderId[];
}): Promise<boolean | null> => {
  if (!input.isTTY || !output.isTTY) {
    return null;
  }

  const { confirm, isCancel, outro } = await import("@clack/prompts");
  console.log("Init configuration summary:");
  console.log(`- Agent: ${params.selectedAgent}`);
  console.log(`- UI locale: ${params.uiLocale}`);
  console.log(`- Profile: ${params.profile}`);
  console.log(`- Modules: ${params.modules.join(", ")}`);
  console.log(`- Task mode: ${params.taskMode}`);
  console.log(`- Questionnaire on init: ${params.questionnaireOnInit}`);
  console.log(
    `- MCP providers: ${params.enableMcpProviders.length > 0 ? params.enableMcpProviders.join(", ") : "(none)"}`
  );
  const answer = await confirm({
    message: "Apply this init configuration?",
    initialValue: true
  });

  if (isCancel(answer)) {
    outro("Operation cancelled.");
    return null;
  }

  return Boolean(answer);
};

const parseNonInteractiveInitOptions = (options: {
  agent?: string;
  uiLocale?: string;
  profile?: string;
  modules?: string;
  taskMode?: string;
  questionnaireOnInit?: string;
  enableMcpProviders?: string;
}): {
  selectedAgent: AgentKey | null;
  uiLocale: string | null;
  profile: InitProfile | null;
  modules: InitModuleName[];
  taskMode: TaskMode | null;
  questionnaireOnInit: boolean | null;
  enableMcpProviders: McpProviderId[];
  warnings: Array<{ message: string }>;
  errors: Array<{ message: string }>;
} => {
  const selectedAgent = normalizeAgentKey(options.agent);
  const uiLocale = normalizeUiLocale(options.uiLocale);
  const knownProfiles = new Set<string>(INIT_PROFILES);
  const knownModules = new Set<string>(INIT_MODULES);
  const knownTaskModes = new Set<string>(TASK_MODES);
  const knownProviders = new Set<string>(MCP_PROVIDER_IDS);

  const profileRaw = options.profile?.trim().toLowerCase();
  const profile =
    profileRaw && knownProfiles.has(profileRaw) ? (profileRaw as InitProfile) : "standard";

  const modulesRaw = splitCommaSeparated(options.modules).map((item) => item.toLowerCase());
  const modules = modulesRaw.filter((item): item is InitModuleName => knownModules.has(item));

  const taskModeRaw = options.taskMode?.trim().toLowerCase();
  const taskMode =
    taskModeRaw && knownTaskModes.has(taskModeRaw) ? (taskModeRaw as TaskMode) : null;

  const questionnaireOnInit = parseBooleanOption(options.questionnaireOnInit);

  const providersRaw = splitCommaSeparated(options.enableMcpProviders).map((item) =>
    item.toLowerCase()
  );
  const enableMcpProviders = providersRaw.filter(
    (item): item is McpProviderId => knownProviders.has(item)
  );

  const errors: Array<{ message: string }> = [];
  const warnings: Array<{ message: string }> = [];
  if (!options.agent) {
    errors.push({ message: "Missing required option --agent in --non-interactive mode." });
  } else if (!selectedAgent) {
    errors.push({
      message: `Invalid --agent value "${options.agent}". Use codex|claude|both|other.`
    });
  }

  if (!options.uiLocale) {
    errors.push({
      message: "Missing required option --ui-locale in --non-interactive mode."
    });
  } else if (!uiLocale) {
    errors.push({
      message: `Invalid --ui-locale value "${options.uiLocale}". Use locale like en, ru or pt-BR.`
    });
  }

  if (options.profile && (!profileRaw || !knownProfiles.has(profileRaw))) {
    errors.push({
      message: `Invalid --profile value "${options.profile}". Use minimal|standard|full.`
    });
  }

  if (modulesRaw.length > 0 && modulesRaw.length !== modules.length) {
    const invalidModules = modulesRaw.filter((moduleName) => !knownModules.has(moduleName));
    errors.push({
      message: `Invalid --modules value "${invalidModules.join(",")}". Use known module names from: ${INIT_MODULES.join("|")}.`
    });
  }

  if (options.taskMode && !taskMode) {
    errors.push({
      message: `Invalid --task-mode value "${options.taskMode}". Use off|assisted|enforced.`
    });
  }

  if (options.questionnaireOnInit && questionnaireOnInit === null) {
    errors.push({
      message: `Invalid --questionnaire-on-init value "${options.questionnaireOnInit}". Use true|false.`
    });
  }

  if (providersRaw.length > 0 && providersRaw.length !== enableMcpProviders.length) {
    const invalidProviders = providersRaw.filter((providerId) => !knownProviders.has(providerId));
    errors.push({
      message: `Invalid --enable-mcp-providers value "${invalidProviders.join(",")}". Use known provider IDs from: ${MCP_PROVIDER_IDS.join("|")}.`
    });
  }

  const resolved = resolveInitConfig(
    {
      profile,
      modules: options.modules ? modules : undefined,
      taskMode: taskMode ?? undefined,
      questionnaireOnInit: questionnaireOnInit ?? undefined,
      enableMcpProviders
    },
    {
      autoFixDependencies: false
    }
  );
  for (const resolverError of resolved.errors) {
    errors.push({ message: `Invalid configuration: ${resolverError}` });
  }
  if (resolved.autoAddedModules.length > 0) {
    warnings.push({
      message: `Auto-enabled dependent modules: ${resolved.autoAddedModules.join(", ")}.`
    });
  }

  return {
    selectedAgent,
    uiLocale,
    profile: resolved.profile,
    modules: resolved.modules,
    taskMode: resolved.taskMode,
    questionnaireOnInit: resolved.questionnaireOnInit,
    enableMcpProviders: resolved.enableMcpProviders,
    warnings,
    errors
  };
};

const readYamlObject = (
  filePath: string,
  displayPath: string
): { content: Record<string, unknown> | null; errors: InitIssue[] } => {
  if (!fs.existsSync(filePath)) {
    return {
      content: null,
      errors: [{ file: displayPath, message: `Missing ${path.basename(filePath)}.` }]
    };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = parseYaml(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        content: null,
        errors: [
          {
            file: displayPath,
            message: `${path.basename(filePath)} must contain a YAML object.`
          }
        ]
      };
    }
    return { content: parsed as Record<string, unknown>, errors: [] };
  } catch (error) {
    return {
      content: null,
      errors: [
        {
          file: displayPath,
          message: `Failed to read ${path.basename(filePath)}: ${error instanceof Error ? error.message : "unknown error"}`
        }
      ]
    };
  }
};

const validateManifestContent = (manifest: Record<string, unknown>): InitIssue[] => {
  const errors: InitIssue[] = [];
  const schemaVersion = manifest.schema_version;
  const generator = manifest.generator;
  const managedBy = manifest.managed_by;
  const selectedAgent = manifest.selected_agent;
  const uiLocale = manifest.ui_locale;
  const qaRequiredOnStart = manifest.qa_required_on_start;

  if (typeof schemaVersion !== "string" || schemaVersion.trim().length === 0) {
    errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/manifest.yaml`,
      message: "Missing or invalid 'schema_version'."
    });
  }

  if (generator !== "ai-config") {
    errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/manifest.yaml`,
      message: "Missing or invalid 'generator' (expected 'ai-config')."
    });
  }

  if (managedBy !== "ai-config") {
    errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/manifest.yaml`,
      message: "Missing or invalid 'managed_by' (expected 'ai-config')."
    });
  }

  if (typeof selectedAgent !== "string" || !normalizeAgentKey(selectedAgent)) {
    errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/manifest.yaml`,
      message: "Missing or invalid 'selected_agent'."
    });
  }

  if (typeof uiLocale !== "string" || !normalizeUiLocale(uiLocale)) {
    errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/manifest.yaml`,
      message: "Missing or invalid 'ui_locale'."
    });
  }

  if (typeof qaRequiredOnStart !== "boolean") {
    errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/manifest.yaml`,
      message: "Missing or invalid 'qa_required_on_start'."
    });
  }

  return errors;
};

const collectQaQuestionTexts = (qa: Record<string, unknown>): string[] => {
  const texts: string[] = [];
  const directQuestions = qa.questions;
  if (Array.isArray(directQuestions)) {
    for (const questionDef of directQuestions) {
      if (!questionDef || typeof questionDef !== "object" || Array.isArray(questionDef)) {
        continue;
      }
      const questionText = (questionDef as Record<string, unknown>).question;
      if (typeof questionText === "string" && questionText.trim().length > 0) {
        texts.push(questionText);
      }
    }
  }

  const sections = qa.sections;
  if (Array.isArray(sections)) {
    for (const sectionDef of sections) {
      if (!sectionDef || typeof sectionDef !== "object" || Array.isArray(sectionDef)) {
        continue;
      }
      const questions = (sectionDef as Record<string, unknown>).questions;
      if (!Array.isArray(questions)) {
        continue;
      }
      for (const questionDef of questions) {
        if (!questionDef || typeof questionDef !== "object" || Array.isArray(questionDef)) {
          continue;
        }
        const questionText = (questionDef as Record<string, unknown>).question;
        if (typeof questionText === "string" && questionText.trim().length > 0) {
          texts.push(questionText);
        }
      }
    }
  }

  return texts;
};

const containsCyrillic = (text: string): boolean => /[А-Яа-яЁё]/.test(text);
const containsLatinLetters = (text: string): boolean => /[A-Za-z]/.test(text);

const validateQaLocaleConsistency = (
  manifest: Record<string, unknown> | null,
  qa: Record<string, unknown> | null
): InitIssue[] => {
  const warnings: InitIssue[] = [];
  if (!manifest || !qa) {
    return warnings;
  }

  const uiLocaleRaw = manifest.ui_locale;
  if (typeof uiLocaleRaw !== "string") {
    return warnings;
  }
  const uiLocale = uiLocaleRaw.trim().toLowerCase();
  const qaQuestionTexts = collectQaQuestionTexts(qa);
  if (qaQuestionTexts.length === 0) {
    return warnings;
  }

  if (uiLocale === "ru" || uiLocale.startsWith("ru-")) {
    const mismatchedQuestions = qaQuestionTexts.filter(
      (text) => containsLatinLetters(text) && !containsCyrillic(text)
    );
    if (mismatchedQuestions.length > 0) {
      warnings.push({
        file: asConfigFilePath("qa.yaml"),
        message:
          `QA language mismatch with ui_locale="${uiLocaleRaw}". ` +
          "Detected likely non-Russian question text; generate QA questions in ui_locale."
      });
    }
  }

  return warnings;
};

const validateConfigContent = (config: Record<string, unknown>): InitIssue[] => {
  const errors: InitIssue[] = [];
  const schema = config.schema;
  const schemaVersion =
    schema && typeof schema === "object" && !Array.isArray(schema)
      ? (schema as Record<string, unknown>).version
      : null;

  if (typeof schemaVersion !== "string" || schemaVersion.trim().length === 0) {
    errors.push({
      file: asConfigFilePath("config.yaml"),
      message: "Missing or invalid 'schema.version'."
    });
  }

  return errors;
};

type ModuleEntry = {
  name: string;
  path: string;
  enabled: boolean;
  state: string;
};

const readModuleEntries = (modulesConfig: Record<string, unknown>): ModuleEntry[] => {
  const modules = modulesConfig.modules;
  if (!Array.isArray(modules)) {
    return [];
  }

  const entries: ModuleEntry[] = [];
  for (const moduleDef of modules) {
    if (!moduleDef || typeof moduleDef !== "object" || Array.isArray(moduleDef)) {
      continue;
    }
    const entry = moduleDef as Record<string, unknown>;
    entries.push({
      name: typeof entry.name === "string" ? entry.name : "",
      path: typeof entry.path === "string" ? entry.path : "",
      enabled: entry.enabled === true,
      state: typeof entry.state === "string" ? entry.state : ""
    });
  }

  return entries;
};

const validateModulesContent = (
  modulesConfig: Record<string, unknown>,
  aiRoot: string
): InitIssue[] => {
  const errors: InitIssue[] = [];

  const schemaVersion = modulesConfig.schema_version;
  if (typeof schemaVersion !== "string" || schemaVersion.trim().length === 0) {
    errors.push({
      file: asConfigFilePath("modules.yaml"),
      message: "Missing or invalid 'schema_version'."
    });
  }

  const modules = modulesConfig.modules;
  if (!Array.isArray(modules)) {
    errors.push({
      file: asConfigFilePath("modules.yaml"),
      message: "Missing or invalid 'modules' list."
    });
    return errors;
  }

  for (const moduleEntry of readModuleEntries(modulesConfig)) {
    if (!moduleEntry.name || !moduleEntry.path) {
      errors.push({
        file: asConfigFilePath("modules.yaml"),
        message: "Module entry must include non-empty 'name' and 'path'."
      });
      continue;
    }

    if (!moduleEntry.enabled) {
      continue;
    }

    const resolvedPath = path.resolve(aiRoot, moduleEntry.path);
    if (!resolvedPath.startsWith(path.resolve(aiRoot))) {
      errors.push({
        file: asConfigFilePath("modules.yaml"),
        message: `Enabled module "${moduleEntry.name}" points outside ./${DEFAULT_CONFIG_ROOT}: ${moduleEntry.path}`
      });
      continue;
    }

    if (!fs.existsSync(resolvedPath)) {
      errors.push({
        file: asConfigFilePath("modules.yaml"),
        message: `Enabled module "${moduleEntry.name}" points to missing path: ${moduleEntry.path}`
      });
    }
  }

  return errors;
};

const validateModuleLifecycleStates = (moduleEntries: ModuleEntry[]): InitIssue[] => {
  const errors: InitIssue[] = [];
  const knownStates = new Set<string>(MODULE_LIFECYCLE_STATES);

  for (const moduleEntry of moduleEntries) {
    if (!moduleEntry.name) {
      continue;
    }

    if (!moduleEntry.state || !knownStates.has(moduleEntry.state)) {
      errors.push({
        file: asConfigFilePath("modules.yaml"),
        message:
          `Module "${moduleEntry.name}" has invalid state "${moduleEntry.state || "<missing>"}". ` +
          `Use one of: ${MODULE_LIFECYCLE_STATES.join("|")}.`
      });
      continue;
    }

    if (!moduleEntry.enabled && moduleEntry.state !== "disabled") {
      errors.push({
        file: asConfigFilePath("modules.yaml"),
        message: `Module "${moduleEntry.name}" is disabled but state is "${moduleEntry.state}" (expected "disabled").`
      });
    }
  }

  return errors;
};

const validateEnabledModuleReadiness = (
  aiRoot: string,
  moduleEntries: ModuleEntry[]
): { errors: InitIssue[]; warnings: InitIssue[] } => {
  const errors: InitIssue[] = [];
  const warnings: InitIssue[] = [];
  const byName = new Map<string, ModuleEntry>(moduleEntries.map((entry) => [entry.name, entry]));

  const assertPathExists = (
    relativePath: string,
    severity: "error" | "warning",
    message: string
  ): void => {
    const absolutePath = path.join(aiRoot, relativePath);
    if (fs.existsSync(absolutePath)) {
      return;
    }
    const issue = { file: asConfigFilePath(relativePath.replace(/\\/g, "/")), message };
    if (severity === "error") {
      errors.push(issue);
      return;
    }
    warnings.push(issue);
  };

  const enabledEntries = moduleEntries.filter((entry) => entry.enabled);
  for (const entry of enabledEntries) {
    if (entry.state === "degraded") {
      warnings.push({
        file: asConfigFilePath("modules.yaml"),
        message: `Module "${entry.name}" is enabled with state "degraded".`
      });
    }
  }

  if (byName.get("project")?.enabled) {
    assertPathExists("project/description.md", "error", "Project module requires project/description.md.");
    assertPathExists("project/tech-stack.yaml", "error", "Project module requires project/tech-stack.yaml.");
  }

  if (byName.get("rules")?.enabled) {
    assertPathExists("rules/text-and-locale.md", "error", "Rules module requires rules/text-and-locale.md.");
  }

  if (byName.get("agents")?.enabled) {
    assertPathExists("agents/registry.yaml", "error", "Agents module requires agents/registry.yaml.");
  }

  if (byName.get("mcp")?.enabled) {
    assertPathExists("mcp/registry.yaml", "error", "MCP module requires mcp/registry.yaml.");
    assertPathExists("mcp/policies.yaml", "error", "MCP module requires mcp/policies.yaml.");
  }

  if (byName.get("skills")?.enabled) {
    assertPathExists("skills/registry.yaml", "error", "Skills module requires skills/registry.yaml.");
  }

  if (byName.get("orchestration")?.enabled) {
    assertPathExists(
      "orchestration/orchestration.yaml",
      "error",
      "Orchestration module requires orchestration/orchestration.yaml."
    );
    assertPathExists(
      "orchestration/workflows",
      "error",
      "Orchestration module requires orchestration/workflows directory."
    );
  }

  if (byName.get("contracts")?.enabled) {
    assertPathExists("contracts/README.md", "error", "Contracts module requires contracts/README.md.");
    assertPathExists(
      "contracts/module-contract-template.md",
      "error",
      "Contracts module requires contracts/module-contract-template.md."
    );
  }

  if (byName.get("checklists")?.enabled) {
    assertPathExists("checklists/README.md", "error", "Checklists module requires checklists/README.md.");
    assertPathExists(
      "checklists/pr-checklist.md",
      "error",
      "Checklists module requires checklists/pr-checklist.md."
    );
    assertPathExists(
      "checklists/release-checklist.md",
      "error",
      "Checklists module requires checklists/release-checklist.md."
    );
  }

  if (byName.get("adr")?.enabled) {
    assertPathExists("adr/README.md", "error", "ADR module requires adr/README.md.");
    assertPathExists("adr/template.md", "error", "ADR module requires adr/template.md.");
    assertPathExists("adr/records", "error", "ADR module requires adr/records directory.");
  }

  if (byName.get("governance")?.enabled) {
    assertPathExists("governance/README.md", "error", "Governance module requires governance/README.md.");
    assertPathExists(
      "governance/ownership.yaml",
      "error",
      "Governance module requires governance/ownership.yaml."
    );
    assertPathExists(
      "governance/escalation.yaml",
      "error",
      "Governance module requires governance/escalation.yaml."
    );
  }

  if (byName.get("interfaces")?.enabled) {
    assertPathExists("interfaces/README.md", "error", "Interfaces module requires interfaces/README.md.");
    assertPathExists(
      "interfaces/registry.yaml",
      "error",
      "Interfaces module requires interfaces/registry.yaml."
    );
    assertPathExists(
      "interfaces/schemas.yaml",
      "error",
      "Interfaces module requires interfaces/schemas.yaml."
    );
  }

  if (byName.get("runbooks")?.enabled) {
    assertPathExists("runbooks/README.md", "error", "Runbooks module requires runbooks/README.md.");
    assertPathExists(
      "runbooks/incident-response.md",
      "error",
      "Runbooks module requires runbooks/incident-response.md."
    );
    assertPathExists(
      "runbooks/release-ops.md",
      "error",
      "Runbooks module requires runbooks/release-ops.md."
    );
  }

  if (byName.get("risk")?.enabled) {
    assertPathExists("risk/README.md", "error", "Risk module requires risk/README.md.");
    assertPathExists(
      "risk/risk-register.yaml",
      "error",
      "Risk module requires risk/risk-register.yaml."
    );
    assertPathExists(
      "risk/mitigation-plan.md",
      "error",
      "Risk module requires risk/mitigation-plan.md."
    );
  }

  if (byName.get("quality")?.enabled) {
    assertPathExists("quality/README.md", "error", "Quality module requires quality/README.md.");
    assertPathExists(
      "quality/gates.yaml",
      "error",
      "Quality module requires quality/gates.yaml."
    );
    assertPathExists(
      "quality/profile.yaml",
      "error",
      "Quality module requires quality/profile.yaml."
    );
  }

  if (byName.get("security")?.enabled) {
    assertPathExists("security/README.md", "error", "Security module requires security/README.md.");
    assertPathExists(
      "security/controls.yaml",
      "error",
      "Security module requires security/controls.yaml."
    );
    assertPathExists(
      "security/secrets-policy.md",
      "error",
      "Security module requires security/secrets-policy.md."
    );
  }

  if (byName.get("observability")?.enabled) {
    assertPathExists(
      "observability/README.md",
      "error",
      "Observability module requires observability/README.md."
    );
    assertPathExists(
      "observability/baseline.yaml",
      "error",
      "Observability module requires observability/baseline.yaml."
    );
    assertPathExists(
      "observability/slo-policy.md",
      "error",
      "Observability module requires observability/slo-policy.md."
    );
  }

  if (byName.get("templates")?.enabled) {
    assertPathExists("templates/qa-template.yaml", "warning", "Templates module should include templates/qa-template.yaml.");
  }

  if (byName.get("memory")?.enabled) {
    const memoryProfilePath = path.join(aiRoot, "memory", "profile.yaml");
    const memoryProfile = readYamlObject(memoryProfilePath, asConfigFilePath("memory/profile.yaml"));
    errors.push(...memoryProfile.errors);
    if (memoryProfile.content && memoryProfile.content.enabled !== true) {
      warnings.push({
        file: asConfigFilePath("memory/profile.yaml"),
        message: "Memory module is enabled but memory/profile.yaml has enabled != true."
      });
    }
  }

  if (byName.get("logs")?.enabled) {
    const logsPolicyPath = path.join(aiRoot, "logs", "policy.yaml");
    const logsPolicy = readYamlObject(logsPolicyPath, asConfigFilePath("logs/policy.yaml"));
    errors.push(...logsPolicy.errors);
    if (logsPolicy.content && logsPolicy.content.enabled !== true) {
      warnings.push({
        file: asConfigFilePath("logs/policy.yaml"),
        message: "Logs module is enabled but logs/policy.yaml has enabled != true."
      });
    }
  }

  return { errors, warnings };
};

const validateSkillsRegistryAgainstModules = (
  aiRoot: string,
  declaredModuleNames: Set<string>
): InitIssue[] => {
  const skillsRegistryPath = path.join(aiRoot, "skills", "registry.yaml");
  const displayPath = asConfigFilePath("skills/registry.yaml");
  const errors: InitIssue[] = [];
  const readResult = readYamlObject(skillsRegistryPath, displayPath);
  errors.push(...readResult.errors);
  if (!readResult.content) {
    return errors;
  }

  const skills = readResult.content.skills;
  if (!Array.isArray(skills)) {
    errors.push({
      file: displayPath,
      message: "Missing or invalid 'skills' list."
    });
    return errors;
  }

  for (const skillDef of skills) {
    if (!skillDef || typeof skillDef !== "object" || Array.isArray(skillDef)) {
      continue;
    }
    const skill = skillDef as Record<string, unknown>;
    const skillId = typeof skill.id === "string" ? skill.id : "<unknown-skill>";
    const requiredModules = skill.required_modules;
    if (!Array.isArray(requiredModules)) {
      continue;
    }

    for (const moduleName of requiredModules) {
      if (typeof moduleName !== "string" || moduleName.trim().length === 0) {
        continue;
      }
      if (!declaredModuleNames.has(moduleName)) {
        errors.push({
          file: displayPath,
          message: `Skill "${skillId}" references unknown module "${moduleName}" in required_modules.`
        });
      }
    }
  }

  return errors;
};

const validateWorkflowRolesAgainstAgents = (aiRoot: string): InitIssue[] => {
  const errors: InitIssue[] = [];
  const agentsRegistryPath = path.join(aiRoot, "agents", "registry.yaml");
  const agentsDisplayPath = asConfigFilePath("agents/registry.yaml");
  const agentsReadResult = readYamlObject(agentsRegistryPath, agentsDisplayPath);
  errors.push(...agentsReadResult.errors);
  if (!agentsReadResult.content) {
    return errors;
  }

  const roles = agentsReadResult.content.roles;
  if (!Array.isArray(roles)) {
    errors.push({
      file: agentsDisplayPath,
      message: "Missing or invalid 'roles' list."
    });
    return errors;
  }

  const roleIds = new Set<string>();
  for (const roleDef of roles) {
    if (!roleDef || typeof roleDef !== "object" || Array.isArray(roleDef)) {
      continue;
    }
    const roleId = (roleDef as Record<string, unknown>).id;
    if (typeof roleId === "string" && roleId.trim().length > 0) {
      roleIds.add(roleId);
    }
  }

  const workflowsDir = path.join(aiRoot, "orchestration", "workflows");
  if (!fs.existsSync(workflowsDir) || !fs.statSync(workflowsDir).isDirectory()) {
    errors.push({
      file: asConfigFilePath("orchestration/workflows"),
      message: "Missing workflows directory."
    });
    return errors;
  }

  const workflowFiles = fs
    .readdirSync(workflowsDir)
    .filter((fileName) => fileName.endsWith(".yaml") || fileName.endsWith(".yml"));

  for (const workflowFile of workflowFiles) {
    const workflowPath = path.join(workflowsDir, workflowFile);
    const workflowDisplayPath = asConfigFilePath(`orchestration/workflows/${workflowFile}`);
    const workflowReadResult = readYamlObject(workflowPath, workflowDisplayPath);
    errors.push(...workflowReadResult.errors);
    if (!workflowReadResult.content) {
      continue;
    }

    const steps = workflowReadResult.content.steps;
    if (!Array.isArray(steps)) {
      continue;
    }

    for (const stepDef of steps) {
      if (!stepDef || typeof stepDef !== "object" || Array.isArray(stepDef)) {
        continue;
      }
      const step = stepDef as Record<string, unknown>;
      const stepId = typeof step.id === "string" ? step.id : "<unknown-step>";
      const stepRole = step.role;
      const fallbackRole = step.fallback_role;

      if (typeof stepRole === "string" && stepRole.trim().length > 0 && !roleIds.has(stepRole)) {
        errors.push({
          file: workflowDisplayPath,
          message: `Step "${stepId}" references unknown role "${stepRole}".`
        });
      }

      if (
        typeof fallbackRole === "string" &&
        fallbackRole.trim().length > 0 &&
        !roleIds.has(fallbackRole)
      ) {
        errors.push({
          file: workflowDisplayPath,
          message: `Step "${stepId}" references unknown fallback_role "${fallbackRole}".`
        });
      }
    }
  }

  return errors;
};

export const builtInCommands: CommandDefinition[] = [
  {
    name: "init",
    description: "Generate ./.ai from ./ai-template",
    register: (program: Command, context) => {
      program
        .command("init")
        .description("Generate ./.ai from ./ai-template")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--force", "Recreate ./.ai when it already exists", false)
        .option("--non-interactive", "Disable prompts and require flags", false)
        .option("--agent <agent>", "Agent key for non-interactive mode: codex|claude|both|other")
        .option("--ui-locale <locale>", "UI locale for non-interactive mode, e.g. en|ru|pt-BR")
        .option("--profile <profile>", "Init profile: minimal|standard|full", "standard")
        .option(
          "--modules <modules>",
          "Optional CSV override for enabled modules, e.g. core,qa,project,rules"
        )
        .option("--task-mode <taskMode>", "Task mode override: off|assisted|enforced")
        .option(
          "--questionnaire-on-init <boolean>",
          "Questionnaire toggle override in non-interactive mode: true|false"
        )
        .option(
          "--enable-mcp-providers <providers>",
          "Optional CSV list of MCP providers to enable, e.g. context7,chrome-devtools"
        )
        .action(
          async (options: {
            cwd: string;
            format: "human" | "json";
            force?: boolean;
            nonInteractive?: boolean;
            agent?: string;
            uiLocale?: string;
            profile?: string;
            modules?: string;
            taskMode?: string;
            questionnaireOnInit?: string;
            enableMcpProviders?: string;
          }) => {
            const targetDir = path.resolve(options.cwd);
            let selectedAgent: AgentKey | null = null;
            let uiLocale: string | null = null;
            let profile: InitProfile = "standard";
            let modules: InitModuleName[] = [];
            let taskMode: TaskMode | null = null;
            let questionnaireOnInit: boolean | null = null;
            let enableMcpProviders: McpProviderId[] = [];
            const initWarnings: Array<{ message: string }> = [];

            if (options.nonInteractive) {
              const parsedOptions = parseNonInteractiveInitOptions(options);
              selectedAgent = parsedOptions.selectedAgent;
              uiLocale = parsedOptions.uiLocale;
              profile = parsedOptions.profile ?? "standard";
              modules = parsedOptions.modules;
              taskMode = parsedOptions.taskMode;
              questionnaireOnInit = parsedOptions.questionnaireOnInit;
              enableMcpProviders = parsedOptions.enableMcpProviders;
              initWarnings.push(...parsedOptions.warnings);

              const errors = parsedOptions.errors;

              if (errors.length > 0) {
                const envelope = createEnvelope({
                  ok: false,
                  command: "init",
                  data: {
                    nonInteractive: true
                  },
                  warnings: [],
                  errors
                });
                emitEnvelope(envelope, options.format);
                process.exitCode = EXIT_CODE.USAGE;
                return;
              }
            } else {
              selectedAgent = await selectAgentInteractive();
              if (!selectedAgent) {
                const envelope = createEnvelope({
                  ok: false,
                  command: "init",
                  data: {},
                  warnings: [],
                  errors: [
                    {
                      message:
                        "Agent selection was cancelled or unavailable. Run init in interactive mode."
                    }
                  ]
                });
                emitEnvelope(envelope, options.format);
                process.exitCode = EXIT_CODE.USAGE;
                return;
              }
              uiLocale = await selectLocaleInteractive();
              if (!uiLocale) {
                const envelope = createEnvelope({
                  ok: false,
                  command: "init",
                  data: {},
                  warnings: [],
                  errors: [
                    {
                      message:
                        "Locale selection was cancelled or unavailable. Run init in interactive mode."
                    }
                  ]
                });
                emitEnvelope(envelope, options.format);
                process.exitCode = EXIT_CODE.USAGE;
                return;
              }

              const selectedProfile = await selectProfileInteractive();
              if (!selectedProfile) {
                const envelope = createEnvelope({
                  ok: false,
                  command: "init",
                  data: {},
                  warnings: [],
                  errors: [{ message: "Profile selection was cancelled." }]
                });
                emitEnvelope(envelope, options.format);
                process.exitCode = EXIT_CODE.USAGE;
                return;
              }
              profile = selectedProfile;

              const setupMode = await selectSetupModeInteractive();
              if (!setupMode) {
                const envelope = createEnvelope({
                  ok: false,
                  command: "init",
                  data: {},
                  warnings: [],
                  errors: [{ message: "Setup mode selection was cancelled." }]
                });
                emitEnvelope(envelope, options.format);
                process.exitCode = EXIT_CODE.USAGE;
                return;
              }

              if (setupMode === "quick") {
                const quickResolved = resolveInitConfig(
                  {
                    profile
                  },
                  {
                    autoFixDependencies: true
                  }
                );
                modules = quickResolved.modules;
                taskMode = quickResolved.taskMode;
                questionnaireOnInit = quickResolved.questionnaireOnInit;
                enableMcpProviders = quickResolved.enableMcpProviders;
                if (quickResolved.autoAddedModules.length > 0) {
                  initWarnings.push({
                    message:
                      `Auto-enabled dependent modules: ${quickResolved.autoAddedModules.join(", ")}.`
                  });
                }
              } else {
                const selectedModules = await selectModulesInteractive(profile);
                if (!selectedModules) {
                  const envelope = createEnvelope({
                    ok: false,
                    command: "init",
                    data: {},
                    warnings: [],
                    errors: [{ message: "Module selection was cancelled." }]
                  });
                  emitEnvelope(envelope, options.format);
                  process.exitCode = EXIT_CODE.USAGE;
                  return;
                }

                const resolved = resolveInitConfig(
                  {
                    profile,
                    modules: selectedModules
                  },
                  {
                    autoFixDependencies: true
                  }
                );
                modules = resolved.modules;
                taskMode = resolved.taskMode;
                questionnaireOnInit = resolved.questionnaireOnInit;
                if (resolved.autoAddedModules.length > 0) {
                  initWarnings.push({
                    message:
                      `Auto-enabled dependent modules: ${resolved.autoAddedModules.join(", ")}.`
                  });
                }

                const selectedTaskMode = await selectTaskModeInteractive();
                if (!selectedTaskMode) {
                  const envelope = createEnvelope({
                    ok: false,
                    command: "init",
                    data: {},
                    warnings: [],
                    errors: [{ message: "Task mode selection was cancelled." }]
                  });
                  emitEnvelope(envelope, options.format);
                  process.exitCode = EXIT_CODE.USAGE;
                  return;
                }
                const taskResolved = resolveInitConfig(
                  {
                    profile,
                    modules,
                    taskMode: selectedTaskMode,
                    questionnaireOnInit: questionnaireOnInit ?? undefined
                  },
                  {
                    autoFixDependencies: true
                  }
                );
                taskMode = taskResolved.taskMode;

                const selectedQuestionnaireOnInit = await selectQuestionnaireOnInitInteractive();
                if (selectedQuestionnaireOnInit === null) {
                  const envelope = createEnvelope({
                    ok: false,
                    command: "init",
                    data: {},
                    warnings: [],
                    errors: [{ message: "Questionnaire selection was cancelled." }]
                  });
                  emitEnvelope(envelope, options.format);
                  process.exitCode = EXIT_CODE.USAGE;
                  return;
                }
                const qaResolved = resolveInitConfig(
                  {
                    profile,
                    modules,
                    taskMode: taskMode ?? undefined,
                    questionnaireOnInit: selectedQuestionnaireOnInit
                  },
                  {
                    autoFixDependencies: true
                  }
                );
                questionnaireOnInit = qaResolved.questionnaireOnInit;

                if (modules.includes("mcp")) {
                  const selectedProviders = await selectMcpProvidersInteractive(profile);
                  if (!selectedProviders) {
                    const envelope = createEnvelope({
                      ok: false,
                      command: "init",
                      data: {},
                      warnings: [],
                      errors: [{ message: "MCP providers selection was cancelled." }]
                    });
                    emitEnvelope(envelope, options.format);
                    process.exitCode = EXIT_CODE.USAGE;
                    return;
                  }
                  const providerResolved = resolveInitConfig(
                    {
                      profile,
                      modules,
                      taskMode: taskMode ?? undefined,
                      questionnaireOnInit: questionnaireOnInit ?? undefined,
                      enableMcpProviders: selectedProviders
                    },
                    {
                      autoFixDependencies: true
                    }
                  );
                  enableMcpProviders = providerResolved.enableMcpProviders;
                }
              }

              const confirmed = await confirmInitConfigurationInteractive({
                selectedAgent,
                uiLocale,
                profile,
                modules,
                taskMode: taskMode ?? "off",
                questionnaireOnInit: questionnaireOnInit ?? false,
                enableMcpProviders
              });
              if (!confirmed) {
                const envelope = createEnvelope({
                  ok: false,
                  command: "init",
                  data: {},
                  warnings: [],
                  errors: [{ message: "Init configuration was cancelled by user." }]
                });
                emitEnvelope(envelope, options.format);
                process.exitCode = EXIT_CODE.USAGE;
                return;
              }
            }

            const finalResolved = resolveInitConfig(
              {
                profile,
                modules: modules.length > 0 ? modules : undefined,
                taskMode: taskMode ?? undefined,
                questionnaireOnInit: questionnaireOnInit ?? undefined,
                enableMcpProviders
              },
              {
                autoFixDependencies: options.nonInteractive !== true
              }
            );
            profile = finalResolved.profile;
            modules = finalResolved.modules;
            taskMode = finalResolved.taskMode;
            questionnaireOnInit = finalResolved.questionnaireOnInit;
            enableMcpProviders = finalResolved.enableMcpProviders;
            if (finalResolved.autoAddedModules.length > 0) {
              initWarnings.push({
                message: `Auto-enabled dependent modules: ${finalResolved.autoAddedModules.join(", ")}.`
              });
            }
            if (finalResolved.errors.length > 0) {
              const envelope = createEnvelope({
                ok: false,
                command: "init",
                data: {
                  nonInteractive: options.nonInteractive === true
                },
                warnings: initWarnings,
                errors: finalResolved.errors.map((message) => ({ message }))
              });
              emitEnvelope(envelope, options.format);
              process.exitCode = EXIT_CODE.USAGE;
              return;
            }

            const report = context.initializer.init(targetDir, {
              force: options.force ?? false,
              agent: selectedAgent ?? undefined,
              uiLocale: uiLocale ?? undefined,
              profile,
              modules,
              taskMode: taskMode ?? undefined,
              questionnaireOnInit: questionnaireOnInit ?? undefined,
              enableMcpProviders
            });
            const envelope = createEnvelope({
              ok: report.ok,
              command: "init",
              data: {
                preflightState: report.preflightState,
                projectRoot: report.projectRoot,
                selectedAgent: report.selectedAgent,
                uiLocale: report.uiLocale,
                profile,
                modules,
                taskMode,
                questionnaireOnInit,
                enableMcpProviders,
                createdFiles: report.createdFiles
              },
              warnings: [...initWarnings, ...report.warnings],
              errors: report.errors
            });

            emitEnvelope(envelope, options.format);
            if (options.format === "human") {
              if (report.ok) {
                console.log("Init completed.");
                console.log(`Preflight: ${report.preflightState}`);
                console.log(`Agent: ${report.selectedAgent}`);
                console.log(`UI locale: ${report.uiLocale}`);
                console.log(`Profile: ${profile}`);
                console.log(`Created: ${report.createdFiles.join(", ")}`);
                if (initWarnings.length > 0) {
                  for (const warning of initWarnings) {
                    console.log(`- [WARN] ${warning.message}`);
                  }
                }
              } else {
                console.error("Init failed.");
                for (const error of report.errors) {
                  console.error(`- [ERROR] ${error.file}: ${error.message}`);
                }
              }
            }

            if (!report.ok) {
              process.exitCode = EXIT_CODE.ERROR;
            }
          }
        );
    }
  },
  {
    name: "sync",
    description: "Plan synchronization between ./.ai and ai-template",
    register: (program: Command) => {
      program
        .command("sync")
        .description("Plan synchronization between ./.ai and ai-template (dry-run)")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--dry-run", "Preview only mode", true)
        .option("--no-dry-run", "Apply missing template files/directories")
        .option("--conflicts-only", "Show only conflict actions and recommendations", false)
        .action(
          (options: {
            cwd: string;
            format: "human" | "json";
            dryRun: boolean;
            conflictsOnly?: boolean;
          }) => {
            const projectRoot = path.resolve(options.cwd);
            const preflight = detectPreflightState(projectRoot);
            const warnings: InitIssue[] = [];
            const errors: InitIssue[] = [];

            if (!options.dryRun && options.conflictsOnly) {
              errors.push({
                file: DEFAULT_CONFIG_ROOT,
                message: "--conflicts-only is supported only in dry-run mode."
              });
            }

            if (!templateExists()) {
              errors.push({
                file: "ai-template",
                message: "Template directory is missing in the package."
              });
            }

            if (preflight.state === "fresh") {
              errors.push({
                file: DEFAULT_CONFIG_ROOT,
                message: `Missing ./${DEFAULT_CONFIG_ROOT} directory. Run init first.`
              });
            } else if (preflight.state === "foreign") {
              errors.push({
                file: DEFAULT_CONFIG_ROOT,
                message:
                `Detected foreign ./${DEFAULT_CONFIG_ROOT} (not managed by ai-config). ` +
                "Use init --force or migration flow before sync."
              });
            } else if (preflight.state === "mixed") {
              errors.push({
                file: DEFAULT_CONFIG_ROOT,
                message:
                `Detected mixed ./${DEFAULT_CONFIG_ROOT} state (managed + foreign markers). ` +
                "Resolve conflicts before sync."
              });
            }

            const canPlan = errors.length === 0 && preflight.state === "managed";
            let plan: ReturnType<typeof buildSyncPlan> = {
              actions: [],
              recommendations: [],
              summary: { createDirs: 0, createFiles: 0, updateFiles: 0, conflictFiles: 0, unchanged: 0 }
            };
            if (canPlan) {
              plan = buildSyncPlan(projectRoot);
            }
            const visibleActions = options.conflictsOnly
              ? plan.actions.filter((action) => action.type === "conflict_file")
              : plan.actions;
            const visibleRecommendations = options.conflictsOnly
              ? plan.recommendations.filter((recommendation) =>
                visibleActions.some((action) => action.path === recommendation.path)
              )
              : plan.recommendations;
            const applyResult =
            canPlan && !options.dryRun
              ? applySyncPlan(projectRoot, plan)
              : { applied: { createDirs: 0, createFiles: 0, updateFiles: 0 }, appliedPaths: [] };

            const ok = errors.length === 0;
            const envelope = createEnvelope({
              ok,
              command: "sync",
              data: {
                projectRoot,
                configRoot: DEFAULT_CONFIG_ROOT,
                preflightState: preflight.state,
                dryRun: options.dryRun,
                conflictsOnly: options.conflictsOnly === true,
                summary: plan.summary,
                actions: visibleActions,
                recommendations: visibleRecommendations,
                applied: applyResult.applied,
                appliedPaths: applyResult.appliedPaths
              },
              warnings,
              errors
            });

            emitEnvelope(envelope, options.format);
            if (options.format === "human") {
              if (ok) {
                console.log(options.dryRun ? "Sync dry-run completed." : "Sync apply completed.");
                console.log(`Preflight: ${preflight.state}`);
                if (options.conflictsOnly) {
                  console.log("View: conflicts only");
                }
                console.log(
                  `Planned: ${plan.summary.createDirs} dirs, ${plan.summary.createFiles} files, ${plan.summary.updateFiles} updates, ${plan.summary.conflictFiles} conflicts, ${plan.summary.unchanged} unchanged`
                );
                if (!options.dryRun) {
                  console.log(
                    `Applied: ${applyResult.applied.createDirs} dirs, ${applyResult.applied.createFiles} files, ${applyResult.applied.updateFiles} updates`
                  );
                }
                if (visibleRecommendations.length > 0) {
                  console.log(
                    `Recommendations: ${visibleRecommendations.length} conflict resolution hints`
                  );
                }
              } else {
                console.error("Sync failed.");
                for (const error of errors) {
                  console.error(`- [ERROR] ${error.file}: ${error.message}`);
                }
              }
            }

            if (!ok) {
              process.exitCode = EXIT_CODE.ERROR;
            }
          });
    }
  },
  {
    name: "validate",
    description: "Validate ./.ai bootstrap structure",
    register: (program: Command) => {
      program
        .command("validate")
        .description("Validate ./.ai bootstrap structure")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .action((options: { cwd: string; format: "human" | "json" }) => {
          const projectRoot = path.resolve(options.cwd);
          const aiRoot = path.join(projectRoot, DEFAULT_CONFIG_ROOT);
          const preflight = detectPreflightState(projectRoot);
          const manifestPath = path.join(aiRoot, "manifest.yaml");
          const configPath = path.join(aiRoot, "config.yaml");
          const modulesPath = path.join(aiRoot, "modules.yaml");
          const qaPath = path.join(aiRoot, "qa.yaml");
          const warnings: InitIssue[] = [];
          const errors: InitIssue[] = [];
          let parsedManifest: Record<string, unknown> | null = null;
          let parsedQa: Record<string, unknown> | null = null;

          if (preflight.state === "fresh") {
            errors.push({
              file: DEFAULT_CONFIG_ROOT,
              message: `Missing ./${DEFAULT_CONFIG_ROOT} directory. Run init first.`
            });
          } else if (preflight.state === "foreign") {
            errors.push({
              file: DEFAULT_CONFIG_ROOT,
              message:
                `Detected foreign ./${DEFAULT_CONFIG_ROOT} (not managed by ai-config). ` +
                "Use init --force to re-bootstrap, or migrate/import before validate."
            });
          } else if (preflight.state === "mixed") {
            errors.push({
              file: DEFAULT_CONFIG_ROOT,
              message:
                `Detected mixed ./${DEFAULT_CONFIG_ROOT} state (managed + foreign markers). ` +
                "Resolve conflicts, then run validate again."
            });
          } else {
            for (const fileName of REQUIRED_ROOT_FILES) {
              const absoluteFilePath = path.join(aiRoot, fileName);
              if (!fs.existsSync(absoluteFilePath)) {
                errors.push({
                  file: asConfigFilePath(fileName),
                  message: `Missing required root file: ${fileName}`
                });
              }
            }

            const manifestReadResult = readYamlObject(
              manifestPath,
              asConfigFilePath("manifest.yaml")
            );
            errors.push(...manifestReadResult.errors);
            if (manifestReadResult.content) {
              parsedManifest = manifestReadResult.content;
              errors.push(...validateManifestContent(manifestReadResult.content));
            }

            const qaReadResult = readYamlObject(qaPath, asConfigFilePath("qa.yaml"));
            errors.push(...qaReadResult.errors);
            if (qaReadResult.content) {
              parsedQa = qaReadResult.content;
            }

            const configReadResult = readYamlObject(configPath, asConfigFilePath("config.yaml"));
            errors.push(...configReadResult.errors);
            if (configReadResult.content) {
              errors.push(...validateConfigContent(configReadResult.content));
            }

            const modulesReadResult = readYamlObject(modulesPath, asConfigFilePath("modules.yaml"));
            errors.push(...modulesReadResult.errors);
            if (modulesReadResult.content) {
              errors.push(...validateModulesContent(modulesReadResult.content, aiRoot));
              const moduleEntries = readModuleEntries(modulesReadResult.content);
              errors.push(...validateModuleLifecycleStates(moduleEntries));
              const readiness = validateEnabledModuleReadiness(aiRoot, moduleEntries);
              errors.push(...readiness.errors);
              warnings.push(...readiness.warnings);
              const declaredModuleNames = new Set<string>(
                moduleEntries
                  .map((entry) => entry.name)
                  .filter((name) => typeof name === "string" && name.trim().length > 0)
              );
              const enabledModuleNames = new Set<string>(
                moduleEntries.filter((entry) => entry.enabled).map((entry) => entry.name)
              );

              if (enabledModuleNames.has("skills")) {
                errors.push(...validateSkillsRegistryAgainstModules(aiRoot, declaredModuleNames));
              }

              if (enabledModuleNames.has("orchestration")) {
                errors.push(...validateWorkflowRolesAgainstAgents(aiRoot));
              }
            }

            warnings.push(...validateQaLocaleConsistency(parsedManifest, parsedQa));
          }

          const ok = errors.length === 0;
          const envelope = createEnvelope({
            ok,
            command: "validate",
            data: {
              projectRoot,
              configRoot: DEFAULT_CONFIG_ROOT,
              preflightState: preflight.state
            },
            warnings,
            errors
          });

          emitEnvelope(envelope, options.format);
          if (options.format === "human") {
            if (ok) {
              console.log("Validation passed.");
              console.log(`Preflight: ${preflight.state}`);
              console.log(
                `Checked: ./${DEFAULT_CONFIG_ROOT} root files, manifest/config/modules integrity, enabled module paths, and cross-module links`
              );
            } else {
              console.error("Validation failed.");
              for (const error of errors) {
                console.error(`- [ERROR] ${error.file}: ${error.message}`);
              }
            }
          }

          if (!ok) {
            process.exitCode = EXIT_CODE.ERROR;
          }
        });
    }
  }
];
