# AI Agent Bootstrap Decisions

Status: accepted baseline for next design stage.

## 1) Production outcome for end users

The system must provide a template-based AI-agent configuration structure in project root (`.ai`), similar in spirit to framework conventions (predictable, discoverable, reusable baseline).

`init` is responsible for generating this structure from project template sources.

## 2) Responsibility split (CLI vs user AI-agent)

The CLI generates the structure and baseline artifacts.

Then the user AI-agent must:
- read this generated structure,
- fill missing/unknown fields,
- use it as the primary control/context layer for behavior and code interaction.

So: CLI bootstraps, agent operationalizes.

## 3) How to make agent use it by default

Direct enforcement across all agent products is not guaranteed, so we adopt an activation strategy:

1. Root-level bridge instructions that explicitly tell the agent to load and follow `.ai` first.
2. Agent-specific bridge adapters (where supported) that point to `.ai` as source of truth.
3. Bootstrap state/policy rule: before normal task execution, agent should complete/read bootstrap flow and only then proceed with coding tasks.

This 3-part strategy is the required baseline for future implementation.

## 4) V1 init behavior (agent selection + bridge generation)

In v1, `init` must ask the user which AI-agent is used in the project.

Based on selected agent, CLI generates the required bridge file in repository root:

- `codex` -> `AGENTS.md`
- `claude` -> `CLAUDE.md`
- `both` -> `AGENTS.md` + `CLAUDE.md`
- `custom/other` -> `AGENTS.md` (generic bridge template)

Bridge file content must explicitly instruct agent to:
- load `.ai/manifest.yaml` first,
- follow `.ai/config.yaml` and `.ai/rules/*`,
- treat `.ai` as source of truth for project interaction.
