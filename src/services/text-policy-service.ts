import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import YAML from "yaml";
import { z } from "zod";

import { TextCheckReport, TextPolicyPort } from "../core/ports";

const TEXT_ENCODING_PATH = "ai/text/encoding.yaml";
const TEXT_LOCALE_PATH = "ai/text/locale.yaml";
const IGNORE_RULES_PATH = "ai/rules/ignore.yaml";
const MAX_TEXT_FILE_BYTES = 512 * 1024;
const MAX_SCAN_FILES = 4000;
const MAX_SCAN_TOTAL_BYTES = 32 * 1024 * 1024;
const TEXT_FILE_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".yaml",
  ".yml",
  ".json",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".html",
  ".htm",
  ".xml",
  ".env",
  ".sh",
  ".ps1"
]);

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

const IgnoreRulesSchema = z.object({
  version: z.string().min(1),
  ignore: z.array(z.string().min(1)),
  allowlist_overrides: z.array(z.string().min(1))
});

const toRelative = (projectRoot: string, absolutePath: string): string =>
  path.relative(projectRoot, absolutePath).replace(/\\/g, "/");

const normalizeRelativePath = (value: string): string =>
  value.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "");

const escapeRegExpChar = (value: string): string => value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");

const globToRegex = (pattern: string): RegExp => {
  const normalized = normalizeRelativePath(pattern);
  let regexBody = "";
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    const next = normalized[index + 1];

    if (current === "*" && next === "*") {
      regexBody += ".*";
      index += 1;
      continue;
    }

    if (current === "*") {
      regexBody += "[^/]*";
      continue;
    }

    regexBody += escapeRegExpChar(current);
  }

  return new RegExp(`^${regexBody}$`);
};

type PathMatcher = {
  ignore: RegExp[];
  allowlist: RegExp[];
};

const createPathMatcher = (ignorePatterns: string[], allowlistPatterns: string[]): PathMatcher => ({
  ignore: ignorePatterns.map(globToRegex),
  allowlist: allowlistPatterns.map(globToRegex)
});

const matchesAny = (value: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(value));

const isIgnoredPath = (relativePath: string, matcher: PathMatcher): boolean => {
  const normalized = normalizeRelativePath(relativePath);
  const candidates = [normalized, `${normalized}/`];
  const ignored = candidates.some((candidate) => matchesAny(candidate, matcher.ignore));
  if (!ignored) {
    return false;
  }
  return !candidates.some((candidate) => matchesAny(candidate, matcher.allowlist));
};

const canPruneDirectory = (relativeDir: string, matcher: PathMatcher): boolean => {
  if (!isIgnoredPath(relativeDir, matcher)) {
    return false;
  }

  const probe = normalizeRelativePath(path.posix.join(relativeDir, "__allowlist_probe__"));
  return !matchesAny(probe, matcher.allowlist);
};

const isTextLikeFile = (relativePath: string): boolean => {
  const ext = path.extname(relativePath).toLowerCase();
  if (TEXT_FILE_EXTENSIONS.has(ext)) {
    return true;
  }

  const baseName = path.basename(relativePath).toLowerCase();
  return baseName === ".env" || baseName.endsWith(".env");
};

