# Rollback Plan: v0.1.0

## Goal

Provide a safe, deterministic rollback path if release `v0.1.0` introduces a blocking regression.

## Rollback Targets

- Release tag: `v0.1.0`
- Previous stable reference policy:
  - Use the latest known-good pre-release tag captured before release cut.
  - Recommended naming: `v0.1.0-preflight`.

## Pre-Release Requirement

Before publishing `v0.1.0`, create and push preflight tag from the last known-good commit:

```bash
git tag v0.1.0-preflight
git push origin v0.1.0-preflight
```

This tag is the primary rollback anchor.

## Rollback Triggers

- Critical CLI failure in core flow (`init|sync|resolve|validate|explain`)
- Data integrity issue in `./ai` managed state
- Invalid mutation of `./ai/custom/**`
- Repeated CI failures across matrix targets after release

## Rollback Procedure

1. Announce rollback decision and freeze further release commits.
2. Checkout rollback anchor:

```bash
git checkout v0.1.0-preflight
```

3. Create rollback hotfix branch:

```bash
git checkout -b codex/rollback-v0.1.0
```

4. Re-run gate:

```bash
npm ci
npm run check
```

5. Publish rollback release/tag according to project release policy.

## Operational Notes

- `sync` preserves `./ai/custom/**`; rollback should not overwrite user custom files.
- If release partially modified managed files, run:

```bash
ai-config sync --confirm
```

on rollback build to restore managed baseline.

## Post-Rollback Actions

1. Open incident document with root cause and affected scope.
2. Add regression tests that reproduce the rollback trigger.
3. Prepare patched forward release (`v0.1.1` or equivalent) only after full gate passes.
