# E2E Test Cases

This checklist is for manual end-to-end verification of `ai-config` on a real project using a local build (`dist/cli.js`), not the published npm package.

Path placeholders used below:
- `<repo-root>`: local path to the `ai-config` repository.
- `<target-project-root>`: local path to the project under test.

## Prerequisites
- Build CLI locally:
```bash
npm run build
```
- CLI path:
`<repo-root>/dist/cli.js`
- Test sandbox (example):
`<target-project-root>/_ai-config-e2e`

## Case 1: Fresh Project
1. Create empty folder for test case.
2. Run:
```bash
node <repo-root>/dist/cli.js validate --cwd <case-path> --format json
node <repo-root>/dist/cli.js sync --cwd <case-path> --format json
```
Expected:
- `ok: false`
- `preflightState: "fresh"`
- error with `Run init first`
3. Run init:
```bash
node <repo-root>/dist/cli.js init --cwd <case-path> --non-interactive --agent codex --ui-locale en --format json
```
Expected:
- `ok: true`
- `preflightState: "fresh"`
- `.ai` created + bridge file
4. Re-run validate/sync:
Expected:
- `validate`: `ok: true`, `preflightState: "managed"`
- `sync`: `ok: true`, no pending actions in clean state

## Case 2: Managed Drift (create/update/conflict)
1. Initialize managed case (`init`).
2. Make drift:
- delete `.ai/project/README.md` (create_file expected)
- modify `.ai/.aiignore` (update_file expected)
- modify `.ai/README.md` (conflict_file expected)
3. Run dry-run sync:
```bash
node <repo-root>/dist/cli.js sync --cwd <case-path> --format json
```
Expected:
- `summary.createFiles > 0`
- `summary.updateFiles > 0`
- `summary.conflictFiles > 0`
- non-empty `recommendations` for conflicts
4. Run conflicts-only:
```bash
node <repo-root>/dist/cli.js sync --cwd <case-path> --conflicts-only --format json
```
Expected:
- only `conflict_file` entries in `actions`
- recommendations preserved
5. Run apply:
```bash
node <repo-root>/dist/cli.js sync --cwd <case-path> --no-dry-run --format json
```
Expected:
- safe changes applied (`create_file`, `update_file`)
- conflicts remain untouched
- `appliedPaths` includes restored/updated safe paths

## Case 3: Foreign .ai
1. Create `.ai` manually with minimal custom `manifest.yaml` without `generator/managed_by`.
2. Run:
```bash
node <repo-root>/dist/cli.js validate --cwd <case-path> --format json
node <repo-root>/dist/cli.js sync --cwd <case-path> --format json
```
Expected:
- `ok: false`
- `preflightState: "foreign"`
3. Run init without force:
Expected:
- blocked with foreign-state error
4. Run init with force:
```bash
node <repo-root>/dist/cli.js init --cwd <case-path> --force --non-interactive --agent codex --ui-locale en --format json
```
Expected:
- `ok: true`
- warning about removing existing `.ai`

## Case 4: Mixed State
1. Initialize managed `.ai`.
2. Add legacy `./ai` folder.
3. Run `validate`, `sync`, `init` (without force).
Expected:
- all blocked with `preflightState: "mixed"`

## Case 5: Flag Misuse
1. Initialize managed case.
2. Run:
```bash
node <repo-root>/dist/cli.js sync --cwd <case-path> --no-dry-run --conflicts-only --format json
```
Expected:
- `ok: false`
- error: `--conflicts-only is supported only in dry-run mode.`

## Case 6: Usage Error Contract
1. Run init non-interactive without required options:
```bash
node <repo-root>/dist/cli.js init --cwd <case-path> --non-interactive --ui-locale en --format json
```
Expected:
- `ok: false`
- missing `--agent` error
- process exit code `2`

## Optional: Real Project Root Smoke
Run on real target path directly:
```bash
node <repo-root>/dist/cli.js validate --cwd <target-project-root> --format json
node <repo-root>/dist/cli.js sync --cwd <target-project-root> --format json
```
Expected depends on project state (`fresh` if `.ai` is not initialized yet).
