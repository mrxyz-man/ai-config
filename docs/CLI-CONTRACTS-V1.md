# ai-config CLI Contracts v1

## 1. Scope

This document defines implementation contracts for v1 commands:
- Core: `init`, `sync`, `resolve`, `validate`, `explain`
- Tasks: `tasks enable|disable|intake|plan|status|list|sync`
- Text: `text check`
- Questions: `questions status|run|ask`
- MCP prep: `mcp status|connect|disconnect`

Design goals:
- deterministic behavior
- predictable file mutations
- machine-readable outputs for tool-calling
- safe failure and clear exit codes

---

## 2. Global CLI Conventions

### 2.1 Command format

`ai-config <command> [subcommand] [options]`

### 2.2 Common flags

- `--cwd <path>`: target project directory (default: current directory)
- `--format <human|json>`: output format (default: `human`)

Notes:
- `--non-interactive` is supported only on `questions run` and `questions ask`.
- `--changed-only` is supported only on `text check`.

### 2.3 Standard output contract

All commands return:
- human mode: readable summary + result details
- json mode: stable envelope

JSON envelope:
```json
{
  "ok": true,
  "command": "resolve",
  "timestamp": "2026-03-28T12:00:00Z",
  "data": {},
  "warnings": [],
  "errors": []
}
```

### 2.4 Exit codes

- `0`: success
- `1`: generic runtime failure
- `2`: invalid arguments/flags
- `3`: configuration validation failed
- `4`: unresolved conflicts/cycles/merge errors
- `5`: required user input missing in non-interactive mode
- `6`: sync/update compatibility violation
- `7`: file system access/write error

---

## 3. `ai-config init`

### 3.1 Purpose

Bootstrap `./ai` in a project:
- create baseline folder/files
- collect project context
- run questionnaire
- generate first resolved snapshot

### 3.2 Inputs

Usage:
`ai-config init [options]`

Options:
- `--profile <name>`: onboarding profile (`default`, `backend`, `frontend`, `design`)
- `--lang <code>`: force questionnaire language (`ru`, `en`, etc.)
- `--force`: allow init over existing partial `./ai`
- `--skip-questions`: bootstrap without interview (marks answers incomplete)

### 3.3 Side effects

Creates/updates:
- `./ai/*` baseline files
- `./ai/project.yaml`
- `./ai/questions/answers.yaml`
- `./ai/resolved.yaml`
- `./ai/state/sync-state.yaml`
- `./ai/state/audit-log.yaml`

### 3.4 Success output (`data`)

- detected project metadata summary
- selected language/profile
- created/updated files list
- unresolved questionnaire items (if any)

### 3.5 Fail conditions

- existing incompatible schema without `--force`
- missing required interactive answers in `--non-interactive`
- filesystem write errors

---

## 4. `ai-config sync`

### 4.1 Purpose

Synchronize managed configuration layers while preserving user-owned custom files.

### 4.2 Inputs

Usage:
`ai-config sync [options]`

Options:
- `--dry-run`: show planned changes only
- `--with-migrations`: apply compatible migrations
- `--from-version <v>`: optional expected current schema/module version

### 4.3 Side effects

May update:
- managed files under `./ai` except `./ai/custom/**`
- `./ai/lock.yaml`
- `./ai/resolved.yaml`
- `./ai/state/sync-state.yaml`
- `./ai/state/migration-state.yaml` (if present)
- `./ai/state/audit-log.yaml`

Must never modify:
- `./ai/custom/**`

### 4.4 Success output (`data`)

- applied changes list
- preserved custom files count
- migration summary
- drift/conflict summary

### 4.5 Fail conditions

- compatibility violation
- unresolved migration conflict
- policy-enforced deny conditions

---

## 5. `ai-config resolve`

### 5.1 Purpose

Build deterministic final agent-facing configuration from all active layers.

### 5.2 Inputs

Usage:
`ai-config resolve [options]`

Options:
- `--strict`: treat warnings as failures
- `--explain`: include provenance references in output

### 5.3 Side effects

Updates:
- `./ai/resolved.yaml`
- `./ai/state/audit-log.yaml`

### 5.4 Success output (`data`)

- active layers and precedence used
- resolved module list
- warnings (if any)
- checksum/hash of resolved payload (optional but recommended)

### 5.5 Fail conditions

- merge conflict not resolvable by strategy
- inheritance cycle
- missing required contracts

---

## 6. `ai-config validate`

### 6.1 Purpose

Run schema and semantic validations across v1 configuration set.

### 6.2 Inputs

Usage:
`ai-config validate [options]`

Options:
- `--scope <all|schemas|rules|text|tasks|questions>`
- `--strict`

### 6.3 Side effects

No config mutations expected.
May append audit event:
- `./ai/state/audit-log.yaml`

### 6.4 Success output (`data`)

- validation summary by scope
- warning/error counts
- actionable diagnostics with file references

### 6.5 Fail conditions

- schema mismatch
- required file missing
- semantic rule violations (precedence, illegal override, invalid status set, invalid text policy)

---

## 7. `ai-config explain`

### 7.1 Purpose

Explain why resolved values were produced and from which source layers.

### 7.2 Inputs

Usage:
`ai-config explain [options]`

Options:
- `--key <path>`: explain specific resolved key path
- `--module <name>`: filter by module
- `--format <human|json>`

