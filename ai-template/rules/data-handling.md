# Data Handling Policy

Purpose:
- Protect sensitive data and enforce safe defaults.

Rules:
- Secrets, tokens, and credentials MUST NOT be stored in repository files.
- Personal or sensitive data MUST NOT be logged in plain text.
- Data exposure in examples, tests, and docs MUST use redacted or synthetic values.
- Retention-sensitive data MUST follow declared retention policy.
- Access to external data sources MUST follow least-privilege principle.

Operational requirements:
- redaction MUST be enabled for logs where supported,
- security-relevant data operations MUST be auditable,
- uncertain data classification MUST be escalated before release.
