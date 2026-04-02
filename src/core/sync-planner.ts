import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as toYaml } from "yaml";

import { DEFAULT_CONFIG_ROOT, DEFAULT_TEMPLATE_ROOT } from "./config-paths";

export type SyncAction = {
  type: "create_dir" | "create_file" | "update_file" | "conflict_file";
  path: string;
  relativePath: string;
  reason: string;
};

export type SyncPlan = {
  actions: SyncAction[];
  recommendations: Array<{
    path: string;
    strategy: "manual_merge";
    message: string;
    suggestedCommands: string[];
  }>;
  summary: {
    createDirs: number;
    createFiles: number;
    updateFiles: number;
    conflictFiles: number;
    unchanged: number;
  };
};

export type SyncApplyResult = {
  applied: {
    createDirs: number;
    createFiles: number;
    updateFiles: number;
  };
  appliedPaths: string[];
};

const resolveTemplateDir = (): string => path.resolve(__dirname, `../../${DEFAULT_TEMPLATE_ROOT}`);
const MERGEABLE_RELATIVE_PATHS = new Set<string>([".aiignore", "modules.yaml"]);

const normalizeRelativePath = (relativePath: string): string => relativePath.replace(/\\/g, "/");
const toDisplayPath = (relativePath: string): string =>
  `${DEFAULT_CONFIG_ROOT}/${normalizeRelativePath(relativePath)}`;
const ensureTrailingNewline = (value: string): string => (value.endsWith("\n") ? value : `${value}\n`);

const collectTemplateEntries = (
  absoluteDir: string,
  relativeDir = ""
): Array<{ kind: "dir" | "file"; relativePath: string }> => {
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const result: Array<{ kind: "dir" | "file"; relativePath: string }> = [];

  for (const entry of entries) {
    const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    const absolutePath = path.join(absoluteDir, entry.name);

    if (entry.isDirectory()) {
      result.push({ kind: "dir", relativePath });
      result.push(...collectTemplateEntries(absolutePath, relativePath));
      continue;
    }

    if (entry.isFile()) {
      result.push({ kind: "file", relativePath });
    }
  }

  return result;
};

const mergeAiIgnore = (templateRaw: string, targetRaw: string): string | null => {
  const targetLines = targetRaw.split(/\r?\n/);
  const templateLines = templateRaw.split(/\r?\n/);
  const existing = new Set<string>(targetLines);
  const linesToAppend: string[] = [];

  for (const line of templateLines) {
    if (line.trim().length === 0) {
      continue;
    }
    if (!existing.has(line)) {
      linesToAppend.push(line);
      existing.add(line);
    }
  }

  if (linesToAppend.length === 0) {
    return null;
  }

  const base = targetRaw.trim().length === 0 ? "" : ensureTrailingNewline(targetRaw);
  return `${base}${linesToAppend.join("\n")}\n`;
};

