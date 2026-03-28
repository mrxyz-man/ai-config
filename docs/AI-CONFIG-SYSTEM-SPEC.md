# ai-config: System Specification (v1 Draft)

## 1. Purpose

`ai-config` is a configuration and synchronization system for AI agents working in software projects.
It provides a reusable, versioned, and extensible way to define how agents should operate in each project.

Core goals:
- Connect AI agents to any project type (backend, frontend, design, etc.).
- Build a full project context for better AI output quality.
- Reuse and centrally update shared configurations.
- Support local project-specific overrides without breaking global standards.
- Keep the system modular so new capabilities can be added via sync.

---

## 2. Core Principles

- Deterministic resolution: same inputs produce the same resolved configuration.
- Layered inheritance: base < stack < org < project < custom override < enforced policy.
- Explainability: every resolved rule must have a traceable source.
- Safe sync: managed layers update via sync; `custom` layers are never overwritten.
- Versioned contracts: modules and schemas have explicit compatibility boundaries.
- Progressive governance: teams can start flexible and move to stricter policy controls.

---

## 3. Target `./ai` Structure

```txt
./ai/
  ai.yaml
  project.yaml
  lock.yaml
  resolved.yaml
  modules.yaml
  README.md

  presets/
    base.yaml
    stack.yaml
    org.yaml

  rules/
    policies.yaml
    constraints.yaml
    merge-strategy.yaml
    ignore.yaml

  agents/
    registry.yaml
    roles/
      architect.yaml
      developer.yaml
      reviewer.yaml
    workflows/
      feature-flow.yaml
      bugfix-flow.yaml

  tasks/
    config.yaml
    templates/
      task.yaml
      bug.yaml
      epic.yaml
    board/
      inbox.yaml
      ready.yaml
      in-progress.yaml
      review.yaml
      done.yaml
    integrations/
      mcp.yaml

  text/
    encoding.yaml
    locale.yaml
    normalization.yaml
    terminology.yaml
    lint-rules.yaml

  questions/
    config.yaml
    language.yaml
    profiles/
      default.yaml
      backend.yaml
      frontend.yaml
      design.yaml
    answers.yaml

  context/
    sources.yaml
    conventions.yaml
    glossary.yaml
    structure-map.yaml

  instructions/
    system.md
    coding.md
    review.md
    delivery.md

  custom/
    instructions/
      *.md
    roles/
      *.yaml
    modules/
      *.yaml
    overrides.yaml
    ignore.local.yaml

  state/
    sync-state.yaml
    audit-log.yaml
    migration-state.yaml
```

---

## 4. Module Responsibilities and Requirements

### 4.1 `project` Module

Solves:
- Captures project identity and operating profile.
- Defines what is used now and what is expected to be used.
- Stores key paths and project structure map for agent navigation.

Requirements:
- Must be auto-filled during `init` from project scan.
- Must support manual enrichments from user interview.
- Must be consumable by all other modules as base context.

---

### 4.2 `context` Module

Solves:
- Provides agent-readable map of where truth lives (docs, standards, code areas).
- Reduces hallucinations by grounding the agent in project-specific knowledge.

Requirements:
- Must include source priorities.
- Must include domain glossary and conventions.
- Must support ignore-aware indexing.

---

### 4.3 `rules` Module

Solves:
- Central policy enforcement.
- Merge behavior governance.
- Files and paths to ignore for agent scanning.

Requirements:
- Must include `ignore` capability as first-class rule set.
- Must support local override layer (`ignore.local`) with controlled precedence.
- Must provide conflict detection at validation time.

---

### 4.4 `agents` Module

Solves:
- Defines available AI agent roles and responsibilities.
- Defines multi-role workflows for typical delivery scenarios.

Requirements:
- Must support enabling/disabling roles per project.
- Must support custom role extension without editing managed core files.
- Must expose role metadata usable by orchestration logic.

---

### 4.5 `tasks` Module

Solves:
- Converts user text requests into structured tasks.
- Supports epic decomposition into micro-tasks.
- Captures risks, dependencies, and acceptance criteria before execution.
- Organizes tasks by lifecycle statuses.

