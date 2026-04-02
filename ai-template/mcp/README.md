# MCP Module

This module defines how AI agents should use MCP providers in a safe and predictable way.

## Files

- `registry.yaml`: provider registry (capabilities, trust, operations, priority).
- `policies.yaml`: selection policy, guardrails, confirmation and fallback logic.
- `scenarios.yaml`: practical task-oriented MCP usage playbooks.
- `custom/`: project-specific provider and policy extensions.

## Principles

- Capability-first, not vendor-first.
- MCP usage is optional; no MCP must not block baseline workflow.
- Read-first policy by default.
- Write operations require explicit confirmation.
- Every scenario must have a fallback path.
