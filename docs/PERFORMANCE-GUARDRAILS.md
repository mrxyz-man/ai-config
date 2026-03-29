# Performance Guardrails

This document defines practical guardrails for running `ai-config` on large repositories.

## Text Check Guardrails

`ai-config text check` applies runtime limits to keep scans predictable:

- Per-file size limit: `512 KB`
- Maximum scanned files per run: `4000`
- Maximum total scanned text size per run: `32 MB`

When limits are reached, scan stops early and emits warnings in command output.

## Recommended Usage

1. Use changed-only mode for daily workflow:

```bash
ai-config text check --changed-only
```

2. Use full repository scan in CI/release gates:

```bash
ai-config text check
```

3. Keep ignore rules current:
- maintain `ai/rules/ignore.yaml`
- exclude generated artifacts and dependency trees
- allowlist only essential paths

4. Split large generated content outside scanned text paths when possible.

## CI Guidance

- Keep `npm run check` as release gate.
- If scan warnings indicate limits are frequently reached:
  - tighten ignore patterns
  - move heavy generated docs/artifacts to ignored paths
  - prefer changed-only checks on developer machines