Requirements:
- Must be optionally enabled/disabled (`task-first` mode toggle).
- Must always offer task creation when enabled.
- Must support external task backends via MCP (user-managed custom provider).
- Must support local mode, hybrid mode, and remote-first mode.
- Must preserve task traceability between user request and execution.

Recommended default mode:
- Hybrid mode (local board + MCP sync) for resilience and transparency.

---

### 4.6 `text` Module

Solves:
- Prevents text quality failures (encoding corruption, mojibake, locale mismatch).
- Improves multilingual reliability, including Cyrillic correctness.

Requirements:
- Must define canonical encoding and locale behavior.
- Must include normalization and text lint checks.
- Must support terminology control to keep consistent wording.
- Must provide check/fix flows integrated into validation pipeline.

---

### 4.7 `questions` Module

Solves:
- Collects high-value missing information from users during init/onboarding.
- Improves config quality where static scanning is insufficient.

Requirements:
- Must detect and confirm user language before asking questions.
- Must support profile-based questionnaires by project type.
- Must track answer confidence and unanswered critical fields.
- Must be re-runnable without destructive data loss.

---

### 4.8 `instructions` Module

Solves:
- Provides canonical prompt layers for system behavior, coding, review, delivery.

Requirements:
- Must remain readable and editable.
- Must be mergeable with custom instructions.
- Must be included in resolved output with source attribution.

---

### 4.9 `custom` Module

Solves:
- Enables project/team-specific extension without forking managed templates.

Requirements:
- Must never be overwritten by `sync`.
- Must support custom instructions, roles, modules, and local ignore rules.
- Must have explicit precedence behavior in resolution.

---

### 4.10 `state` Module

Solves:
- Tracks sync/update/migration health and auditability.

Requirements:
- Must log last sync, version transitions, and migration outcomes.
- Must support diagnostics (`doctor`) and recovery workflows.

---

## 5. `init` Workflow Contract

`ai-config init` must:
- Create `./ai` structure.
- Scan project stack and structure.
- Build initial context map and key paths.
- Run user interview with language detection.
- Ask for constraints and preferred standards.
- Generate first resolved output and lock state.
- Validate module consistency.

Expected outcome:
- Agent can operate with high context completeness immediately after init.

---

## 6. `sync` and Evolution Contract

`ai-config sync` must:
- Pull managed updates (presets/modules/policies/schema changes).
- Apply safe migrations when structure changes.
- Recompute resolved output.
- Preserve all `custom` user content.
- Report drift, conflicts, and required manual actions.

Future module onboarding requirement:
- A newly introduced module must be addable through sync without breaking old projects.

---

## 7. Command Surface (High-Level)

### 7.1 Core Commands

- `ai-config init`
- `ai-config sync`
- `ai-config update`
- `ai-config resolve`
- `ai-config validate`
- `ai-config explain`
- `ai-config doctor`
- `ai-config diff`

### 7.2 Agent Role Commands

- `ai-config agents list`
- `ai-config agents enable <role>`
- `ai-config agents disable <role>`

### 7.3 Task Commands

- `ai-config tasks enable`
- `ai-config tasks disable`
- `ai-config tasks intake "<text>"`
- `ai-config tasks plan <task-id>`
- `ai-config tasks status <task-id> <status>`
- `ai-config tasks list`

### 7.4 MCP Integration Commands

- `ai-config mcp connect <provider>`
- `ai-config mcp disconnect <provider>`
- `ai-config mcp status`
- `ai-config tasks sync`

### 7.5 Text Quality Commands

- `ai-config text check`
- `ai-config text fix`
- `ai-config text doctor`

### 7.6 Questionnaire Commands

- `ai-config questions run`
- `ai-config questions status`
- `ai-config questions reset --profile <name>`

### 7.7 Ignore Commands

- `ai-config ignore add <pattern>`
- `ai-config ignore remove <pattern>`
- `ai-config ignore list`
- `ai-config ignore check <path>`

---

## 8. Resolution and Precedence Model

Precedence order:
- Base preset
- Stack preset
- Org preset
- Project layer
- Custom overrides
- Enforced policies

