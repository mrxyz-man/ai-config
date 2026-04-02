import path from "node:path";

export const DEFAULT_CONFIG_ROOT = ".ai";
export const DEFAULT_TEMPLATE_ROOT = "ai-template";

export const resolveConfigRootName = (): string => DEFAULT_CONFIG_ROOT;

export const resolveConfigPath = (projectRoot: string, ...segments: string[]): string =>
  path.join(projectRoot, DEFAULT_CONFIG_ROOT, ...segments);
