# API Compatibility Policy

Purpose:
- Keep integrations stable and predictable.

Rules:
- Public API changes MUST preserve backward compatibility by default.
- Breaking changes MUST be explicitly marked and documented before merge.
- Request/response contracts MUST be versioned when compatibility cannot be preserved.
- Error formats and status semantics MUST remain consistent across endpoints.
- Compatibility-impacting changes MUST include migration notes and test coverage updates.

Review checks:
- contract diff identified,
- compatibility impact classified (`non-breaking` or `breaking`),
- rollout/rollback notes provided.
