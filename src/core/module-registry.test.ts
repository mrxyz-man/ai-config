import { describe, expect, it } from "@jest/globals";

import { ModuleRegistry } from "./module-registry";

describe("ModuleRegistry", () => {
  it("registers and lists modules", () => {
    const registry = new ModuleRegistry();
    registry.register({
      name: "project",
      description: "Project module",
      enabledByDefault: true
    });

    const modules = registry.list();
    expect(modules).toHaveLength(1);
    expect(modules[0]?.name).toBe("project");
  });

  it("throws for duplicate modules", () => {
    const registry = new ModuleRegistry();
    const moduleDef = {
      name: "context" as const,
      description: "Context module",
      enabledByDefault: true
    };

    registry.register(moduleDef);
    expect(() => registry.register(moduleDef)).toThrow('Module "context" is already registered');
  });
});

