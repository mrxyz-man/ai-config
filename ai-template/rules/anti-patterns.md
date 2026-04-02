# Anti-Patterns

Use this catalog as a warning list. Avoid these unless there is a clear, documented reason.

## Code-level Anti-Patterns

- Magic numbers/strings instead of named constants.
- Long `switch` / long `if-else` dispatch where table mapping or polymorphism fits better.
- God Object (one class doing too much).
- Spaghetti code with unclear control flow.
- Copy-paste programming (duplicated logic across modules).
- Lava Flow (dead/legacy code kept only from fear).
- Shotgun Surgery (small change requires touching many unrelated places).
- Reinventing the wheel for solved platform/library concerns.
- Hardcoded env-specific values (paths, hosts, secrets, limits).
- Dependency hell from unmanaged object creation inside business classes.

## OOP Anti-Patterns

- Anemic domain model (all behavior moved to services, entities become DTO-only).
- Inheritance abuse (fragile base classes / template abuse).
- Poltergeist classes (thin pass-through classes with no responsibility).
- Yo-yo inheritance (deep hierarchies hard to reason about).
- Interface bloat (fat interfaces violating ISP).

## Architecture Anti-Patterns

- Big Ball of Mud (no clear boundaries or modularity).
- Distributed monolith (microservices with tight coupling and synchronized deploys).
- Stovepipe systems (isolated silos with duplicated functionality).
- Vendor lock-in without abstraction/exit strategy.
- Inner-platform effect (building internal platform over existing platform for no gain).
- Architecture by implication (no explicit architecture agreements/docs).

## Data and Persistence Anti-Patterns

- `SELECT *` in production data paths without need.
- N+1 query patterns.
- Magic pile columns (overloading one field with many concerns).
- Ignoring object-relational mapping constraints and query behavior.
- Fear of SQL causing unoptimized ORM-only access in complex queries.

## Testing Anti-Patterns

- Test logic leaking into production code paths.
- Fragile tests coupled to implementation details.
- Ice-cream cone test shape (too many slow E2E, too few fast unit/integration tests).
- Mock overuse that verifies internals instead of behavior.
- "Smoke and mirrors" tests that assert nothing meaningful.

## CI/CD and DevOps Anti-Patterns

- Manual deployments for regular release flow.
- Long-lived branches with painful late integration.
- "Always green" pipelines that ignore failing checks.
- Deployment fear from risky/non-repeatable rollout process.

## Team and Process Anti-Patterns

- Hero culture (critical knowledge concentrated in one person).
- Analysis paralysis.
- Death by planning (process overhead blocks delivery).
- Not Invented Here (NIH) without objective evaluation.
- Golden hammer (forcing one favorite tool on every problem).

## Additional AI-Config Specific Anti-Patterns

- Duplicated schema fragments/constants across `manifest`, `config`, and modules.
- Mixing runtime state and policy config in the same file.
- Broad, unrelated changes in one commit or pull request.
- Applying advanced patterns (CQRS/Event Sourcing/Saga) without scale or domain pressure.
- Cargo-cult adoption of patterns without measurable benefit.

## Notes on Practical Usage

- Some items are context-sensitive. Example: short `switch` can be acceptable when stable and explicit.
- Prototype phases may temporarily tolerate simplifications, but should be refactored before scaling.
- Main defenses: regular refactoring, disciplined code review, and static analysis automation.
