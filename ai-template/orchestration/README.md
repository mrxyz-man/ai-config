# Orchestration Module

This module defines how tasks move through roles, skills, and quality gates.

## Structure

- `orchestration.yaml`: global lifecycle, execution, and escalation policy.
- `workflows/`: task-type specific workflow definitions.
- `tasks/`: local task board directories.
- `custom/`: project-specific workflow extensions.

## Principles

- One active workflow per task MUST be enforced.
- Step transitions and handoffs MUST be explicit.
- Quality gates MUST pass before completion.
- Retries MUST be controlled and escalation path MUST be clear.
- If a workflow step role is disabled or unavailable, step-level `fallback_role` MUST be used.
