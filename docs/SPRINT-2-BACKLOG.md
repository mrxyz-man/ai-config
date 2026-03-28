# Sprint 2 Backlog (Proposed)

## Goal

Move from foundation + first vertical slice to feature-complete v1 workflow for initialization, sync, and explainability.

## Priority Items

1. `init` implementation (P0)
- project scan baseline
- questionnaire run integration
- initial resolved generation
- output envelope and exit-code compliance

2. `sync` implementation (P0)
- managed layer updates
- preserve `./ai/custom/**` invariant
- drift/migration report output
- policy + audit integration (already wired)

3. `explain` implementation (P0)
- provenance trace for resolved keys/modules
- `--key` and `--module` filters
- JSON/human output parity

4. Resolver enhancement (P1)
- strict precedence enforcement (`base < stack < org < project < custom < enforced`)
- richer merge semantics and conflict reporting

5. Validation expansion (P1)
- scope support (`schemas|rules|text|tasks|questions`)
- stronger semantic checks for task/status and text policy

6. Audit hardening (P1)
- retention policy
- event schema contract tests
- append safety in repeated command runs

7. MCP integration prep (P2)
- provider interface contract
- local/hybrid mode toggles
- initial GitLab adapter skeleton

## Definition of Done (Sprint 2)

- `init`, `sync`, `explain` are implemented and covered by CLI e2e tests.
- `resolve`/`validate`/`sync` output contract is stable in JSON mode.
- Policy and audit hooks are exercised across implemented commands.
- Documentation and examples are updated for end-to-end v1 flow.

