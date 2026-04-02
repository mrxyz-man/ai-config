# Orchestration Module

This module defines how tasks move through roles, skills, and quality gates.

## Structure

- `orchestration.yaml`: global lifecycle, execution, and escalation policy.
- `workflows/`: task-type specific workflow definitions.
- `tasks/`: local task board directories.
- `custom/`: project-specific workflow extensions.

## Principles

- One active workflow per task.
- Explicit step transitions and handoffs.
- Quality gates required before completion.
- Controlled retries and clear escalation path.
- If a workflow step role is disabled or unavailable, use step-level `fallback_role`.
