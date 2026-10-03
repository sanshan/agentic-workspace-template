# HTTP Presenter Engineering Guidelines

References labeled “upstream example” describe the source project at a pinned revision; they are not local files or required applications. Reuse only the relevant responsibilities.

These rules define the reusable HTTP presentation boundary for internal Nest services in Agentic Workspace.

Apply them when a service exposes `presenters/http`. They complement `docs/engineering/service-guidelines.md` and `docs/engineering/observability-and-http-errors.md`; they do not make HTTP mandatory for every internal service.

This guide is the canonical engineering owner for ordinary HTTP failure presentation, Problem Details usage, endpoint OpenAPI error contracts, and the separation between ordinary errors and the health HTTP contract. `docs/engineering/observability-and-http-errors.md` owns failure classification, retry ownership, logging, and telemetry rather than HTTP status or presentation policy.

## Canonical implemented references

Use the closest proven implementation for the responsibility being changed:

- [upstream example: apps/services/documents/src/app/presenters/http/documents](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/documents/src/app/presenters/http/documents) is the current business HTTP presenter reference for concrete UseCase invocation, request identity, file upload, DTO mapping, expected-result HTTP presentation, endpoint-specific `@ApiEndpoint(...)`, and controller tests.
- `@agentic-workspace/runtime-presenters/http/health` is the implementation owner for reusable Nest/Terminus liveness and readiness HTTP adaptation.
- [upstream example: apps/api](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api) and [upstream example: apps/services/documents](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/documents) are the proven running-service consumers of the shared health adapter: API preserves its global `/api` prefix, while Documents exposes the relative routes directly as `/health/live` and `/health/ready`.
- `@agentic-workspace/runtime-presenters/http` is the implementation owner for reusable HTTP request-identity middleware and decorators.
- `@agentic-workspace/runtime-presenters/http/errors` owns canonical Problem Details definitions/runtime mappings; `/http/errors/nest` owns Nest global ordinary-error composition.
- `@agentic-workspace/runtime-presenters/http/openapi` owns compact endpoint-specific error declarations and canonical OpenAPI projection.

These references are not templates requiring every endpoint to contain every file or dependency.

## HTTP service runtime

Adding a `presenters/http` boundary makes the hosting service an HTTP server process. The service must have a complete runnable HTTP bootstrap rather than remain an application-context-only Nest process.

A service with HTTP presenters MUST:

- create the Nest application with `NestFactory.create(...)`, not only `createApplicationContext(...)`;
- expose its listen port through the canonical typed service configuration boundary;
- use `@agentic-workspace/runtime-config` as the raw port owner when the same port is consumed by workspace/E2E tooling;
- obtain the namespaced service config through its existing `registerAs` `KEY` / `ConfigType` contract in `main.ts`;
- call `app.listen(config.port)` during bootstrap;
- preserve shutdown hooks and other lifecycle behavior already owned by the service.

Use [upstream example: apps/api/src/main.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api/src/main.ts) and [upstream example: apps/api/src/app/infrastructure/config/api.config.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api/src/app/infrastructure/config/api.config.ts) as the current HTTP bootstrap/configuration reference. Do not hard-code ports in bootstrap code or validate the same raw port in more than one owner.

When a service consumes shared runtime observability, use `@agentic-workspace/runtime-observability/nest` for Nest/Pino/OpenTelemetry lifecycle composition and structured startup logging rather than recreating service-local logger/telemetry configuration. The cross-cutting ownership rules are in `docs/engineering/observability-and-http-errors.md`.

The base internal-service generator remains transport-agnostic. Do not add an HTTP listener to every generated service merely because some services expose HTTP presenters.

## Responsibility and dependency direction

HTTP presenters own transport concerns only:

```text
HTTP request
    ↓
controller / HTTP presenter
    ↓
application-facing boundary
    ↓
application behavior
```

Presenters MAY depend on concrete service UseCases and application-facing input/result types needed to invoke them.

Presenters MUST NOT:

