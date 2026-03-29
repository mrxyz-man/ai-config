# Changelog

All notable changes to this project are documented in this file.

## [0.1.0] - 2026-03-29

### Added

- Core CLI workflow:
  - `init`
  - `sync`
  - `resolve`
  - `validate`
  - `explain`
- Tasks module commands:
  - `tasks enable`
  - `tasks disable`
  - `tasks intake`
  - `tasks plan`
  - `tasks status`
  - `tasks list`
  - `tasks sync`
- Questions module commands:
  - `questions status`
  - `questions run`
  - `questions ask`
- Text module:
  - `text check`
  - repository-wide scan with `ignore` + `allowlist_overrides`
  - `--changed-only` mode with safe fallback
- MCP integration baseline:
  - `mcp status`
  - `mcp connect`
  - `mcp disconnect`
  - `custom` provider strategy
  - push/pull/bidirectional sync
  - reconciliation policy (`conflict_strategy`, `timestamp_field`, `on_equal_timestamp`, `dedupe_by_id`)
- Sync migration baseline:
  - version-aware sync checks
  - `--with-migrations` path with migration-state tracking
  - `ai/state/migration-state.yaml`

### Changed

- Tool-calling policy surface aligned to implemented commands only.
- Documentation synchronized with implementation for:
  - CLI contracts
  - Sprint handoff
  - RC checklist
- CI upgraded to OS matrix:
  - Ubuntu
  - Windows
  - macOS

### Quality

- Stable quality gate: `npm run check`
- Test status at release prep:
  - 17 suites passing
  - 94 tests passing
  - 3 snapshots passing
