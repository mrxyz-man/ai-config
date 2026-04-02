# Init/Sync Contract (I1)

Status: accepted design contract for implementation.

## Purpose

Define strict responsibility split between `init` and `sync` to avoid destructive or ambiguous behavior.

## Command Responsibilities

- `init`: first-time bootstrap only.
  - Creates `.ai` from template.
  - Generates bridge files.
  - Writes bootstrap manifest metadata.
- `sync`: update/upgrade existing managed `.ai`.
  - Compares template versions.
  - Applies safe structural updates according to ownership/merge policy.
  - Produces sync report.

## Preflight States

The preflight detector must classify project state into one of the following:

1. `no_ai_config`
   - `.ai` is missing.
2. `managed_ai_config`
   - `.ai/manifest.yaml` exists and has ai-config signature.
3. `foreign_or_legacy_ai`
   - legacy/foreign AI config exists (for example `./ai` or `.ai` without ai-config signature).
4. `broken_ai_config`
   - `.ai` exists but required managed metadata/files are missing or invalid.

## Expected Routing Matrix

1. `init` + `no_ai_config`
   - proceed with bootstrap.
2. `init` + `managed_ai_config`
   - do not re-bootstrap.
   - return guidance: use `sync`.
3. `init` + `foreign_or_legacy_ai`
   - trigger migration preview flow and request confirmation.
4. `init` + `broken_ai_config`
   - return diagnostics and guidance (repair, migrate, or force with explicit confirmation).

## Safety Rules

- Never delete legacy/foreign config automatically.
- Never overwrite user-authored bridge content silently.
- Any destructive action requires explicit confirmation.
- `--force` must be deliberate and clearly warned.

## Signature Requirements

Managed config must be identifiable via manifest fields (or equivalent contract markers):

- `generator: "ai-config"`
- `managed_by: "ai-config"`
- `schema_version`
- `template_version`

## UX Requirements

- Error/help text must always include a concrete next step.
- For `managed_ai_config`, prefer message: "Already initialized. Use sync."
- Maintain stable exit codes:
  - `0` success
  - `1` runtime/validation error
  - `2` usage/input error
