# ai-config

Configuration and synchronization system for AI agents in software projects.

## Requirements

- Node.js `24.14.0` (or compatible `24.x` as constrained by `package.json`)
- npm `11+`

## Quick Start

```bash
npm install
npm run check
npm run dev -- --help
```

## Main Scripts

- `npm run dev` - run CLI entrypoint in dev mode
- `npm run check` - run typecheck + lint + build + test
- `npm run lint:fix` - auto-fix lint/style issues
- `npm run clean` - remove build artifacts

## Extensibility Skeleton

- Commands are registered via command registry (`src/commands/builtins.ts` + `src/core/command-registry.ts`).
- Modules are registered via module registry (`src/modules/builtin-modules.ts` + `src/core/module-registry.ts`).
- Core service contracts are isolated as ports (`src/core/ports.ts`), so resolver/validator implementations can evolve without rewriting CLI wiring.
- Singleton boundaries are explicitly defined in [docs/SINGLETON-BOUNDARIES.md](./docs/SINGLETON-BOUNDARIES.md), including test reset hooks.
- Tool-calling policy and audit hooks are enforced through dedicated services (`ToolCallingPolicyGate`, `YamlAuditLogger`).

## Implemented Command Surface

- Core:
  - `init`
  - `sync`
  - `resolve`
  - `validate`
  - `explain`
- Tasks:
  - `tasks enable`
  - `tasks disable`
  - `tasks intake "<text>"`
  - `tasks plan <task-id>`
  - `tasks status <task-id> <status>`
  - `tasks list [--status]`
  - `tasks sync`
- Text:
  - `text check [--changed-only]`
- Questions:
  - `questions status`
  - `questions run [--lang|--profile|--answer|--non-interactive]`
  - `questions ask [--lang|--profile|--answer|--non-interactive]`
- MCP:
  - `mcp status`
  - `mcp connect custom [--mode local|hybrid|remote-first]`
  - `mcp disconnect`

## Status References

- Sprint 1 handoff: [docs/SPRINT-1-HANDOFF.md](./docs/SPRINT-1-HANDOFF.md)
- Sprint 2 handoff: [docs/SPRINT-2-HANDOFF.md](./docs/SPRINT-2-HANDOFF.md)
- Sprint 2 backlog: [docs/SPRINT-2-BACKLOG.md](./docs/SPRINT-2-BACKLOG.md)
- CLI contracts: [docs/CLI-CONTRACTS-V1.md](./docs/CLI-CONTRACTS-V1.md)
- RC checklist: [docs/V1-RC-CHECKLIST.md](./docs/V1-RC-CHECKLIST.md)

## Current Limitations

- `sync --with-migrations` currently accepts migration flags but does not execute full versioned migration steps yet.
- MCP provider model is `custom`-first and user-managed; production adapters beyond `custom` are not bundled.
- Command surface from long-term spec (`ignore`, `text fix/doctor`, `questions reset`, `agents`, `doctor`, `diff`) is not part of current v1 implemented scope.
