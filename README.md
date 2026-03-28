# ai-config

Configuration and synchronization system for AI agents in software projects.

## Requirements

- Node.js `24.14.0` (or compatible `24.x` as constrained by `package.json`)
- npm `11+`

## Quick Start

```bash
npm install
npm run check
npm run dev
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
