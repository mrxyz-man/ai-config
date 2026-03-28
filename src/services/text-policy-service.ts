import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";
import { z } from "zod";

import { TextCheckReport, TextPolicyPort } from "../core/ports";

const TEXT_ENCODING_PATH = "ai/text/encoding.yaml";
const TEXT_LOCALE_PATH = "ai/text/locale.yaml";
const AI_ROOT = "ai";

const TextEncodingSchema = z.object({
  default_encoding: z.string().min(1),
  enforce_utf8: z.boolean(),
  reject_unknown_encoding: z.boolean(),
  mojibake_signals: z.array(z.string())
});

const TextLocaleSchema = z.object({
  primary_language: z.string().min(1),
  secondary_language: z.string().min(1),
  response_language_policy: z.string().min(1),
  require_readable_cyrillic: z.boolean()
});

const collectFiles = (absoluteDir: string): string[] => {
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }
    if (/\.(ya?ml|md|txt)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
};

const toRelative = (projectRoot: string, absolutePath: string): string =>
  path.relative(projectRoot, absolutePath).replace(/\\/g, "/");

const findSignalExcerpt = (content: string, signal: string): string => {
  const index = content.indexOf(signal);
  if (index === -1) {
    return "";
  }
  const start = Math.max(0, index - 20);
  const end = Math.min(content.length, index + signal.length + 20);
  return content.slice(start, end).replace(/\s+/g, " ");
};

export class TextPolicyService implements TextPolicyPort {
  check(projectRoot: string): TextCheckReport {
    const absoluteRoot = path.resolve(projectRoot);
    const warnings: TextCheckReport["warnings"] = [];
    const errors: TextCheckReport["errors"] = [];
    const violations: TextCheckReport["violations"] = [];

    try {
      const encodingAbsolutePath = path.join(absoluteRoot, TEXT_ENCODING_PATH);
      const localeAbsolutePath = path.join(absoluteRoot, TEXT_LOCALE_PATH);
      const encoding = TextEncodingSchema.parse(
        YAML.parse(fs.readFileSync(encodingAbsolutePath, "utf8"))
      );
      const locale = TextLocaleSchema.parse(
        YAML.parse(fs.readFileSync(localeAbsolutePath, "utf8"))
      );

      if (encoding.enforce_utf8 && encoding.default_encoding.toLowerCase() !== "utf-8") {
        errors.push({
          file: TEXT_ENCODING_PATH,
          path: "default_encoding",
          message: 'default_encoding must be "utf-8" when enforce_utf8 is true'
        });
      }

      const files = collectFiles(path.join(absoluteRoot, AI_ROOT));
      for (const file of files) {
        const content = fs.readFileSync(file, "utf8");
        const relativeFile = toRelative(absoluteRoot, file);
        const allowSignalDefinitions = relativeFile === TEXT_ENCODING_PATH;
        for (const signal of encoding.mojibake_signals) {
          if (allowSignalDefinitions || !signal || !content.includes(signal)) {
            continue;
          }
          violations.push({
            file: relativeFile,
            signal,
            excerpt: findSignalExcerpt(content, signal)
          });
          errors.push({
            file: relativeFile,
            message: `Detected mojibake signal "${signal}"`
          });
        }

        if (locale.require_readable_cyrillic && content.includes("�")) {
          errors.push({
            file: relativeFile,
            message: "Detected replacement character that may indicate corrupted Cyrillic"
          });
        }
      }

      return {
        ok: errors.length === 0,
        checkedFiles: files.length,
        violations,
        warnings,
        errors
      };
    } catch (error) {
      return {
        ok: false,
        checkedFiles: 0,
        violations,
        warnings,
        errors: [
          {
            file: AI_ROOT,
            message: error instanceof Error ? error.message : "Text check failed"
          }
        ]
      };
    }
  }
}
