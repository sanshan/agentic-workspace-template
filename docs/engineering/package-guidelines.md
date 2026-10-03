# Package Engineering Guidelines

References labeled “upstream example” describe the source project at a pinned revision; they are not local files or required applications. Reuse only the relevant responsibilities.

Rules for implementing and reviewing Agentic Workspace business packages and the Core identity/reference contracts they require.

This guide does not own implementation rules for technical capability packages such as `@agentic-workspace/runtime-executions`, `@agentic-workspace/runtime-presenters`, `@agentic-workspace/object-storage`, or `@agentic-workspace/runtime-config`. Follow `packages/AGENTS.md` and the nearest package-local instructions for those packages.

Normative keywords:

- **MUST** — required.
- **MUST NOT** — prohibited.
- **SHOULD** — preferred; deviation requires a concrete reason.

## Package creation

- **PKG-000** — A new business package MUST be created with `pnpm nx g @agentic-workspace/generators:package <name>`. Direct use of `@nx/js:lib` for new business packages is not supported.

## Package boundaries

- **PKG-001** — A business package MUST NOT depend on another business package.
- **PKG-002** — A business package MUST use cross-domain identities and references from `@agentic-workspace/core`.
- **PKG-003** — A business package MUST NOT redefine an identity or reference available from `@agentic-workspace/core`.
- **PKG-004** — Ports MUST be placed under `packages/[package-name]/src/lib/ports/`.

## Core identities

- **CORE-001** — Before implementing a business package, its domain identity MUST already exist in `@agentic-workspace/core`.
- **CORE-002** — Before implementing a business package, verify that Core provides its domain name, branded ID, and required reference types.
- **CORE-003** — If a required identity or reference is missing from Core, business-package implementation MUST stop. Add the missing Core contract first in a separate prerequisite task.
- **CORE-004** — Core owns cross-domain names, branded IDs, and reference types.
- **CORE-005** — Core MUST use generic primitives from `@event-driven-platform/*` instead of introducing equivalent local abstractions.
- **CORE-006** — Core MUST NOT contain aggregates, domain statuses, operations, reads, events, persistence, or business behavior.

## Domain model

- **DOMAIN-001** — A domain aggregate MUST be implemented as a class.
- **DOMAIN-002** — Each aggregate MUST be placed at `packages/[package-name]/src/lib/[domain-name]/[domain-name].aggregate.ts`.
- **DOMAIN-003** — Domain statuses MUST be represented by enums.
- **DOMAIN-004** — An aggregate MUST own the business invariants that govern its state.
- **DOMAIN-005** — State-transition validation MUST be performed by the aggregate, not by an operation handler.
- **DOMAIN-006** — State transitions SHOULD be exposed as aggregate methods instead of being constructed externally.

## Typed values

- **TYPE-001** — Branded IDs MUST use `Brand<TValue, TBrand>` from `@event-driven-platform/types`.
- **TYPE-002** — Brand names MUST identify the domain identity. Generic brands such as `String`, `Id`, or `Identifier` MUST NOT be used.
- **TYPE-003** — Code MUST use the domain-specific ID/reference exported by Core instead of reconstructing its generic EDP type.
- **TYPE-004** — Typed object literals SHOULD use `satisfies` when the compiler cannot otherwise verify the intended contract without widening or assertion.
- **TYPE-005** — `as unknown` and `as unknown as ...` MUST NOT be used to bypass type incompatibility. Fix the type boundary instead.

## Operations

