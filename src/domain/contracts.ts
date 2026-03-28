import { z } from "zod";

export const MODULE_NAMES = [
  "project",
  "context",
  "rules",
  "agents",
  "tasks",
  "text",
  "questions",
  "instructions",
  "custom",
  "state"
] as const;

export const ModuleNameSchema = z.enum(MODULE_NAMES);

export const AiConfigSchema = z.object({
  schema_version: z.string().min(1),
  project_id: z.string().min(1),
  profile: z.string().min(1),
  default_language: z.string().min(1),
  fallback_language: z.string().min(1),
  timezone: z.string().min(1),
  modules: z.record(ModuleNameSchema, z.boolean()),
  execution: z.object({
    mode: z.string().min(1),
    policy_profile: z.string().min(1),
    require_confirmation_for_mutations: z.boolean()
  })
});

export const ModulesConfigSchema = z.object({
  version: z.string().min(1),
  active_modules: z.array(ModuleNameSchema).min(1),
  module_modes: z.record(z.string(), z.string()).optional().default({})
});

export const ProjectConfigSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  domains: z.array(z.string().min(1)).min(1),
  runtime_environment: z.object({
    shell: z.string().min(1),
    os_family: z.string().min(1),
    timezone: z.string().min(1)
  }),
  repository_map: z.object({
    docs: z.array(z.string().min(1)).min(1),
    ai_root: z.string().min(1),
    custom_root: z.string().min(1)
  }),
  engineering_goals: z.array(z.string().min(1)).min(1)
});

export const ResolvedConfigSchema = z.object({
  generated_at: z.string().nullable(),
  status: z.string().min(1),
  profile: z.object({
    project_id: z.string().min(1),
    language: z.string().min(1),
    timezone: z.string().min(1)
  }),
  active_modules: z.array(ModuleNameSchema).min(1),
  execution: z.object({
    mode: z.string().min(1),
    policy: z.string().min(1),
    require_confirmation_for_mutations: z.boolean()
  }),
  agent_roles: z.object({
    default: z.string().min(1),
    enabled: z.array(z.string().min(1)).min(1),
    execution_order: z.array(z.string().min(1)).min(1)
  }),
  tasks: z.object({
    enabled: z.boolean(),
    mode: z.string().min(1),
    always_offer_task_creation: z.boolean(),
    epic_auto_decomposition: z.boolean(),
    statuses: z.array(z.string().min(1)).min(1)
  }),
  text: z.object({
    default_encoding: z.string().min(1),
    enforce_utf8: z.boolean(),
    require_readable_cyrillic: z.boolean(),
    language_policy: z.string().min(1)
  }),
  context_priorities: z.array(z.string().min(1)).min(1),
  note: z.string().min(1)
});

export const IgnoreConfigSchema = z.object({
  version: z.string().min(1),
  ignore: z.array(z.string().min(1)),
  allowlist_overrides: z.array(z.string().min(1))
});

export type AiConfig = z.infer<typeof AiConfigSchema>;
export type ModulesConfig = z.infer<typeof ModulesConfigSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type ResolvedConfig = z.infer<typeof ResolvedConfigSchema>;
export type IgnoreConfig = z.infer<typeof IgnoreConfigSchema>;

