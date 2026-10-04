# Internal Service Configuration Guidelines

References labeled “upstream example” describe the source project at a pinned revision; they are not local files or required applications. Reuse only the relevant responsibilities.

These rules define the canonical configuration boundary for internal Nest services in Agentic Workspace.

The current [upstream example: apps/api](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api) implementation is the proven reference. Follow its pattern before introducing a new configuration abstraction.

## Ownership

Every configuration value has one owner.

- `@agentic-workspace/runtime-config` owns only values that genuinely need a cross-project runtime contract, such as values consumed by an application and workspace/E2E tooling.
- A Nest service owns values that only that service/runtime needs.
- A value MUST have one validation owner. A service config may compose an already-validated value from `@agentic-workspace/runtime-config`, but MUST NOT validate the same raw environment variable again.
- Application and domain code MUST NOT read `process.env` or depend on Nest configuration APIs.

Environment loading and variable naming rules are defined in `docs/engineering/environment-guidelines.md`.

## Canonical service structure

For a service named `<service>`, configuration belongs under:

```text
infrastructure/config/
├── <service>-env.schema.ts
├── <service>.config.ts
└── <service>-config.module.ts
```

### `<service>-env.schema.ts`

Owns validation of raw environment variables that belong only to the service.

MUST:

- use the existing Zod validation approach;
- validate only service-owned raw variables;
- reuse shared schemas such as `PortSchema` when the primitive itself is shared;
- remain free of Nest module/DI concerns.

MUST NOT duplicate validation for raw variables already owned by `@agentic-workspace/runtime-config`.

### `<service>.config.ts`

Owns the service configuration factory.

Expose a callable `create<Service>Config()` factory and register that exact factory with `registerAs('<service>', create<Service>Config)`.

The callable factory:

- reads service-owned raw values from `process.env` only here;
- parses them through `<service>-env.schema.ts`;
- composes already-validated shared values from `@agentic-workspace/runtime-config` where required;
- returns one typed object containing the service runtime configuration used by bootstrap/infrastructure composition;
- may be called by another process-owned adapter, such as the service-local TypeORM CLI `data-source.ts`, so that raw env parsing/mapping is not duplicated.

Do not create a second hand-written interface for the returned shape when `ConfigType<typeof <service>Config>` can infer it.

### `<service>-config.module.ts`

Owns Nest registration only.

The canonical shape is a small module that:

- imports `ConfigModule.forFeature(<service>Config)`;
- exports `ConfigModule` so consuming runtime/infrastructure modules can inject the registered config;
- contains no business behavior or environment parsing.

## Injection and consumption

Use the token already provided by `registerAs`:

```ts
inject: [serviceConfig.KEY]
```

Use the inferred type:

```ts
ConfigType<typeof serviceConfig>
```

MUST NOT create a parallel custom config token or duplicate configuration interface without a concrete need that `registerAs` cannot satisfy.

Allowed consumers include:

- `main.ts` for bootstrap concerns such as the listen port;
- infrastructure/runtime composition modules for database/provider/client construction.

Application/domain code MUST stay configuration-framework independent. Pass only the specific values/capabilities required by business/application behavior rather than injecting service config there.

## Validation behavior

Configuration validation is fail-fast.

Within one process, a raw variable is validated by its owning configuration boundary when that configuration is constructed. Validation logic MUST NOT be copied into multiple layers.

Different processes may execute the same callable owning factory independently. For example, the Nest runtime and TypeORM CLI are separate processes and both may call the same service config factory. Database runtime/CLI sharing then follows `docs/engineering/database-guidelines.md`.

## Canonical API reference

[upstream example: apps/api](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api) is the current reference implementation:

- [upstream example: apps/api/src/app/infrastructure/config/api-env.schema.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api/src/app/infrastructure/config/api-env.schema.ts)
- [upstream example: apps/api/src/app/infrastructure/config/api.config.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api/src/app/infrastructure/config/api.config.ts)
- [upstream example: apps/api/src/app/infrastructure/config/api-config.module.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api/src/app/infrastructure/config/api-config.module.ts)
- [upstream example: apps/api/src/main.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api/src/main.ts)
- [upstream example: apps/api/src/app/infrastructure/persistence/typeorm/api-typeorm.module.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api/src/app/infrastructure/persistence/typeorm/api-typeorm.module.ts)

The API demonstrates:

```text
process.env / @agentic-workspace/runtime-config
                  ↓
      callable service config factory
                  ↓
       registerAs + ConfigModule
                  ↓
       typed bootstrap/infrastructure
```

New internal services SHOULD follow this proven shape unless a concrete requirement demonstrates that it is insufficient.

## Generator contract

The canonical `@agentic-workspace/generators:service` generator may generate only this reusable configuration shell:

- service-owned env schema file;
- callable namespaced `registerAs` config factory;
- config module using `ConfigModule.forFeature`;
- typed `KEY`/`ConfigType` consumption pattern.

Database-specific generated structure follows `docs/engineering/database-guidelines.md`.

The generator MUST NOT invent service-specific variables, physical database topology, provider configuration, or a generic shared Nest configuration framework.
