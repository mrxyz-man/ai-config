import { ModuleDefinition } from "../core/module-registry";

export const builtInModules: ModuleDefinition[] = [
  { name: "project", description: "Project identity and environment context", enabledByDefault: true },
  { name: "context", description: "Priority context sources for AI runtime", enabledByDefault: true },
  { name: "rules", description: "Policy, constraints, and ignore behavior", enabledByDefault: true },
  { name: "agents", description: "Role registry and execution behavior", enabledByDefault: true },
  { name: "tasks", description: "Task lifecycle and planning workflow", enabledByDefault: true },
  { name: "text", description: "Encoding, locale, and text quality safeguards", enabledByDefault: true },
  { name: "questions", description: "Onboarding and profile-driven questionnaire", enabledByDefault: true },
  { name: "instructions", description: "System and workflow instruction layers", enabledByDefault: true },
  { name: "custom", description: "User-owned local overrides and instructions", enabledByDefault: true },
  { name: "state", description: "Sync and audit runtime state", enabledByDefault: true }
];

