import fs from "node:fs";
import path from "node:path";

import { parse as parseYaml } from "yaml";

import { AGENTS, BRIDGE_CONTENT_BY_FILE } from "./agents";
import { DEFAULT_CONFIG_ROOT } from "./config-paths";

export const PREFLIGHT_STATES = ["fresh", "managed", "foreign", "mixed"] as const;

export type PreflightState = (typeof PREFLIGHT_STATES)[number];

export type PreflightReport = {
  state: PreflightState;
  hasAiRoot: boolean;
  hasManifest: boolean;
  hasManagedManifest: boolean;
};

const parseManifest = (manifestPath: string): Record<string, unknown> | null => {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    const parsed = parseYaml(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const hasManagedBridgeMarker = (projectRoot: string): boolean => {
  const bridgeFiles = [AGENTS.codex.fileName, AGENTS.claude.fileName] as const;

  for (const bridgeFile of bridgeFiles) {
    const absolutePath = path.join(projectRoot, bridgeFile);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    try {
      const content = fs.readFileSync(absolutePath, "utf8");
      if (content === BRIDGE_CONTENT_BY_FILE[bridgeFile]) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
};

export const detectPreflightState = (projectRoot: string): PreflightReport => {
  const absoluteRoot = path.resolve(projectRoot);
  const aiRoot = path.join(absoluteRoot, DEFAULT_CONFIG_ROOT);
  const hasAiRoot = fs.existsSync(aiRoot);
  if (!hasAiRoot) {
    return {
      state: "fresh",
      hasAiRoot: false,
      hasManifest: false,
      hasManagedManifest: false
    };
  }

  const manifestPath = path.join(aiRoot, "manifest.yaml");
  const manifest = parseManifest(manifestPath);
  const hasManifest = manifest !== null;
  const hasManagedManifest =
    manifest?.generator === "ai-config" && manifest?.managed_by === "ai-config";

  if (hasManagedManifest) {
    const legacyAiRoot = path.join(absoluteRoot, "ai");
    if (fs.existsSync(legacyAiRoot)) {
      return {
        state: "mixed",
        hasAiRoot,
        hasManifest,
        hasManagedManifest
      };
    }
    return {
      state: "managed",
      hasAiRoot,
      hasManifest,
      hasManagedManifest
    };
  }

  if (hasManagedBridgeMarker(absoluteRoot)) {
    return {
      state: "mixed",
      hasAiRoot,
      hasManifest,
      hasManagedManifest
    };
  }

  return {
    state: "foreign",
    hasAiRoot,
    hasManifest,
    hasManagedManifest
  };
};
