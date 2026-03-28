import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";
import { z } from "zod";

import { QuestionsPort, QuestionsRunReport, QuestionsStatusReport } from "../core/ports";

const QUESTIONS_CONFIG_PATH = "ai/questions/config.yaml";
const QUESTIONS_ANSWERS_PATH = "ai/questions/answers.yaml";

const QuestionsConfigSchema = z.object({
  enabled: z.boolean(),
  language_detection: z.object({
    mode: z.string().min(1),
    fallback: z.string().min(1)
  }),
  required_blocks: z.array(z.string().min(1))
});

const QuestionsAnswersSchema = z.object({
  language_confirmed: z.string().min(1),
  completed: z.boolean(),
  answers: z
    .array(
      z.object({
        id: z.string().min(1),
        value: z.string().optional(),
        confidence: z.string().optional()
      })
    )
    .default([]),
  last_updated: z.string().optional()
});

type QuestionsConfig = z.infer<typeof QuestionsConfigSchema>;
type QuestionsAnswers = z.infer<typeof QuestionsAnswersSchema>;

const parseYaml = (absolutePath: string): unknown => YAML.parse(fs.readFileSync(absolutePath, "utf8"));

const writeYamlAtomic = (absolutePath: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const tempPath = `${absolutePath}.tmp`;
  fs.writeFileSync(tempPath, YAML.stringify(value), "utf8");
  if (fs.existsSync(absolutePath)) {
    fs.rmSync(absolutePath, { force: true });
  }
  fs.renameSync(tempPath, absolutePath);
};

const normalizeBlockId = (value: string): string => value.toLowerCase().replace(/_/g, "-");

const resolveStatus = (
  config: QuestionsConfig,
  answers: QuestionsAnswers
): Pick<QuestionsStatusReport, "completed" | "requiredBlocks" | "answeredBlocks" | "missingBlocks"> => {
  const requiredBlocks = config.required_blocks.map((item) => normalizeBlockId(item));
  const answeredBlocks = answers.answers.map((item) => normalizeBlockId(item.id));
  const answeredSet = new Set(answeredBlocks);
  const missingBlocks = requiredBlocks.filter((block) => !answeredSet.has(block));
  return {
    completed: config.enabled ? missingBlocks.length === 0 : true,
    requiredBlocks,
    answeredBlocks,
    missingBlocks
  };
};

const readConfig = (projectRoot: string): QuestionsConfig => {
  const absolutePath = path.join(projectRoot, QUESTIONS_CONFIG_PATH);
  return QuestionsConfigSchema.parse(parseYaml(absolutePath));
};

const readAnswers = (projectRoot: string): QuestionsAnswers => {
  const absolutePath = path.join(projectRoot, QUESTIONS_ANSWERS_PATH);
  return QuestionsAnswersSchema.parse(parseYaml(absolutePath));
};

export class QuestionsService implements QuestionsPort {
  status(projectRoot: string): QuestionsStatusReport {
    try {
      const config = readConfig(projectRoot);
      const answers = readAnswers(projectRoot);
      const resolved = resolveStatus(config, answers);
      return {
        ok: true,
        enabled: config.enabled,
        language: answers.language_confirmed,
        completed: resolved.completed,
        requiredBlocks: resolved.requiredBlocks,
        answeredBlocks: resolved.answeredBlocks,
        missingBlocks: resolved.missingBlocks,
        warnings: [],
        errors: []
      };
    } catch (error) {
      return {
        ok: false,
        enabled: false,
        language: "unknown",
        completed: false,
        requiredBlocks: [],
        answeredBlocks: [],
        missingBlocks: [],
        warnings: [],
        errors: [
          {
            file: QUESTIONS_CONFIG_PATH,
            message: error instanceof Error ? error.message : "Questions status failed"
          }
        ]
      };
    }
  }

  run(projectRoot: string, options?: { language?: string }): QuestionsRunReport {
    try {
      const config = readConfig(projectRoot);
      const answers = readAnswers(projectRoot);

      if (options?.language) {
        answers.language_confirmed = options.language;
      } else if (!answers.language_confirmed) {
        answers.language_confirmed = config.language_detection.fallback;
      }

      const resolved = resolveStatus(config, answers);
      answers.completed = resolved.completed;
      answers.last_updated = new Date().toISOString().slice(0, 10);

      const absoluteAnswersPath = path.join(projectRoot, QUESTIONS_ANSWERS_PATH);
      writeYamlAtomic(absoluteAnswersPath, answers);

      const warnings = [];
      if (resolved.missingBlocks.length > 0) {
        warnings.push({
          file: QUESTIONS_ANSWERS_PATH,
          message: "Questionnaire is still incomplete; some required blocks are missing"
        });
      }

      return {
        ok: true,
        language: answers.language_confirmed,
        completed: answers.completed,
        missingBlocks: resolved.missingBlocks,
        updatedFiles: [QUESTIONS_ANSWERS_PATH],
        warnings,
        errors: []
      };
    } catch (error) {
      return {
        ok: false,
        language: options?.language ?? "unknown",
        completed: false,
        missingBlocks: [],
        updatedFiles: [],
        warnings: [],
        errors: [
          {
            file: QUESTIONS_ANSWERS_PATH,
            message: error instanceof Error ? error.message : "Questions run failed"
          }
        ]
      };
    }
  }
}

