# Release Notes: v0.1.0

Release date: 2026-03-29
Package version: `0.1.0`
Planned git tag: `v0.1.0`

## Summary

`ai-config` v0.1.0 provides a production-oriented MVP for configuring and operating AI agent workflows in repositories, including core config lifecycle, tasks, questionnaire flow, text reliability checks, and custom MCP task synchronization.

## Highlights

1. End-to-end core config lifecycle
- Bootstrap and evolve project configuration using:
  - `init`
  - `sync`
  - `resolve`
  - `validate`
  - `explain`

2. Task workflow hardening
- Added task lifecycle commands:
  - `tasks intake`
  - `tasks plan`
  - `tasks status`
  - `tasks list`
  - `tasks enable/disable`
- Enforced status-transition rules and epic decomposition path.

3. Questionnaire improvements
- Added profile-aware and interactive questionnaire flow:
  - `questions run`
  - `questions ask`
  - `questions status`
- Added non-interactive completion behavior with explicit failure semantics.

4. Text reliability v2
- `text check` scans repository text sources with:
  - ignore/allowlist rules
  - mojibake and Cyrillic readability checks
  - `--changed-only` optimization mode

5. MCP strategy and reconciliation policy
- `custom` provider with sync directions:
  - `pull`
  - `push`
  - `bidirectional`
- Reconciliation policy contract added for deterministic conflict resolution.

6. Migration baseline in sync
- `sync --with-migrations` now uses version-aware flow with migration-state recording.

## Quality and Verification

- Local gate: `npm run check`
- Passing status at release prep:
  - 17 test suites
  - 94 tests
  - 3 snapshot suites
- CI matrix enabled for:
  - Ubuntu
  - Windows
  - macOS

## Known Limitations

- `sync --with-migrations` currently includes baseline version-step support; major-version migration packs are future work.
- Built-in MCP provider support is `custom`-first; additional provider packs are not bundled in this release.
- Long-term spec command families are deferred from v0.1.0:
  - `ignore *`
  - `text fix/doctor`
  - `questions reset`
  - `agents *`
  - `update`
  - `doctor`
  - `diff`

## Upgrade Guidance

1. Install dependencies with Node `24.14.0` and npm `11+`.
2. Run `npm run check`.
3. For existing projects:
  - run `ai-config sync --confirm`
  - if schema version mismatch is detected, run `ai-config sync --confirm --with-migrations`
