# Release Operations Runbook

## Preconditions
- Build, tests, and validation checks are green.
- Migration and rollback steps are prepared.

## Steps
1. Confirm release scope and target version.
2. Apply deployment plan.
3. Run smoke checks and health verification.
4. Monitor key metrics and logs.
5. Announce release completion.

## Rollback
- Trigger rollback if health checks fail or critical errors appear.
- Document rollback reason and next corrective action.
