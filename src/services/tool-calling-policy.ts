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

const readPolicyFile = (projectRoot: string): ToolCallingPolicyFile => {
  const absolutePath = path.join(projectRoot, POLICY_FILE_PATH);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const parsed = YAML.parse(raw) as ToolCallingPolicyFile;
  return parsed;
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

