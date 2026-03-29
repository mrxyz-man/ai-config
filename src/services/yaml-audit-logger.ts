import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";
import { z } from "zod";

import { AuditEvent, AuditLoggerPort } from "../core/ports";

type AuditLogFile = {
  version: string;
  retention: number;
  events: AuditEvent[];
};

const AUDIT_LOG_PATH = "ai/state/audit-log.yaml";
const DEFAULT_RETENTION = 1000;
const DEFAULT_VERSION = "1.0";

const AuditEventSchema = z.object({
  actor: z.enum(["agent", "user"]),
  command: z.string().min(1),
  timestamp: z.string().min(1),
  decision: z.enum(["auto-run", "confirm-required", "confirmed", "deny"]),
  outcome: z.enum(["success", "failed", "denied"]),
  message: z.string().optional()
});

const AuditLogSchema = z.object({
  version: z.string().default(DEFAULT_VERSION),
  retention: z.number().int().positive().default(DEFAULT_RETENTION),
  events: z.array(AuditEventSchema).default([])
});

const readAuditFile = (absolutePath: string): AuditLogFile => {
  if (!fs.existsSync(absolutePath)) {
    return { version: DEFAULT_VERSION, retention: DEFAULT_RETENTION, events: [] };
  }

  try {
    const raw = fs.readFileSync(absolutePath, "utf8");
    const parsed = YAML.parse(raw);
    const validated = AuditLogSchema.safeParse(parsed);
    if (!validated.success) {
      return { version: DEFAULT_VERSION, retention: DEFAULT_RETENTION, events: [] };
    }
    return validated.data as AuditLogFile;
  } catch {
    return { version: DEFAULT_VERSION, retention: DEFAULT_RETENTION, events: [] };
  }
};

export class YamlAuditLogger implements AuditLoggerPort {
  constructor(private readonly retentionLimit = DEFAULT_RETENTION) {}

  append(projectRoot: string, event: AuditEvent): void {
    const checkedEvent = AuditEventSchema.safeParse(event);
    if (!checkedEvent.success) {
      throw new Error(`Invalid audit event: ${checkedEvent.error.issues[0]?.message ?? "unknown"}`);
    }

    const absolutePath = path.join(projectRoot, AUDIT_LOG_PATH);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    const current = readAuditFile(absolutePath);
    current.events.push(checkedEvent.data);
    current.retention = this.retentionLimit;

    if (current.events.length > this.retentionLimit) {
      current.events = current.events.slice(current.events.length - this.retentionLimit);
    }

    const serialized = YAML.stringify(current);
    const tempPath = `${absolutePath}.tmp`;
    fs.writeFileSync(tempPath, serialized, "utf8");
    if (fs.existsSync(absolutePath)) {
      fs.rmSync(absolutePath, { force: true });
    }
    fs.renameSync(tempPath, absolutePath);
  }
}
