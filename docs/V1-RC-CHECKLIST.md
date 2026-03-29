# v1 RC Checklist

## Scope Freeze

- [x] CLI command signatures frozen for v1 (`src/cli/cli-signatures-snapshots.test.ts`)
- [x] JSON envelope fields frozen for v1 (`src/cli/cli-envelope-snapshots.test.ts`)
- [x] Exit-code mapping verified against contracts (e2e assertions in `src/cli/cli-contract-e2e.test.ts`)

## Quality Gate

- [x] `npm run check` passes on release branch (`codex/release-v0.1.0-rc`, 18/18 suites, 103/103 tests, 8/8 snapshots)
- [x] Snapshot/contract tests for JSON envelope pass (`src/cli/cli-envelope-snapshots.test.ts`)
- [x] No failing e2e tests for core flow (`init -> resolve -> validate -> explain -> sync`) (`src/cli/cli-contract-e2e.test.ts`)

## Policy and Audit

- [x] Tool-calling policy matrix matches implemented commands (`ai/rules/tool-calling-policy.yaml`, `src/services/tool-calling-policy.ts`)
- [x] Audit events written for success/failed/denied paths (command layer writes via `context.auditLogger.append(...)` in `src/commands/builtins.ts`)
- [x] Audit retention and malformed-log recovery verified (`src/services/yaml-audit-logger.test.ts`)

## Module Minimums

- [x] Tasks local flow works (`enable/disable/intake/list`) (`src/services/task-board-service.test.ts`, `src/cli/cli-contract-e2e.test.ts`)
- [x] Text check works and reports reliability issues (`src/services/text-policy-service.test.ts`)
- [x] Questions status/run works and persists state (`src/services/questions-service.test.ts`, `src/cli/cli-contract-e2e.test.ts`)
- [x] MCP strategy layer works without mandatory provider dependency (`src/services/task-mcp-integration.test.ts`)

## Documentation

- [x] `docs/CLI-CONTRACTS-V1.md` matches implementation
- [x] `docs/SPRINT-2-HANDOFF.md` matches implementation
- [x] Known limitations and Sprint 3 scope documented

## Release Readiness

- [x] Version/tag planned (`v0.1.0`, see `docs/RELEASE-NOTES-v0.1.0.md`)
- [x] Changelog/release notes drafted (`docs/CHANGELOG.md`, `docs/RELEASE-NOTES-v0.1.0.md`)
- [x] Rollback plan documented (`docs/ROLLBACK-PLAN-v0.1.0.md`)

## Latest Evidence Snapshot

- Local quality gate: `npm run check` passed (18/18 suites, 103/103 tests, 8/8 snapshots).
- CI workflow present: `.github/workflows/ci.yml` (Ubuntu/Windows/macOS matrix).
- Command contract coverage: `src/cli/cli-contract-e2e.test.ts`.
- Envelope shape stability: `src/cli/cli-envelope-snapshots.test.ts`.
- Command signature stability: `src/cli/cli-signatures-snapshots.test.ts`.
