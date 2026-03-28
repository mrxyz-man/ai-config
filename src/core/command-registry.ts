import { Command } from "commander";

import {
  AuditLoggerPort,
  ConfigInitializerPort,
  ConfigSyncPort,
  ConfigExplainerPort,
  ConfigResolverPort,
  ConfigValidatorPort,
  PolicyGatePort
} from "./ports";
import { ModuleRegistry } from "./module-registry";

export type CommandContext = {
  initializer: ConfigInitializerPort;
  syncer: ConfigSyncPort;
  explainer: ConfigExplainerPort;
  validator: ConfigValidatorPort;
  resolver: ConfigResolverPort;
  policyGate: PolicyGatePort;
  auditLogger: AuditLoggerPort;
  moduleRegistry: ModuleRegistry;
};

export type CommandDefinition = {
  name: string;
  description: string;
  register: (program: Command, context: CommandContext) => void;
};

export class CommandRegistry {
  private readonly commands = new Map<string, CommandDefinition>();

  register(command: CommandDefinition): void {
    if (this.commands.has(command.name)) {
      throw new Error(`Command "${command.name}" is already registered`);
    }
    this.commands.set(command.name, command);
  }

  registerMany(commands: CommandDefinition[]): void {
    for (const command of commands) {
      this.register(command);
    }
  }

  list(): CommandDefinition[] {
    return [...this.commands.values()];
  }

  apply(program: Command, context: CommandContext): void {
    for (const command of this.commands.values()) {
      command.register(program, context);
    }
  }
}
