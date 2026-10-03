# Internal Service Database Guidelines

References labeled “upstream example” describe the source project at a pinned revision; they are not local files or required applications. Reuse only the relevant responsibilities.

These rules define the canonical consumer-facing PostgreSQL and TypeORM integration for internal Nest services in Agentic Workspace.

This guide owns service database lifecycle, schema ownership, TypeORM composition, migration, and shared-runtime persistence **consumption**. Business-package TypeORM producer contracts are owned by `docs/engineering/package-guidelines.md`. Detailed algorithms and implementation invariants inside `@agentic-workspace/runtime-executions` are owned by `packages/runtime-executions/AGENTS.md`.

The pattern follows the official NestJS `@nestjs/typeorm` and TypeORM APIs instead of introducing a repository-owned database lifecycle abstraction.

## Vendor lifecycle ownership

For a Nest runtime, `TypeOrmModule.forRootAsync(...)` owns creation, initialization, registration, and shutdown of the service's real TypeORM `DataSource`.

MUST NOT add a custom `DatabaseService` or custom async provider whose only purpose is to call `new DataSource(...).initialize()` / `destroy()`. Nest already exposes the initialized `DataSource` and `EntityManager` through dependency injection.

Feature persistence registration still uses Nest/TypeORM mechanisms, but standard business-package contributions are registered by `@agentic-workspace/runtime-executions/nest` from hosted package manifests. The service does not import package-private entity files or create package persistence provider wrappers.

The TypeORM CLI is a separate process and requires a service-local exported `DataSource`. That CLI adapter does not become the runtime lifecycle owner.

## Database ownership

Each internal service owns one logical database runtime boundary:

- its service-owned database configuration and credentials;
- its runtime `DataSource` and connection-pool lifecycle;
- migration execution for that database and its migration history.

Business packages hosted by the service own TypeORM schema artifacts for their own business state, including entities and migrations. The service composes those package-owned artifacts into its database runtime rather than copying or re-owning them.

Shared runtime packages may own schema artifacts for shared runtime state that they implement. A service composes those artifacts through the owning package's public integration entrypoint while retaining ownership of its real `DataSource` and database lifecycle.

A service may additionally own entities and migrations for persistence that genuinely belongs to that service boundary. Artifact ownership follows the state/concern that owns the schema; `DataSource` lifecycle ownership remains with the service.

Logical ownership does not require one physical PostgreSQL server or cluster per service. Deployment may colocate independently owned databases while keeping service persistence boundaries isolated.

A service MUST NOT import another service's entities, repositories, migrations, or `DataSource`.

Service-specific database environment variables follow `docs/engineering/environment-guidelines.md`. Their typed Nest mapping follows `docs/engineering/service-configuration-guidelines.md`.

## Consuming business-package TypeORM contributions

The producer contract for a TypeORM-backed business package is owned by `docs/engineering/package-guidelines.md`. A hosting service consumes that package through its public integration contracts; it does not redefine how the package exposes entities, migrations, persistence ports, adapter factories, or its runtime manifest.

For the standard execution path, register the package's `@agentic-workspace/<package>/runtime` manifest through `@agentic-workspace/runtime-executions/nest`. The shared Nest adapter composes the manifested package schema and persistence providers around the service-owned `DataSource`, including the transaction-aware `DataSource` where required.

The service MUST NOT deep-import package entity, migration, mapper, repository, handler, or concrete persistence implementation files, move package-owned schema into the service, or recreate package-grouped persistence provider wrappers. The real `DataSource` lifecycle and migration execution remain service-owned.

When the service-local TypeORM CLI needs the hosted business-package schema, derive it from the same hosted manifest list with `collectRuntimePackageTypeOrmSchema(hostedPackages)` where practical. Use the owning package's public integration contracts for other capabilities that are not part of that hosted manifest list.

## Canonical service structure

For a service named `<service>`:

```text
infrastructure/persistence/typeorm/
├── <service>-typeorm.module.ts
├── typeorm-options.ts
├── data-source.ts
└── migrations/                 # only service-owned schema artifacts when needed
```

Business-package and shared-runtime entities/migrations remain with their owning packages and are composed through public integration contracts. Empty generator-owned `entities/`, `repositories/`, or `migrations/` directories are not evidence that externally owned schema belongs to the service.

### `<service>-typeorm.module.ts`

Owns the Nest runtime integration.

Use `TypeOrmModule.forRootAsync(...)` with typed service config from `docs/engineering/service-configuration-guidelines.md`.

The runtime options factory MUST reuse the service-local pure TypeORM connection-options factory and may add Nest-only options such as `autoLoadEntities: true`.

