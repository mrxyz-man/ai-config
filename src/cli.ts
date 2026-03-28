#!/usr/bin/env node

const [, , ...args] = process.argv;

const command = args[0] ?? "help";

const showHelp = (): void => {
  console.log("ai-config CLI (v1 foundation)");
  console.log("");
  console.log("Usage:");
  console.log("  ai-config <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  init       Bootstrap ./ai configuration");
  console.log("  sync       Sync managed configuration layers");
  console.log("  resolve    Build resolved agent configuration");
  console.log("  validate   Run configuration validation");
  console.log("  explain    Explain resolved provenance");
};

switch (command) {
  case "help":
  case "--help":
  case "-h":
    showHelp();
    break;
  default:
    console.log(`Command "${command}" is not implemented yet.`);
    console.log('Run "ai-config help" to see available commands.');
    process.exitCode = 0;
}

