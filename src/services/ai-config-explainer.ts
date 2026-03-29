import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { ResolvedConfig, ResolvedConfigSchema } from "../domain/contracts";
import { ConfigExplainerPort, ExplainIssue, ExplainMatch, ExplainReport } from "../core/ports";

type ExplainOptions = {
  key?: string;
  module?: string;
};

type ProvenanceMap = Record<string, { module: string; sources: string[] }>;

const RESOLVED_PATH = "ai/resolved.yaml";

const PROVENANCE_MAP: ProvenanceMap = {
  generated_at: { module: "state", sources: ["ai/resolved.yaml"] },
  status: { module: "state", sources: ["ai/resolved.yaml"] },
  "profile.project_id": { module: "project", sources: ["ai/ai.yaml"] },
  "profile.language": { module: "project", sources: ["ai/ai.yaml"] },
  "profile.timezone": { module: "project", sources: ["ai/ai.yaml"] },
  active_modules: { module: "state", sources: ["ai/modules.yaml"] },
  "execution.mode": { module: "rules", sources: ["ai/ai.yaml"] },
  "execution.policy": { module: "rules", sources: ["ai/ai.yaml"] },
  "execution.require_confirmation_for_mutations": { module: "rules", sources: ["ai/ai.yaml"] },
  "agent_roles.default": { module: "agents", sources: ["ai/agents/registry.yaml"] },
  "agent_roles.enabled": { module: "agents", sources: ["ai/agents/registry.yaml"] },
  "agent_roles.execution_order": { module: "agents", sources: ["ai/agents/registry.yaml"] },
  "tasks.enabled": { module: "tasks", sources: ["ai/tasks/config.yaml"] },
  "tasks.mode": { module: "tasks", sources: ["ai/tasks/config.yaml"] },
  "tasks.always_offer_task_creation": { module: "tasks", sources: ["ai/tasks/config.yaml"] },
  "tasks.epic_auto_decomposition": { module: "tasks", sources: ["ai/tasks/config.yaml"] },
  "tasks.statuses": { module: "tasks", sources: ["ai/tasks/config.yaml"] },
  "text.default_encoding": { module: "text", sources: ["ai/text/encoding.yaml"] },
  "text.enforce_utf8": { module: "text", sources: ["ai/text/encoding.yaml"] },
  "text.require_readable_cyrillic": { module: "text", sources: ["ai/text/locale.yaml"] },
  "text.language_policy": { module: "text", sources: ["ai/text/locale.yaml"] },
  context_priorities: { module: "context", sources: ["ai/context/sources.yaml"] },
  note: { module: "state", sources: ["ai/resolved.yaml"] }
};

const getByPath = (value: unknown, dottedPath: string): unknown => {
  if (!dottedPath) {
    return value;
  }
  const parts = dottedPath.split(".");
  let current = value as Record<string, unknown> | undefined;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = current[part] as Record<string, unknown>;
  }
  return current;
};

const buildAllMatches = (resolved: ResolvedConfig): ExplainMatch[] => {
  const matches: ExplainMatch[] = [];
  for (const [key, meta] of Object.entries(PROVENANCE_MAP)) {
    const value = getByPath(resolved, key);
    if (typeof value === "undefined") {
      continue;
    }
    matches.push({
      key,
      module: meta.module,
      value,
      sources: meta.sources
    });
  }
  return matches;
};

export class AiConfigExplainer implements ConfigExplainerPort {
  explain(projectRoot: string, options?: ExplainOptions): ExplainReport {
    const absoluteRoot = path.resolve(projectRoot);
    const resolvedAbsolutePath = path.join(absoluteRoot, RESOLVED_PATH);
    const warnings: ExplainIssue[] = [];
    const errors: ExplainIssue[] = [];

    if (!fs.existsSync(resolvedAbsolutePath)) {
      errors.push({
        file: RESOLVED_PATH,
        message: "Resolved state is missing. Run `ai-config resolve` first."
      });
      return {
        ok: false,
        keyFilter: options?.key,
        moduleFilter: options?.module,
        matches: [],
        warnings,
        errors
      };
    }

    let resolved: ResolvedConfig;
    try {
      const parsed = YAML.parse(fs.readFileSync(resolvedAbsolutePath, "utf8"));
      const result = ResolvedConfigSchema.safeParse(parsed);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            file: RESOLVED_PATH,
            path: issue.path.map((part) => String(part)).join("."),
            message: issue.message
          });
        }
        return {
          ok: false,
          keyFilter: options?.key,
          moduleFilter: options?.module,
          matches: [],
          warnings,
          errors
        };
      }
      resolved = result.data;
    } catch (error) {
      errors.push({
        file: RESOLVED_PATH,
        message: `Failed to parse YAML: ${(error as Error).message}`
      });
      return {
        ok: false,
        keyFilter: options?.key,
        moduleFilter: options?.module,
        matches: [],
        warnings,
        errors
      };
    }

    const allMatches = buildAllMatches(resolved);
    const keyFilter = options?.key?.trim();
    const moduleFilter = options?.module?.trim();

    if (keyFilter) {
      const keyExists = allMatches.some((entry) => entry.key === keyFilter);
      if (!keyExists) {
        errors.push({
          file: RESOLVED_PATH,
          path: keyFilter,
          message: `Unknown key path "${keyFilter}"`
        });
      }
    }

    if (moduleFilter) {
      const moduleExists = allMatches.some((entry) => entry.module === moduleFilter);
      if (!moduleExists) {
        errors.push({
          file: RESOLVED_PATH,
          path: moduleFilter,
          message: `Unknown module "${moduleFilter}"`
        });
      }
    }

    if (errors.length > 0) {
      return {
        ok: false,
        keyFilter,
        moduleFilter,
        matches: [],
        warnings,
        errors
      };
    }

    const matches = allMatches.filter((entry) => {
      if (keyFilter && entry.key !== keyFilter) {
        return false;
      }
      if (moduleFilter && entry.module !== moduleFilter) {
        return false;
      }
      return true;
    });

    return {
      ok: true,
      keyFilter,
      moduleFilter,
      matches,
      warnings,
      errors
    };
  }
}
