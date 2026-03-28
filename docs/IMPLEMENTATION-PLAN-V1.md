# ai-config Implementation Plan v1

## Status Snapshot (2026-03-28)

- M1: completed
- M2: completed
- M3: completed
- M4: completed
- M5: completed
- M6: in progress (docs alignment and release preparation)

## 1. Objective

Implement a stable MVP based on:
- `AI-CONFIG-SYSTEM-SPEC.md`
- `CLI-CONTRACTS-V1.md`
- current `./ai` bootstrap baseline

Primary deliverable:
- production-ready v1 CLI flow for core + module commands
  - core: `init|sync|resolve|validate|explain`
  - modules: `tasks`, `text`, `questions`, `mcp` prep

---

## 2. Workstreams

1. Core domain and contracts
2. Resolver and validation engine
3. CLI command layer
4. Task/text/questions minimum modules
5. Tool-calling policy and audit
6. Test and release hardening

---

## 3. Milestone Plan

## M1: Core Foundation

Scope:
- Define internal domain models for v1 config files.
- Implement schema loading and contract validation primitives.
- Implement filesystem abstraction for `./ai` reads/writes.
- Implement standardized output envelope and exit-code mapping.

Dependencies:
- Frozen CLI contract and v1 file contract.

Done when:
- Core models compile and pass unit tests.
- Invalid schema and missing files return deterministic errors.

Tests:
- Unit: schema parser, contract guards, path resolution.
- Contract: sample valid/invalid fixtures.

---

## M2: Resolver + Validate Engine

Scope:
- Implement precedence layering and merge semantics.
- Implement cycle/conflict detection.
- Implement `resolve` engine writing `resolved.yaml`.
- Implement `validate` engine (schema + semantic checks).

Dependencies:
- M1 completed.

Done when:
- `resolve` deterministic on same input.
- `validate` reports actionable diagnostics and correct exit codes.

Tests:
- Unit: merge semantics (map/list/scalar), conflict matrix.
- Unit: inheritance cycle detector.
- E2E: `resolve` then `validate` on fixture projects.

---

## M3: `init` Command

Scope:
- Implement project bootstrap flow.
- Implement project context scan baseline.
- Implement questionnaire orchestration (language + required blocks).
- Generate initial `resolved.yaml` and update state/audit.

Dependencies:
- M1, M2 completed.

Done when:
- Running `init` in empty project creates valid baseline `./ai`.
- Non-interactive mode fails correctly when required answers are missing.

Tests:
- E2E: `init` on clean fixture.
- E2E: `init --skip-questions`.
- E2E: `init --non-interactive` expected failures.

---

## M4: `sync` + Explainability

Scope:
- Implement managed-layer sync with custom-preservation invariant.
- Implement migration hook point (v1-compatible migrations only).
- Implement `explain` command with provenance chain.
- Update audit logging for command decisions/outcomes.

Dependencies:
- M1, M2, M3 completed.

Done when:
- `sync` updates managed files without modifying `./ai/custom/**`.
- `explain` shows source and precedence trace for resolved keys.

Tests:
- E2E: sync after manual custom changes.
- E2E: explain specific key path and module filters.

---

## M5: Module Minimums (tasks/text/questions)

Scope:
- Wire v1 local task mode toggles and intake/list behavior.
- Implement `text check` baseline validators.
- Implement `questions status` and `questions run` baseline flow.
- Keep all these modules integrated with `validate` and `resolve`.

Dependencies:
- M2 and M3 completed.

Done when:
- Tasks/text/questions data is validated and reflected in `resolved`.
- CLI behavior matches v1 policy and contracts.

Tests:
- E2E: tasks mode on/off and intake.
- E2E: text check signal detection.
- E2E: questionnaire completion lifecycle.

---

## M6: Hardening + Release Candidate

Scope:
- Tool-calling policy enforcement matrix in command dispatcher.
- Full audit coverage and error taxonomy polish.
- Cross-platform verification and docs alignment.
- Release checklist and v1 tag prep.

Dependencies:
- M1-M5 completed.

Done when:
- All mandatory commands pass contract tests and e2e suite.
- No critical/high defects open.

Tests:
- Full regression suite.
- Snapshot tests for `--format json`.
- Stability tests on repeated resolve/sync flows.

---

## 4. Recommended Build Order (Inside Milestones)

1. Shared output/error framework.
2. Config models and schema validators.
3. Resolver internals.
4. Validate internals.
5. `resolve` command wrapper.
6. `validate` command wrapper.
7. `init`.
8. `sync`.
9. `explain`.
10. tasks/text/questions command set.
11. tool-calling policy gate.
12. hardening and docs.

---

## 5. Testing Matrix (Minimum)

- Unit:
  - parsers
  - merge rules
  - precedence resolver
  - cycle detection
  - policy matrix evaluator
- Contract:
  - command output envelope
  - exit code mapping
  - file mutation boundaries
- E2E:
  - `init -> resolve -> validate`
  - `sync` preserving `custom`
  - `explain` provenance
  - `tasks/text/questions` minimum behavior

---

## 6. Risks and Mitigation

- Risk: ambiguous merge semantics.
  - Mitigation: lock rule table early, add explicit tests per key type.
- Risk: `sync` accidentally touching `custom`.
  - Mitigation: hard guard + immutable path checks + dedicated e2e.
- Risk: questionnaire UX blocking automation.
  - Mitigation: `--skip-questions` and non-interactive error clarity.
- Risk: output instability breaks tool-calling.
  - Mitigation: snapshot tests for JSON envelopes.

---

## 7. Team Operating Rhythm

Recommended cadence:
- Weekly planning: scope by milestone.
- Mid-week checkpoint: risks and blockers.
- Weekly demo: command-level progress.
- Weekly quality gate: test pass + open defect review.

---

## 8. Go/No-Go for Coding Start

Start implementation when:
- CLI contracts approved.
- v1 scope approved.
- owners assigned per milestone.
- fixture strategy agreed.
- test gate baseline agreed.
