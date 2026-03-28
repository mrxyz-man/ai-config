import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import YAML from "yaml";
import { describe, expect, it } from "@jest/globals";

import { TaskBoardService } from "./task-board-service";

const createTempProject = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-task-board-test-"));
  const sourceAiDir = path.resolve(__dirname, "../../ai");
  const targetAiDir = path.join(tempRoot, "ai");
  fs.cpSync(sourceAiDir, targetAiDir, { recursive: true });
  return tempRoot;
};

describe("TaskBoardService", () => {
  it("enables and disables tasks in config", () => {
    const projectRoot = createTempProject();
    const service = new TaskBoardService();

    const disabled = service.disable(projectRoot);
    expect(disabled.ok).toBe(true);
    expect(disabled.enabled).toBe(false);

    const enabled = service.enable(projectRoot);
    expect(enabled.ok).toBe(true);
    expect(enabled.enabled).toBe(true);
  });

  it("creates task via intake and stores it in inbox", () => {
    const projectRoot = createTempProject();
    const service = new TaskBoardService();

    const report = service.intake(projectRoot, { text: "Implement CLI help improvements" });
    expect(report.ok).toBe(true);
    expect(report.task?.id).toBeTruthy();
    expect(report.targetStatus).toBe("inbox");

    const inbox = YAML.parse(
      fs.readFileSync(path.join(projectRoot, "ai/tasks/board/inbox.yaml"), "utf8")
    ) as { tasks: Array<{ description: string }> };
    expect(inbox.tasks.length).toBeGreaterThan(0);
    expect(
      inbox.tasks.some((task) => task.description.includes("Implement CLI help improvements"))
    ).toBe(true);
  });

  it("fails intake when tasks are disabled", () => {
    const projectRoot = createTempProject();
    const service = new TaskBoardService();
    service.disable(projectRoot);

    const report = service.intake(projectRoot, { text: "Should not be accepted" });
    expect(report.ok).toBe(false);
    expect(report.errors[0]?.message).toContain("Tasks are disabled");
  });

  it("lists tasks with optional status filter", () => {
    const projectRoot = createTempProject();
    const service = new TaskBoardService();
    service.intake(projectRoot, { text: "Task one" });
    service.intake(projectRoot, { text: "Task two" });

    const all = service.list(projectRoot);
    expect(all.ok).toBe(true);
    expect(all.tasks.length).toBeGreaterThanOrEqual(2);

    const inboxOnly = service.list(projectRoot, { status: "inbox" });
    expect(inboxOnly.ok).toBe(true);
    expect(inboxOnly.tasks.every((task) => task.status === "inbox")).toBe(true);
  });
});
