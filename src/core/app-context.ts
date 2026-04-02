import { builtInCommands } from "../commands/builtins";
import { AiConfigInitializer } from "../services/ai-config-initializer";
import { CommandRegistry, CommandContext } from "./command-registry";

export type AppContext = CommandContext & {
  commandRegistry: CommandRegistry;
};

const buildFreshAppContext = (): AppContext => {
  const commandRegistry = new CommandRegistry();
  commandRegistry.registerMany(builtInCommands);

  return {
    commandRegistry,
    initializer: new AiConfigInitializer()
  };
};

let processSingletonContext: AppContext | undefined;

export const getProcessSingletonAppContext = (): AppContext => {
  if (!processSingletonContext) {
    processSingletonContext = buildFreshAppContext();
  }
  return processSingletonContext;
};

