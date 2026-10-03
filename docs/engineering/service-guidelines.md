# Internal Service Engineering Guidelines

References labeled “upstream example” describe the source project at a pinned revision; they are not local files or required applications. Reuse only the relevant responsibilities.

These rules define the reusable architecture and application boundaries for internal Nest services in Agentic Workspace.

They apply to [upstream example: apps/api](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api) and services under [upstream example: apps/services/](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/) where the corresponding responsibility exists. The stable service shell is not optional even when a layer currently has no concrete behavior.

## Canonical implemented references

Use the closest proven implementation rather than copying service-specific behavior mechanically.

- [upstream example: apps/api](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api) is the reference for a small HTTP host that owns its Nest bootstrap, typed configuration, and TypeORM `DataSource` lifecycle while composing shared runtime capabilities such as `@agentic-workspace/runtime-health/typeorm` and `@agentic-workspace/runtime-presenters/http/health`.
- [upstream example: apps/services/documents](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/documents) is the reference for a business-service host. Its concrete UseCases orchestrate package-owned Operations/Reads through shared EDP runtime composition, while service infrastructure composes public package/runtime integration contracts.
- [upstream example: apps/services/document-processing/src/app/presenters/messaging](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/document-processing/src/app/presenters/messaging) is the reference for explicit event ingress composition: a presenter-owned EventContract -> UseCase subscription uses the shared messaging/presenter runtime and obtains application capabilities through `ApplicationModule`.

Reference implementations demonstrate responsibility and dependency direction. They are not templates requiring every service to have the same ports, DTOs, mappers, runtime capabilities, or domain behavior.

## Stable service shell

Every internal service preserves these three service boundaries as directories and Nest modules:

```text
presenters -> application -> infrastructure
```

The canonical module chain is:

```text
PresentersModule -> ApplicationModule -> InfrastructureModule
```

`ApplicationModule` imports `InfrastructureModule`. `PresentersModule` imports `ApplicationModule`. Do not bypass this chain by importing `InfrastructureModule` directly into presenters.

These boundaries remain present even when a layer temporarily has no providers, UseCases, controllers, or other concrete behavior. Do not delete, collapse, or bypass `ApplicationModule`, `InfrastructureModule`, or `PresentersModule` as empty-layer cleanup.

`domain` is not part of this mandatory Nest module shell. Add service-local domain code only when the service genuinely owns domain concepts or behavior.

### Domain

Domain code owns service-local domain concepts, invariants, and behavior when such behavior genuinely belongs to the service rather than to a hosted business package.

Domain code MUST NOT depend on NestJS, TypeORM, transport contracts, or infrastructure implementations.

Do not introduce a service-local domain model when the behavior is already owned by a business package or when there is no meaningful state, invariant, or behavior to represent.

### Application

Application code owns service-level use-case orchestration and application-facing abstractions. Its Nest module is also the stable composition boundary between presenters and infrastructure, even when there are currently no concrete UseCases.

Application code MAY depend on domain code and application-facing ports. Concrete application behavior MUST remain unaware of TypeORM entities/repositories/DataSource, HTTP DTOs/controllers, Nest transport objects, and concrete infrastructure implementations.

`ApplicationModule` MAY import and re-export infrastructure modules/capabilities required by upper-layer Nest composition. This module-level composition does not authorize concrete application UseCases to depend directly on infrastructure implementation types.

Create an application port only when application behavior requires a real external capability that is not already represented by an existing package/runtime contract.

### Infrastructure

Infrastructure owns technology/runtime composition and adapters: persistence, configuration, execution runtime, external storage/providers, messaging, caches, and similar integrations.

Infrastructure MAY implement application-facing ports and compose business-package/shared-runtime public contracts. It MUST NOT move orchestration out of a UseCase merely because that orchestration invokes external technology.

When a service hosts a business package through the standard execution runtime, consume its `@agentic-workspace/<package>/runtime` manifest through `@agentic-workspace/runtime-executions/nest`. Do not deep-import package implementation files, manually consume its individual execution/persistence descriptors, or reconstruct package-owned handler/persistence construction in the service.

Database lifecycle, TypeORM composition, and migration rules are defined in `docs/engineering/database-guidelines.md`. Environment and typed service configuration rules are defined in `docs/engineering/environment-guidelines.md` and `docs/engineering/service-configuration-guidelines.md`.

### Presenters

Presenters own transport adaptation and depend on the service through `ApplicationModule`. Presenters MUST NOT import `InfrastructureModule` directly or bypass the application boundary to call persistence or other infrastructure implementations.

Transport-specific DTOs, validation/binding concerns, response mapping, and framework-specific presenter adapters remain in the presenter boundary and MUST NOT leak into application/domain code.

Internal HTTP presenters and HTTP service E2E follow `docs/engineering/http-presenter-guidelines.md`. Do not infer that every presenter or service is HTTP; a `PresentersModule` may remain empty until a transport is introduced.

