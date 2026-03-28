#!/usr/bin/env node

import { Command } from "commander";

import { builtInCommands } from "./commands/builtins";
import { CommandRegistry } from "./core/command-registry";
import { ModuleRegistry } from "./core/module-registry";
import { builtInModules } from "./modules/builtin-modules";
import { AiConfigResolver } from "./services/ai-config-resolver";
import { AiConfigValidator } from "./services/ai-config-validator";

const program = new Command();
const moduleRegistry = new ModuleRegistry();
moduleRegistry.registerMany(builtInModules);

const commandRegistry = new CommandRegistry();
commandRegistry.registerMany(builtInCommands);

program
  .name("ai-config")
  .description("Configuration and synchronization system for AI agents")
  .version("0.1.0");

commandRegistry.apply(program, {
  validator: new AiConfigValidator(),
  resolver: new AiConfigResolver(),
  moduleRegistry
});

program.parse(process.argv);
