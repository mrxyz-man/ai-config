# Singleton Boundaries and Guardrails

This document defines singleton usage policy for `ai-config` v1.

## Process-Level Singletons (Allowed)

Use process singleton only for immutable or registry-style runtime wiring:
- `commandRegistry`
- `moduleRegistry`
- top-level service instances used by CLI wiring (`validator`, `resolver`)

Lifecycle assumption:
- one Node process runs one CLI invocation context
- singleton scope is process-local only (never cross-process)

## Fresh Instances (Required, Non-Singleton)

Never keep global singleton state for:
- command input options
- validation reports and diagnostics
- per-command temporary data
- mutable request/session state

Reason:
- avoids hidden cross-command coupling
- keeps tests deterministic and isolated

## Test-Friendly Construction Path

The architecture provides:
- `createAppContext()` for fresh dependency graph in tests or custom runners
- `getProcessSingletonAppContext()` for production CLI wiring
- `resetProcessSingletonAppContextForTests()` to clear singleton between tests

## Anti-Patterns (Do Not Use)

- hidden mutable module-level state that changes command behavior
- ad-hoc singleton objects without explicit lifecycle policy
- branching CLI wiring that bypasses registries and context factory

