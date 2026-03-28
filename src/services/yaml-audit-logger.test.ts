import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import YAML from "yaml";
import { describe, expect, it } from "@jest/globals";

import { YamlAuditLogger } from "./yaml-audit-logger";

const createTempProject = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-audit-test-"));
  const auditDir = path.join(tempRoot, "ai/state");
  fs.mkdirSync(auditDir, { recursive: true });
  fs.writeFileSync(path.join(auditDir, "audit-log.yaml"), YAML.stringify({ events: [] }), "utf8");
  return tempRoot;
};

describe("YamlAuditLogger", () => {
  it("appends events to audit log", () => {
    const logger = new YamlAuditLogger();
    const projectRoot = createTempProject();

    logger.append(projectRoot, {
      actor: "user",
      command: "validate",
      timestamp: "2026-03-28T00:00:00.000Z",
      decision: "auto-run",
      outcome: "success"
    });

    const raw = fs.readFileSync(path.join(projectRoot, "ai/state/audit-log.yaml"), "utf8");
    const parsed = YAML.parse(raw) as { events: Array<{ command: string; outcome: string }> };

    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]?.command).toBe("validate");
    expect(parsed.events[0]?.outcome).toBe("success");
  });
});

