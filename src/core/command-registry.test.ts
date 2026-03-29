import { describe, expect, it } from "@jest/globals";
import { Command } from "commander";

import { CommandRegistry } from "./command-registry";
import { ModuleRegistry } from "./module-registry";

describe("CommandRegistry", () => {
  it("registers commands and applies them to commander", () => {
    const registry = new CommandRegistry();
    const program = new Command();
    let called = false;

    registry.register({
      name: "hello",
      description: "Test command",
      register: (root) => {
        root.command("hello").action(() => {
          called = true;
        });
      }
    });

    registry.apply(program, {
      moduleRegistry: new ModuleRegistry(),
      initializer: {
        init: () => ({
          ok: true,
          projectRoot: ".",
          createdFiles: [],
          updatedFiles: [],
          detected: {
            hasPackageJson: true,
            hasTypeScript: true,
            hasNodeModules: false
          },
          unresolvedQuestions: [],
          warnings: [],
          errors: []
        })
      },
      resolver: {
        resolve: () => ({
          ok: true,
          outputFile: "ai/resolved.yaml",
          resolved: null,
          resolvedModules: [],
          checksum: null,
          warnings: [],
          errors: []
        })
      },
      syncer: {
        sync: () => ({
          ok: true,
          dryRun: false,
          appliedChanges: [],
          plannedChanges: [],
          preservedCustomFiles: [],
          migrationSummary: [],
          warnings: [],
          errors: []
        })
      },
      explainer: {
        explain: () => ({
          ok: true,
          matches: [],
          warnings: [],
          errors: []
        })
      },
      mcpIntegration: {
        status: () => ({
          ok: true,
          provider: null,
          enabled: false,
          mode: "local",
          syncDirection: "none",
          warnings: [],
          errors: []
        }),
        connect: () => ({
          ok: true,
          provider: "custom",
          mode: "hybrid",
          syncDirection: "pull",
          updatedFiles: [],
          warnings: [],
          errors: []
        }),
        disconnect: () => ({
          ok: true,
          provider: null,
          mode: "local",
          syncDirection: "none",
          updatedFiles: [],
          warnings: [],
          errors: []
        }),
        sync: () => ({
          ok: false,
          provider: null,
          mode: "local",
          syncDirection: "none",
          updatedFiles: [],
          warnings: [],
          errors: [{ file: "ai/tasks/integrations/mcp.yaml", message: "not connected" }]
        })
      },
      taskBoard: {
        enable: () => ({
          ok: true,
          enabled: true,
          mode: "local",
          updatedFiles: [],
          warnings: [],
          errors: []
        }),
        disable: () => ({
          ok: true,
          enabled: false,
          mode: "local",
          updatedFiles: [],
          warnings: [],
          errors: []
        }),
        intake: () => ({
          ok: true,
          task: null,
          targetStatus: "inbox",
          updatedFiles: [],
          warnings: [],
          errors: []
        }),
        list: () => ({
          ok: true,
          enabled: true,
          mode: "local",
          tasks: [],
          warnings: [],
          errors: []
        }),
        plan: () => ({
          ok: true,
          task: null,
          generatedTasks: [],
          updatedFiles: [],
          warnings: [],
          errors: []
        }),
        changeStatus: () => ({
          ok: true,
          task: null,
          fromStatus: "inbox",
          toStatus: "ready",
          updatedFiles: [],
          warnings: [],
          errors: []
        })
      },
      textPolicy: {
        check: () => ({
          ok: true,
          scanMode: "repository",
          checkedFiles: 0,
          violations: [],
          warnings: [],
          errors: []
        })
      },
      questions: {
        status: () => ({
          ok: true,
          enabled: true,
          language: "ru",
          completed: true,
          requiredBlocks: [],
          answeredBlocks: [],
          missingBlocks: [],
          warnings: [],
          errors: []
        }),
        run: () => ({
          ok: true,
          language: "ru",
          completed: true,
          missingBlocks: [],
          pendingQuestions: [],
          appliedAnswers: 0,
          updatedFiles: [],
          warnings: [],
          errors: []
        })
      },
      policyGate: {
        check: () => ({
          allowed: true,
          decision: "auto-run"
        })
      },
      auditLogger: {
        append: () => undefined
      },
      validator: {
        validate: () => ({
          scope: "all",
          ok: true,
          validatedFiles: [],
          errors: [],
          warnings: []
        })
      }
    });

    program.parse(["node", "test", "hello"], { from: "node" });
    expect(called).toBe(true);
  });

  it("throws for duplicate command names", () => {
    const registry = new CommandRegistry();
    const command = {
      name: "dup",
      description: "Duplicate command",
      register: () => undefined
    };

    registry.register(command);
    expect(() => registry.register(command)).toThrow('Command "dup" is already registered');
  });
});