- call Runner, Reader, Operation/Read handlers, repositories, TypeORM, ObjectStorage, or other infrastructure boundaries directly when a UseCase owns that orchestration;
- move business rules or application orchestration into controllers, DTOs, or mappers;
- pass Nest, Express, Multer, request, or DTO types into application/UseCase code;
- expose application/domain/UseCase result objects directly as HTTP response contracts merely for convenience.

Controllers remain thin transport adapters.

System health endpoints are technical runtime behavior rather than durable business UseCases. Consume `@agentic-workspace/runtime-presenters/http/health` and supply transport-independent `ReadinessCheck` instances from `@agentic-workspace/runtime-health` through service composition. For PostgreSQL readiness, use `@agentic-workspace/runtime-health/typeorm` with the hosting service's existing Nest-managed `DataSource`. Do not force `UseCaseExecutor` into health endpoints or recreate a service-local health controller/indicator flow solely for structural symmetry.

## Placement

Organize HTTP presentation by feature/capability under:

```text
presenters/http/<feature>/
```

Use the smallest structure required by the feature. A normal business HTTP feature may contain:

```text
presenters/http/<feature>/
├── <feature>.controller.ts
├── <feature>.controller.spec.ts
├── dto/
│   ├── <action>.request.dto.ts
│   └── <action>.response.dto.ts
└── mappers/
    └── <action>.response.mapper.ts
```

Do not create empty symmetry-only directories or generic base controllers/mappers. Add only files required by concrete endpoints.

Keep presenter-owned Nest module/composition wiring at the nearest presenter module boundary established by the service. Do not put HTTP composition into application or infrastructure modules.

## Business controllers and durable UseCases

Concrete service UseCases are Nest providers and MUST be obtained through constructor DI. Controllers MUST NOT instantiate UseCases, reconstruct their stable dependencies, or manually resolve them from the Nest container.

When an HTTP business endpoint invokes a durable concrete UseCase, preserve the service execution boundary from `docs/engineering/service-guidelines.md`: submit that UseCase through the service-wide EDP `UseCaseExecutor`; do not call `useCase.execute()` directly merely because the UseCase is injectable.

For such an endpoint, the controller owns only transport adaptation and invocation assembly:

1. extract and validate transport input;
2. obtain request identity/context values through the shared HTTP runtime utilities when required;
3. construct the concrete UseCase input and typed UseCase context;
4. submit the concrete UseCase through `UseCaseExecutor`;
5. map the result to the HTTP response contract.

Invocation-specific metadata remains explicit. Do not introduce request-scoped UseCases, ambient current-user/current-tenant providers, presenter-local AsyncLocalStorage, or similar hidden state to avoid constructing the typed UseCase context.

## Actor and tenant request identity

Use the shared HTTP presenter runtime from `@agentic-workspace/runtime-presenters/http` for request identity. That package owns parsing/validation behavior and the canonical header contract; service code MUST NOT reproduce raw identity-header names or parse them independently.

A presenter module whose controllers use `@Actor()` or `@Tenant()` MUST apply `httpRequestIdentityMiddleware` to those routes before controller invocation.

Scope request-identity middleware to the business routes that require it. Reusable health routes from `@agentic-workspace/runtime-presenters/http/health` do not acquire Actor/Tenant requirements merely because another controller in the same service uses request identity. [upstream example: apps/services/documents](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/documents) is the proven reference for this route-scoped composition.

The middleware/decorators represent a trusted-upstream identity contract, not authentication or authorization. Production exposure requires an upstream auth/gateway boundary that authenticates callers, removes untrusted caller-supplied Agentic Workspace identity headers, validates the upstream contract, and injects trusted values.

Controllers use the shared extraction decorators and pass only identity values required by the concrete application context. A UseCase that needs actor but not tenant MUST NOT receive tenant merely because it is available on the request.

UseCases remain unaware of HTTP request objects, trusted headers, middleware, and presenter decorators.

