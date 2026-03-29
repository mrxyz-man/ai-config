import { MODULE_NAMES, ModuleNameSchema } from "../domain/contracts";

export type ModuleDefinition = {
  name: (typeof MODULE_NAMES)[number];
  description: string;
  enabledByDefault: boolean;
};

export class ModuleRegistry {
  private readonly modules = new Map<ModuleDefinition["name"], ModuleDefinition>();

  register(module: ModuleDefinition): void {
    ModuleNameSchema.parse(module.name);
    if (this.modules.has(module.name)) {
      throw new Error(`Module "${module.name}" is already registered`);
    }
    this.modules.set(module.name, module);
  }

  registerMany(modules: ModuleDefinition[]): void {
    for (const module of modules) {
      this.register(module);
    }
  }

  get(name: ModuleDefinition["name"]): ModuleDefinition | undefined {
    return this.modules.get(name);
  }

  list(): ModuleDefinition[] {
    return [...this.modules.values()];
  }
}