- **OP-001** — Each operation MUST have its own directory: `packages/[package-name]/src/lib/operations/[operation-name]/`.
- **OP-002** — Operation files MUST use `[operation-name].operation.ts`, `[operation-name].handler.ts`, and `[operation-name].handler.spec.ts`.
- **OP-003** — Operation names MUST be declared in `packages/[package-name]/src/lib/operations/names.ts`.
- **OP-004** — Operation names MUST be exposed through `[camelCaseDomainName]OperationNames`.
- **OP-005** — An operation name MUST use the domain name from Core and an imperative kebab-case action: `[domain-name].[imperative-action]`.
- **OP-006** — Operation handlers MUST orchestrate application flow and MUST NOT implement aggregate invariants or state-transition rules.
- **OP-007** — A business package MUST own its EDP `OperationHandler` implementations and the knowledge required to construct them.
- **OP-008** — Business-package Operation handler classes MUST remain framework-agnostic. They MUST NOT use Nest decorators or import NestJS merely for service composition.
- **OP-009** — Operation handler provisioning data MUST be owned by a dedicated Nest-agnostic package entrypoint such as `@agentic-workspace/<package>/execution`, not exposed through concrete handler deep imports. Standard hosting consumes this data through the package `/runtime` manifest rather than importing `/execution` directly in the service.
- **OP-010** — The package execution entrypoint MUST expose Nest-compatible provider descriptors as ordinary object literals with `provide`, `inject`, and `useFactory`; the package MUST NOT import or reproduce Nest `Provider` / `FactoryProvider` types.
- **OP-011** — Operation handler provider descriptors MUST inject package-owned runtime ports/contracts and construct concrete handlers inside the package. The runtime manifest/hosting adapter MUST reuse those descriptors; a hosting service MUST NOT recreate handler constructors or duplicate their dependency knowledge.
- **OP-012** — Concrete Operation handler classes MUST NOT be exported from the package's main business entrypoint solely for service composition when the package execution entrypoint already owns provisioning.
- **OP-013** — A business package MUST own its Operation-name-to-handler mapping and expose one package-specific binding group from its `/execution` entrypoint. A hosting service MUST NOT recreate that mapping.
- **OP-014** — Package Operation-handler binding descriptors MUST remain Nest-compatible and Nest-agnostic ordinary objects. They MAY depend on `OperationHandlerBinding` from `@agentic-workspace/runtime-executions`, but MUST NOT import Nest provider types.
- **OP-015** — A package binding group MUST reference the package's exported Operation-name constants rather than repeating raw Operation names.
- **OP-016** — Shared resolver identity and lookup implementation belong to `@agentic-workspace/runtime-executions`, not `@agentic-workspace/core` or a business package.
- **OP-017** — Each Operation name MUST map to exactly one Operation handler in Agentic Workspace. Duplicate bindings are invalid service composition and MUST be rejected by the shared resolver.

## Reads

- **READ-001** — Each read MUST have its own directory: `packages/[package-name]/src/lib/reads/[read-name]/`.
- **READ-002** — Read files MUST use `[read-name].read.ts`, `[read-name].handler.ts`, and `[read-name].handler.spec.ts`.
- **READ-003** — Read names MUST be declared in `packages/[package-name]/src/lib/reads/names.ts`.
- **READ-004** — Read names MUST be exposed through `[camelCaseDomainName]ReadNames`.
- **READ-005** — A read name MUST use the domain name from Core and an imperative kebab-case action: `[domain-name].[imperative-action]`.
- **READ-006** — A business package MUST own its EDP `ReadHandler` implementations and the knowledge required to construct them.
- **READ-007** — Business-package Read handler classes MUST remain framework-agnostic. They MUST NOT use Nest decorators or import NestJS merely for service composition.
- **READ-008** — Read handler provisioning data MUST be owned by the package's Nest-agnostic `/execution` entrypoint rather than exposed through concrete handler deep imports. Standard hosting consumes this data through the package `/runtime` manifest rather than importing `/execution` directly in the service.
- **READ-009** — Read handler provider descriptors MUST be Nest-compatible ordinary objects with `provide`, `inject`, and `useFactory`; the business package MUST NOT import or reproduce Nest provider types.
- **READ-010** — Read handler provider descriptors MUST inject package-owned runtime ports/contracts and construct concrete handlers inside the package. The runtime manifest/hosting adapter MUST reuse those descriptors; a hosting service MUST NOT recreate handler constructors or duplicate their dependency knowledge.
- **READ-011** — Concrete Read handler classes MUST NOT be exported from the package's main business entrypoint solely for service composition when the package `/execution` entrypoint already owns provisioning.
- **READ-012** — A business package MUST own its Read-name-to-handler mapping and expose one package-specific binding group from its `/execution` entrypoint. A hosting service MUST NOT recreate that mapping.
- **READ-013** — Package Read-handler binding descriptors MUST remain Nest-compatible and Nest-agnostic ordinary objects. They MAY depend on `ReadHandlerBinding` from `@agentic-workspace/runtime-executions`, but MUST NOT import Nest provider types.
- **READ-014** — A package Read binding group MUST reference the package's exported Read-name constants rather than repeating raw Read names.
- **READ-015** — Shared Read resolver identity and lookup implementation belong to `@agentic-workspace/runtime-executions`, not `@agentic-workspace/core` or a business package.
- **READ-016** — Each Read name MUST map to exactly one Read handler in Agentic Workspace. Duplicate bindings are invalid service composition and MUST be rejected by the shared resolver. When adapting to the EDP resolver contract, a successful resolution MUST contain a singleton handler tuple.