const collectRepositoryFiles = (
  projectRoot: string,
  matcher: PathMatcher,
  warnings: TextCheckReport["warnings"]
): string[] => {
  const files: string[] = [];
  let totalBytes = 0;
  let reachedFileLimit = false;
  let reachedTotalBytesLimit = false;
  const visit = (absoluteDir: string): void => {
    if (reachedFileLimit || reachedTotalBytesLimit) {
      return;
    }
    const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      if (reachedFileLimit || reachedTotalBytesLimit) {
        return;
      }
      const absolutePath = path.join(absoluteDir, entry.name);
      const relativePath = normalizeRelativePath(toRelative(projectRoot, absolutePath));
      if (!relativePath) {
        continue;
      }

      if (entry.isDirectory()) {
        if (canPruneDirectory(relativePath, matcher)) {
          continue;
        }
        visit(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (isIgnoredPath(relativePath, matcher) || !isTextLikeFile(relativePath)) {
        continue;
      }

      let stat: fs.Stats;
      try {
        stat = fs.statSync(absolutePath);
      } catch {
        continue;
      }

      if (stat.size > MAX_TEXT_FILE_BYTES) {
        warnings.push({
          file: relativePath,
          message: `Skipped file larger than ${MAX_TEXT_FILE_BYTES} bytes`
        });
        continue;
      }

      if (files.length >= MAX_SCAN_FILES) {
        reachedFileLimit = true;
        warnings.push({
          file: "ai/text/encoding.yaml",
          message: `Reached scan file limit (${MAX_SCAN_FILES}); stop scanning remaining files. Consider --changed-only.`
        });
        return;
      }

      if (totalBytes + stat.size > MAX_SCAN_TOTAL_BYTES) {
        reachedTotalBytesLimit = true;
        warnings.push({
          file: "ai/text/encoding.yaml",
          message: `Reached scan size limit (${MAX_SCAN_TOTAL_BYTES} bytes); stop scanning remaining files. Consider --changed-only.`
        });
        return;
      }

      totalBytes += stat.size;
      files.push(absolutePath);
    }
  };

  visit(projectRoot);
  return files;
};

const readGitLines = (projectRoot: string, args: string[]): string[] => {
  const output = execFileSync("git", ["-C", projectRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
  if (!output) {
    return [];
  }
  return output
    .split("\n")
    .map((line) => normalizeRelativePath(line))
    .filter((line) => line.length > 0);
};

const collectChangedFiles = (
  projectRoot: string,
  matcher: PathMatcher,
  warnings: TextCheckReport["warnings"]
): string[] | null => {
  try {
    const unstaged = readGitLines(projectRoot, ["diff", "--name-only", "--diff-filter=ACMRTUXB", "--"]);
    const staged = readGitLines(projectRoot, [
      "diff",
      "--cached",
      "--name-only",
      "--diff-filter=ACMRTUXB",
      "--"
    ]);
    const untracked = readGitLines(projectRoot, ["ls-files", "--others", "--exclude-standard"]);

    const uniquePaths = [...new Set([...unstaged, ...staged, ...untracked])];
    const files: string[] = [];
    let totalBytes = 0;
    for (const relativePath of uniquePaths) {
      if (isIgnoredPath(relativePath, matcher) || !isTextLikeFile(relativePath)) {
        continue;
      }
      const absolutePath = path.join(projectRoot, relativePath);
      if (!fs.existsSync(absolutePath)) {
        continue;
      }
      const stat = fs.statSync(absolutePath);
      if (!stat.isFile()) {
        continue;
      }
      if (stat.size > MAX_TEXT_FILE_BYTES) {
        warnings.push({
          file: relativePath,
          message: `Skipped file larger than ${MAX_TEXT_FILE_BYTES} bytes`
        });
        continue;
      }
      if (files.length >= MAX_SCAN_FILES) {
        warnings.push({
          file: "ai/text/encoding.yaml",
          message: `Reached changed-only file limit (${MAX_SCAN_FILES}); stop scanning remaining files.`
        });
        break;
      }
      if (totalBytes + stat.size > MAX_SCAN_TOTAL_BYTES) {
        warnings.push({
          file: "ai/text/encoding.yaml",
          message: `Reached changed-only scan size limit (${MAX_SCAN_TOTAL_BYTES} bytes); stop scanning remaining files.`
        });
        break;
      }
      totalBytes += stat.size;
      files.push(absolutePath);
    }
    return files;
  } catch {
    return null;
  }
};

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
  check(projectRoot: string, options?: { changedOnly?: boolean }): TextCheckReport {
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
      const ignoreRules = IgnoreRulesSchema.parse(
        YAML.parse(fs.readFileSync(path.join(absoluteRoot, IGNORE_RULES_PATH), "utf8"))
      );
      const matcher = createPathMatcher(ignoreRules.ignore, ignoreRules.allowlist_overrides);

      if (encoding.enforce_utf8 && encoding.default_encoding.toLowerCase() !== "utf-8") {
        errors.push({
          file: TEXT_ENCODING_PATH,
          path: "default_encoding",
          message: 'default_encoding must be "utf-8" when enforce_utf8 is true'
        });
      }

      let scanMode: TextCheckReport["scanMode"] = "repository";
      let files: string[];
      if (options?.changedOnly) {
        const changedFiles = collectChangedFiles(absoluteRoot, matcher, warnings);
        if (changedFiles) {
          files = changedFiles;
          scanMode = "changed-only";
        } else {
          warnings.push({
            file: ".git",
            message: "Changed-only mode requires a git repository; fallback to full repository scan"
          });
          files = collectRepositoryFiles(absoluteRoot, matcher, warnings);
        }
      } else {
        files = collectRepositoryFiles(absoluteRoot, matcher, warnings);
      }

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
        scanMode,
        checkedFiles: files.length,
        violations,
        warnings,
        errors
      };
    } catch (error) {
      return {
        ok: false,
        scanMode: options?.changedOnly ? "changed-only" : "repository",
        checkedFiles: 0,
        violations,
        warnings,
        errors: [
          {
            file: "ai",
            message: error instanceof Error ? error.message : "Text check failed"
          }
        ]
      };
    }
  }
}
