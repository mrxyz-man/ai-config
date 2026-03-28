# AI Runtime Config

This folder is the single source of truth for AI-agent behavior in this project.

Key points:
- `resolved.yaml` is the final agent-facing layer.
- `custom/*` is user-owned and must never be overwritten by sync.
- `rules/*` defines hard constraints and scanning boundaries.
- `agents/*` defines role behavior, patterns, and anti-patterns.

