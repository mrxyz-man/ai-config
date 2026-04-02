# Memory Module

This module stores reusable project context for AI-assisted work.

## Structure

- `profile.yaml`: memory policy and conflict rules.
- `long-term/`: stable knowledge (decisions and lessons).
- `short-term/`: temporary working context and open questions.
- `custom/`: project-specific memory extensions.

## Principles

- Long-term memory stores confirmed knowledge only.
- Short-term memory is temporary and can be pruned.
- Each entry should include source references and confidence level.
- Project files remain source-of-truth in case of conflicts.
- Do not store secrets or sensitive personal data.