### Event ingress presenters

A service that consumes business events declares each concrete EventContract -> UseCase mapping under its presenter boundary and composes it through `@agentic-workspace/runtime-presenters/events`. The service mapping owns only business-event-to-application-input conversion. It MUST NOT receive the full EventEnvelope, derive intents, adapt Actor/Tenant metadata, own handler lookup, or call the UseCase directly.

[upstream example: apps/services/document-processing/src/app/presenters/messaging](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/document-processing/src/app/presenters/messaging) is the canonical implementation. Its local events module imports `ApplicationModule` for the concrete UseCase and shared `UseCaseExecutor`, and imports the shared event-subscription Nest composition for registration. `PresentersModule` imports the local events module without listing concrete subscriptions itself.

The current canonical integration starts from a complete logical EDP EventEnvelope supplied directly to `EventIngress`. It proves production registration, exact dispatch and durable UseCase execution without a broker. It MUST NOT be described as an implemented Documents Outbox -> broker -> document-processing pipeline: broker transport, CDC/wire decoding, acknowledgement, retry/DLQ and consumer lifecycle are outside this integration.

Future transport work must preserve the existing readiness/shutdown contracts: messaging must become not-ready/stopping before drain, intake and retry scheduling must stop, in-flight work must drain within a reviewed bounded budget, and dependency/telemetry teardown must happen after that drain. Retry timing, attempt budgets and lease-aware redelivery remain unresolved in #355 and MUST NOT be copied from earlier discussion as approved defaults.

## Nest modules and dependency injection

Nest modules are service composition boundaries, not substitutes for application/domain design.

Keep the stable module chain `PresentersModule -> ApplicationModule -> InfrastructureModule`. Infrastructure modules bind application-facing abstractions/contracts to concrete adapters and shared runtime composition; `ApplicationModule` exposes the service composition boundary to presenters.

Do not introduce parallel DI tokens, wrappers, generic repositories, base services, or framework abstractions when an existing package/runtime contract or Nest mechanism already serves the required boundary.

## Concrete service UseCases

Concrete service UseCases are application-level orchestration and use the published EDP UseCase contracts.

A concrete service UseCase MUST be a Nest `@Injectable()` provider using the default singleton scope unless a concrete reviewed requirement proves another scope necessary.

Each concrete UseCase MUST expose the explicit stable `readonly name` required by the EDP UseCase contract. Use a bounded semantic identity owned by the application behavior, such as `<entity>.<action>`; MUST NOT derive this identity from `constructor.name` or another implementation/class name that can change during refactoring.

Constructor dependencies are reserved for stable reusable collaborators such as Runner, Reader, storage capabilities, repositories/ports, or other long-lived dependencies. Invocation-specific metadata MUST NOT be stored on the singleton instance or introduced through request-scoped DI merely for convenience.

Each concrete UseCase MUST own a dedicated folder under `application/use-cases/`. Keep its implementation, concrete context and behavioral specification colocated:

```text
application/
  use-cases/
    <use-case-name>/
      <use-case-name>.use-case.ts
      <use-case-name>.use-case.context.ts
      <use-case-name>.use-case.spec.ts
```

Each UseCase MUST define its own concrete context type extending EDP `UseCaseContext` with exactly the additional invocation metadata it needs.

Actor, tenant, and similar invocation values belong in that concrete context only when the UseCase requires them. Preserve typed concrete-context flow end to end through `UseCaseExecutor`; do not hide invocation metadata in AsyncLocalStorage, ambient current-user/current-tenant providers, casts, or local executor wrappers.

UseCase behavioral tests are specification-level tests. They MUST verify observable behavior required by the owning specification. They MUST NOT test Nest scope, constructor shape, context-file placement, or EDP implementation mechanics unless the specification makes such behavior observable.

### Tenant-owned UseCases

A UseCase that reads or changes tenant-owned resources MUST include the typed tenant reference in its concrete UseCase context. The presenter or other invocation adapter supplies that tenant explicitly together with the other invocation metadata required by the UseCase.

When the UseCase constructs a tenant-owned Operation or Read, it MUST pass the context tenant through the applicable published EDP execution contract. Do not copy tenant into an Intent or business payload as a substitute for the execution tenant, and do not hide it in request-scoped providers, AsyncLocalStorage, or another ambient current-tenant mechanism.

A UseCase whose behavior and resources are genuinely tenantless MUST NOT acquire tenant merely because the presenter can provide one. Select the applicable tenant-aware or tenantless EDP execution contract from the ownership model before implementation; do not omit or fabricate tenant on a contract that requires it.

The package handler and persistence responsibilities after Operation/Read construction are defined by the tenant-ownership rules in `docs/engineering/package-guidelines.md`. `RegisterDocumentUseCase` and `GetDocumentUseCase` under [upstream example: apps/services/documents/src/app/application/use-cases/](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/documents/src/app/application/use-cases/) are the current concrete context-to-Operation/Read references.

