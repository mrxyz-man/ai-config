#!/usr/bin/env node

import { Command } from "commander";

import { getProcessSingletonAppContext } from "./core/app-context";

const program = new Command();
const appContext = getProcessSingletonAppContext();

program
  .name("ai-config")
  .description("Configuration and synchronization system for AI agents")
  .version("0.1.0");

appContext.commandRegistry.apply(program, appContext);

program.parse(process.argv);
