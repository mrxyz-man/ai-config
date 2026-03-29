# Sprint 2 Handoff

## Delivered

- `init` command implemented with bootstrap flow and first resolve generation.
- `sync` command implemented with:
  - `--dry-run`, `--with-migrations`, `--from-version`
  - managed layer refresh
  - `./ai/custom/**` preservation invariant
- `explain` command implemented with filters:
  - `--key`
  - `--module`
- Resolver enhancements:
  - custom overrides support (`ai/custom/overrides.yaml`)
  - enforced invariants for protected policy values
- Validator enhancements:
  - scope support (`all|schemas|rules|text|tasks|questions`)
  - semantic checks for rules/text/tasks/questions
- Audit hardening:
  - runtime event schema checks
  - retention limit
  - atomic write path
  - malformed-file recovery
- MCP prep:
  - provider interface contract
  - `mcp status|connect|disconnect`
  - `tasks sync`
  - custom provider strategy with local/external task reconciliation (push/pull/bidirectional)
- Module minimums (M5):
  - `tasks enable|disable|intake|plan|status|list`
  - `text check` (repository scope + ignore rules + changed-only mode)
  - `questions status|run|ask` (profile-aware, interactive/non-interactive paths)

## Current Command Surface

- Core:
  - `init`
  - `sync`
  - `resolve`
  - `validate`
  - `explain`
- Tasks:
  - `tasks enable`
  - `tasks disable`
  - `tasks intake "<text>"`
  - `tasks plan <task-id>`
  - `tasks status <task-id> <status>`
  - `tasks list [--status]`
  - `tasks sync`
- Text:
  - `text check [--changed-only]`
- Questions:
  - `questions status`
  - `questions run [--lang|--profile|--answer|--non-interactive]`
  - `questions ask [--lang|--profile|--answer|--non-interactive]`
- MCP:
  - `mcp status`
  - `mcp connect <provider> [--mode local|hybrid|remote-first]`
  - `mcp disconnect`

## Quality Gate Status (Current)

- `npm run check`: passing
- Test suites: 18
- Tests: 103

## Remaining Limitations

- MCP bundled support is intentionally limited to `custom` provider strategy; additional provider packs are pending.
- Long-term spec commands (`ignore *`, `text fix/doctor`, `questions reset`, `agents *`, `doctor`, `diff`) are not in current implemented v1 scope.

## Suggested Sprint 3 Focus

1. Close production documentation gap (`README`, contracts, handoff docs, RC checklist evidence).
2. Implement full migration contract for `sync --with-migrations`.
3. Finalize MCP reconciliation policy and adapter hardening strategy.
4. Complete release readiness artifacts (versioning, changelog, rollback plan, CI matrix hardening).
