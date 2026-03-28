# Sprint 1 Handoff

## Delivered

- Foundation project setup with Node 24 + npm 11 constraints.
- TypeScript + ESLint 9 + stylistic rules (`semi`, `indent=2`, `quote-props=as-needed`).
- CI quality gate (`npm run check`).
- Modular architecture skeleton:
  - command registry
  - module registry
  - app context wiring
  - service ports
- Config contracts and validation for core `./ai` files.
- Working `validate` command with v1 output envelope (`human/json`).
- Working `resolve` command:
  - deterministic build
  - `ai/resolved.yaml` write
  - checksum output
- Tool-calling policy gate and audit logger hooks.
- Unit + contract + CLI e2e smoke coverage.

## Known Limitations

- `init`, `sync`, `explain` are still stubs (policy-aware but behavior not implemented).
- Resolver currently uses baseline v1 layer merge only; advanced inheritance/merge strategy is not yet implemented.
- Audit logger currently appends YAML events locally; no retention/pruning policy yet.
- No external MCP task sync yet (local mode only).

## Operational Runbook

```bash
npm install
npm run check
npm run dev -- validate
npm run dev -- resolve
```

Useful contract checks:

```bash
npm run dev -- validate --format json
npm run dev -- resolve --format json
npm run dev -- sync --format json      # expected policy block without --confirm
```

## Handoff Notes

- Command and module expansion should be done via registries, not by editing dispatcher branching.
- Singleton policy and test reset behavior are defined in `docs/SINGLETON-BOUNDARIES.md`.
- Prefer adding new runtime behavior behind service ports to keep CLI wiring stable.

