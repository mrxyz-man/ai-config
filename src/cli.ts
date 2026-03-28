#!/usr/bin/env node

import { Command } from "commander";

const program = new Command();

const notImplemented = (name: string): void => {
  console.log(`Command "${name}" is not implemented yet.`);
  console.log('Run "ai-config --help" to see available commands.');
};

program
  .name("ai-config")
  .description("Configuration and synchronization system for AI agents")
  .version("0.1.0");

program
  .command("init")
  .description("Bootstrap ./ai configuration")
  .action(() => notImplemented("init"));

program
  .command("sync")
  .description("Sync managed configuration layers")
  .action(() => notImplemented("sync"));

program
  .command("resolve")
  .description("Build resolved agent configuration")
  .action(() => notImplemented("resolve"));

program
  .command("validate")
  .description("Run configuration validation")
  .action(() => notImplemented("validate"));

program
  .command("explain")
  .description("Explain resolved provenance")
  .action(() => notImplemented("explain"));

program.parse(process.argv);
