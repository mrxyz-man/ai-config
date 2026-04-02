# INIT CONFIG MATRIX

This document defines how interactive/non-interactive `init` should collect configuration and map answers into `.ai/*`.

## Goals
- Keep `init` deterministic and explainable.
- Avoid hidden defaults.
- Support both interactive UX and CI mode.
- Enforce module/option dependencies at bootstrap time.

## Profiles

### `minimal`
- Enabled modules: `core`, `qa`
- Intended for: fast bootstrap with minimal process overhead.

### `standard` (recommended default)
- Enabled modules: `core`, `qa`, `project`, `rules`, `agents`, `skills`, `templates`
- Disabled modules: `mcp`, `orchestration`, `memory`, `logs`
- Intended for: strong day-to-day AI coding workflows.

### `full`
- Enabled modules: all
- Intended for: team/process-heavy environments with orchestration, MCP, memory and observability.

## Init Question Flow

1. Agent selection (`codex|claude|both|other`)
2. UI locale selection (`en|ru|custom`)
3. Profile selection (`minimal|standard|full`)
4. Optional module customization (multi-select)
5. Task behavior configuration
6. QA behavior configuration
7. MCP configuration (only if module enabled)
8. Orchestration configuration (only if module enabled)
9. Memory/logs toggles (only if modules enabled)
10. Confirmation screen (summary + apply)

## Field Mapping Matrix

### Q1: Agent
- Target: bridge files in project root.
- Mapping:
  - `codex` -> create/update `AGENTS.md`
  - `claude` -> create/update `CLAUDE.md`
  - `both` -> create/update both
  - `other` -> create/update `AGENTS.md`
- Also written to: `.ai/manifest.yaml -> selected_agent`

### Q2: UI locale
- Target: `.ai/manifest.yaml -> ui_locale`
- Also used as default language for QA prompts and user-facing text generation.

### Q3: Profile
- Target: `.ai/config.yaml -> profile.name`
- Values: `minimal|standard|full`
- Also sets module enablement baseline in `.ai/modules.yaml`.

### Q4: Module customization
- Target: `.ai/modules.yaml -> modules[*].enabled`
- Rule: start from selected profile baseline, then apply user overrides.

### Q5: Task behavior
- Target: `.ai/config.yaml -> behavior`
- Fields:
  - `task_mode`: `off|assisted|enforced`
  - `ask_before_task_creation`: `true|false`

### Q6: QA behavior
- Target: `.ai/config.yaml -> behavior.questionnaire_on_init`
- Values: `true|false`
- Additional side-effect:
  - if `true`, set `.ai/qa.yaml -> status: in_progress` (when still empty)
  - if `false`, keep `not_started`

### Q7: MCP (conditional)
- Preconditions: module `mcp` enabled.
- Targets:
  - `.ai/mcp/registry.yaml -> providers[*].enabled`
  - `.ai/mcp/registry.yaml -> defaults.enabled_by_default` (derived)
- Recommended default:
  - keep providers disabled unless explicitly selected.

### Q8: Orchestration (conditional)
- Preconditions: module `orchestration` enabled.
- Targets:
  - `.ai/orchestration/orchestration.yaml -> enabled`
  - `.ai/orchestration/orchestration.yaml -> mode` (`manual|assisted|enforced`)
  - optional: `task_storage.mode` (`local_files|external_mcp`)

### Q9: Memory/logs (conditional)
- Preconditions: corresponding modules enabled.
- Targets:
  - `.ai/memory/profile.yaml -> enabled` (if present)
  - `.ai/logs/policy.yaml -> enabled`
- Recommended defaults:
  - `memory`: enabled when module on, `mode: hybrid`
  - `logs`: enabled when module on, `log_level: info`

## Manifest Contract

`init` must always set:
- `schema_version`
- `generator: ai-config`
- `managed_by: ai-config`
- `created_at`
- `selected_agent`
- `ui_locale`
- `template_version`
- `qa_version`
- `qa_completed`
- `qa_completed_at`

## Dependency Rules (must enforce at init)

1. `skills` requires `rules` and `templates` enabled.
2. `orchestration` requires `agents` enabled.
3. `mcp` can be enabled independently, but write capabilities stay confirmation-gated.
4. `memory` without `logs` is allowed, but warn in summary.
5. `logs` without `orchestration` is allowed.

If dependency violation appears after user customization:
- interactive mode: show correction prompt and auto-fix proposal.
- non-interactive mode: fail with usage error and actionable message.

## Recommended Defaults by Profile

### `minimal`
- `task_mode: off`
- `questionnaire_on_init: false`
- `strict_enabled_only: true`

### `standard`
- `task_mode: assisted`
- `questionnaire_on_init: true`
- `strict_enabled_only: true`

### `full`
- `task_mode: assisted`
- `questionnaire_on_init: true`
- enable `orchestration`, `memory`, `logs`
- keep destructive actions disabled globally

## Non-Interactive Contract

Add/keep CLI options:
- `--agent`
- `--ui-locale`
- `--profile <minimal|standard|full>`
- `--modules <comma-separated-list>` (optional override)
- `--task-mode <off|assisted|enforced>` (optional)
- `--questionnaire-on-init <true|false>` (optional)
- `--enable-mcp-providers <comma-separated-ids>` (optional)

Resolution order:
1. hardcoded safe defaults
2. profile baseline
3. explicit CLI overrides
4. dependency auto-fixes (interactive) or hard-fail (non-interactive)

## Validation After Init

`init` completion should run internal post-check equivalent to:
- manifest markers present
- selected modules exist and are enabled consistently
- dependency rules satisfied
- required root files present

If post-check fails:
- return `ok: false`
- include exact file/field level diagnostics
- no partial ambiguous state (or provide clear warning when force mode replaced state)

## Implementation Note

Use dictionary-driven mappings (not long if/else chains):
- `PROFILE_TO_MODULES`
- `QUESTION_TO_MUTATIONS`
- `MODULE_DEPENDENCIES`
- `PROVIDER_PRESETS`

This keeps `init` extensible when new modules/options are added.
