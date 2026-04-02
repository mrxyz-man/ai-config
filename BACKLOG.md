# BACKLOG

## E2E Feedback (2026-04-02)

### Context
- Local build tested via `node <repo-root>/dist/cli.js` (not published package).
- Real project target: `<target-project-root>`.
- Full scenario matrix executed in `<target-project-root>/_ai-config-e2e`.

### Verified
- `init/validate/sync` flows are stable for `fresh`, `managed`, `foreign`, and `mixed`.
- `sync --no-dry-run` applies only safe actions (`create_*` + safe `update_file`) and does not overwrite conflicts.
- `sync --conflicts-only` correctly filters output to conflicts and recommendations.

### Follow-up Items
1. Add conflict recommendations for YAML parse-error conflicts
- Problem: for `conflict_file` with reason like "Safe merge is configured but YAML parsing failed", `recommendations` may be empty.
- Goal: always provide actionable `manual_merge` guidance for every `conflict_file`, including parse-error cases.

2. Make recommendation commands runtime-aware
- Problem: `recommendations.suggestedCommands` currently use `ai-config ...` literal commands, which may not match local execution mode (`node .../dist/cli.js` or `npx`).
- Goal: generate neutral or configurable command hints (for example, template variables or execution-mode aware rendering).