For the standard execution path, package-owned persistence entities/providers are composed from hosted runtime manifests by `RuntimeExecutionsModule.register([...packages])`. The service TypeORM module retains `TypeOrmModule.forRootAsync(...)` and any service-owned or unrelated capability registration, but does not recreate the shared execution persistence graph.

Do not manually initialize or destroy the `DataSource`.

### `typeorm-options.ts`

Owns pure mapping from typed service database config to common TypeORM connection options used by runtime and CLI.

The factory MUST:

- accept typed service database config rather than `process.env`;
- map host, port, username, password, and database name once;
- set `synchronize: false`;
- avoid Nest module/lifecycle concerns;
- avoid entity/migration discovery concerns that differ between runtime and CLI.

This factory is service-local. Do not create a generic shared database package until multiple proven consumers require behavior that cannot remain a small repeated vendor integration shell.

### `data-source.ts`

Exists only for the TypeORM CLI contract.

It MUST:

- obtain configuration through the same callable service config factory used by Nest registration;
- reuse `typeorm-options.ts`;
- compose explicit entities and migrations for all schema hosted by that service; for business packages use `collectRuntimePackageTypeOrmSchema(hostedPackages)` from the same hosted manifest list where practical, plus public contracts for other runtime capabilities and genuinely service-owned artifacts;
- export a `DataSource` instance for the TypeORM `-d` option;
- keep `migrationsRun: false`;
- contain no duplicate raw-environment parsing or duplicate connection-field mapping.

It MUST NOT deep-import another package's private entity/migration files and MUST NOT be imported as the Nest runtime connection provider.

## Runtime DataSource and observability

The Nest-managed `DataSource` is the canonical runtime database object.

Infrastructure concerns that genuinely need runtime database state may inject the Nest-managed `DataSource` directly or use Nest's `@InjectDataSource()` helper when named data sources are introduced. Such adapters may observe runtime database state but MUST NOT take ownership of initialization or shutdown.

Do not expose `DataSource` to application/domain code. Business-package TypeORM factories and shared-runtime persistence composition are infrastructure boundaries; application/domain behavior continues to depend on their owned ports/contracts rather than TypeORM.

## Shared EDP runtime persistence consumption

Services that use durable EDP execution with TypeORM MUST consume the focused public integrations provided by `@agentic-workspace/runtime-executions`; they MUST NOT copy their schemas, adapters, transaction propagation, or recovery/fencing behavior into a service.

The service remains the owner of the real Nest-managed `DataSource`. Shared runtime integrations compose around that service-owned lifecycle; they do not replace it.

### Transactional Operation execution

For EDP Operations that require transactional TypeORM participation:

- use `@agentic-workspace/runtime-executions/typeorm` for the shared execution-transaction boundary;
- let `@agentic-workspace/runtime-executions/nest` supply the transaction-aware `DataSource` to manifested business-package persistence factories and shared runtime stores that must participate in the Operation transaction;
- keep business packages unaware of service transaction plumbing;
- do not create service-local transaction contexts, repository-switching proxies, or `QueryRunner` execution adapters.

The exact transaction-context/proxy/QueryRunner implementation is owned and tested by `packages/runtime-executions` and is intentionally not reproduced here.

### Execution log and Outbox

Transactional services use:

```text
@agentic-workspace/runtime-executions/execution-log/typeorm
@agentic-workspace/runtime-executions/outbox/typeorm
```

The standard Nest adapter composes these stores and their runtime entities around the service-owned database. Keep execution-log and Outbox state in that database rather than creating a central database or service-local copies of the adapters/schemas.

When the runtime path requires participation in the active Operation transaction, the adapter binds these stores to the same transaction-aware `DataSource` boundary used by business persistence.

Outbox publication is CDC-owned. Services MUST NOT add a service-local polling publisher or delivery-lifecycle state merely to replace the established shared boundary.

Detailed execution-log ownership/fencing and Outbox persistence/projection invariants are implementation-owned by `packages/runtime-executions/AGENTS.md`.

### Durable UseCase execution

Services using durable EDP UseCases consume:

```text
@agentic-workspace/runtime-executions/use-case-execution/typeorm
```

Under the standard Nest runtime, `@agentic-workspace/runtime-executions/nest` composes its entity/store around the real service-owned `DataSource`; services do not construct a service-local store provider.

UseCase execution persistence owns short durable state transitions; it does not create one SQL transaction spanning the child Operations/Reads orchestrated by a UseCase. Services MUST NOT create a service-local UseCase execution table/store or add recovery/lease/progress behavior around the shared implementation.

Detailed claim/reclaim/fencing/replay/schema semantics are owned by `packages/runtime-executions/AGENTS.md` and its tests.

