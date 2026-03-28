import path from "node:path";

import { Command } from "commander";

import { CommandDefinition } from "../core/command-registry";

const notImplemented = (name: string): void => {
  console.log(`Command "${name}" is not implemented yet.`);
  console.log('Run "ai-config --help" to see available commands.');
};

export const builtInCommands: CommandDefinition[] = [
  {
    name: "init",
    description: "Bootstrap ./ai configuration",
    register: (program: Command) => {
      program
        .command("init")
        .description("Bootstrap ./ai configuration")
        .action(() => notImplemented("init"));
    }
  },
  {
    name: "sync",
    description: "Sync managed configuration layers",
    register: (program: Command) => {
      program
        .command("sync")
        .description("Sync managed configuration layers")
        .action(() => notImplemented("sync"));
    }
  },
  {
    name: "resolve",
    description: "Build resolved agent configuration",
    register: (program: Command) => {
      program
        .command("resolve")
        .description("Build resolved agent configuration")
        .action(() => notImplemented("resolve"));
    }
  },
  {
    name: "validate",
    description: "Run configuration validation",
    register: (program: Command, context) => {
      program
        .command("validate")
        .description("Run configuration validation")
        .option("--cwd <path>", "Project root path", ".")
        .action((options: { cwd: string }) => {
          const targetDir = path.resolve(options.cwd);
          const report = context.validator.validate(targetDir);

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
    }
  },
  {
    name: "explain",
    description: "Explain resolved provenance",
    register: (program: Command) => {
      program
        .command("explain")
        .description("Explain resolved provenance")
        .action(() => notImplemented("explain"));
    }
  }
];