## Tenant ownership

- **TENANT-001** — Before choosing an Operation/Read contract, determine whether the behavior and resource are tenant-owned. Tenant-owned execution MUST use the applicable published EDP tenant-aware contract with the domain's typed tenant reference.
- **TENANT-002** — A genuinely tenantless Operation/Read is valid when the behavior and resource have no tenant owner and the applicable published EDP contract represents that model. Code MUST NOT omit or fabricate tenant merely to force tenantless behavior through a tenant-aware contract.
- **TENANT-003** — A tenant-aware Operation/Read handler MUST pass the execution tenant through every tenant-owned persistence call. It MUST NOT replace explicit propagation with Intent/payload duplication, AsyncLocalStorage, request-scoped current-tenant providers, or another ambient mechanism.
- **TENANT-004** — Tenant-owned persistence APIs MUST accept tenant identity explicitly. When tenant ownership is part of aggregate state, the aggregate and persistence representation MUST preserve that owner, and persistence MUST reject a write whose aggregate owner contradicts the requested tenant scope.
- **TENANT-005** — Tenant isolation MUST be enforced by the persistence query predicate, for example `WHERE tenant_id = :tenantId AND id = :resourceId`. Loading by a globally unique id and comparing tenant afterward is not an isolation boundary.
- **TENANT-006** — Unless an approved specification requires different behavior, a cross-tenant lookup MUST return the same absence outcome as an unknown identity. Persistence/handler behavior MUST NOT reveal that another tenant owns the identity.
- **TENANT-007** — Tenant-owned updates and deletes MUST include tenant in their mutation predicate. A missing row and a row owned by another tenant MUST have the same non-mutating outcome at that boundary unless an approved specification says otherwise.
- **TENANT-008** — Database uniqueness, idempotency, and deduplication constraints MUST use the same ownership scope as the business rule. Tenant-local duplicate detection requires a tenant-scoped constraint such as `(tenant_id, content_hash)`; a global constraint MUST NOT collapse different tenants' resources.
- **TENANT-009** — Database-enforced tenant ownership and scoped constraints are the primary package persistence boundary. RLS MAY be considered separately as defense in depth, but it MUST NOT replace explicit tenant-aware contracts and predicates.

The current canonical reference is Documents: `Document` preserves its owner, `DocumentPersistence` accepts tenant identity, `TypeOrmDocumentPersistence` scopes duplicate/find/update queries, the Prepare/Finish/Get handlers propagate the EDP execution tenant, and [upstream example: apps/services/documents-e2e/src/documents/documents.spec.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/documents-e2e/src/documents/documents.spec.ts) proves the complete running-service boundary. Follow those responsibilities without copying Documents-specific fields or operations mechanically.

## Runtime manifest