### Testing ownership

Service tests verify only service-owned database composition where that composition introduces behavior worth proving. Shared runtime adapter concurrency, transaction-propagation, fencing, projection, and replay behavior belongs to `packages/runtime-executions` tests. Do not repeat those implementation tests from a hosting service.

## Schema evolution

Schema evolution is migration-driven.

MUST:

- keep `synchronize: false`;
- keep each migration with the schema owner: business-package migrations remain in that package, shared-runtime migrations remain in the runtime package, and genuinely service-owned migrations remain in the service;
- use TypeORM migrations for schema changes;
- compose all migrations required by the service database into the service-local CLI `DataSource`;
- keep application bootstrap from silently applying pending migrations.

The hosting service owns migration execution/order and migration history for its database even when migration classes are contributed by hosted packages.

A migration contains both `up` and, when safely possible, `down` behavior. Review generated SQL before relying on a generated migration.

## Canonical migration commands

Every database-owning service exposes Nx targets backed by its package scripts for:

```text
migration:generate
migration:run
migration:revert
migration:show
```

The package scripts invoke the repository-installed TypeORM CLI with the service-local `data-source.ts` through `-d`.

Run normal migration commands through Nx from the repository root so environment loading follows `docs/engineering/environment-guidelines.md`.

For the API reference, the canonical commands are:

```bash
pnpm nx run @agentic-workspace/api:migration:generate --name=CreateSomething
pnpm nx run @agentic-workspace/api:migration:show
pnpm nx run @agentic-workspace/api:migration:run
pnpm nx run @agentic-workspace/api:migration:revert
```

A generated service uses the same target names with its own Nx project identity.

Migration generation output MUST be placed with the owner of the schema being changed. A service-local migration target is appropriate only for genuinely service-owned schema; a business-package or shared-runtime schema change belongs with its owning package artifacts. Do not relocate package migrations into a service merely because the service owns the CLI `DataSource`.

`migration:run` applies pending migrations, `migration:show` reports applied/pending state, and `migration:revert` reverts the latest applied migration.

## Local, CI, and deployment behavior

Local development and CI supply the owning service's environment externally and run migrations explicitly.

CI SHOULD apply migrations before database-backed tests and runtime smoke checks.

Deployment MUST have an explicit migration step/job before runtime code depends on a new incompatible schema. Runtime bootstrap MUST NOT use `migrationsRun: true` as a substitute for deployment orchestration.

## Canonical references

[upstream example: apps/api](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api) is the proven reference for the service-owned `DataSource` lifecycle/configuration shell:

- [upstream example: apps/api/src/app/infrastructure/config/api.config.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api/src/app/infrastructure/config/api.config.ts) exposes the callable typed service config factory;
- [upstream example: apps/api/src/app/infrastructure/persistence/typeorm/typeorm-options.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api/src/app/infrastructure/persistence/typeorm/typeorm-options.ts) owns common TypeORM connection options;
- [upstream example: apps/api/src/app/infrastructure/persistence/typeorm/api-typeorm.module.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api/src/app/infrastructure/persistence/typeorm/api-typeorm.module.ts) uses `TypeOrmModule.forRootAsync(...)` for runtime;
- [upstream example: apps/api/src/app/infrastructure/persistence/typeorm/data-source.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api/src/app/infrastructure/persistence/typeorm/data-source.ts) is the CLI-only `DataSource` adapter.

[upstream example: apps/services/documents](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/documents) is the proven business-service reference for composing business-package and shared-runtime TypeORM contributions into a service-owned database.

When a business service hosts a TypeORM-backed business package through the standard runtime, register its `@agentic-workspace/<package>/runtime` manifest and let `@agentic-workspace/runtime-executions/nest` compose runtime persistence around the service-owned `DataSource`; do not move package artifacts into the service.

## Generator contract

The service generator may reproduce only the reusable vendor integration shell:

- service-prefixed DB env/config fields;
- service-local `typeorm-options.ts`;
- Nest `TypeOrmModule.forRootAsync(...)` shell;
- CLI `data-source.ts` shell;
- migration targets/scripts.

Create service-local `entities/`, `repositories/`, or `migrations/` directories only when a concrete service-owned artifact needs them. Empty tracked directories are not part of the generated contract.

The generator MUST NOT copy API-specific entities, health behavior, migrations, repository adapters, physical database topology, package-owned business/runtime entities/migrations, package persistence adapters/factories, or a custom database lifecycle abstraction.

Adding a standard runtime package to a generated service is a composition step performed after generation: register its runtime manifest rather than modifying the generator to copy package persistence artifacts or execution wiring.