Special rules:
- `ignore.local` can extend ignore behavior for project-specific needs.
- Enforced policies can deny unsafe overrides.
- Every final key in `resolved` must include source provenance in explain output.

---

## 9. Scalability and Extensibility Guarantees

- Module registry (`modules.yaml`) defines what modules are active and compatible.
- New modules can be introduced without forced re-init.
- Migrations are explicit and tracked in state.
- Backward compatibility is validated before applying updates.
- Partial capability mode is allowed when optional modules are absent.

---

## 10. Non-Goals (for this stage)

- No implementation details.
- No technology stack selection.
- No low-level file schema definitions.
- No execution engine internals.

---

## 11. Summary

This specification defines `ai-config` as:
- A modular AI agent configuration platform.
- A context-complete project bootstrap system.
- A policy-driven and explainable resolver.
- A task-capable operation model with optional MCP integration.
- A multilingual-safe text quality layer.
- A sync-first, future-proof structure for evolving AI workflows.

---

## 12. v1 Release Scope (MVP Contract)

This section defines the minimum mandatory scope for the first release.

### 12.1 Mandatory v1 Modules

Required in v1:
- `project`
- `context`
- `rules` (including `ignore`)
- `instructions`
- `custom`
- `state`
- `text` (minimum subset)
- `questions` (minimum subset)

Optional in v1 (can be feature-flagged):
- `agents` (advanced role orchestration)
- `tasks` (full lifecycle and MCP sync)

v1 recommendation:
- Include `tasks` in local mode only.
- Keep `agents` as static role profiles (no complex workflow engine yet).

### 12.2 Minimum v1 Folder Contract

Minimum required:
- `./ai/ai.yaml`
- `./ai/project.yaml`
- `./ai/lock.yaml`
- `./ai/resolved.yaml`
- `./ai/modules.yaml`
- `./ai/rules/ignore.yaml`
- `./ai/context/sources.yaml`
- `./ai/context/structure-map.yaml`
- `./ai/text/encoding.yaml`
- `./ai/text/locale.yaml`
- `./ai/questions/config.yaml`
- `./ai/questions/answers.yaml`
- `./ai/instructions/system.md`
- `./ai/custom/overrides.yaml`
- `./ai/custom/ignore.local.yaml`
- `./ai/state/sync-state.yaml`

### 12.3 Mandatory v1 Commands

Core:
- `ai-config init`
- `ai-config sync`
- `ai-config resolve`
- `ai-config validate`
- `ai-config explain`

Ignore:
- `ai-config ignore add <pattern>`
- `ai-config ignore remove <pattern>`
- `ai-config ignore list`

Questions/Text:
- `ai-config questions run`
- `ai-config questions status`
- `ai-config text check`

Tasks (v1 basic, local only):
- `ai-config tasks enable`
- `ai-config tasks disable`
- `ai-config tasks intake "<text>"`
- `ai-config tasks list`

### 12.4 v1 Non-Mandatory (Phase 2+)

Move to later phases:
- MCP bi-directional task sync.
- Advanced multi-agent workflow execution.
- Auto text fix with aggressive transforms.
- Complex policy packs and organization governance templates.
- Full migration framework for major schema rewrites.

### 12.5 v1 Acceptance Criteria

- `init` creates valid `./ai` and fills project context from scan + questionnaire.
- Agent can read `resolved` and operate with enough project context.
- Ignore rules are applied and verifiable.
- User custom content persists after `sync`.
- `validate` detects core conflicts and missing mandatory fields.
- Text checks detect encoding/locale mismatch risks.
- Task mode can be turned on/off and create structured local tasks from user text.

---

## 13. AI Agent CLI Execution Model (`via tool-calling`)

This section fixes how AI agents can invoke `ai-config` commands through tool-calling.

### 13.1 Decision

v1 execution mode:
- Agent can call `ai-config` commands through tool-calling.
- Execution policy is `human-in-the-loop` by default.
- Only explicitly safe commands are auto-runnable.

Rationale:
- Reduces manual friction for read/check flows.
- Prevents destructive or unexpected project mutations.
- Preserves user control while enabling automation.

### 13.2 Invocation Contract

