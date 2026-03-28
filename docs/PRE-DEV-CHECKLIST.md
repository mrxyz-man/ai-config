# ai-config: Pre-Development Readiness Checklist

Use this checklist before implementation starts.  
Status markers: `[ ]` not started, `[~]` in progress, `[x]` done.

## Tracking Template

Use this line template for each checklist item:

`- [ ] <item> | Owner: <name> | Due: <YYYY-MM-DD> | Status: <not started/in progress/done> | Notes: <optional>`

Example:

`- [~] Define error model and exit codes | Owner: Alex | Due: 2026-04-02 | Status: in progress | Notes: draft ready for review`

---

## 1. Product Scope Freeze

- [ ] Confirm v1 scope (in-scope modules and commands). | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Confirm out-of-scope items (Phase 2+). | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define v1 success criteria (functional and quality). | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Approve final scope with stakeholders. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:

## 2. CLI Contracts

- [ ] Define contract for each v1 command: inputs, flags, outputs. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define command side effects and affected files. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define error model and exit codes. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define output modes (human-readable and machine-readable). | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Freeze command naming and aliases. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:

## 3. Config Contracts

- [ ] Finalize minimal schema for `ai.yaml`. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Finalize minimal schema for `project.yaml`. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Finalize minimal schema for `modules.yaml`. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Finalize minimal schema for `resolved.yaml`. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Finalize schema for `rules/ignore.yaml` and `custom/ignore.local.yaml`. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Finalize schema for `tasks` v1 local mode. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Finalize schema for `questions` v1 profile and answers. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Finalize schema for `text` v1 (encoding/locale/check rules). | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define schema versioning and compatibility policy. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:

## 4. Resolution Semantics

- [ ] Freeze precedence model for all layers. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Freeze merge semantics for maps/lists/scalars. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define conflict behavior (error, warn, fallback). | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define cycle detection rules for inheritance. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define behavior for missing/optional modules. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define explain/provenance output contract. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:

## 5. Security and Tool-Calling Policy

- [ ] Approve v1 permission matrix (`auto-run`, `confirm`, `deny`). | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define confirmation UX for mutation commands. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define audit log fields and retention policy. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define boundaries for destructive operations. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define safe defaults for external integrations. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:

## 6. Onboarding and Questionnaire UX

- [ ] Freeze `init` interview flow (required vs optional questions). | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define language detection and fallback strategy. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define backend/frontend/design question profiles. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define re-run behavior for unanswered or low-confidence answers. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define user-facing copy style for prompts and confirmations. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:

## 7. Task System (v1 Local)

- [ ] Freeze task entity contract (task/bug/epic minimal fields). | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Freeze epic decomposition rules. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Freeze statuses and transition rules. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define risk/dependency/acceptance criteria fields. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define behavior when tasks mode is disabled. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:

## 8. Text Reliability

- [ ] Define canonical encoding and locale defaults. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define mojibake detection heuristics. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define Cyrillic and multilingual validation rules. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define non-destructive `text check` behavior. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define gated behavior for future `text fix`. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:

## 9. Testing Strategy

- [ ] Prepare unit test plan for resolver and validators. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Prepare contract tests for all v1 schemas. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Prepare e2e scenarios for `init/sync/resolve/validate/explain`. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Build fixture projects (backend/frontend/design/mono). | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define release quality gates (pass/fail thresholds). | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:

## 10. Delivery Plan and Ownership

- [ ] Split MVP into implementation milestones. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Assign owner per milestone. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define Definition of Done per milestone. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define risk register and mitigation owner. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Define rollout and rollback strategy. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:

## 11. Readiness Gate (Go/No-Go)

- [ ] All scope and contracts approved. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Security/tool-calling policy approved. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Test strategy approved. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Delivery ownership confirmed. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:
- [ ] Team Go/No-Go decision recorded. | Owner: <name> | Due: <YYYY-MM-DD> | Status: not started | Notes:

---

## Suggested Immediate Next Actions

1. Fill owners and due dates for sections 1-4 first.
2. Run a scope/contract review and close all blocking open items.
3. Start implementation only after section 11 is fully green.

---

## Weekly Review Log

- Week: <YYYY-Www> | Reviewer: <name> | Overall Status: <red/yellow/green> | Blockers: <summary>
- Week: <YYYY-Www> | Reviewer: <name> | Overall Status: <red/yellow/green> | Blockers: <summary>

## Decision Log

- Date: <YYYY-MM-DD> | Decision: <short title> | Owner: <name> | Impact: <scope/risk/timeline>
- Date: <YYYY-MM-DD> | Decision: <short title> | Owner: <name> | Impact: <scope/risk/timeline>
