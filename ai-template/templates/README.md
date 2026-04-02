# Templates Module

This directory contains canonical templates for standard AI artifacts.

## Purpose

- Keep artifact structure consistent across projects.
- Help agents generate predictable files.
- Reduce format drift for future validation and sync.

## Usage Rules

1. Treat template structure as stable unless schema version changes.
2. Agent can enrich content, but should keep required fields.
3. Prefer copying a template and filling values instead of inventing new layout.

## Included Templates

- `qa-template.yaml`: canonical structure for question/answer collection and answer routing.
- `skill-template.yaml`: canonical structure for reusable skill definitions.
- `memory-decision-template.md`: template for long-term decision records.
- `memory-lesson-template.md`: template for long-term lessons learned records.
- `memory-session-template.md`: template for short-term session notes.
- `memory-open-question-template.md`: template for unresolved question records.
- `task-template.yaml`: canonical structure for local orchestration task files.