- **RUNTIME-001** — A business package that participates in the standard execution runtime MUST expose one Nest-agnostic host manifest from `@agentic-workspace/<package>/runtime`.
- **RUNTIME-002** — The manifest MUST be created through the `RuntimePackageManifest`/`defineRuntimePackage(...)` contract from `@agentic-workspace/runtime-executions`; `@agentic-workspace/documents/runtime` is the canonical working reference.
- **RUNTIME-003** — The runtime manifest aggregates package-owned execution and TypeORM contributions. It MUST NOT duplicate concrete handler, mapper, repository, entity, migration, or adapter construction knowledge already owned by the package's focused boundaries.
- **RUNTIME-004** — The runtime manifest MUST remain framework-agnostic and MUST NOT import NestJS provider/module types.
- **RUNTIME-005** — Operation/Read binding container tokens MAY be carried by the manifest because they represent collection/multibinding semantics. They MUST NOT be used as ordinary application DI identities.
- **RUNTIME-006** — A standard Nest hosting service MUST register package manifests through `@agentic-workspace/runtime-executions/nest` rather than manually consuming the package's individual execution provider/binding and persistence-factory descriptors.

## Events

- **EVENT-001** — Each event MUST have its own directory: `packages/[package-name]/src/lib/events/[event-name]/`.
- **EVENT-002** — An event file MUST use `[event-name].event.ts`.
- **EVENT-003** — Event names MUST be declared in `packages/[package-name]/src/lib/events/names.ts`.
- **EVENT-004** — Event names MUST be exposed through `[camelCaseDomainName]EventNames`.
- **EVENT-005** — An event name MUST use the domain name from Core and describe the completed parent operation in past tense: `[domain-name].[past-tense-event]`.
- **EVENT-006** — A business event MUST be declared through the published EDP `defineEventContract(...)` API so its literal name, business schema version, and Zod payload schema have one runtime source of truth.
- **EVENT-007** — Event payload and Event TypeScript types MUST derive from that contract through the published EDP inference types instead of a separately maintained payload interface or Event class.
- **EVENT-008** — An Operation handler that emits a package event MUST create it through the owning EventContract's `.create(...)` API instead of constructing a parallel Event representation.
- **EVENT-009** — A business package MUST expose the runtime EventContract value and required derived public Event/payload types from its main business entrypoint when those contracts are part of its integration API.

[upstream example: packages/documents/src/lib/events/document-registered/document-registered.event.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/packages/documents/src/lib/events/document-registered/document-registered.event.ts) and [upstream example: packages/document-processing/src/lib/events/document-processing-completed/document-processing-completed.event.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/packages/document-processing/src/lib/events/document-processing-completed/document-processing-completed.event.ts) are the canonical working references. Keep EDP EventContract/runtime-validation and renderer semantics in EDP documentation rather than duplicating them here.

## Persistence

- **DB-001** — Persistence entities MUST NOT contain business behavior.
- **DB-002** — Persistence entities and domain aggregates MUST remain separate representations.
- **DB-003** — Persistence mappers MUST only translate between persistence and domain representations; they MUST NOT implement business rules.
- **DB-004** — Invariants that must remain correct under concurrent writes MUST be enforced by the database.
- **DB-005** — Expected business outcomes MUST NOT expose database-specific errors to business handlers.

## TypeORM integration

