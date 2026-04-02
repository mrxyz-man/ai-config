# Memory Module

This module stores reusable project context for AI-assisted work.

## Structure

- `profile.yaml`: memory policy and conflict rules.
- `long-term/`: stable knowledge (decisions and lessons).
- `short-term/`: temporary working context and open questions.
- `custom/`: project-specific memory extensions.

## Principles

- Long-term memory MUST store confirmed knowledge only.
- Short-term memory MUST be treated as temporary and can be pruned.
- Each entry MUST include source references and confidence level.
- Project files MUST remain source-of-truth in case of conflicts.
- Memory MUST NOT store secrets or sensitive personal data.
