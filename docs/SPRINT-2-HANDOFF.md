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
  - GitLab provider skeleton (health/sync stubs)
- Module minimums (M5):
  - `tasks enable|disable|intake|list`
  - `text check`
  - `questions status|run`

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
  - `tasks list [--status]`
  - `tasks sync`
- Text:
  - `text check`
- Questions:
  - `questions status`
  - `questions run [--lang]`
- MCP:
  - `mcp status`
  - `mcp connect <provider> [--mode local|hybrid|remote-first]`
  - `mcp disconnect`

## Quality Gate Status

- `npm run check`: passing
- Test suites: 16
- Tests: 68

## Known Limitations

- MCP GitLab adapter is a skeleton and does not perform real remote sync yet.
- `tasks sync` without connected MCP provider is a safe no-op with warning (local workflow continues).
- `tasks sync` with connected provider currently reports provider skeleton limitations until adapter implementation.
- `text check` is focused on config-local reliability signals; broader repository scanning is not enabled.
- Questionnaire `run` currently updates status/language and does not perform interactive interviewing.

## Suggested Sprint 3 Focus

1. Implement real MCP provider adapter (GitLab) and provider-specific auth/config checks.
2. Add interactive questionnaire runner and profile-aware question orchestration.
3. Expand text checks to repository-level scan with ignore rules integration.
4. Harden task workflow with `plan/status` transitions and MCP reconciliation strategy.
