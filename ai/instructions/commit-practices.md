# Commit Practices for AI Agent

## Goal

Create clean, reviewable, and low-risk commits.

## Rules

- Keep commits atomic: one logical change per commit.
- Use clear commit messages in imperative mood.
- Prefer Conventional Commits style:
  - `feat: ...`
  - `fix: ...`
  - `chore: ...`
  - `docs: ...`
  - `refactor: ...`
  - `test: ...`
- Include only relevant files; avoid unrelated noise.
- Run quality gate before commit: `npm run check`.
- Do not commit secrets (`.env`, keys, tokens).
- Do not commit generated or temporary files unless explicitly required.
- If schema/contracts changed, include matching docs update in the same commit.

## Commit Message Template

`<type>: <short summary>`

Optional body:
- what changed
- why it changed
- notable risks or follow-up

