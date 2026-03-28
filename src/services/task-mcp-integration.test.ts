import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";
import YAML from "yaml";

import { TaskMcpIntegrationService } from "./task-mcp-integration";

const createTempProject = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-mcp-test-"));
  const sourceAiDir = path.resolve(__dirname, "../../ai");
  const targetAiDir = path.join(tempRoot, "ai");
  fs.cpSync(sourceAiDir, targetAiDir, { recursive: true });
  return tempRoot;
};

describe("TaskMcpIntegrationService", () => {
  it("returns current mcp status", () => {
    const projectRoot = createTempProject();
    const service = new TaskMcpIntegrationService();

    const report = service.status(projectRoot);

    expect(report.ok).toBe(true);
    expect(report.enabled).toBe(false);
    expect(report.provider).toBeNull();
    expect(report.mode).toBe("local");
  });

  it("connects gitlab provider and switches tasks mode", () => {
    const projectRoot = createTempProject();
    const service = new TaskMcpIntegrationService();

    const report = service.connect(projectRoot, { provider: "gitlab", mode: "hybrid" });

    expect(report.ok).toBe(true);
    const tasksYaml = YAML.parse(fs.readFileSync(path.join(projectRoot, "ai/tasks/config.yaml"), "utf8")) as {
      mode: string;
    };
    const mcpYaml = YAML.parse(
      fs.readFileSync(path.join(projectRoot, "ai/tasks/integrations/mcp.yaml"), "utf8")
    ) as { enabled: boolean; provider: string | null; mode: string };
    expect(tasksYaml.mode).toBe("hybrid");
    expect(mcpYaml.enabled).toBe(true);
    expect(mcpYaml.provider).toBe("gitlab");
    expect(mcpYaml.mode).toBe("hybrid");
  });

  it("disconnects provider and restores local mode", () => {
    const projectRoot = createTempProject();
    const service = new TaskMcpIntegrationService();
    service.connect(projectRoot, { provider: "gitlab", mode: "hybrid" });

    const report = service.disconnect(projectRoot);

    expect(report.ok).toBe(true);
    const tasksYaml = YAML.parse(fs.readFileSync(path.join(projectRoot, "ai/tasks/config.yaml"), "utf8")) as {
      mode: string;
    };
    expect(tasksYaml.mode).toBe("local");
  });

  it("returns sync error when provider is not connected", () => {
    const projectRoot = createTempProject();
    const service = new TaskMcpIntegrationService();

    const report = service.sync(projectRoot);

    expect(report.ok).toBe(false);
    expect(report.errors[0]?.message).toContain("not enabled");
  });
});

