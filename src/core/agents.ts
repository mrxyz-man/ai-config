export const AGENT_KEYS = ["codex", "claude", "both", "other"] as const;

export type AgentKey = (typeof AGENT_KEYS)[number];

export const DEFAULT_AGENT: AgentKey = "codex";

export const VALID_AGENTS: readonly AgentKey[] = AGENT_KEYS;

export const normalizeAgentKey = (value: string | undefined): AgentKey | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return VALID_AGENTS.includes(normalized as AgentKey) ? (normalized as AgentKey) : null;
};

export type BridgeFileName = "AGENTS.md" | "CLAUDE.md";

export const AGENTS = {
  codex: { name: "codex", fileName: "AGENTS.md" as BridgeFileName },
  claude: { name: "claude", fileName: "CLAUDE.md" as BridgeFileName }
} as const;

export const AGENT_MENU_OPTIONS: ReadonlyArray<{
  key: AgentKey;
  label: string;
  description: string;
}> = [
  { key: "codex", label: "Codex", description: "Bridge file: AGENTS.md" },
  { key: "claude", label: "Claude", description: "Bridge file: CLAUDE.md" },
  { key: "both", label: "Both", description: "Bridge files: AGENTS.md + CLAUDE.md" },
  { key: "other", label: "Other", description: "Default bridge file: AGENTS.md" }
] as const;

export const AGENT_TO_BRIDGE_FILES: Record<AgentKey, BridgeFileName[]> = {
  codex: [AGENTS.codex.fileName],
  claude: [AGENTS.claude.fileName],
  both: [AGENTS.codex.fileName, AGENTS.claude.fileName],
  other: [AGENTS.codex.fileName]
};

const AGENTS_BRIDGE_CONTENT = `# AGENTS Bridge

Before starting work:
1. Read .ai/manifest.yaml first.
2. Follow .ai/config.yaml and .ai/rules/* as source of truth.
3. Use .ai as the primary configuration layer for project interaction.
`;

const CLAUDE_BRIDGE_CONTENT = `# CLAUDE Bridge

Before starting work:
1. Read .ai/manifest.yaml first.
2. Follow .ai/config.yaml and .ai/rules/* as source of truth.
3. Use .ai as the primary configuration layer for project interaction.
`;

export const BRIDGE_CONTENT_BY_FILE: Record<BridgeFileName, string> = {
  "AGENTS.md": AGENTS_BRIDGE_CONTENT,
  "CLAUDE.md": CLAUDE_BRIDGE_CONTENT
};
