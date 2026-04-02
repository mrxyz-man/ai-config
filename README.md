# ai-config

AI configuration bootstrap CLI for development projects.

Current behavior:
- CLI commands: `init`, `validate`, `sync`
- generates and maintains `./.ai` from `./ai-template`
- `init` supports interactive wizard and non-interactive CI mode
- interactive `init` asks:
  - AI-agent (`codex|claude|both|other`)
  - UI locale (`en|ru|custom`)
  - profile (`minimal|standard|full`)
  - enabled modules
  - task mode (`off|assisted|enforced`)
  - questionnaire toggle (`true|false`)
  - MCP providers (if `mcp` module is enabled)
  - final confirmation
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
- init config matrix is documented in `INIT-CONFIG-MATRIX.md`.

`init` applies resolved options into `.ai/*`:
- `.ai/config.yaml`:
  - `profile.name`
  - `behavior.task_mode`
  - `behavior.questionnaire_on_init`
- `.ai/modules.yaml`:
  - `modules[*].enabled`
- `.ai/qa.yaml`:
  - `status` (`in_progress` or `not_started`)
- `.ai/mcp/registry.yaml`:
  - `defaults.enabled_by_default`
  - `providers[*].enabled`
- module-level enabled toggles:
  - `.ai/orchestration/orchestration.yaml`
  - `.ai/memory/profile.yaml`
  - `.ai/logs/policy.yaml`
- post-init internal validation is executed automatically (manifest markers + required files + core config consistency).

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

Extended non-interactive init:

```bash
npx @mrxyz/ai-config@latest init \
  --cwd <project-path> \
  --non-interactive \
  --agent codex \
  --ui-locale en \
  --profile standard \
  --modules core,qa,project,rules,agents,skills,templates,mcp \
  --task-mode assisted \
  --questionnaire-on-init true \
  --enable-mcp-providers context7,chrome-devtools
```

Rules:
- dependency checks are enforced in non-interactive mode:
  - `skills` requires `rules` and `templates`
  - `orchestration` requires `agents`
  - MCP providers require `mcp` module
- dependency auto-fix is used in interactive mode (with warnings).

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

E2E manual checklist:
- `E2E-TEST-CASES.md`

Exit codes:
- `0` success
- `1` runtime/validation error
- `2` usage/input error
