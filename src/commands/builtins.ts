import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";

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

const appendOptionValue = (value: string, previous: string[]): string[] => [...previous, value];

const parseAnswerPairs = (pairs: string[]): Array<{ id: string; value: string }> => {
  const parsed: Array<{ id: string; value: string }> = [];
  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    if (separator < 1) {
      continue;
    }
    const id = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!id || !value) {
      continue;
    }
    parsed.push({ id, value });
  }
  return parsed;
};

type PendingQuestion = {
  id: string;
  blockId: string;
  prompt: string;
  required: boolean;
};

const collectInteractiveAnswers = async (
  pendingQuestions: PendingQuestion[]
): Promise<Array<{ id: string; value: string }>> => {
  const requiredQuestions = pendingQuestions.filter((item) => item.required);
  if (requiredQuestions.length === 0 || !input.isTTY || !output.isTTY) {
    return [];
  }

  const terminal = readline.createInterface({ input, output });
  const answers: Array<{ id: string; value: string }> = [];
  try {
    for (const question of requiredQuestions) {
      const response = (await terminal.question(`${question.prompt} [${question.id}]: `)).trim();
      if (response.length > 0) {
        answers.push({ id: question.id, value: response });
      }
    }
  } finally {
    terminal.close();
  }
  return answers;
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
        .option(
          "--scope <scope>",
          "Validation scope: all|schemas|rules|text|tasks|questions",
          "all"
        )
        .option("--strict", "Treat warnings as failures", false)
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action(
          (options: {
            cwd: string;
            format: "human" | "json";
            scope?: "all" | "schemas" | "rules" | "text" | "tasks" | "questions";
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

            const validScopes = ["all", "schemas", "rules", "text", "tasks", "questions"];
            if (options.scope && !validScopes.includes(options.scope)) {
              const envelope = createEnvelope({
                ok: false,
                command: "validate",
                data: {
                  providedScope: options.scope
                },
                warnings: [],
                errors: [{ message: `Invalid scope "${options.scope}"` }]
              });
              emitEnvelope(envelope, options.format);
              process.exitCode = 2;
              return;
            }

            const report = context.validator.validate(targetDir, {
              scope: options.scope ?? "all"
            });
            const strictFailed = options.strict === true && report.warnings.length > 0;
            const ok = report.ok && !strictFailed;
            const envelope = createEnvelope({
              ok,
              command: "validate",
              data: {
                scope: report.scope,
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
  },
  {
    name: "text",
    description: "Text quality checks",
    register: (program: Command, context) => {
      const text = program.command("text").description("Text quality checks");

      text
        .command("check")
        .description("Run text reliability checks")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--changed-only", "Scan only changed/untracked files from git", false)
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action(
          (options: {
            cwd: string;
            format: "human" | "json";
            changedOnly?: boolean;
            confirm?: boolean;
          }) => {
            const targetDir = path.resolve(options.cwd);
            const allowed = applyPolicy({
              context,
              projectRoot: targetDir,
              command: "text check",
              confirmed: options.confirm ?? false,
              format: options.format
            });
            if (!allowed) {
              return;
            }

            const report = context.textPolicy.check(targetDir, {
              changedOnly: options.changedOnly ?? false
            });
            const envelope = createEnvelope({
              ok: report.ok,
              command: "text check",
              data: {
                scanMode: report.scanMode,
                checkedFiles: report.checkedFiles,
                violationCount: report.violations.length,
                violations: report.violations
              },
              warnings: report.warnings,
              errors: report.errors
            });
            emitEnvelope(envelope, options.format);
            context.auditLogger.append(targetDir, {
              actor: "user",
              command: "text check",
              timestamp: new Date().toISOString(),
              decision: "auto-run",
              outcome: report.ok ? "success" : "failed",
              message: report.ok ? undefined : "Text check failed"
            });

            if (!report.ok) {
              process.exitCode = 3;
            }
          }
        );
    }
  },
  {
    name: "questions",
    description: "Questionnaire management",
    register: (program: Command, context) => {
      const questions = program.command("questions").description("Questionnaire management");
      type QuestionsRunOptions = {
        cwd: string;
        format: "human" | "json";
        lang?: string;
        profile?: string;
        answer?: string[];
        nonInteractive?: boolean;
        confirm?: boolean;
      };

      const executeQuestionsFlow = async (
        commandName: "questions run" | "questions ask",
        options: QuestionsRunOptions,
        forceInteractivePrompt: boolean
      ): Promise<void> => {
        const targetDir = path.resolve(options.cwd);
        const allowed = applyPolicy({
          context,
          projectRoot: targetDir,
          command: commandName,
          confirmed: options.confirm ?? false,
          format: options.format
        });
        if (!allowed) {
          return;
        }

        const answerPairs = options.answer ?? [];
        const parsedAnswers = parseAnswerPairs(answerPairs);
        if (answerPairs.length > 0 && parsedAnswers.length !== answerPairs.length) {
          const envelope = createEnvelope({
            ok: false,
            command: commandName,
            data: {
              providedAnswers: answerPairs
            },
            warnings: [],
            errors: [{ message: "Invalid --answer format. Use --answer id=value." }]
          });
          emitEnvelope(envelope, options.format);
          process.exitCode = 2;
          return;
        }

        let report = context.questions.run(targetDir, {
          language: options.lang,
          profile: options.profile,
          nonInteractive: options.nonInteractive ?? false,
          providedAnswers: parsedAnswers
        });

        const shouldPrompt =
          options.format === "human" &&
          (options.nonInteractive ?? false) === false &&
          report.pendingQuestions.some((item) => item.required) &&
          report.missingBlocks.length > 0 &&
          (forceInteractivePrompt || parsedAnswers.length === 0);

        if (shouldPrompt) {
          const promptedAnswers = await collectInteractiveAnswers(report.pendingQuestions);
          if (promptedAnswers.length > 0) {
            report = context.questions.run(targetDir, {
              language: report.language,
              profile: options.profile,
              nonInteractive: false,
              providedAnswers: [...parsedAnswers, ...promptedAnswers]
            });
          }
        }

        const envelope = createEnvelope({
          ok: report.ok,
          command: commandName,
          data: {
            language: report.language,
            completed: report.completed,
            missingBlocks: report.missingBlocks,
            pendingQuestions: report.pendingQuestions,
            appliedAnswers: report.appliedAnswers,
            updatedFiles: report.updatedFiles
          },
          warnings: report.warnings,
          errors: report.errors
        });
        emitEnvelope(envelope, options.format);
        context.auditLogger.append(targetDir, {
          actor: "user",
          command: commandName,
          timestamp: new Date().toISOString(),
          decision: "confirmed",
          outcome: report.ok ? "success" : "failed",
          message: report.ok ? undefined : `${commandName} failed`
        });
        if (!report.ok) {
          process.exitCode = options.nonInteractive ? 5 : 7;
        }
      };

      questions
        .command("status")
        .description("Show questionnaire completion status")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action((options: { cwd: string; format: "human" | "json"; confirm?: boolean }) => {
          const targetDir = path.resolve(options.cwd);
          const allowed = applyPolicy({
            context,
            projectRoot: targetDir,
            command: "questions status",
            confirmed: options.confirm ?? false,
            format: options.format
          });
          if (!allowed) {
            return;
          }

          const report = context.questions.status(targetDir);
          const envelope = createEnvelope({
            ok: report.ok,
            command: "questions status",
            data: {
              enabled: report.enabled,
              language: report.language,
              completed: report.completed,
              missingBlocks: report.missingBlocks
            },
            warnings: report.warnings,
            errors: report.errors
          });
          emitEnvelope(envelope, options.format);
          context.auditLogger.append(targetDir, {
            actor: "user",
            command: "questions status",
            timestamp: new Date().toISOString(),
            decision: "auto-run",
            outcome: report.ok ? "success" : "failed",
            message: report.ok ? undefined : "Questions status failed"
          });
          if (!report.ok) {
            process.exitCode = 1;
          }
        });

      questions
        .command("run")
        .description("Run questionnaire update cycle")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--lang <code>", "Set questionnaire language for this run")
        .option("--profile <name>", "Questions profile name", "default")
        .option("--answer <id=value>", "Provide answer pair (repeatable)", appendOptionValue, [])
        .option("--non-interactive", "Do not prompt for missing required answers", false)
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action((options: QuestionsRunOptions) => executeQuestionsFlow("questions run", options, false));

      questions
        .command("ask")
        .description("Run interactive questionnaire interview")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--lang <code>", "Set questionnaire language for this run")
        .option("--profile <name>", "Questions profile name", "default")
        .option("--answer <id=value>", "Provide answer pair (repeatable)", appendOptionValue, [])
        .option("--non-interactive", "Do not prompt for missing required answers", false)
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action((options: QuestionsRunOptions) => executeQuestionsFlow("questions ask", options, true));
    }
  },
  {
    name: "mcp",
    description: "Manage MCP task integrations",
    register: (program: Command, context) => {
      const mcp = program.command("mcp").description("Manage MCP task integrations");

      mcp
        .command("status")
        .description("Show MCP integration status")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action((options: { cwd: string; format: "human" | "json"; confirm?: boolean }) => {
          const targetDir = path.resolve(options.cwd);
          const allowed = applyPolicy({
            context,
            projectRoot: targetDir,
            command: "mcp status",
            confirmed: options.confirm ?? false,
            format: options.format
          });
          if (!allowed) {
            return;
          }

          const report = context.mcpIntegration.status(targetDir);
          const envelope = createEnvelope({
            ok: report.ok,
            command: "mcp status",
            data: {
              enabled: report.enabled,
              provider: report.provider,
              mode: report.mode,
              syncDirection: report.syncDirection,
              providerHealth: report.providerHealth
            },
            warnings: report.warnings,
            errors: report.errors
          });
          emitEnvelope(envelope, options.format);
          if (options.format === "human") {
            if (report.ok) {
              console.log(
                `MCP status: enabled=${report.enabled}, provider=${report.provider ?? "none"}, mode=${report.mode}`
              );
              if (report.providerHealth) {
                console.log(`Provider health: ${report.providerHealth}`);
              }
            } else {
              console.error("MCP status failed.");
            }
          }

          context.auditLogger.append(targetDir, {
            actor: "user",
            command: "mcp status",
            timestamp: new Date().toISOString(),
            decision: "auto-run",
            outcome: report.ok ? "success" : "failed",
            message: report.ok ? undefined : "MCP status failed"
          });

          if (!report.ok) {
            process.exitCode = 1;
          }
        });

      mcp
        .command("connect <provider>")
        .description("Connect MCP provider for task sync")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--mode <mode>", "Task mode after connect: local|hybrid|remote-first", "hybrid")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action(
          (
            provider: string,
            options: {
              cwd: string;
              format: "human" | "json";
              mode?: "local" | "hybrid" | "remote-first";
              confirm?: boolean;
            }
          ) => {
            const targetDir = path.resolve(options.cwd);
            const allowed = applyPolicy({
              context,
              projectRoot: targetDir,
              command: "mcp connect",
              confirmed: options.confirm ?? false,
              format: options.format
            });
            if (!allowed) {
              return;
            }

            const validProviders = ["custom"];
            if (!validProviders.includes(provider)) {
              const envelope = createEnvelope({
                ok: false,
                command: "mcp connect",
                data: {
                  providedProvider: provider
                },
                warnings: [],
                errors: [{ message: `Unsupported provider "${provider}"` }]
              });
              emitEnvelope(envelope, options.format);
              process.exitCode = 2;
              return;
            }

            const validModes = ["local", "hybrid", "remote-first"];
            if (options.mode && !validModes.includes(options.mode)) {
              const envelope = createEnvelope({
                ok: false,
                command: "mcp connect",
                data: {
                  providedMode: options.mode
                },
                warnings: [],
                errors: [{ message: `Invalid mode "${options.mode}"` }]
              });
              emitEnvelope(envelope, options.format);
              process.exitCode = 2;
              return;
            }

            const report = context.mcpIntegration.connect(targetDir, {
              provider: provider as "custom",
              mode: options.mode ?? "hybrid"
            });
            const envelope = createEnvelope({
              ok: report.ok,
              command: "mcp connect",
              data: {
                provider: report.provider,
                mode: report.mode,
                syncDirection: report.syncDirection,
                updatedFiles: report.updatedFiles
              },
              warnings: report.warnings,
              errors: report.errors
            });
            emitEnvelope(envelope, options.format);
            if (options.format === "human") {
              if (report.ok) {
                console.log(
                  `MCP connected: provider=${report.provider}, mode=${report.mode}, direction=${report.syncDirection}`
                );
              } else {
                console.error("MCP connect failed.");
              }
            }

            context.auditLogger.append(targetDir, {
              actor: "user",
              command: "mcp connect",
              timestamp: new Date().toISOString(),
              decision: "confirmed",
              outcome: report.ok ? "success" : "failed",
              message: report.ok ? undefined : "MCP connect failed"
            });

            if (!report.ok) {
              process.exitCode = 7;
            }
          }
        );

      mcp
        .command("disconnect")
        .description("Disconnect MCP provider and return tasks mode to local")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action((options: { cwd: string; format: "human" | "json"; confirm?: boolean }) => {
          const targetDir = path.resolve(options.cwd);
          const allowed = applyPolicy({
            context,
            projectRoot: targetDir,
            command: "mcp disconnect",
            confirmed: options.confirm ?? false,
            format: options.format
          });
          if (!allowed) {
            return;
          }

          const report = context.mcpIntegration.disconnect(targetDir);
          const envelope = createEnvelope({
            ok: report.ok,
            command: "mcp disconnect",
            data: {
              provider: report.provider,
              mode: report.mode,
              syncDirection: report.syncDirection,
              updatedFiles: report.updatedFiles
            },
            warnings: report.warnings,
            errors: report.errors
          });
          emitEnvelope(envelope, options.format);

          context.auditLogger.append(targetDir, {
            actor: "user",
            command: "mcp disconnect",
            timestamp: new Date().toISOString(),
            decision: "confirmed",
            outcome: report.ok ? "success" : "failed",
            message: report.ok ? undefined : "MCP disconnect failed"
          });

          if (!report.ok) {
            process.exitCode = 7;
          }
        });
    }
  },
  {
    name: "tasks",
    description: "Manage tasks operations",
    register: (program: Command, context) => {
      const tasks = program.command("tasks").description("Manage tasks operations");

      tasks
        .command("enable")
        .description("Enable task-first workflow")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action((options: { cwd: string; format: "human" | "json"; confirm?: boolean }) => {
          const targetDir = path.resolve(options.cwd);
          const allowed = applyPolicy({
            context,
            projectRoot: targetDir,
            command: "tasks enable",
            confirmed: options.confirm ?? false,
            format: options.format
          });
          if (!allowed) {
            return;
          }

          const report = context.taskBoard.enable(targetDir);
          const envelope = createEnvelope({
            ok: report.ok,
            command: "tasks enable",
            data: {
              enabled: report.enabled,
              mode: report.mode,
              updatedFiles: report.updatedFiles
            },
            warnings: report.warnings,
            errors: report.errors
          });
          emitEnvelope(envelope, options.format);
          context.auditLogger.append(targetDir, {
            actor: "user",
            command: "tasks enable",
            timestamp: new Date().toISOString(),
            decision: "confirmed",
            outcome: report.ok ? "success" : "failed",
            message: report.ok ? undefined : "Tasks enable failed"
          });
          if (!report.ok) {
            process.exitCode = 7;
          }
        });

      tasks
        .command("disable")
        .description("Disable task-first workflow")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action((options: { cwd: string; format: "human" | "json"; confirm?: boolean }) => {
          const targetDir = path.resolve(options.cwd);
          const allowed = applyPolicy({
            context,
            projectRoot: targetDir,
            command: "tasks disable",
            confirmed: options.confirm ?? false,
            format: options.format
          });
          if (!allowed) {
            return;
          }

          const report = context.taskBoard.disable(targetDir);
          const envelope = createEnvelope({
            ok: report.ok,
            command: "tasks disable",
            data: {
              enabled: report.enabled,
              mode: report.mode,
              updatedFiles: report.updatedFiles
            },
            warnings: report.warnings,
            errors: report.errors
          });
          emitEnvelope(envelope, options.format);
          context.auditLogger.append(targetDir, {
            actor: "user",
            command: "tasks disable",
            timestamp: new Date().toISOString(),
            decision: "confirmed",
            outcome: report.ok ? "success" : "failed",
            message: report.ok ? undefined : "Tasks disable failed"
          });
          if (!report.ok) {
            process.exitCode = 7;
          }
        });

      tasks
        .command("intake <text>")
        .description("Create structured task from user text")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--type <type>", "Task type: task|bug|epic")
        .option("--priority <priority>", "Priority: P0|P1|P2|P3")
        .option("--source <source>", "Source reference for intake")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action(
          (
            text: string,
            options: {
              cwd: string;
              format: "human" | "json";
              type?: "task" | "bug" | "epic";
              priority?: "P0" | "P1" | "P2" | "P3";
              source?: string;
              confirm?: boolean;
            }
          ) => {
            const targetDir = path.resolve(options.cwd);
            const allowed = applyPolicy({
              context,
              projectRoot: targetDir,
              command: "tasks intake",
              confirmed: options.confirm ?? false,
              format: options.format
            });
            if (!allowed) {
              return;
            }

            const validTypes = ["task", "bug", "epic"];
            if (options.type && !validTypes.includes(options.type)) {
              const envelope = createEnvelope({
                ok: false,
                command: "tasks intake",
                data: {
                  providedType: options.type
                },
                warnings: [],
                errors: [{ message: `Invalid type "${options.type}"` }]
              });
              emitEnvelope(envelope, options.format);
              process.exitCode = 2;
              return;
            }

            const validPriorities = ["P0", "P1", "P2", "P3"];
            if (options.priority && !validPriorities.includes(options.priority)) {
              const envelope = createEnvelope({
                ok: false,
                command: "tasks intake",
                data: {
                  providedPriority: options.priority
                },
                warnings: [],
                errors: [{ message: `Invalid priority "${options.priority}"` }]
              });
              emitEnvelope(envelope, options.format);
              process.exitCode = 2;
              return;
            }

            const report = context.taskBoard.intake(targetDir, {
              text,
              type: options.type,
              priority: options.priority,
              source: options.source
            });
            const envelope = createEnvelope({
              ok: report.ok,
              command: "tasks intake",
              data: {
                task: report.task,
                targetStatus: report.targetStatus,
                updatedFiles: report.updatedFiles
              },
              warnings: report.warnings,
              errors: report.errors
            });
            emitEnvelope(envelope, options.format);
            context.auditLogger.append(targetDir, {
              actor: "user",
              command: "tasks intake",
              timestamp: new Date().toISOString(),
              decision: "auto-run",
              outcome: report.ok ? "success" : "failed",
              message: report.ok ? undefined : "Tasks intake failed"
            });
            if (!report.ok) {
              process.exitCode = 3;
            }
          }
        );

      tasks
        .command("list")
        .description("List tasks from local board")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--status <status>", "Status filter: inbox|ready|in_progress|review|done")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action(
          (options: {
            cwd: string;
            format: "human" | "json";
            status?: "inbox" | "ready" | "in_progress" | "review" | "done";
            confirm?: boolean;
          }) => {
            const targetDir = path.resolve(options.cwd);
            const allowed = applyPolicy({
              context,
              projectRoot: targetDir,
              command: "tasks list",
              confirmed: options.confirm ?? false,
              format: options.format
            });
            if (!allowed) {
              return;
            }

            const validStatuses = ["inbox", "ready", "in_progress", "review", "done"];
            if (options.status && !validStatuses.includes(options.status)) {
              const envelope = createEnvelope({
                ok: false,
                command: "tasks list",
                data: {
                  providedStatus: options.status
                },
                warnings: [],
                errors: [{ message: `Invalid status "${options.status}"` }]
              });
              emitEnvelope(envelope, options.format);
              process.exitCode = 2;
              return;
            }

            const report = context.taskBoard.list(targetDir, {
              status: options.status
            });
            const envelope = createEnvelope({
              ok: report.ok,
              command: "tasks list",
              data: {
                enabled: report.enabled,
                mode: report.mode,
                statusFilter: report.statusFilter,
                count: report.tasks.length,
                tasks: report.tasks
              },
              warnings: report.warnings,
              errors: report.errors
            });
            emitEnvelope(envelope, options.format);
            context.auditLogger.append(targetDir, {
              actor: "user",
              command: "tasks list",
              timestamp: new Date().toISOString(),
              decision: "auto-run",
              outcome: report.ok ? "success" : "failed",
              message: report.ok ? undefined : "Tasks list failed"
            });
            if (!report.ok) {
              process.exitCode = 1;
            }
          }
        );

      tasks
        .command("plan <taskId>")
        .description("Generate execution plan for a task")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action(
          (
            taskId: string,
            options: { cwd: string; format: "human" | "json"; confirm?: boolean }
          ) => {
            const targetDir = path.resolve(options.cwd);
            const allowed = applyPolicy({
              context,
              projectRoot: targetDir,
              command: "tasks plan",
              confirmed: options.confirm ?? false,
              format: options.format
            });
            if (!allowed) {
              return;
            }

            const report = context.taskBoard.plan(targetDir, { taskId });
            const envelope = createEnvelope({
              ok: report.ok,
              command: "tasks plan",
              data: {
                task: report.task,
                generatedTasks: report.generatedTasks,
                updatedFiles: report.updatedFiles
              },
              warnings: report.warnings,
              errors: report.errors
            });
            emitEnvelope(envelope, options.format);
            context.auditLogger.append(targetDir, {
              actor: "user",
              command: "tasks plan",
              timestamp: new Date().toISOString(),
              decision: "auto-run",
              outcome: report.ok ? "success" : "failed",
              message: report.ok ? undefined : "Tasks plan failed"
            });
            if (!report.ok) {
              process.exitCode = 3;
            }
          }
        );

      tasks
        .command("status <taskId> <status>")
        .description("Move task to another status")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action(
          (
            taskId: string,
            status: string,
            options: { cwd: string; format: "human" | "json"; confirm?: boolean }
          ) => {
            const targetDir = path.resolve(options.cwd);
            const allowed = applyPolicy({
              context,
              projectRoot: targetDir,
              command: "tasks status",
              confirmed: options.confirm ?? false,
              format: options.format
            });
            if (!allowed) {
              return;
            }

            const validStatuses = ["inbox", "ready", "in_progress", "review", "done"];
            if (!validStatuses.includes(status)) {
              const envelope = createEnvelope({
                ok: false,
                command: "tasks status",
                data: {
                  providedStatus: status
                },
                warnings: [],
                errors: [{ message: `Invalid status "${status}"` }]
              });
              emitEnvelope(envelope, options.format);
              process.exitCode = 2;
              return;
            }

            const report = context.taskBoard.changeStatus(targetDir, {
              taskId,
              status: status as "inbox" | "ready" | "in_progress" | "review" | "done"
            });
            const envelope = createEnvelope({
              ok: report.ok,
              command: "tasks status",
              data: {
                task: report.task,
                fromStatus: report.fromStatus,
                toStatus: report.toStatus,
                updatedFiles: report.updatedFiles
              },
              warnings: report.warnings,
              errors: report.errors
            });
            emitEnvelope(envelope, options.format);
            context.auditLogger.append(targetDir, {
              actor: "user",
              command: "tasks status",
              timestamp: new Date().toISOString(),
              decision: "confirmed",
              outcome: report.ok ? "success" : "failed",
              message: report.ok ? undefined : "Tasks status failed"
            });
            if (!report.ok) {
              process.exitCode = 3;
            }
          }
        );

      tasks
        .command("sync")
        .description("Sync tasks using configured MCP provider")
        .option("--cwd <path>", "Project root path", ".")
        .option("--format <format>", "Output format: human|json", "human")
        .option("--confirm", "Confirm execution for policy-gated command", false)
        .action((options: { cwd: string; format: "human" | "json"; confirm?: boolean }) => {
          const targetDir = path.resolve(options.cwd);
          const allowed = applyPolicy({
            context,
            projectRoot: targetDir,
            command: "tasks sync",
            confirmed: options.confirm ?? false,
            format: options.format
          });
          if (!allowed) {
            return;
          }

          const report = context.mcpIntegration.sync(targetDir);
          const envelope = createEnvelope({
            ok: report.ok,
            command: "tasks sync",
            data: {
              provider: report.provider,
              mode: report.mode,
              syncDirection: report.syncDirection
            },
            warnings: report.warnings,
            errors: report.errors
          });
          emitEnvelope(envelope, options.format);
          context.auditLogger.append(targetDir, {
            actor: "user",
            command: "tasks sync",
            timestamp: new Date().toISOString(),
            decision: "confirmed",
            outcome: report.ok ? "success" : "failed",
            message: report.ok ? undefined : "Tasks sync failed"
          });

          if (!report.ok) {
            process.exitCode = 6;
          }
        });
    }
  }
];
