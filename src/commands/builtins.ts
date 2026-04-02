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
import { UI_LOCALE_OPTIONS, normalizeUiLocale } from "../core/locales";
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
  const selectedAgent = manifest.selected_agent;
  const uiLocale = manifest.ui_locale;

  if (typeof schemaVersion !== "string" || schemaVersion.trim().length === 0) {
    errors.push({
      file: `${DEFAULT_CONFIG_ROOT}/manifest.yaml`,
      message: "Missing or invalid 'schema_version'."
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

  return errors;
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
      enabled: entry.enabled === true
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
        .action(
          async (options: {
            cwd: string;
            format: "human" | "json";
            force?: boolean;
            nonInteractive?: boolean;
            agent?: string;
            uiLocale?: string;
          }) => {
            const targetDir = path.resolve(options.cwd);
            let selectedAgent: AgentKey | null = null;
            let uiLocale: string | null = null;

            if (options.nonInteractive) {
              selectedAgent = normalizeAgentKey(options.agent);
              uiLocale = normalizeUiLocale(options.uiLocale);

              const errors: Array<{ message: string }> = [];
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
            }

            const report = context.initializer.init(targetDir, {
              force: options.force ?? false,
              agent: selectedAgent ?? undefined,
              uiLocale: uiLocale ?? undefined
            });
            const envelope = createEnvelope({
              ok: report.ok,
              command: "init",
              data: {
                projectRoot: report.projectRoot,
                selectedAgent: report.selectedAgent,
                uiLocale: report.uiLocale,
                createdFiles: report.createdFiles
              },
              warnings: report.warnings,
              errors: report.errors
            });

            emitEnvelope(envelope, options.format);
            if (options.format === "human") {
              if (report.ok) {
                console.log("Init completed.");
                console.log(`Agent: ${report.selectedAgent}`);
                console.log(`UI locale: ${report.uiLocale}`);
                console.log(`Created: ${report.createdFiles.join(", ")}`);
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
          const manifestPath = path.join(aiRoot, "manifest.yaml");
          const configPath = path.join(aiRoot, "config.yaml");
          const modulesPath = path.join(aiRoot, "modules.yaml");
          const warnings: InitIssue[] = [];
          const errors: InitIssue[] = [];

          if (!fs.existsSync(aiRoot)) {
            errors.push({
              file: DEFAULT_CONFIG_ROOT,
              message: `Missing ./${DEFAULT_CONFIG_ROOT} directory. Run init first.`
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
              errors.push(...validateManifestContent(manifestReadResult.content));
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
          }

          const ok = errors.length === 0;
          const envelope = createEnvelope({
            ok,
            command: "validate",
            data: {
              projectRoot,
              configRoot: DEFAULT_CONFIG_ROOT
            },
            warnings,
            errors
          });

          emitEnvelope(envelope, options.format);
          if (options.format === "human") {
            if (ok) {
              console.log("Validation passed.");
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
