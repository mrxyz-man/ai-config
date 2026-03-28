import path from "node:path";

import { Command } from "commander";

import { CommandDefinition } from "../core/command-registry";
import { createEnvelope, emitEnvelope } from "../cli/output";

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
        .option("--force", "Allow re-bootstrap over existing ./ai", false)
        .option("--lang <code>", "Set questionnaire language")
        .option("--skip-questions", "Skip interactive questionnaire", false)
        .action(
          (options: {
            cwd: string;
            format: "human" | "json";
            confirm?: boolean;
            force?: boolean;
            lang?: string;
            skipQuestions?: boolean;
          }) => {
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

            const report = context.initializer.init(targetDir, {
              force: options.force ?? false,
              lang: options.lang,
              skipQuestions: options.skipQuestions ?? false
            });
            const envelope = createEnvelope({
              ok: report.ok,
              command: "init",
              data: {
                projectRoot: report.projectRoot,
                createdFiles: report.createdFiles,
                updatedFiles: report.updatedFiles,
                detected: report.detected,
                unresolvedQuestions: report.unresolvedQuestions
              },
              warnings: report.warnings,
              errors: report.errors
            });

            emitEnvelope(envelope, options.format);
            if (options.format === "human") {
              if (report.ok) {
                console.log("Init completed.");
                console.log(`Created: ${report.createdFiles.length} entries`);
                console.log(`Updated: ${report.updatedFiles.length} entries`);
                if (report.unresolvedQuestions.length > 0) {
                  console.log(`Unresolved questions: ${report.unresolvedQuestions.join(", ")}`);
                }
              } else {
                console.error("Init failed.");
                for (const error of report.errors) {
                  const location = error.path ? `${error.file}#${error.path}` : error.file;
                  console.error(`- [ERROR] ${location}: ${error.message}`);
                }
              }
            }

            context.auditLogger.append(targetDir, {
              actor: "user",
              command: "init",
              timestamp: new Date().toISOString(),
              decision: "confirmed",
              outcome: report.ok ? "success" : "failed",
              message: report.ok ? undefined : "Init command failed"
            });

            if (!report.ok) {
              process.exitCode = 7;
            }
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
        .option("--dry-run", "Show planned changes without writing files", false)
        .option("--with-migrations", "Apply compatible migrations", false)
        .option("--from-version <version>", "Expected source config version")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action(
          (options: {
            cwd: string;
            format: "human" | "json";
            dryRun?: boolean;
            withMigrations?: boolean;
            fromVersion?: string;
            confirm?: boolean;
          }) => {
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

            const report = context.syncer.sync(targetDir, {
              dryRun: options.dryRun ?? false,
              withMigrations: options.withMigrations ?? false,
              fromVersion: options.fromVersion
            });
            const envelope = createEnvelope({
              ok: report.ok,
              command: "sync",
              data: {
                dryRun: report.dryRun,
                appliedChanges: report.appliedChanges,
                plannedChanges: report.plannedChanges,
                preservedCustomFiles: report.preservedCustomFiles,
                migrationSummary: report.migrationSummary
              },
              warnings: report.warnings,
              errors: report.errors
            });

            emitEnvelope(envelope, options.format);
            if (options.format === "human") {
              if (report.ok) {
                console.log(`Sync completed${report.dryRun ? " (dry-run)" : ""}.`);
                console.log(`Planned changes: ${report.plannedChanges.length}`);
                console.log(`Applied changes: ${report.appliedChanges.length}`);
                if (report.preservedCustomFiles.length > 0) {
                  console.log(`Preserved custom files: ${report.preservedCustomFiles.length}`);
                }
                if (report.migrationSummary.length > 0) {
                  console.log(`Migrations: ${report.migrationSummary.join("; ")}`);
                }
                if (report.warnings.length > 0) {
                  console.log(`Warnings: ${report.warnings.length}`);
                }
              } else {
                console.error("Sync failed.");
                for (const error of report.errors) {
                  const location = error.path ? `${error.file}#${error.path}` : error.file;
                  console.error(`- [ERROR] ${location}: ${error.message}`);
                }
              }
            }

            context.auditLogger.append(targetDir, {
              actor: "user",
              command: "sync",
              timestamp: new Date().toISOString(),
              decision: "confirmed",
              outcome: report.ok ? "success" : "failed",
              message: report.ok ? undefined : "Sync command failed"
            });

            if (!report.ok) {
              process.exitCode = 6;
            }
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
        .option("--key <path>", "Explain specific resolved key path")
        .option("--module <name>", "Filter explanation by module name")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action(
          (options: {
            cwd: string;
            format: "human" | "json";
            key?: string;
            module?: string;
            confirm?: boolean;
          }) => {
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

            const report = context.explainer.explain(targetDir, {
              key: options.key,
              module: options.module
            });
            const envelope = createEnvelope({
              ok: report.ok,
              command: "explain",
              data: {
                keyFilter: report.keyFilter,
                moduleFilter: report.moduleFilter,
                matches: report.matches
              },
              warnings: report.warnings,
              errors: report.errors
            });

            emitEnvelope(envelope, options.format);
            if (options.format === "human") {
              if (report.ok) {
                console.log(`Explain succeeded. Matches: ${report.matches.length}`);
                for (const match of report.matches) {
                  console.log(`- ${match.key} [${match.module}] <- ${match.sources.join(", ")}`);
                }
              } else {
                console.error("Explain failed.");
                for (const error of report.errors) {
                  const location = error.path ? `${error.file}#${error.path}` : error.file;
                  console.error(`- [ERROR] ${location}: ${error.message}`);
                }
              }
            }

            context.auditLogger.append(targetDir, {
              actor: "user",
              command: "explain",
              timestamp: new Date().toISOString(),
              decision: "auto-run",
              outcome: report.ok ? "success" : "failed",
              message: report.ok ? undefined : "Explain command failed"
            });

            if (!report.ok) {
              process.exitCode = 4;
            }
          }
        );
    }
  }
];
