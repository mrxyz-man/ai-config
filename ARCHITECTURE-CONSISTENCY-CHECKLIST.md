# Architecture Consistency Checklist

Use this checklist to evaluate any `.ai` module for two goals at once:
- user comfort (clear UX, predictable behavior),
- agent operability (deterministic and enforceable behavior).

---

## 1. Module Contract

For each module, verify:
- Purpose is explicit in 1-2 lines.
- Inputs are listed (which files/fields are required).
- Outputs are listed (which files/fields are produced or updated).
- Source-of-truth priority is declared.
- Scope boundaries are clear (what the module never does).

Pass criteria:
- A new contributor can understand module responsibility in under 2 minutes.
- An agent can execute the module without inferring hidden assumptions.

---

## 2. Trigger Semantics

Verify each module has:
- `entry_condition` (when module must start).
- `blocking_condition` (when work cannot continue).
- `exit_condition` (when module is considered complete).
- Explicit fallback when preconditions are missing.

Pass criteria:
- No critical behavior depends on user explicitly asking for it.
- Agent behavior is driven by state, not by guesswork.

---

## 3. State Model

Check that module state is represented explicitly:
- `disabled`
- `bootstrap`
- `ready`
- `degraded`

Verify transitions are defined:
- who can transition state,
- what evidence is required for transition,
- what warnings/errors are emitted.

Pass criteria:
- Enabled module cannot silently be incomplete.

---

## 4. Language and Locale Policy

Verify locale contract is explicit:
- user-facing content MUST use `manifest.ui_locale`.
- system/internal instructions may have separate language policy.
- language-switch is allowed only on explicit user request.

Check all user-facing surfaces:
- `qa.yaml` questions,
- user prompts,
- summaries/reports,
- conflict hints.

Pass criteria:
- No mixed-language output unless user explicitly requested.

---

## 5. Priority of Sources

Verify precedence is globally fixed and reused across modules, for example:
1. `manifest/config`
2. `rules`
3. `project`
4. `qa`
5. auxiliary modules (`memory/logs/templates`)

Pass criteria:
- Conflicts between files are resolved by policy, not by agent choice.

---

## 6. Validation Coverage

For each module, verify `validate` can detect:
- missing required files,
- schema/type errors,
- cross-file consistency issues,
- policy violations (for example locale mismatch).

Severity policy:
- `error` for blocking issues,
- `warning` for degraded-but-usable state.

Pass criteria:
- User can run one command and get actionable diagnostics.

---

## 7. Dependency Safety

Verify dependencies are explicit and enforced:
- module dependency graph exists,
- non-interactive mode fails on invalid combinations,
- interactive mode can auto-fix with explicit warnings.

Pass criteria:
- No hidden dependency can produce ambiguous runtime behavior.

---

## 8. Conflict Playbook (Sync/Init)

Check conflict handling is user-actionable:
- each conflict has reason,
- each conflict has recommended next action,
- safe auto-merge scope is explicit,
- destructive overwrite requires explicit force/confirmation.

Pass criteria:
- User can recover from conflicts without reading implementation code.

---

## 9. MCP Readiness

Verify MCP behavior remains capability-first:
- provider selection by capabilities, not vendor name,
- write operations require explicit confirmation,
- fallback path exists when MCP is unavailable,
- module works without MCP unless explicitly required.

Pass criteria:
- MCP enriches workflow but does not become a hidden hard dependency.

---

## 10. UX Simplicity

Check onboarding complexity:
- init asks only high-impact questions first,
- advanced options are conditional,
- summary/confirmation screen is concise and clear,
- next action after init is explicit.

Pass criteria:
- First-time user can bootstrap confidently with minimal confusion.

---

## 11. Agent Determinism

Check that critical rules use strict language:
- use `MUST / MUST NOT / ONLY IF`.
- avoid ambiguous wording (`should`, `try`, `prefer`) for required behavior.

Pass criteria:
- Different agents/sessions produce consistent behavior for the same state.

---

## 12. Release Gate

Before publishing:
- Run full quality gate.
- Run e2e matrix on a fresh project and on an existing project.
- Verify docs match real behavior.
- Verify no local/private absolute paths in docs.

Pass criteria:
- Published package behavior equals documented behavior.

---

## Quick Scoring (optional)

For each section, score:
- `0` = missing,
- `1` = partial,
- `2` = complete.

Interpretation:
- `20-24`: production-ready,
- `14-19`: usable with notable risks,
- `<14`: high ambiguity, prioritize architecture hardening.
