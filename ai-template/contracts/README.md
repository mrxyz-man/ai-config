# Contracts Module

This module defines operational contracts for `.ai` modules and workflows.

## Purpose

- Make module behavior deterministic for AI agents.
- Reduce ambiguity for users and maintainers.

## What to store here

- `module-contract-template.md`: reusable schema for module contracts.
- `core-contract.md`: baseline contract for core bootstrap behavior.
- Additional module contracts as needed (`<module>-contract.md`).

## Contract shape (recommended)

- `trigger`: when module must start.
- `inputs`: required files/fields.
- `outputs`: produced artifacts/updates.
- `blocking_conditions`: when execution must stop.
- `exit_conditions`: completion criteria.
- `failure_mode`: fallback behavior.