- **DB-006** — A business package that persists its business state with TypeORM MUST own the corresponding TypeORM schema artifacts, including its entities and migrations.
- **DB-007** — A business package MUST NOT create, initialize, destroy, observe, or configure a TypeORM `DataSource`; the hosting business service owns the real `DataSource` lifecycle and connection configuration.
- **DB-008** — Package-owned TypeORM integration MUST be exposed through a dedicated Nest-agnostic public entrypoint such as `@agentic-workspace/<package>/typeorm`, not through the package's main business entrypoint.
- **DB-009** — The TypeORM entrypoint MUST expose package composition contracts such as `<PACKAGE>_TYPEORM_ENTITIES` and, when package-owned migrations exist, `<PACKAGE>_TYPEORM_MIGRATIONS`. Consumers MUST use those contracts instead of deep-importing concrete entity or migration implementation files.
- **DB-010** — A package TypeORM integration boundary MAY depend on TypeORM but MUST NOT depend on NestJS merely to participate in service persistence composition.
- **DB-011** — TypeORM-specific entities, migrations, mappers, repositories, and persistence implementation classes MUST NOT be exported from the main business entrypoint solely for service composition.
- **DB-012** — A persistence port that is used as a Nest DI token MUST be a runtime value, normally an `abstract class`; a TypeScript-only interface is insufficient for that composition boundary.
- **DB-013** — Infrastructure-facing persistence ports used for TypeORM service composition MUST be exported from the package's `/typeorm` entrypoint. The main business entrypoint MUST NOT be expanded merely to expose those ports to Nest wiring.
- **DB-014** — The package `/typeorm` entrypoint MUST expose one package-owned factory per persistence port that needs service composition. The factory accepts TypeORM primitives such as `DataSource` and constructs the package-owned concrete adapter internally.
- **DB-015** — Package TypeORM factories MUST keep entity, mapper, repository, and concrete persistence implementation knowledge inside the business package. A hosting service MUST NOT recreate adapter construction or import those implementation details.
- **DB-016** — Package TypeORM factories MUST remain Nest-agnostic. They MUST NOT import Nest provider types or decorators; the standard `@agentic-workspace/runtime-executions/nest` adapter owns Nest provider wiring for persistence contributions declared by hosted runtime manifests.
- **DB-017** — Package TypeORM factories MUST continue to accept the normal TypeORM `DataSource` contract and MUST remain unaware of `AsyncLocalStorage`, `QueryRunner`, or execution-transaction propagation.
- **DB-018** — Transaction participation for package persistence is a hosting-runtime concern. Under the standard Nest composition, `@agentic-workspace/runtime-executions/nest` supplies the shared transaction-aware `DataSource` to unchanged package factories declared by hosted manifests; the business package remains unaware of transaction plumbing.
- **DB-019** — A business package MUST NOT introduce its own ambient transaction context or repository-switching proxy to participate in EDP execution; the canonical implementation belongs to shared service runtime.

Detailed shared runtime transaction/store algorithms and Runner/Reader/UseCaseExecutor composition invariants are intentionally not owned here. Service consumers follow `docs/engineering/service-guidelines.md` and `docs/engineering/database-guidelines.md`; changes to the shared runtime implementation follow `packages/runtime-executions/AGENTS.md`.

## Names

- **NAME-001** — Domain names used by business packages MUST come from `@agentic-workspace/core`.
- **NAME-002** — After an operation, read, or event name is declared in its `names.ts`, package code MUST reference that declaration instead of repeating the raw string.

## Platform integration tests

- **TEST-001** — Tests MUST verify behavior implemented by Agentic Workspace at the owning boundary. They MUST NOT duplicate EDP tests or restate EDP-owned semantics merely because Agentic Workspace consumes an EDP contract.
- **TEST-002** — When a business package adds composition around EDP, tests SHOULD target only the added mapping, adapter, provider, invariant, or failure behavior; use typecheck/build evidence for structural contract compatibility where sufficient.

## Review behavior

- **REVIEW-001** — Review findings MUST identify the violated rule ID.
- **REVIEW-002** — A finding MUST cite concrete code evidence. Do not report a violation based only on speculation about future code.
- **REVIEW-003** — Do not request abstractions, extensibility, or infrastructure that is not required by the current specification or these guidelines.
- **REVIEW-004** — When no guideline is violated and the specification does not require a change, the reviewer MUST NOT invent a requirement.
- **REVIEW-005** — If implementation requires violating a MUST/MUST NOT rule, stop and surface the conflict instead of silently working around it.
