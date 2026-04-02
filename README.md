# ai-config

AI configuration bootstrap CLI for development projects.

Current behavior:
- CLI commands: `init`, `validate`, `sync`
- generates and maintains `./.ai` from `./ai-template`
- `init` supports interactive wizard and non-interactive CI mode
- interactive `init` asks AI-agent (`codex|claude|both|other`) and UI locale (`en|ru|custom`)
- bridge files are created by selected agent:
  - `AGENTS.md` for Codex/generic
  - `CLAUDE.md` for Claude
- `manifest.yaml` includes management markers:
  - `generator: ai-config`
  - `managed_by: ai-config`
- template includes modular structure:
  - `project`, `rules`, `agents`, `skills`, `mcp`, `memory`, `orchestration`, `logs`, `templates`

Preflight states:
- `fresh`: `./.ai` is missing
- `managed`: `./.ai` is managed by `ai-config`
- `foreign`: `./.ai` exists but is not managed by `ai-config`
- `mixed`: managed `./.ai` plus foreign markers (for example legacy `./ai`)

Init contract:
- `init` is bootstrap-oriented; `sync` is reserved for managed structure updates.
- preflight routing design is documented in `INIT-SYNC-CONTRACT.md`.

`validate` checks:
- required `.ai` root files
- YAML object validity for `manifest/config/modules`
- manifest management markers and core fields
- enabled module path existence
- cross-module links (`skills.required_modules`, workflow `role`/`fallback_role`)

`sync` modes:
- default (`--dry-run`): plans changes only
- apply (`--no-dry-run`): applies safe changes only
  - creates missing files/directories
  - applies safe updates (`.aiignore`, `modules.yaml`)
  - does not overwrite conflicts
- conflicts view (`--conflicts-only`): returns only `conflict_file` actions and recommendations (dry-run only)

Quick Start (recommended):

```bash
npx @mrxyz/ai-config@latest init --cwd <project-path>
npx @mrxyz/ai-config@latest init --cwd <project-path> --non-interactive --agent codex --ui-locale en
npx @mrxyz/ai-config@latest validate --cwd <project-path>
npx @mrxyz/ai-config@latest sync --cwd <project-path>
npx @mrxyz/ai-config@latest sync --cwd <project-path> --no-dry-run
npx @mrxyz/ai-config@latest sync --cwd <project-path> --conflicts-only
```

Requirements:
- Node `24.14.0+`
- npm `11+`

Development (local repository):

```bash
npm install
npm run build
node dist/cli.js init --cwd <project-path>
node dist/cli.js validate --cwd <project-path>
node dist/cli.js sync --cwd <project-path>
```

Exit codes:
- `0` success
- `1` runtime/validation error
- `2` usage/input error
