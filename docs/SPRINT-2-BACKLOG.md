# Sprint 2 Backlog (Completed)

## Goal

Move from foundation + first vertical slice to feature-complete v1 workflow for initialization, sync, explainability, tasks, text, questions, and MCP prep.

## Completed Items

1. `init` implementation (P0)
- project scan baseline
- questionnaire run integration
- initial resolved generation
- output envelope and exit-code compliance
 - status: done

2. `sync` implementation (P0)
- managed layer updates
- preserve `./ai/custom/**` invariant
- drift/migration report output
- policy + audit integration (already wired)
 - status: done

3. `explain` implementation (P0)
- provenance trace for resolved keys/modules
- `--key` and `--module` filters
- JSON/human output parity
 - status: done

4. Resolver enhancement (P1)
- strict precedence enforcement (`base < stack < org < project < custom < enforced`)
- richer merge semantics and conflict reporting
 - status: done (custom override precedence + enforced invariants in v1)

5. Validation expansion (P1)
- scope support (`schemas|rules|text|tasks|questions`)
- stronger semantic checks for task/status and text policy
 - status: done

6. Audit hardening (P1)
- retention policy
- event schema contract tests
- append safety in repeated command runs
 - status: done

7. MCP integration prep (P2)
- provider interface contract
- local/hybrid mode toggles
- initial custom provider skeleton
 - status: done

8. Tasks/Text/Questions module minimums (M5 scope extension)
- `tasks enable|disable|intake|list`
- `text check`
- `questions status|run`
- status: done

## Definition of Done (Sprint 2)

- `init`, `sync`, `explain` are implemented and covered by CLI e2e tests.
- `resolve`/`validate`/`sync` output contract is stable in JSON mode.
- Policy and audit hooks are exercised across implemented commands.
- Documentation and examples are updated for end-to-end v1 flow.

Status: achieved.
