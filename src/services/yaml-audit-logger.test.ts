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
  fs.writeFileSync(
    path.join(auditDir, "audit-log.yaml"),
    YAML.stringify({ version: "1.0", retention: 1000, events: [] }),
    "utf8"
  );
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
    const parsed = YAML.parse(raw) as {
      version: string;
      retention: number;
      events: Array<{ command: string; outcome: string }>;
    };

    expect(parsed.version).toBe("1.0");
    expect(parsed.retention).toBe(1000);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]?.command).toBe("validate");
    expect(parsed.events[0]?.outcome).toBe("success");
  });

  it("keeps only the latest events according to retention", () => {
    const logger = new YamlAuditLogger(2);
    const projectRoot = createTempProject();

    logger.append(projectRoot, {
      actor: "user",
      command: "validate",
      timestamp: "2026-03-28T00:00:00.000Z",
      decision: "auto-run",
      outcome: "success"
    });
    logger.append(projectRoot, {
      actor: "user",
      command: "resolve",
      timestamp: "2026-03-28T00:00:01.000Z",
      decision: "auto-run",
      outcome: "success"
    });
    logger.append(projectRoot, {
      actor: "user",
      command: "sync",
      timestamp: "2026-03-28T00:00:02.000Z",
      decision: "confirmed",
      outcome: "success"
    });

    const raw = fs.readFileSync(path.join(projectRoot, "ai/state/audit-log.yaml"), "utf8");
    const parsed = YAML.parse(raw) as { retention: number; events: Array<{ command: string }> };

    expect(parsed.retention).toBe(2);
    expect(parsed.events).toHaveLength(2);
    expect(parsed.events.map((event) => event.command)).toEqual(["resolve", "sync"]);
  });

  it("throws when audit event violates runtime schema", () => {
    const logger = new YamlAuditLogger();
    const projectRoot = createTempProject();

    expect(() =>
      logger.append(projectRoot, {
        actor: "user",
        command: "",
        timestamp: "2026-03-28T00:00:00.000Z",
        decision: "auto-run",
        outcome: "success"
      })
    ).toThrow("Invalid audit event");
  });

  it("recovers from malformed audit file and appends new event", () => {
    const logger = new YamlAuditLogger();
    const projectRoot = createTempProject();
    const auditPath = path.join(projectRoot, "ai/state/audit-log.yaml");
    fs.writeFileSync(auditPath, "events: [broken", "utf8");

    logger.append(projectRoot, {
      actor: "user",
      command: "validate",
      timestamp: "2026-03-28T00:00:00.000Z",
      decision: "auto-run",
      outcome: "success"
    });

    const parsed = YAML.parse(fs.readFileSync(auditPath, "utf8")) as {
      events: Array<{ command: string }>;
    };
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]?.command).toBe("validate");
  });
});
