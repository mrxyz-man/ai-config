import { builtInCommands } from "../commands/builtins";
import { builtInModules } from "../modules/builtin-modules";
import { AiConfigResolver } from "../services/ai-config-resolver";
import { AiConfigValidator } from "../services/ai-config-validator";
import { ToolCallingPolicyGate } from "../services/tool-calling-policy";
import { YamlAuditLogger } from "../services/yaml-audit-logger";
import { CommandRegistry, CommandContext } from "./command-registry";
import { ModuleRegistry } from "./module-registry";

export type AppContext = CommandContext & {
  commandRegistry: CommandRegistry;
};

const buildFreshAppContext = (): AppContext => {
  const moduleRegistry = new ModuleRegistry();
  moduleRegistry.registerMany(builtInModules);

  const commandRegistry = new CommandRegistry();
  commandRegistry.registerMany(builtInCommands);

  return {
    commandRegistry,
    moduleRegistry,
    validator: new AiConfigValidator(),
    resolver: new AiConfigResolver(),
    policyGate: new ToolCallingPolicyGate(),
    auditLogger: new YamlAuditLogger()
  };
};

let processSingletonContext: AppContext | undefined;

export const createAppContext = (): AppContext => buildFreshAppContext();

export const getProcessSingletonAppContext = (): AppContext => {
  if (!processSingletonContext) {
    processSingletonContext = buildFreshAppContext();
  }
  return processSingletonContext;
};

export const resetProcessSingletonAppContextForTests = (): void => {
  processSingletonContext = undefined;
};
