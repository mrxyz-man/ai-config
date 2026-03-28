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
