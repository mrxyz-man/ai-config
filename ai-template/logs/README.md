# Logs Module

This module provides observability and audit traces for AI-agent workflows.

## Files

- `policy.yaml`: logging configuration (levels, retention, redaction, audit rules).
- `activity.log`: operational events.
- `errors.log`: failures, blockers, and runtime errors.
- `audit.log`: sensitive and confirmation-relevant events.
- `sessions/`: optional session-oriented traces.

## Event Contract (recommended)

- `timestamp`
- `level`
- `event_type`
- `module`
- `message`
- `correlation_id`
- optional: `task_id`, `role`, `metadata`

## Security

- Do not log secrets, tokens, passwords, or personal sensitive data.
- Keep audit logs for confirmation-required and override events.

