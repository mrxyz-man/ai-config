import { builtInCommands } from "../commands/builtins";
import { builtInModules } from "../modules/builtin-modules";
import { AiConfigExplainer } from "../services/ai-config-explainer";
import { AiConfigInitializer } from "../services/ai-config-initializer";
import { AiConfigResolver } from "../services/ai-config-resolver";
import { AiConfigSyncer } from "../services/ai-config-syncer";
import { AiConfigValidator } from "../services/ai-config-validator";
import { TaskBoardService } from "../services/task-board-service";
import { TaskMcpIntegrationService } from "../services/task-mcp-integration";
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

  const resolver = new AiConfigResolver();

  return {
    commandRegistry,
    moduleRegistry,
    initializer: new AiConfigInitializer(resolver),
    syncer: new AiConfigSyncer(resolver),
    explainer: new AiConfigExplainer(),
    mcpIntegration: new TaskMcpIntegrationService(),
    taskBoard: new TaskBoardService(),
    validator: new AiConfigValidator(),
    resolver,
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
