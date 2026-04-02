import { Command } from "commander";

import { ConfigInitializerPort } from "./ports";

export type CommandContext = {
  initializer: ConfigInitializerPort;
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

  apply(program: Command, context: CommandContext): void {
    for (const command of this.commands.values()) {
      command.register(program, context);
    }
  }
}

