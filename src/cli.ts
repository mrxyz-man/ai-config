#!/usr/bin/env node

import { Command } from "commander";
import path from "node:path";

import { validateAiConfigContracts } from "./services/ai-config-validator";

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
  .option("--cwd <path>", "Project root path", ".")
  .action((options: { cwd: string }) => {
    const targetDir = path.resolve(options.cwd);
    const report = validateAiConfigContracts(targetDir);

    if (report.ok) {
      console.log(`Validation passed. Checked ${report.validatedFiles.length} files.`);
      if (report.warnings.length > 0) {
        console.log(`Warnings: ${report.warnings.length}`);
        for (const warning of report.warnings) {
          const location = warning.path ? `${warning.file}#${warning.path}` : warning.file;
          console.log(`- [WARN] ${location}: ${warning.message}`);
        }
      }
      return;
    }

    console.error("Validation failed.");
    for (const error of report.errors) {
      const location = error.path ? `${error.file}#${error.path}` : error.file;
      console.error(`- [ERROR] ${location}: ${error.message}`);
    }
    process.exitCode = 3;
  });

program
  .command("explain")
  .description("Explain resolved provenance")
  .action(() => notImplemented("explain"));

program.parse(process.argv);
