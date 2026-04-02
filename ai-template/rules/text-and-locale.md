# Text and Locale Rules

Core rules:
- Source of truth for user-facing language: `.ai/manifest.yaml -> ui_locale`.
- All questions in `.ai/qa.yaml` must be generated in `ui_locale`.
- Do not switch QA/user-facing language unless user explicitly asks.
- Keep file encoding UTF-8.
- Preserve terminology consistency from project glossary and requirements.

Project-specific additions:
- Add repository-specific translation/localization constraints below.
