# Recommended Patterns

Use this file as a pattern catalog. Apply patterns based on project scale and complexity.

## Core Defaults (Use by default)

- Prefer explicit mapping dictionaries over long `if/else` chains for key-based branching.
- Keep a single source of truth for shared constants and schemas.
- Isolate side effects (I/O) from decision logic where practical.
- Make configuration declarative and versioned.
- Favor small, composable functions with clear input/output contracts.
- Use Dependency Injection (DI) to reduce coupling and improve testability.
- Use DTOs at boundaries between layers/services.
- Prefer immutable data where it improves predictability.
- Use Adapter and Facade to integrate external systems cleanly.
- Use Strategy for interchangeable algorithms/business rules.
- Use Observer (or pub/sub equivalent) for decoupled event reactions.

## Object-Oriented Catalog (GoF)

These are allowed patterns. Apply only when they simplify design for the current codebase.

- Creational: Abstract Factory, Builder, Factory Method, Prototype, Singleton.
- Structural: Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy.
- Behavioral: Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor.

## Domain and Data Patterns (Project-dependent)

- Repository.
- Unit of Work.
- CQRS.
- Event Sourcing.
- Saga.

Note: CQRS, Event Sourcing, and Saga are advanced. Use only with clear scale/audit/consistency needs.

## Async and Event-driven Patterns

- Event Bus / Message Bus.
- Outbox.
- Claim Check.
- Reactive Streams / Publisher-Subscriber.

## Cloud and Platform Patterns (Distributed systems)

- Circuit Breaker.
- API Gateway.
- Backends for Frontends (BFF).
- Strangler Fig.
- Sidecar.
- Ambassador.

## Delivery and Operations Patterns

- Infrastructure as Code (IaC).
- Blue-Green Deployment.
- Canary Deployment.
- Feature Toggles (Feature Flags).

## Functional Error/Flow Patterns

- Option / Maybe for explicit absence handling.
- Result / Either for explicit success/error flow.
- Monad-style composition where supported by language/tooling.