For the exact request-identity implementation invariants, change `@agentic-workspace/runtime-presenters/http` under its own package instructions rather than duplicating those rules in service documentation.

## DTO ownership and transport validation

DTOs are HTTP contracts and belong inside the HTTP presenter boundary.

Request DTOs own HTTP-visible request shape and transport validation. They MUST NOT be imported into application/domain code or reused as UseCase input types merely for convenience.

Response DTOs own the HTTP-visible response shape. Controllers MUST NOT expose application/domain/UseCase result objects directly when an explicit HTTP contract is required.

If an endpoint has no structured body/query contract, do not create a request DTO just for symmetry.

Use standard Nest validation/binding primitives when they already express the transport rule. Do not add a custom validator or abstraction when Nest owns the behavior.

### Uploaded files

For a normal single multipart upload, use Nest's standard file primitives such as `FileInterceptor`, `@UploadedFile`, and `ParseFilePipe` / `ParseFilePipeBuilder`.

Use Nest's built-in file validators such as `MaxFileSizeValidator` when file-size validation is required. Do not implement uploaded-file size as a `class-validator` decorator while the Nest file validator owns that concern.

When application input already accepts `Uint8Array`, an in-memory Multer `Buffer` may be passed as `file.buffer` without copying solely to convert it. Keep `Express.Multer.File` and other Multer metadata inside the HTTP boundary unless a concrete application requirement needs that metadata.

## Response mapping

Every application/UseCase result exposed as a business HTTP response MUST have an explicit presenter mapping step to its response contract.

Feature-specific response mappers belong under the feature presenter boundary, for example:

```text
presenters/http/<feature>/mappers/
```

A presenter mapper MAY select, rename, flatten, or format values for the HTTP contract. It MUST NOT implement business decisions, persistence translation, authorization, or application orchestration.

Do not introduce generic mapper interfaces/base classes until repeated implemented endpoints prove a concrete need.

## Ordinary HTTP error contract

Ordinary application/framework failures use the canonical RFC 9457-compatible `application/problem+json` contract from `@agentic-workspace/runtime-presenters/http/errors`; Nest installs the shared filter through `/http/errors/nest`.

Failure classification itself remains owned by EDP and the concrete adapters described in `docs/engineering/observability-and-http-errors.md`. At the HTTP boundary, presentation is owned here and follows this canonical flow:

- classified `ExecutionFailureError` maps by `executionFailure.code` only;
- an expected application/business result remains a normal result below the presenter and is explicitly selected as a canonical `HttpProblemDefinition` by the presenter when the public HTTP contract is non-2xx;
- ordinary Nest `HttpException` status maps to the canonical problem family;
- unknown thrown values become the safe internal problem without exposing internal diagnostics;
- an active OpenTelemetry `traceId` may appear as a safe support reference.

HTTP mapping MUST NOT inspect an execution failure message or `retryable` to decide status. Do not throw an EDP failure merely to represent an expected application result that the presenter exposes as a non-2xx public contract.

Do not create service-local Problem Details DTOs, exception filters, failure-code tables, or retryability/message-to-status mappings while the shared runtime owns them. Expected business/client problems are not automatically terminal server-error logs.

## OpenAPI endpoint contracts

For ordinary business/application endpoints with endpoint-specific public errors, use one compact declaration from `@agentic-workspace/runtime-presenters/http/openapi`:

```ts
@ApiEndpoint({ errors: [NOT_FOUND_HTTP_PROBLEM] })
```

The supplied values are canonical `HttpProblemDefinition`s. Controllers MUST NOT repeat their status/title/type/schema literals with `@ApiNotFoundResponse`, `@ApiConflictResponse`, or similar stacks.

`@ApiEndpoint` owns only endpoint-specific public error projection. It MUST NOT own or duplicate successful status configuration, replace HTTP verb decorators/`@HttpCode(...)`, infer errors from the filter/call graph, or require generic internal errors to be listed on every method.

