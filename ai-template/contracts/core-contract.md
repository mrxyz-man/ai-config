# Core Contract

Module: `core`
Version: `1`

## Trigger
- MUST start at the beginning of every agent session.

## Inputs
- `.ai/manifest.yaml`
- `.ai/config.yaml`
- `.ai/modules.yaml`

## Outputs
- Session-level execution plan aligned with enabled modules.

## Blocking Conditions
- Missing or invalid `manifest/config/modules` files.
- Invalid management markers in manifest.

## Exit Conditions
- Source-of-truth files loaded successfully.
- Enabled modules and policy constraints are known.

## Failure Mode
- Stop execution and report structured diagnostics.
- Ask user for corrective action before continuing.
