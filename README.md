# ai-config

`ai-config` is a CLI for bootstrapping and synchronizing a unified AI configuration layer (`./.ai`) in software projects.

## What It Does

- initializes `./.ai` from `./ai-template`
- validates config integrity and module readiness
- synchronizes managed configs with template updates
- creates AI bridge files (`AGENTS.md` / `CLAUDE.md`)

## Install/Run

Use without global install:

```bash
npx @mrxyz/ai-config@latest init --cwd <project-path>
```

## Commands

```bash
npx @mrxyz/ai-config@latest init --cwd <project-path>
npx @mrxyz/ai-config@latest validate --cwd <project-path>
npx @mrxyz/ai-config@latest sync --cwd <project-path>
npx @mrxyz/ai-config@latest sync --cwd <project-path> --no-dry-run
```

## Requirements

- Node `24.14.0+`
- npm `11+`

## Documentation

- User guide: [docs/USER-GUIDE.md](docs/USER-GUIDE.md)
- Config reference: [docs/CONFIG-REFERENCE.md](docs/CONFIG-REFERENCE.md)
- E2E manual cases: [E2E-TEST-CASES.md](E2E-TEST-CASES.md)

## Development

```bash
npm install
npm run check
npm run build
node dist/cli.js init --cwd <project-path>
```
