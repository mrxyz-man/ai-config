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
});

