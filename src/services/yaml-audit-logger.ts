import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { AuditEvent, AuditLoggerPort } from "../core/ports";

type AuditLogFile = {
  events: AuditEvent[];
};

const AUDIT_LOG_PATH = "ai/state/audit-log.yaml";

const readAuditFile = (absolutePath: string): AuditLogFile => {
  if (!fs.existsSync(absolutePath)) {
    return { events: [] };
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  const parsed = YAML.parse(raw) as AuditLogFile | null;
  if (!parsed || !Array.isArray(parsed.events)) {
    return { events: [] };
  }
  return parsed;
};

export class YamlAuditLogger implements AuditLoggerPort {
  append(projectRoot: string, event: AuditEvent): void {
    const absolutePath = path.join(projectRoot, AUDIT_LOG_PATH);
    const current = readAuditFile(absolutePath);
    current.events.push(event);
    const serialized = YAML.stringify(current);
    fs.writeFileSync(absolutePath, serialized, "utf8");
  }
}

