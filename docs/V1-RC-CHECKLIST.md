# v1 RC Checklist

## Scope Freeze

- [ ] CLI command signatures frozen for v1
- [ ] JSON envelope fields frozen for v1
- [ ] Exit-code mapping verified against contracts

## Quality Gate

- [ ] `npm run check` passes on release branch
- [ ] Snapshot/contract tests for JSON envelope pass
- [ ] No failing e2e tests for core flow (`init -> resolve -> validate -> explain -> sync`)

## Policy and Audit

- [ ] Tool-calling policy matrix matches implemented commands
- [ ] Audit events written for success/failed/denied paths
- [ ] Audit retention and malformed-log recovery verified

## Module Minimums

- [ ] Tasks local flow works (`enable/disable/intake/list`)
- [ ] Text check works and reports reliability issues
- [ ] Questions status/run works and persists state
- [ ] MCP strategy layer works without mandatory provider dependency

## Documentation

- [ ] `docs/CLI-CONTRACTS-V1.md` matches implementation
- [ ] `docs/SPRINT-2-HANDOFF.md` matches implementation
- [ ] Known limitations and Sprint 3 scope documented

## Release Readiness

- [ ] Version/tag planned
- [ ] Changelog/release notes drafted
- [ ] Rollback plan documented (previous stable commit/tag)
