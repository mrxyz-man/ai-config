# Secrets Policy

## Rules
- Do not store secrets in source code, templates, or logs.
- Use environment variables or approved secret storage.
- Rotate exposed credentials immediately.

## Agent Guidance
- Never print token values in outputs.
- Redact sensitive values in diagnostics and examples.
- Ask for confirmation before actions that may expose secure data.
