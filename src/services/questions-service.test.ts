import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import YAML from "yaml";
import { describe, expect, it } from "@jest/globals";

import { QuestionsService } from "./questions-service";

const createTempProject = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-questions-test-"));
  const sourceAiDir = path.resolve(__dirname, "../../ai");
  const targetAiDir = path.join(tempRoot, "ai");
  fs.cpSync(sourceAiDir, targetAiDir, { recursive: true });
  return tempRoot;
};

describe("QuestionsService", () => {
  it("returns questionnaire status", () => {
    const projectRoot = createTempProject();
    const service = new QuestionsService();

    const report = service.status(projectRoot);

    expect(report.ok).toBe(true);
    expect(report.language).toBe("ru");
    expect(Array.isArray(report.missingBlocks)).toBe(true);
  });

  it("runs questionnaire and updates language", () => {
    const projectRoot = createTempProject();
    const service = new QuestionsService();

    const report = service.run(projectRoot, { language: "en" });

    expect(report.ok).toBe(true);
    expect(report.language).toBe("en");
    const answers = YAML.parse(
      fs.readFileSync(path.join(projectRoot, "ai/questions/answers.yaml"), "utf8")
    ) as { language_confirmed: string };
    expect(answers.language_confirmed).toBe("en");
  });

  it("fails in non-interactive mode when required blocks are unresolved", () => {
    const projectRoot = createTempProject();
    const service = new QuestionsService();

    const answersPath = path.join(projectRoot, "ai/questions/answers.yaml");
    const answers = YAML.parse(fs.readFileSync(answersPath, "utf8")) as {
      completed: boolean;
      answers: Array<{ id: string; value: string; confidence?: string }>;
    };
    answers.completed = false;
    answers.answers = [];
    fs.writeFileSync(answersPath, YAML.stringify(answers), "utf8");

    const report = service.run(projectRoot, { nonInteractive: true });

    expect(report.ok).toBe(false);
    expect(report.missingBlocks.length).toBeGreaterThan(0);
    expect(report.errors.length).toBeGreaterThan(0);
  });

  it("applies provided answers and completes required blocks", () => {
    const projectRoot = createTempProject();
    const service = new QuestionsService();

    const answersPath = path.join(projectRoot, "ai/questions/answers.yaml");
    const answers = YAML.parse(fs.readFileSync(answersPath, "utf8")) as {
      completed: boolean;
      answers: Array<{ id: string; value: string; confidence?: string }>;
    };
    answers.completed = false;
    answers.answers = [];
    fs.writeFileSync(answersPath, YAML.stringify(answers), "utf8");

    const report = service.run(projectRoot, {
      profile: "default",
      nonInteractive: true,
      providedAnswers: [
        { id: "q1", value: "Goal answer" },
        { id: "q2", value: "Standards answer" },
        { id: "risk-tolerance", value: "Low risk" },
        { id: "communication-style", value: "Concise" }
      ]
    });

    expect(report.ok).toBe(true);
    expect(report.completed).toBe(true);
    expect(report.missingBlocks).toHaveLength(0);
    expect(report.appliedAnswers).toBe(4);
  });

  it("returns structured error when answers file is malformed", () => {
    const projectRoot = createTempProject();
    const service = new QuestionsService();

    fs.writeFileSync(path.join(projectRoot, "ai/questions/answers.yaml"), "answers: [broken", "utf8");

    const report = service.status(projectRoot);
    expect(report.ok).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
  });
});
