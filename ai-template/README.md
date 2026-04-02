# .ai Configuration

This folder is the single configuration layer for AI-agent work in the project.

## What Is Here

- `manifest.yaml`: System-generated bootstrap metadata (do not edit manually unless needed).
  - includes QA lifecycle flags: `qa_version`, `qa_completed`, `qa_completed_at`
- `config.yaml`: Global behavior and safety defaults.
- `modules.yaml`: Registry of project modules and their enabled state.
- `.aiignore`: Files and directories that AI context loaders should skip.
- `qa.yaml`: User/project answers for better context hydration.

## Ownership Matrix

- System-managed (created/updated by `ai-config init`):
  - `manifest.yaml`
  - bridge files in project root (`AGENTS.md` / `CLAUDE.md`)
- User/Agent-managed:
  - `.aiignore`
  - `qa.yaml`
- Hybrid (system defaults, then project customization):
  - `config.yaml`
  - `modules.yaml`

## Recommended Workflow

1. Run `ai-config init` in the project root.
2. Confirm `manifest.yaml` values (`selected_agent`, `ui_locale`).
3. Adjust `.aiignore` for project-specific noise.
4. Keep `qa.yaml` as the source of questions/answers.
5. If `manifest.qa_completed: false`, agent should ask only missing/incomplete questions and update `qa.yaml`.
6. After all required answers are complete, set:
   - `manifest.qa_completed: true`
   - `manifest.qa_completed_at: <ISO datetime>`
7. Enable modules in `modules.yaml` as the project grows.

## Validation

Run:

```bash
ai-config validate
```

Use this command after bootstrap and after major config changes.
