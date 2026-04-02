import {
  DEFAULTS_BY_PROFILE,
  type InitModuleName,
  INIT_MODULES,
  INIT_PROFILES,
  MCP_PROVIDER_IDS,
  MODULE_DEPENDENCIES,
  PROFILE_TO_MODULES,
  PROVIDER_PRESETS,
  resolveInitConfig,
  TASK_MODES
} from "./init-config";

describe("init-config dictionaries", () => {
  test("all profile module entries reference known modules", () => {
    const knownModules = new Set<string>(INIT_MODULES);
    for (const profile of INIT_PROFILES) {
      for (const moduleName of PROFILE_TO_MODULES[profile]) {
        expect(knownModules.has(moduleName)).toBe(true);
      }
    }
  });

  test("all profiles include mandatory core modules", () => {
    const required = new Set<InitModuleName>(["core", "qa"]);
    for (const profile of INIT_PROFILES) {
      const enabled = new Set(PROFILE_TO_MODULES[profile]);
      for (const moduleName of required) {
        expect(enabled.has(moduleName)).toBe(true);
      }
    }
  });

  test("module dependencies reference known modules", () => {
    const knownModules = new Set<string>(INIT_MODULES);
    for (const moduleName of INIT_MODULES) {
      const dependencies = MODULE_DEPENDENCIES[moduleName];
      expect(Array.isArray(dependencies)).toBe(true);
      for (const dependency of dependencies) {
        expect(knownModules.has(dependency)).toBe(true);
      }
    }
  });

  test("profile defaults use valid task modes", () => {
    const knownTaskModes = new Set<string>(TASK_MODES);
    for (const profile of INIT_PROFILES) {
      expect(knownTaskModes.has(DEFAULTS_BY_PROFILE[profile].taskMode)).toBe(true);
      expect(typeof DEFAULTS_BY_PROFILE[profile].questionnaireOnInit).toBe("boolean");
      expect(typeof DEFAULTS_BY_PROFILE[profile].strictEnabledOnly).toBe("boolean");
    }
  });

  test("provider presets reference known providers", () => {
    const knownProviders = new Set<string>(MCP_PROVIDER_IDS);
    for (const profile of INIT_PROFILES) {
      for (const providerId of PROVIDER_PRESETS[profile]) {
        expect(knownProviders.has(providerId)).toBe(true);
      }
    }
  });

  test("resolveInitConfig auto-fixes dependencies in interactive mode", () => {
    const resolved = resolveInitConfig(
      {
        profile: "standard",
        modules: ["core", "qa", "skills"]
      },
      {
        autoFixDependencies: true
      }
    );

    expect(resolved.errors).toEqual([]);
    expect(resolved.modules).toContain("skills");
    expect(resolved.modules).toContain("rules");
    expect(resolved.modules).toContain("templates");
    expect(resolved.autoAddedModules).toEqual(["rules", "templates"]);
  });

  test("resolveInitConfig reports dependency errors in non-interactive mode", () => {
    const resolved = resolveInitConfig(
      {
        profile: "standard",
        modules: ["core", "qa", "skills"]
      },
      {
        autoFixDependencies: false
      }
    );

    expect(resolved.errors.length).toBeGreaterThan(0);
    expect(resolved.errors.join(" ")).toContain("requires");
  });
});
