# Sprint 1 Tasks (Foundation + Start of Implementation)

## Sprint Goal

Build a production-ready project foundation for `ai-config` and deliver the first implementation slice with extensible architecture.

Target outcome:
- repo is ready for active development
- quality gates are enforced
- core architecture supports module/command growth
- first functional vertical slice is implemented

---

## Scope Rules

In sprint:
- project foundation and engineering standards
- architecture skeleton for scalability
- initial implementation of one core module path

Out of sprint:
- full MCP integrations
- advanced migrations
- full enterprise governance packs

---

## Task Backlog (Priority Order)

## T1. Initialize runtime and package baseline

- Type: task
- Priority: P0
- Description: Set up base runtime project, package metadata, scripts, and command entrypoint.
- Acceptance criteria:
  - project boots via one canonical dev command
  - command entrypoint exists and is discoverable
  - baseline scripts for build/test/lint are declared
- Risks:
  - inconsistent local environments
- Dependencies:
  - none

## T2. Add repository hygiene baseline

- Type: task
- Priority: P0
- Description: Add `.editorconfig`, `.gitignore`, `.env.example`, `.env`, and baseline formatting/lint settings.
- Acceptance criteria:
  - editor behavior is deterministic across contributors
  - ignored files include build/cache/temp/secrets artifacts
  - `.env.example` documents required variables
  - `.env` is excluded from git
- Risks:
  - accidental secret leakage
- Dependencies:
  - T1

## T3. Set up linting (including style formatting via ESLint) and CI quality gates

- Type: task
- Priority: P0
- Description: Configure lint and style-format checks via ESLint plus minimal CI workflow.
- Acceptance criteria:
  - lint and ESLint style checks run locally and in CI
  - failing quality gates block merge
  - command output is readable and actionable
- Risks:
  - unstable ruleset causing noisy failures
- Dependencies:
  - T1, T2

## T4. Implement config domain contracts (v1)

- Type: task
- Priority: P0
- Description: Create strongly typed internal models for v1 config contracts and schema validation boundaries.
- Acceptance criteria:
  - contracts exist for core v1 files
  - invalid contracts fail with explicit diagnostics
  - version field handling is standardized
- Risks:
  - schema drift across modules
- Dependencies:
  - T1

## T5. Implement scalable architecture skeleton

- Type: task
- Priority: P0
- Description: Build modular core structure: command registry, module registry, resolver interfaces, validation interfaces.
- Acceptance criteria:
  - new command can be added via registration without editing core dispatcher logic
  - new module can be added via registration without breaking existing modules
  - extension points are documented
- Risks:
  - over-abstraction too early
- Dependencies:
  - T4

## T6. Define singleton boundaries

- Type: task
- Priority: P1
- Description: Explicitly define which services are singleton and why (for example config store, logger, command bus), and where singleton must not be used.
- Acceptance criteria:
  - singleton candidates documented with lifecycle and thread/process assumptions
  - anti-pattern cases documented (hidden global mutable state)
  - construction path is test-friendly
- Risks:
  - hidden shared state and flaky tests
- Dependencies:
  - T5

## T7. Implement first vertical slice: `resolve` + `validate` (minimal)

- Type: task
- Priority: P0
- Description: Deliver first runnable path from input configs to resolved output and validation report.
- Acceptance criteria:
  - `resolve` command generates deterministic output
  - `validate` command catches schema/semantic baseline issues
  - outputs follow v1 CLI envelope contract
- Risks:
  - merge edge cases underestimated
- Dependencies:
  - T4, T5

## T8. Add audit and tool-calling policy hooks

- Type: task
- Priority: P1
- Description: Add policy gate layer for command execution mode (auto/confirm/deny) and append audit entries.
- Acceptance criteria:
  - policy decisions are enforced per command
  - audit event model is stable
  - deny and confirm branches are test-covered
- Risks:
  - inconsistent policy enforcement
- Dependencies:
  - T5, T7

## T9. Testing baseline (unit + contract + e2e smoke)

- Type: task
- Priority: P0
- Description: Create test harness for core modules and smoke tests for command flows.
- Acceptance criteria:
  - unit tests for resolver/validator core
  - contract tests for CLI envelope and exit codes
  - e2e smoke for `resolve` and `validate`
- Risks:
  - false confidence from shallow tests
- Dependencies:
  - T7

## T10. Sprint hardening and handoff

- Type: task
- Priority: P1
- Description: Stabilize docs, update checklists, and prepare Sprint 2 input.
- Acceptance criteria:
  - implementation docs updated
  - known limitations listed
  - Sprint 2 backlog prepared
- Risks:
  - undocumented behavior
- Dependencies:
  - T1..T9

---

## Suggested Execution Order

1. T1
2. T2
3. T3
4. T4
5. T5
6. T6
7. T7
8. T8
9. T9
10. T10

---

## Definition of Done (Sprint 1)

- Foundation files and quality gates are active.
- Architecture supports adding commands/modules without core rewrites.
- Singleton usage boundaries are explicit and testable.
- First functional implementation path (`resolve`, `validate`) is shipped.
- Policy and audit hooks are in place.
- Tests provide baseline confidence.
