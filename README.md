# ai-config

AI configuration bootstrap CLI for development projects.

Current behavior:
- CLI commands: `init`, `validate`
- command generates `./.ai` from `./ai-template`
- `init` supports both interactive wizard and non-interactive mode for CI
- interactive `init` asks AI-agent (`codex|claude|both|other`) and UI locale (`en|ru|custom`)
- `init` writes `.ai/manifest.yaml` with bootstrap metadata:
  - `schema_version`, `created_at`, `selected_agent`, `ui_locale`, `template_version`,
    `qa_version`, `qa_completed`, `qa_completed_at`
- bridge files are created based on selected agent:
  - `AGENTS.md` for Codex/generic
  - `CLAUDE.md` for Claude
- template includes modular structure:
  - `project`, `rules`, `agents`, `skills`, `mcp`, `memory`, `orchestration`, `logs`, `templates`
- `validate` performs v2 checks:
  - required `.ai` root files
  - YAML object validation for `manifest/config/modules`
  - enabled module paths existence
  - cross-module checks (`skills.required_modules`, workflow `role`/`fallback_role`)

Run:

```bash
npm install
npm run build
node dist/cli.js init --cwd <project-path>
node dist/cli.js init --cwd <project-path> --non-interactive --agent codex --ui-locale en
node dist/cli.js validate --cwd <project-path>
```

Requirements:
- Node `24.14.0+`
- npm `11+`

Exit codes:
- `0` success
- `1` runtime/validation error
- `2` usage/input error
