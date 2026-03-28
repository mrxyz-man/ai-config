import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { PolicyCheckResult, PolicyGatePort } from "../core/ports";

type ToolCallingPolicyFile = {
  version: string;
  policy: string;
  auto_run: string[];
  confirm_required: string[];
  deny: string[];
};

const POLICY_FILE_PATH = "ai/rules/tool-calling-policy.yaml";
const DEFAULT_POLICY: ToolCallingPolicyFile = {
  version: "1.0",
  policy: "balanced",
  auto_run: [
    "resolve",
    "validate",
    "explain",
    "mcp status",
    "tasks intake",
    "tasks list",
    "text check",
    "questions status"
  ],
  confirm_required: [
    "init",
    "sync",
    "update",
    "mcp connect",
    "mcp disconnect",
    "tasks sync",
    "tasks enable",
    "tasks disable",
    "questions run"
  ],
  deny: ["unknown_command"]
};

const readPolicyFile = (projectRoot: string): ToolCallingPolicyFile => {
  const absolutePath = path.join(projectRoot, POLICY_FILE_PATH);
  if (!fs.existsSync(absolutePath)) {
    return DEFAULT_POLICY;
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  const parsed = YAML.parse(raw) as ToolCallingPolicyFile | null;
  if (!parsed) {
    return DEFAULT_POLICY;
  }
  return {
    version: parsed.version ?? DEFAULT_POLICY.version,
    policy: parsed.policy ?? DEFAULT_POLICY.policy,
    auto_run: Array.isArray(parsed.auto_run) ? parsed.auto_run : DEFAULT_POLICY.auto_run,
    confirm_required: Array.isArray(parsed.confirm_required)
      ? parsed.confirm_required
      : DEFAULT_POLICY.confirm_required,
    deny: Array.isArray(parsed.deny) ? parsed.deny : DEFAULT_POLICY.deny
  };
};

export class ToolCallingPolicyGate implements PolicyGatePort {
  check(projectRoot: string, command: string, confirmed: boolean): PolicyCheckResult {
    const policy = readPolicyFile(projectRoot);

    if (policy.deny.includes(command)) {
      return {
        allowed: false,
        decision: "deny",
        reason: `Command "${command}" is denied by policy`
      };
    }

    if (policy.confirm_required.includes(command)) {
      if (!confirmed) {
        return {
          allowed: false,
          decision: "confirm-required",
          reason: `Command "${command}" requires explicit --confirm`
        };
      }
      return {
        allowed: true,
        decision: "confirmed"
      };
    }

    if (policy.auto_run.includes(command)) {
      return {
        allowed: true,
        decision: "auto-run"
      };
    }

    return {
      allowed: false,
      decision: "deny",
      reason: `Command "${command}" is outside allowed policy surface`
    };
  }
}
