# Code Review Checklist

Use this checklist for meaningful, constructive reviews.

## 1. Functionality and Correctness

- Change matches task requirements or user story.
- Happy-path scenarios are implemented correctly.
- Edge cases are handled (empty inputs, null/undefined, boundary values).
- No hidden side effects beyond the expected scope.
- Error handling is explicit and user/developer-friendly.

## 2. Architecture and Design

- SOLID principles are respected where relevant (especially SRP and DIP).
- Responsibilities are split into clear modules/layers.
- Patterns are used only when they simplify the design.
- No God Objects or long, overloaded methods.
- Dependencies are injected or abstracted, not hardwired.
- Composition is preferred over inheritance where practical.

## 3. Readability and Maintainability

- Code is clear and consistent with project style.
- Naming is descriptive and intention-revealing.
- Methods/functions are focused and reasonably small.
- Duplication is minimized (DRY).
- Comments explain why, not what.
- Complex areas include clear rationale.
- No magic numbers/strings without constants/config.

## 4. Performance

- No obvious hotspots (redundant loops, N+1, inefficient algorithms).
- Resource usage is safe (no leaks, listeners/resources are cleaned up).
- Async I/O is non-blocking where required.
- Caching is used only when justified.
- Data access fetches only needed fields and is query-efficient.

## 5. Security

- Inputs are validated/sanitized (injection and XSS-class risks addressed).
- AuthN/AuthZ checks are present where required.
- Secrets are not hardcoded or leaked in logs.
- Serialization/deserialization is safe.
- Dependency risk posture is acceptable for changed areas.

## 6. Testability

- Behavior changes are covered by tests where appropriate.
- Tests verify behavior, not implementation details.
- Tests are isolated and deterministic.
- Mocks/stubs are used mainly for external dependencies.
- Positive and negative paths are covered.

## 7. API and Interface Quality

- Public interfaces are consistent and understandable.
- API versioning/backward compatibility is considered where applicable.
- Error/status responses are explicit and consistent.
- Request/response contracts are validated and documented where needed.

## 8. Tooling and Standards

- Lint/type/static analysis checks pass.
- New warnings are not introduced without justification.
- Relevant documentation is updated when behavior or interfaces change.

## 9. Code Smells

- Avoid train-wreck call chains where possible (Law of Demeter awareness).
- Avoid premature optimization that harms clarity.
- Avoid temporary fields and hidden object states.
- Keep nesting depth under control; use early return where it helps.
- Avoid parameter bloat; prefer parameter objects when needed.

## 10. Integration and Operations

- Change is compatible with target environments.
- Required DB migrations are safe and reversible when possible.
- Runtime configuration is externalized.
- Distributed concerns are addressed when relevant (timeouts, retries, circuit breaker).
- Logging is useful and not noisy.

## 11. Stack-specific Checks (Apply as relevant)

- Frontend: accessibility (a11y), rendering performance, cross-browser behavior.
- Mobile: battery usage, offline behavior.
- Concurrency-heavy systems: race/deadlock/synchronization risks.
- Real-time systems: delivery guarantees and deduplication strategy.

## How to Use This Checklist

- Apply only relevant sections for the current change.
- Focus on high-risk areas first.
- Prefer constructive comments:
  - describe the risk,
  - explain impact,
  - propose a concrete improvement.
- Keep review tone collaborative and respectful.