## UseCase implementation preflight

Before designing or modifying a concrete service UseCase, inspect the current implementation and semantics of every execution boundary the UseCase will actually use:

- `UseCaseExecutor` for durable UseCase execution;
- Runner for child Operations and Reader for child Reads when those paths are used;
- each concrete Operation/Read invoked by the UseCase and its handler;
- the relevant persistence/database implementation and constraints when they own behavior related to deduplication, idempotency, transactions, recovery, concurrency, or result semantics.

The purpose is to establish existing ownership before adding orchestration logic.

MUST NOT add a UseCase-local check, recovery Read, idempotency/deduplication mechanism, retry policy, progress state, transaction workaround, concurrency guard, or similar execution behavior until inspection proves the existing EDP runtime and called Operation/Read/persistence boundaries do not already own the requirement.

When preparing an implementation issue for a concrete UseCase, copy constraining findings into the issue's required `## Do not` section. Name the concrete existing owner/mechanism where practical; a generic instruction such as "do not duplicate existing behavior" is insufficient when the investigation can identify the owner.

## Shared EDP runtime consumption

Internal services consume reusable Agentic Workspace execution composition from `@agentic-workspace/runtime-executions` instead of reconstructing the standard EDP dependency graph locally.

Use the focused public entrypoint that owns the required capability, including the established Runner, Reader, UseCaseExecutor, resolver, TypeORM transaction, and durable runtime-store integrations.

The service owns the hosted-package selection, real `DataSource` lifecycle/configuration, and service-specific external integrations. The framework-agnostic `@agentic-workspace/runtime-executions` core owns reusable Agentic Workspace contracts/factories, while `@agentic-workspace/runtime-executions/nest` owns the standard Nest/process provider graph around the service-owned `DataSource`. EDP remains the source of truth for execution semantics.

MUST NOT introduce service-local implementations/wrappers for Runner, Reader, UseCaseExecutor, handler resolvers, transaction propagation, execution-log persistence, Outbox persistence, or UseCase execution persistence when the shared runtime already owns that capability.

For exact runtime composition contracts and implementation invariants, inspect the current public `@agentic-workspace/runtime-executions` entrypoint and `packages/runtime-executions/AGENTS.md`. Do not copy those implementation details into service code or duplicate them in service documentation.

## Business package hosting

A business package owns its business model, Operations/Reads/handlers, persistence integration contracts, and one framework-agnostic runtime manifest aggregating the contributions required for standard hosting.

A Nest service selects the packages it hosts and registers their manifests through the shared adapter:

```ts
RuntimeExecutionsModule.register([documents]);
```

The service MUST NOT add local execution/read wrapper modules, package provider files, or service-specific Runner/Reader/UseCaseExecutor tokens merely to reproduce the shared graph. Ordinary runtime dependencies are injected through the runtime-valued class/abstract-class identities exported by `@agentic-workspace/runtime-executions`. Symbol tokens are reserved for genuine container/multibinding composition and stay behind the manifest/runtime boundary.

The service remains responsible for its real `DataSource` lifecycle/configuration and service-specific external integrations such as ObjectStorage. It MUST NOT deep-import concrete package handlers/entities/migrations/adapters or duplicate package-owned construction/mapping knowledge.

Use [upstream example: packages/documents/src/runtime.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/packages/documents/src/runtime.ts) together with [upstream example: apps/services/documents/src/app/infrastructure/infrastructure.module.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/documents/src/app/infrastructure/infrastructure.module.ts) as the current paired reference for this boundary.

## Testing ownership

Tests stay at the boundary that owns the behavior:

- concrete UseCase specs verify specification-visible application orchestration;
- service composition tests verify service-owned Nest/runtime wiring only when that wiring introduces behavior worth proving;
- package tests own package aggregate/handler/persistence/composition behavior;
- shared runtime tests own Agentic Workspace runtime adapters/composition;
- persistence integration tests own database-specific adapter guarantees;
- presenter tests own behavior introduced by their transport adapter;
- E2E tests verify important running-service integration boundaries and do not replace lower-level owner tests.

MUST NOT duplicate EDP Runner/Reader/UseCaseExecutor semantics in service tests merely because a service consumes those contracts.

## Change discipline

Before adding a service-level abstraction or integration pattern:

1. inspect the closest current service implementation;
2. identify the existing owner of the required behavior;
3. preserve the stable `presenters -> application -> infrastructure` module shell;
4. reuse existing public contracts/patterns where they apply;
5. add only behavior-specific files required by the concrete change;
6. keep the change within the owning service/package/runtime boundary.

Consistency means preserving the stable service shell and reusing proven boundaries and ownership without copying unrelated behavior.
