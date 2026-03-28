import path from "node:path";

import { Command } from "commander";

import { CommandDefinition } from "../core/command-registry";
import { createEnvelope, emitEnvelope } from "../cli/output";

const notImplemented = (name: string): void => {
  console.log(`Command "${name}" is not implemented yet.`);
  console.log('Run "ai-config --help" to see available commands.');
};

const applyPolicy = (input: {
  projectRoot: string;
  command: string;
  confirmed: boolean;
  context: Parameters<CommandDefinition["register"]>[1];
  format: "human" | "json";
}): boolean => {
  const result = input.context.policyGate.check(
    input.projectRoot,
    input.command,
    input.confirmed
  );

  if (result.allowed) {
    return true;
  }

  const envelope = createEnvelope({
    ok: false,
    command: input.command,
    data: {
      policyDecision: result.decision
    },
    warnings: [],
    errors: [{ message: result.reason ?? "Command blocked by policy" }]
  });

  emitEnvelope(envelope, input.format);
  if (input.format === "human") {
    console.error(`Policy blocked command "${input.command}": ${result.reason}`);
  }

  input.context.auditLogger.append(input.projectRoot, {
    actor: "user",
    command: input.command,
    timestamp: new Date().toISOString(),
    decision: result.decision,
    outcome: "denied",
    message: result.reason
  });

  process.exitCode = result.decision === "confirm-required" ? 5 : 1;
  return false;
};

export const builtInCommands: CommandDefinition[] = [
  {
    name: "init",
    description: "Bootstrap ./ai configuration",
    register: (program: Command, context) => {
      program
        .command("init")
        .description("Bootstrap ./ai configuration")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action(
          (options: { cwd: string; format: "human" | "json"; confirm?: boolean }) => {
            const targetDir = path.resolve(options.cwd);
            const allowed = applyPolicy({
              context,
              projectRoot: targetDir,
              command: "init",
              confirmed: options.confirm ?? false,
              format: options.format
            });
            if (!allowed) {
              return;
            }

            context.auditLogger.append(targetDir, {
              actor: "user",
              command: "init",
              timestamp: new Date().toISOString(),
              decision: "confirmed",
              outcome: "failed",
              message: "Not implemented yet"
            });
            notImplemented("init");
          }
        );
    }
  },
  {
    name: "sync",
    description: "Sync managed configuration layers",
    register: (program: Command, context) => {
      program
        .command("sync")
        .description("Sync managed configuration layers")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action(
          (options: { cwd: string; format: "human" | "json"; confirm?: boolean }) => {
            const targetDir = path.resolve(options.cwd);
            const allowed = applyPolicy({
              context,
              projectRoot: targetDir,
              command: "sync",
              confirmed: options.confirm ?? false,
              format: options.format
            });
            if (!allowed) {
              return;
            }

            context.auditLogger.append(targetDir, {
              actor: "user",
              command: "sync",
              timestamp: new Date().toISOString(),
              decision: "confirmed",
              outcome: "failed",
              message: "Not implemented yet"
            });
            notImplemented("sync");
          }
        );
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
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action(
          (options: {
            cwd: string;
            format: "human" | "json";
            strict?: boolean;
            confirm?: boolean;
          }) => {
            const targetDir = path.resolve(options.cwd);
            const allowed = applyPolicy({
              context,
              projectRoot: targetDir,
              command: "resolve",
              confirmed: options.confirm ?? false,
              format: options.format
            });
            if (!allowed) {
              return;
            }
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

            context.auditLogger.append(targetDir, {
              actor: "user",
              command: "resolve",
              timestamp: new Date().toISOString(),
              decision: "auto-run",
              outcome: ok ? "success" : "failed",
              message: ok ? undefined : "Resolve command failed"
            });
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
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action(
          (options: {
            cwd: string;
            format: "human" | "json";
            strict?: boolean;
            confirm?: boolean;
          }) => {
            const targetDir = path.resolve(options.cwd);
            const allowed = applyPolicy({
              context,
              projectRoot: targetDir,
              command: "validate",
              confirmed: options.confirm ?? false,
              format: options.format
            });
            if (!allowed) {
              return;
            }

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
              } else {
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
            }

            if (!ok) {
              process.exitCode = 3;
            }

            context.auditLogger.append(targetDir, {
              actor: "user",
              command: "validate",
              timestamp: new Date().toISOString(),
              decision: "auto-run",
              outcome: ok ? "success" : "failed",
              message: ok ? undefined : "Validate command failed"
            });
          }
        );
    }
  },
  {
    name: "explain",
    description: "Explain resolved provenance",
    register: (program: Command, context) => {
      program
        .command("explain")
        .description("Explain resolved provenance")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action((options: { cwd: string; format: "human" | "json"; confirm?: boolean }) => {
          const targetDir = path.resolve(options.cwd);
          const allowed = applyPolicy({
            context,
            projectRoot: targetDir,
            command: "explain",
            confirmed: options.confirm ?? false,
            format: options.format
          });
          if (!allowed) {
            return;
          }

          context.auditLogger.append(targetDir, {
            actor: "user",
            command: "explain",
            timestamp: new Date().toISOString(),
            decision: "auto-run",
            outcome: "failed",
            message: "Not implemented yet"
          });
          notImplemented("explain");
        });
    }
  }
];
