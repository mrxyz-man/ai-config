# Decision Log Policy

Purpose:
- Keep architecture and process decisions traceable.

Rules:
- Significant technical decisions MUST be recorded in `project/decisions.md` or `adr/` (if enabled).
- Each decision entry MUST include: context, decision, consequences, and date.
- If a previous decision is superseded, the new entry MUST reference the old one.
- Decisions MUST NOT be silently changed without updating the log.

When to log:
- changes to architecture boundaries,
- changes to data model or API contracts,
- changes to security/compliance behavior,
- irreversible migration choices.