### 7.3 Side effects

No config mutations expected.
May append audit event:
- `./ai/state/audit-log.yaml`

### 7.4 Success output (`data`)

- provenance chain (source file -> layer -> rule)
- precedence decision trace
- conflict resolution notes (if any)

### 7.5 Fail conditions

- unresolved state missing (`resolved.yaml` absent/unbuilt)
- unknown key path/module filter

---

## 8. Validation Baseline by Command

- `init`: verify mandatory bootstrap files and minimum questionnaire integrity.
- `sync`: verify schema compatibility and custom-preservation invariant.
- `resolve`: verify precedence model and required module contracts.
- `validate`: verify schema + semantic rules.
- `explain`: verify provenance metadata availability.

---

## 9. Tool-Calling Alignment (v1)

Execution mode mapping:
- Auto-run:
  - `resolve`
  - `validate`
  - `explain`
  - `mcp status`
  - `tasks intake`
  - `tasks plan`
  - `tasks list`
  - `text check`
  - `questions status`
- Confirm-required:
  - `init`
  - `sync`
  - `mcp connect`
  - `mcp disconnect`
  - `tasks sync`
  - `tasks enable`
  - `tasks disable`
  - `tasks status`
  - `questions run`
  - `questions ask`

Any policy decision should be reflected in:
- command output (`data.policyDecision`)
- `./ai/state/audit-log.yaml`

---

## 10. Module Command Contracts (v1)

### 10.1 `ai-config tasks enable|disable`

- Purpose: toggle task-first workflow in `ai/tasks/config.yaml`.
- Side effects: updates `ai/tasks/config.yaml`, appends audit event.
- Policy: confirm-required.

### 10.2 `ai-config tasks intake "<text>"`

- Purpose: convert user text into structured task and store in local board (`inbox`).
- Side effects: updates `ai/tasks/board/inbox.yaml`, appends audit event.
- Policy: auto-run.

### 10.3 `ai-config tasks plan <task-id>`

- Purpose: enrich task planning fields (`acceptance_criteria`, `risks`) and decompose epic tasks into derived micro-tasks when enabled.
- Side effects: updates task board files, appends audit event.
- Policy: auto-run.

### 10.4 `ai-config tasks status <task-id> <status>`

- Purpose: move task between statuses with transition rules.
- Side effects: updates task board files, appends audit event.
- Policy: confirm-required.

### 10.5 `ai-config tasks list [--status]`

- Purpose: list tasks from local board, optionally filtered by status.
- Side effects: none (besides audit).
- Policy: auto-run.

### 10.6 `ai-config tasks sync`

- Purpose: run MCP-backed task sync using configured provider.
- Behavior:
  - `pull`: imports external tasks to local board.
  - `push`: exports local tasks to external board.
  - `bidirectional`: merges local/external tasks using reconciliation policy from `ai/tasks/integrations/mcp.yaml`.
- Reconciliation policy fields (`provider_config.reconciliation`):
  - `conflict_strategy`: `latest-timestamp|prefer-local|prefer-external`
  - `timestamp_field`: `updated_at|created_at`
  - `on_equal_timestamp`: `prefer-local|prefer-external`
  - `dedupe_by_id`: boolean
- Side effects: updates local board files and/or external board file according to `sync_direction`, then appends audit event.
- Policy: confirm-required.

### 10.7 `ai-config text check`

- Purpose: run mojibake/encoding/cyrillic readability checks across repository text files.
- Scope rules: respects `ai/rules/ignore.yaml` (`ignore` + `allowlist_overrides`) during scan.
- Option: `--changed-only` limits scan to changed/untracked git files; if git metadata is unavailable, command falls back to repository scan with warning.
- Performance guardrails:
  - max file size per scanned file: `512 KB`
  - max scanned files per run: `4000`
  - max total scanned text size per run: `32 MB`
  - when limits are reached, scan stops early and emits warnings
- Side effects: none (besides audit).
- Policy: auto-run.

### 10.8 `ai-config questions status`

- Purpose: show questionnaire completion and missing required blocks.
- Side effects: none (besides audit).
- Policy: auto-run.

### 10.9 `ai-config questions run [--lang]`

- Purpose: run questionnaire lifecycle update and persist language/completion state.
- Side effects: updates `ai/questions/answers.yaml`, appends audit event.
- Policy: confirm-required.

### 10.10 `ai-config questions ask [--lang]`

- Purpose: run interview-first questionnaire flow (interactive by default in human mode), with optional non-interactive prefilled answers.
- Side effects: updates `ai/questions/answers.yaml`, appends audit event.
- Policy: confirm-required.

### 10.11 `ai-config mcp status|connect|disconnect`

- `status`: read integration status and provider health hints (auto-run).
- `connect`: enable provider + set mode/sync direction (confirm-required).
- `disconnect`: disable provider + reset local mode (confirm-required).
- Side effects for mutating commands: updates `ai/tasks/config.yaml` and `ai/tasks/integrations/mcp.yaml`, appends audit event.

---

## 11. Definition of Done for CLI v1 Contracts

Contract is considered implementation-ready when:
- command signatures are frozen
- outputs and exit codes are frozen
- side effects per command are frozen
- non-interactive failure rules are frozen
- tool-calling policy mapping is frozen