Nest defaults and explicit `@HttpCode(...)` remain runtime truth for successful statuses. Successful schema discovery remains on the standard Nest/Swagger path. Build OpenAPI through `createOpenApiDocument(...)`; it preserves normal Nest/Swagger success metadata and then projects canonical endpoint problems, grouping variants sharing one HTTP status into one response.

Business packages remain independent of Swagger; these declarations belong at the HTTP presenter boundary.

## Health and ordinary errors remain separate

Health remains owned by `@agentic-workspace/runtime-presenters/http/health` and Terminus. Do not convert health failures to Problem Details or add ordinary `@ApiEndpoint` declarations merely for visual uniformity.

The generic ordinary-error filter MUST NOT special-case `/health` URL strings. The shared health controller owns its own filter boundary so Terminus response semantics remain intact even when the global ordinary-error filter is installed.

## Presentation tests

Controller/presenter tests own only behavior introduced by the HTTP boundary. Use mocked/stubbed application/runtime collaborators rather than exercising persistence or EDP internals through controller tests.

For business UseCase endpoints, test when applicable that:

- transport input becomes the exact expected UseCase input;
- actor/tenant and other presenter-owned invocation metadata are placed into the expected concrete UseCase context;
- the intended UseCase is submitted through `UseCaseExecutor` once for a valid invocation;
- the application result is mapped to the expected HTTP response;
- material Nest-owned binding/validation behavior that forms part of the HTTP contract is configured correctly;
- material expected application results are selected as the intended canonical public problem;
- representative generated OpenAPI uses canonical endpoint errors and the real Nest success status without duplicated success configuration.

Presenter tests MUST NOT duplicate:

- UseCase specification behavior;
- Runner/Reader/UseCaseExecutor semantics;
- Operation/Read handler behavior;
- persistence, transaction, recovery, idempotency/deduplication, or ObjectStorage behavior;
- request-identity parsing/validation behavior owned by `@agentic-workspace/runtime-presenters/http`;
- shared Problem Details/filter/OpenAPI projection semantics owned by `runtime-presenters`.

Shared health HTTP adapter behavior is owned and tested by `@agentic-workspace/runtime-presenters/http/health`. A consuming service should retain only the integration evidence that its own composition supplies the expected readiness checks and route prefix; do not recreate duplicate service-local health presenter tests.

## HTTP service E2E

Create the E2E project for an internal HTTP service with:

```bash
pnpm nx g @agentic-workspace/generators:service-e2e <name>
```

The canonical layout and identity are:

```text
apps/services/<name>-e2e -> @agentic-workspace/<name>-service-e2e
```

The service MUST already satisfy the HTTP runtime contract above before adding its E2E harness. The service-E2E generator owns the reusable Jest/SWC support project, dependency on the target service, migration + HTTP-server orchestration, and the `e2e` serve configuration it adds.

Service E2E Jest projects use their explicit `e2e` target rather than the root `@nx/jest/plugin` generic `test` inference. The base service generator remains transport-agnostic and MUST NOT receive E2E-specific serve configuration preemptively.

Use [upstream example: apps/api-e2e](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api-e2e) as the global-prefix health E2E reference and [upstream example: apps/services/documents-e2e](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/documents-e2e) as the internal-service HTTP E2E reference, including health routes without a global prefix and without business request-identity headers. E2E may verify service-owned HTTP integration, but MUST NOT duplicate lower-boundary semantics already covered by their owners.

The proven cross-service ordinary-error evidence is intentionally small: API unknown-route failures and Documents business/framework failures use the same Problem Details envelope conventions, accept a safe active `traceId` reference, and do not expose stack/cause; both services keep health on the separate Terminus contract. Do not add artificial production failure endpoints solely for error-contract testing.

## Current omissions

This guidance intentionally does not define behavior that has not yet established a reusable implementation pattern, including:

- gateway/authentication implementation behind the trusted-upstream contract;
- authorization policy;
- non-HTTP presenters.

Add such reusable rules only after a concrete requirement and proven implementation establish them.