Agent execution path:
1. Agent determines intent (check, explain, mutate, sync, etc.).
2. Agent maps intent to a concrete CLI command.
3. Policy engine evaluates command against permission matrix.
4. Command is:
   - auto-executed, or
   - gated behind user confirmation, or
   - denied.
5. Result is returned to agent and user with trace metadata.

Audit requirement:
- Each agent-triggered command must be logged in `state/audit-log.yaml` with:
  - actor (`agent` or `user`)
  - command
  - timestamp
  - decision (`auto-run`, `confirmed`, `denied`)
  - outcome (`success`, `failed`)

### 13.3 Permission Matrix (v1)

Quick reference:

| Command | Mode | Reason | Risk |
|---|---|---|---|
| `ai-config resolve` | Auto-run | Read/build resolved state | Low |
| `ai-config validate` | Auto-run | Non-destructive consistency checks | Low |
| `ai-config explain` | Auto-run | Read-only provenance analysis | Low |
| `ai-config tasks intake "<text>"` | Auto-run | Structured task creation from prompt | Low |
| `ai-config tasks list` | Auto-run | Read-only task board view | Low |
| `ai-config text check` | Auto-run | Non-mutating text quality diagnostics | Low |
| `ai-config questions status` | Auto-run | Read-only questionnaire progress | Low |
| `ai-config ignore list` | Auto-run | Read-only ignore rules listing | Low |
| `ai-config ignore check <path>` | Auto-run | Read-only path evaluation | Low |
| `ai-config init` | Confirm | Creates and populates project config tree | High |
| `ai-config sync` | Confirm | Updates managed config layers and migrations | High |
| `ai-config update` | Confirm | Version changes may alter behavior | High |
| `ai-config questions run` | Confirm | May alter onboarding answers/config quality | Medium |
| `ai-config text fix` | Confirm | Mutates text-related config/content | Medium |
| `ai-config ignore add <pattern>` | Confirm | Changes scan surface for agent context | Medium |
| `ai-config ignore remove <pattern>` | Confirm | Can expose unintended files to agent | Medium |
| `ai-config tasks enable` | Confirm | Changes execution model to task-first | Medium |
| `ai-config tasks disable` | Confirm | Disables structured task governance | Medium |
| `ai-config tasks status <task-id> <status>` | Confirm | Mutates task lifecycle state | Medium |
| `ai-config mcp connect <provider>` | Confirm | External integration and credential surface | High |
| `ai-config mcp disconnect <provider>` | Confirm | Integration state mutation | Medium |
| `ai-config tasks sync` | Confirm | Cross-system task synchronization side effects | High |
| Any non-approved command | Deny | Outside trusted v1 execution surface | Variable |

Auto-run allowed:
- `ai-config resolve`
- `ai-config validate`
- `ai-config explain`
- `ai-config tasks intake "<text>"`
- `ai-config tasks list`
- `ai-config text check`
- `ai-config questions status`
- `ai-config ignore list`
- `ai-config ignore check <path>`

Require user confirmation:
- `ai-config init`
- `ai-config sync`
- `ai-config update`
- `ai-config questions run`
- `ai-config text fix`
- `ai-config ignore add <pattern>`
- `ai-config ignore remove <pattern>`
- `ai-config tasks enable`
- `ai-config tasks disable`
- `ai-config tasks status <task-id> <status>`
- `ai-config mcp connect <provider>`
- `ai-config mcp disconnect <provider>`
- `ai-config tasks sync`

Denied for autonomous agent execution (v1):
- Any command outside the allowed surface.
- Any future destructive/cleanup commands unless explicitly approved by policy.

### 13.4 User Experience Rules

- Agent should propose command execution in plain language before confirmation-required actions.
- Confirmation message must include:
  - what will change
  - where it will change
  - rollback/recovery hint (if applicable)
- If command is denied by policy, agent must provide an alternative safe path.

### 13.5 Future Evolution (Phase 2+)

- Policy-based auto-run profiles by trust level (`strict`, `balanced`, `automation-first`).
- Fine-grained command scopes by module.
- Signed approval workflows for organization-critical commands.