const parseYamlObject = (raw: string): Record<string, unknown> | null => {
  try {
    const parsed = parseYaml(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const mergeModulesYaml = (templateRaw: string, targetRaw: string): string | null => {
  const template = parseYamlObject(templateRaw);
  const target = parseYamlObject(targetRaw);
  if (!template || !target) {
    return null;
  }

  const templateModules = Array.isArray(template.modules) ? template.modules : [];
  const targetModules = Array.isArray(target.modules) ? target.modules : [];
  const targetByName = new Set<string>(
    targetModules
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => (typeof item.name === "string" ? item.name : ""))
      .filter((name) => name.trim().length > 0)
  );

  const missingModules: Record<string, unknown>[] = [];
  for (const moduleDef of templateModules) {
    if (!moduleDef || typeof moduleDef !== "object" || Array.isArray(moduleDef)) {
      continue;
    }
    const moduleName = (moduleDef as Record<string, unknown>).name;
    if (typeof moduleName !== "string" || moduleName.trim().length === 0) {
      continue;
    }
    if (!targetByName.has(moduleName)) {
      missingModules.push(moduleDef as Record<string, unknown>);
      targetByName.add(moduleName);
    }
  }

  const merged: Record<string, unknown> = { ...target };
  if (
    (typeof merged.schema_version !== "string" || merged.schema_version.trim().length === 0) &&
    typeof template.schema_version === "string" &&
    template.schema_version.trim().length > 0
  ) {
    merged.schema_version = template.schema_version;
  }

  if (missingModules.length > 0) {
    merged.modules = [...targetModules, ...missingModules];
  }

  const mergedYaml = toYaml(merged);
  return mergedYaml === targetRaw ? null : mergedYaml;
};

const buildSafeMergedContent = (
  relativePath: string,
  templateRaw: string,
  targetRaw: string
): { merged: string | null; mergeable: boolean; parseError: boolean } => {
  if (!MERGEABLE_RELATIVE_PATHS.has(relativePath)) {
    return { merged: null, mergeable: false, parseError: false };
  }

  if (relativePath === ".aiignore") {
    return { merged: mergeAiIgnore(templateRaw, targetRaw), mergeable: true, parseError: false };
  }

  if (relativePath === "modules.yaml") {
    const merged = mergeModulesYaml(templateRaw, targetRaw);
    if (merged === null) {
      const parsedTemplate = parseYamlObject(templateRaw);
      const parsedTarget = parseYamlObject(targetRaw);
      const parseError = parsedTemplate === null || parsedTarget === null;
      return { merged: null, mergeable: true, parseError };
    }
    return { merged, mergeable: true, parseError: false };
  }

  return { merged: null, mergeable: false, parseError: false };
};

export const buildSyncPlan = (projectRoot: string): SyncPlan => {
  const templateDir = resolveTemplateDir();
  const aiRoot = path.join(path.resolve(projectRoot), DEFAULT_CONFIG_ROOT);
  const entries = collectTemplateEntries(templateDir).sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath)
  );
  const actions: SyncAction[] = [];
  const recommendations: SyncPlan["recommendations"] = [];
  let unchanged = 0;

  for (const entry of entries) {
    const targetPath = path.join(aiRoot, entry.relativePath);
    const targetExists = fs.existsSync(targetPath);
    if (targetExists && entry.kind === "dir") {
      unchanged += 1;
      continue;
    }

    const relativePath = normalizeRelativePath(entry.relativePath);
    const displayPath = toDisplayPath(relativePath);
    if (targetExists && entry.kind === "file") {
      const templatePath = path.join(templateDir, relativePath);
      const targetRaw = fs.readFileSync(targetPath, "utf8");
      const templateRaw = fs.readFileSync(templatePath, "utf8");
      if (templateRaw === targetRaw) {
        unchanged += 1;
        continue;
      }

      const mergeResult = buildSafeMergedContent(relativePath, templateRaw, targetRaw);
      if (mergeResult.mergeable) {
        if (mergeResult.parseError) {
          actions.push({
            type: "conflict_file",
            path: displayPath,
            relativePath,
            reason: "Safe merge is configured but YAML parsing failed. Resolve manually."
          });
          recommendations.push({
            path: displayPath,
            strategy: "manual_merge",
            message:
              "Parse error detected while attempting safe merge. Fix YAML syntax first, then re-run sync.",
            suggestedCommands: [
              `ai-config sync --cwd ${projectRoot} --format json`,
              `ai-config validate --cwd ${projectRoot} --format json`
            ]
          });
          continue;
        }
        if (mergeResult.merged) {
          actions.push({
            type: "update_file",
            path: displayPath,
            relativePath,
            reason: "Safe merge available from template."
          });
          continue;
        }
        unchanged += 1;
        continue;
      }

      actions.push({
        type: "conflict_file",
        path: displayPath,
        relativePath,
        reason: "File differs from template and has no safe merge strategy."
      });
      recommendations.push({
        path: displayPath,
        strategy: "manual_merge",
        message:
          "Compare current file with template, manually merge required updates, then re-run sync.",
        suggestedCommands: [
          `ai-config sync --cwd ${projectRoot} --format json`,
          `ai-config validate --cwd ${projectRoot} --format json`
        ]
      });
      continue;
    }

    if (entry.kind === "dir") {
      actions.push({
        type: "create_dir",
        path: displayPath,
        relativePath,
        reason: "Missing directory from template."
      });
    } else {
      actions.push({
        type: "create_file",
        path: displayPath,
        relativePath,
        reason: "Missing file from template."
      });
    }
  }

  return {
    actions,
    recommendations,
    summary: {
      createDirs: actions.filter((action) => action.type === "create_dir").length,
      createFiles: actions.filter((action) => action.type === "create_file").length,
      updateFiles: actions.filter((action) => action.type === "update_file").length,
      conflictFiles: actions.filter((action) => action.type === "conflict_file").length,
      unchanged
    }
  };
};

export const templateExists = (): boolean => fs.existsSync(resolveTemplateDir());

export const applySyncPlan = (projectRoot: string, plan: SyncPlan): SyncApplyResult => {
  const templateDir = resolveTemplateDir();
  const aiRoot = path.join(path.resolve(projectRoot), DEFAULT_CONFIG_ROOT);
  const appliedPaths: string[] = [];
  let createDirs = 0;
  let createFiles = 0;
  let updateFiles = 0;

  for (const action of plan.actions.filter((item) => item.type === "create_dir")) {
    const targetPath = path.join(aiRoot, action.relativePath);
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
      createDirs += 1;
      appliedPaths.push(action.path);
    }
  }

  for (const action of plan.actions.filter((item) => item.type === "create_file")) {
    const sourcePath = path.join(templateDir, action.relativePath);
    const targetPath = path.join(aiRoot, action.relativePath);
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
      createFiles += 1;
      appliedPaths.push(action.path);
    }
  }

  for (const action of plan.actions.filter((item) => item.type === "update_file")) {
    const sourcePath = path.join(templateDir, action.relativePath);
    const targetPath = path.join(aiRoot, action.relativePath);
    if (!fs.existsSync(targetPath)) {
      continue;
    }
    const targetRaw = fs.readFileSync(targetPath, "utf8");
    const templateRaw = fs.readFileSync(sourcePath, "utf8");
    const mergeResult = buildSafeMergedContent(action.relativePath, templateRaw, targetRaw);
    if (!mergeResult.merged) {
      continue;
    }
    fs.writeFileSync(targetPath, mergeResult.merged, "utf8");
    updateFiles += 1;
    appliedPaths.push(action.path);
  }

  return {
    applied: {
      createDirs,
      createFiles,
      updateFiles
    },
    appliedPaths
  };
};
