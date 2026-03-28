import path from "node:path";

import { Command } from "commander";

import { CommandDefinition } from "../core/command-registry";
import { createEnvelope, emitEnvelope } from "../cli/output";

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
    register: (program: Command, context) => {
      program
        .command("resolve")
        .description("Build resolved agent configuration")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--strict", "Treat warnings as failures", false)
        .action(
          (options: { cwd: string; format: "human" | "json"; strict?: boolean }) => {
            const targetDir = path.resolve(options.cwd);
            const report = context.resolver.resolve(targetDir);

            const strictFailed = options.strict === true && report.warnings.length > 0;
            const ok = report.ok && !strictFailed;
            const envelope = createEnvelope({
              ok,
              command: "resolve",
              data: {
                outputFile: report.outputFile,
                resolvedModules: report.resolvedModules,
                checksum: report.checksum
              },
              warnings: report.warnings,
              errors: strictFailed
                ? [...report.errors, { message: "Strict mode failed due to warnings" }]
                : report.errors
            });

            emitEnvelope(envelope, options.format);
            if (options.format === "human") {
              if (ok) {
                console.log(`Resolve succeeded. Output: ${report.outputFile}`);
                console.log(`Resolved modules: ${report.resolvedModules.join(", ")}`);
                if (report.checksum) {
                  console.log(`Checksum: ${report.checksum}`);
                }
                if (report.warnings.length > 0) {
                  console.log(`Warnings: ${report.warnings.length}`);
                  for (const warning of report.warnings) {
                    const location = warning.path ? `${warning.file}#${warning.path}` : warning.file;
                    console.log(`- [WARN] ${location}: ${warning.message}`);
                  }
                }
              } else {
                console.error("Resolve failed.");
                for (const error of envelope.errors) {
                  const issue = error as { file?: string; path?: string; message: string };
                  const location = issue.file
                    ? issue.path
                      ? `${issue.file}#${issue.path}`
                      : issue.file
                    : "resolve";
                  console.error(`- [ERROR] ${location}: ${issue.message}`);
                }
              }
            }

            if (!ok) {
              process.exitCode = report.errors.length > 0 ? 4 : 3;
            }
          }
        );
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
        .option("--format <format>", "Output format: human|json", "human")
        .option("--strict", "Treat warnings as failures", false)
        .action((options: { cwd: string; format: "human" | "json"; strict?: boolean }) => {
          const targetDir = path.resolve(options.cwd);
          const report = context.validator.validate(targetDir);
          const strictFailed = options.strict === true && report.warnings.length > 0;
          const ok = report.ok && !strictFailed;
          const envelope = createEnvelope({
            ok,
            command: "validate",
            data: {
              validatedFiles: report.validatedFiles,
              warningCount: report.warnings.length,
              errorCount: report.errors.length
            },
            warnings: report.warnings,
            errors: strictFailed
              ? [...report.errors, { message: "Strict mode failed due to warnings" }]
              : report.errors
          });

          emitEnvelope(envelope, options.format);

          if (options.format === "human") {
            if (ok) {
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
            for (const error of envelope.errors) {
              const issue = error as { file?: string; path?: string; message: string };
              const location = issue.file
                ? issue.path
                  ? `${issue.file}#${issue.path}`
                  : issue.file
                : "validate";
              console.error(`- [ERROR] ${location}: ${issue.message}`);
            }
          }

          if (!ok) {
            process.exitCode = 3;
          }
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
