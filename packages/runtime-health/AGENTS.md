# Runtime Health Agent Rules

These rules apply to `@agentic-workspace/runtime-health` in addition to root and `packages/AGENTS.md`.

## Responsibility

`@agentic-workspace/runtime-health` owns reusable, transport-independent service health contracts and technical health capabilities.

The root entrypoint stays framework-agnostic. It MUST NOT depend on NestJS, Terminus, TypeORM, EDP, or concrete services.

`ReadinessCheck` is the canonical readiness boundary:

- `name` is the stable identity used by adapters when reporting the check;
- `check()` resolves when the dependency/capability is ready;
- `check()` rejects when it is not ready;
- transport-specific status codes, response DTOs, logging, and error presentation do not belong in this contract.

## TypeORM subpath

`@agentic-workspace/runtime-health/typeorm` is the canonical TypeORM database-readiness capability.

It owns:

- the write/read/marker-validation/cleanup readiness probe;
- the database health probe entity and schema migration;
- `RUNTIME_HEALTH_TYPEORM_ENTITIES` and `RUNTIME_HEALTH_TYPEORM_MIGRATIONS` composition exports;
- the factory that creates a readiness check from an already managed TypeORM `DataSource`.

The hosting service owns the real `DataSource` lifecycle and configuration, composes the exported entity/migration contributions into its runtime and CLI TypeORM boundaries, and remains responsible for executing migrations.

The shared migration deliberately preserves the historical API migration identity `CreateDatabaseHealthProbes1787040000000`. Do not rename or retimestamp it while existing databases may already contain that migration history entry.

Nest/Terminus HTTP presentation belongs to `@agentic-workspace/runtime-presenters/http/health`, not this package.

## Boundaries

MUST NOT:

- initialize, destroy, or configure a consuming service's production `DataSource`;
- parse service configuration or environment variables in production package code;
- route health checks through `UseCaseExecutor`, Runner, Reader, or other EDP execution mechanisms merely for symmetry;
- add service-specific dependencies;
- introduce registries, background polling, caching, metrics, or additional health states without a concrete consumer requirement;
- duplicate transport or persistence behavior owned by another package.

Keep dependencies and public exports minimal. Add tests only for runtime behavior owned by this package; TypeScript-only contract shape is verified by typecheck/build rather than behaviorless tests.
