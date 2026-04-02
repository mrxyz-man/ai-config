# Agents Module

This module defines AI role contracts and routing between roles.

## Files

- `registry.yaml`: enabled roles, defaults, handoff order, and quality gates.
- `developer.yaml`: implementation role contract.
- `reviewer.yaml`: findings-first review role contract.
- `architect.yaml`: architecture decision role contract.
- `tester.yaml`: risk-based testing role contract.
- `custom/`: user-defined roles.

## Priority

1. `rules/*` and global `.ai` config.
2. Role contract in `agents/*.yaml`.
3. Task context and acceptance criteria.

## Notes

- Keep role boundaries explicit.
- Avoid duplicate responsibilities across roles.
- Add custom roles only through `custom/` and registry entry.
