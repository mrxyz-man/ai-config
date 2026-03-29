import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";
import { z } from "zod";

import { QuestionsPort, QuestionsRunReport, QuestionsStatusReport } from "../core/ports";

const QUESTIONS_CONFIG_PATH = "ai/questions/config.yaml";
const QUESTIONS_ANSWERS_PATH = "ai/questions/answers.yaml";
const QUESTIONS_PROFILES_DIR = "ai/questions/profiles";

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

const QuestionsProfileSchema = z.object({
  profile: z.string().min(1),
  questions: z
    .array(
      z.object({
        id: z.string().min(1),
        text_ru: z.string().optional(),
        text_en: z.string().optional(),
        required: z.boolean().default(false)
      })
    )
    .default([])
});

type QuestionsConfig = z.infer<typeof QuestionsConfigSchema>;
type QuestionsAnswers = z.infer<typeof QuestionsAnswersSchema>;
type QuestionsProfile = z.infer<typeof QuestionsProfileSchema>;

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

const normalizeBlockId = (value: string): string => {
  const normalized = value.toLowerCase().replace(/_/g, "-").replace(/[^a-z0-9-]/g, "");
  return normalized.endsWith("s") ? normalized.slice(0, -1) : normalized;
};

const areSameBlock = (a: string, b: string): boolean => normalizeBlockId(a) === normalizeBlockId(b);

const resolveStatus = (
  config: QuestionsConfig,
  answers: QuestionsAnswers
): Pick<QuestionsStatusReport, "completed" | "requiredBlocks" | "answeredBlocks" | "missingBlocks"> => {
  const requiredBlocks = config.required_blocks.map((item) => item.toLowerCase().replace(/_/g, "-"));
  const answeredBlocks = answers.answers.map((item) => item.id.toLowerCase().replace(/_/g, "-"));
  const missingBlocks = requiredBlocks.filter(
    (required) => !answeredBlocks.some((answered) => areSameBlock(required, answered))
  );
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

const readProfile = (projectRoot: string, profile: string): QuestionsProfile => {
  const profilePath = path.join(projectRoot, QUESTIONS_PROFILES_DIR, `${profile}.yaml`);
  if (!fs.existsSync(profilePath)) {
    return { profile, questions: [] };
  }
  return QuestionsProfileSchema.parse(parseYaml(profilePath));
};

const upsertAnswer = (
  answers: QuestionsAnswers,
  candidate: { id: string; value: string; confidence?: string }
): void => {
  const existingIndex = answers.answers.findIndex((item) => areSameBlock(item.id, candidate.id));
  const nextValue = candidate.value.trim();
  if (!nextValue) {
    return;
  }

  if (existingIndex >= 0) {
    answers.answers[existingIndex] = {
      ...answers.answers[existingIndex],
      id: candidate.id,
      value: nextValue,
      confidence: candidate.confidence ?? answers.answers[existingIndex].confidence ?? "high"
    };
    return;
  }

  answers.answers.push({
    id: candidate.id,
    value: nextValue,
    confidence: candidate.confidence ?? "high"
  });
};

const buildPendingQuestions = (
  config: QuestionsConfig,
  profile: QuestionsProfile,
  missingBlocks: string[],
  language: string
): QuestionsRunReport["pendingQuestions"] => {
  const requiredProfileQuestions = profile.questions.filter((question) => question.required);
  const pending = missingBlocks.map((block, index) => {
    const profileQuestion = requiredProfileQuestions[index];
    const prompt =
      language.startsWith("ru")
        ? profileQuestion?.text_ru ?? profileQuestion?.text_en ?? `Provide answer for block "${block}"`
        : profileQuestion?.text_en ?? profileQuestion?.text_ru ?? `Provide answer for block "${block}"`;
    return {
      id: profileQuestion?.id ?? `required-${index + 1}`,
      blockId: block,
      prompt,
      required: true
    };
  });

  for (const optional of profile.questions.filter((question) => !question.required)) {
    const prompt = language.startsWith("ru")
      ? optional.text_ru ?? optional.text_en
      : optional.text_en ?? optional.text_ru;
    if (!prompt) {
      continue;
    }
    pending.push({
      id: optional.id,
      blockId: optional.id,
      prompt,
      required: false
    });
  }

  return pending;
};

const mapProvidedAnswerId = (
  incomingId: string,
  pendingQuestions: QuestionsRunReport["pendingQuestions"]
): string => {
  const byQuestion = pendingQuestions.find((item) => item.id === incomingId);
  if (byQuestion) {
    return byQuestion.blockId;
  }
  return incomingId;
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

  run(
    projectRoot: string,
    options?: {
      language?: string;
      profile?: string;
      nonInteractive?: boolean;
      providedAnswers?: Array<{ id: string; value: string; confidence?: string }>;
    }
  ): QuestionsRunReport {
    try {
      const config = readConfig(projectRoot);
      const answers = readAnswers(projectRoot);
      const profileName = options?.profile ?? "default";
      const profile = readProfile(projectRoot, profileName);

      if (options?.language) {
        answers.language_confirmed = options.language;
      } else if (!answers.language_confirmed) {
        answers.language_confirmed = config.language_detection.fallback;
      }

      const initial = resolveStatus(config, answers);
      const pendingQuestions = buildPendingQuestions(
        config,
        profile,
        initial.missingBlocks,
        answers.language_confirmed
      );

      let appliedAnswers = 0;
      for (const provided of options?.providedAnswers ?? []) {
        const mappedId = mapProvidedAnswerId(provided.id, pendingQuestions);
        const before = answers.answers.length;
        upsertAnswer(answers, {
          id: mappedId,
          value: provided.value,
          confidence: provided.confidence
        });
        if (answers.answers.length > before || answers.answers.some((item) => areSameBlock(item.id, mappedId))) {
          appliedAnswers += 1;
        }
      }

      const resolved = resolveStatus(config, answers);
      answers.completed = resolved.completed;
      answers.last_updated = new Date().toISOString().slice(0, 10);

      const absoluteAnswersPath = path.join(projectRoot, QUESTIONS_ANSWERS_PATH);
      writeYamlAtomic(absoluteAnswersPath, answers);

      const warnings = [];
      const errors = [];
      if (resolved.missingBlocks.length > 0) {
        warnings.push({
          file: QUESTIONS_ANSWERS_PATH,
          message: "Questionnaire is still incomplete; some required blocks are missing"
        });
      }
      if (options?.nonInteractive && resolved.missingBlocks.length > 0) {
        errors.push({
          file: QUESTIONS_ANSWERS_PATH,
          message:
            "Non-interactive run has unresolved required questionnaire blocks. Provide answers via --answer."
        });
      }

      return {
        ok: errors.length === 0,
        language: answers.language_confirmed,
        completed: answers.completed,
        missingBlocks: resolved.missingBlocks,
        pendingQuestions: buildPendingQuestions(
          config,
          profile,
          resolved.missingBlocks,
          answers.language_confirmed
        ),
        appliedAnswers,
        updatedFiles: [QUESTIONS_ANSWERS_PATH],
        warnings,
        errors
      };
    } catch (error) {
      return {
        ok: false,
        language: options?.language ?? "unknown",
        completed: false,
        missingBlocks: [],
        pendingQuestions: [],
        appliedAnswers: 0,
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

