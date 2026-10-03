# Runtime Presenter Package Rules

These rules apply to `packages/runtime-presenters/` in addition to the root workspace rules and `packages/AGENTS.md`.

`@agentic-workspace/runtime-presenters` is a technical runtime package, not a business feature package. Keep the root entrypoint intentionally minimal; transport-specific behavior belongs in explicit subpath entrypoints such as `@agentic-workspace/runtime-presenters/http`.

Consumer-facing internal-service HTTP guidance is owned by `docs/engineering/http-presenter-guidelines.md`. Cross-cutting failure/observability ownership is recorded in `docs/engineering/observability-and-http-errors.md`. This file owns only implementation-local invariants for changing the shared runtime-presenter package itself.

## Event presenters

`@agentic-workspace/runtime-presenters/events` owns the typed adapter from an explicit EDP `EventContract` subscription to the neutral `EventHandler` boundary provided by `@agentic-workspace/runtime-messaging`.

The canonical adapter flow is contract parse -> application metadata adaptation -> deterministic downstream Intent derivation -> `mapInput(parsedEvent)` -> supplied `UseCaseExecutor.execute(...)`.

Preserve these local invariants:

- `createSubscription(...)` is pure: it derives handler identity from the supplied contract but neither registers nor invokes anything;
- `intentSlot` is application configuration: reject an invalid slot while constructing the subscription by delegating semantic validation to the published EDP `IntentFactory`; do not copy EDP's slot format/schema locally;
- `mapInput` receives only the parsed business Event, never the envelope or execution metadata;
- the supported shared invocation context is the EDP base context plus Agentic Workspace `Actor` and `TenantReference`; a UseCase requiring additional mandatory context is not a supported subscription target until that metadata has a concrete source;
- adapt the nullable EDP `EventActor.origin` shape explicitly, but delegate Actor and TenantReference semantic validation/construction to the published EDP default factories; retain only Agentic Workspace-specific compatibility checks such as `tenant.type === tenantName` and do not duplicate EDP schema rules locally;
- derive the downstream Intent only through `IntentFactory.derive({ parent: { id: envelope.intentId }, slot: intentSlot, discriminator: envelope.eventId })`; when EDP rejects envelope-owned intent metadata, map that factory validation to the shared event-validation outcome rather than reimplementing its rules;
- invoke only the supplied `UseCaseExecutor`; do not call the subscribed UseCase directly, add retries, wrap executor failures, or reinterpret normally returned business results;
- invalid business payload/application metadata uses the shared event-validation outcome; mapper and executor failures remain thrown unchanged.

`@agentic-workspace/runtime-presenters/events/nest` owns only Nest composition for these subscriptions. `EventSubscriptionRegistrar` aggregates explicit subscription arrays into the application-local `EventHandlerRegistry` and rejects duplicate semantic `intentSlot` values across registration calls before application startup completes. It MUST NOT replace or redesign the neutral registry, create a UseCase lookup registry, scan decorators, or introduce broker lifecycle behavior.

## HTTP request identity

`@agentic-workspace/runtime-presenters/http` owns the reusable Nest HTTP adapter that establishes typed presenter request identity before controllers run.

The canonical production path is:

```text
trusted upstream identity headers
    -> httpRequestIdentityMiddleware
    -> EDP Actor / TenantReference factories
    -> request.actor / request.tenant
    -> @Actor() / @Tenant()
    -> controller
```

The canonical trusted headers are defined only by `HTTP_REQUEST_IDENTITY_HEADERS`. Do not repeat raw header names in service code.

`httpRequestIdentityMiddleware` MUST:

- require exactly one non-blank canonical actor type, actor id, and tenant id header;
- keep header multiplicity, presence, and trimming checks at the HTTP transport boundary;
- create EDP-owned Actor and TenantReference values through the published EDP default factories so EDP remains the runtime source of truth for their semantic invariants;
- map EDP identity-construction validation failures to the same unauthorized HTTP boundary without duplicating EDP schemas or validation rules locally;
- write identity values to the request only after both factory calls succeed;
- remain independent from application/domain behavior, persistence, concrete UseCases, and Nest DI.

The middleware is a trusted-upstream adapter, not authentication or authorization. It MUST NOT parse credentials, verify tokens, call persistence, infer permissions, or claim caller authenticity. Production deployment must ensure the upstream auth/gateway boundary strips untrusted caller-supplied Agentic Workspace identity headers, validates the upstream identity contract, and injects trusted values. EDP factory validation is value-contract enforcement inside the service, not caller authentication.

`@Actor()` and `@Tenant()` remain extraction-only decorators. Do not move validation or authentication into them.

Tests in this package own request-identity transport behavior and the adapter's delegation to EDP identity invariants. Service controller tests MUST NOT duplicate those cases; service E2E may send the canonical trusted headers to exercise the same production middleware path.

## HTTP errors

`@agentic-workspace/runtime-presenters/http/errors` owns canonical Problem Details definitions and runtime mapping primitives. Keep this entrypoint free from eager Nest filter composition so consumers that only need definitions do not load the filter/runtime-observability/EDP chain.

`@agentic-workspace/runtime-presenters/http/errors/nest` owns the Nest global ordinary-error composition through `HttpErrorsModule`.

The canonical behavior is:

- `HttpProblemDefinition` is the single runtime/OpenAPI source for public `code`, `status`, `title`, and `type`;
- `ExecutionFailureError` maps by `executionFailure.code` only, never by message or `retryable`;
- expected application/business results remain normal results below the presenter; when their public HTTP contract is non-2xx, the presenter explicitly selects a canonical problem through `HttpProblemException`;
- ordinary Nest `HttpException` values map by status;
- unknown thrown values become the safe internal problem without exposing stack/cause/internal detail;
- an active OpenTelemetry `traceId` may be exposed as a safe problem reference;
- expected client/business problems are not terminal server-error logs, while a non-expected terminal exception is logged with full diagnostics once at the consuming HTTP boundary.

Do not introduce another failure taxonomy, service-local HTTP code table, message/retryability-based status mapping, or global classification of unknown infrastructure errors here.

## HTTP OpenAPI

`@agentic-workspace/runtime-presenters/http/openapi` owns business/application endpoint error documentation.

`@ApiEndpoint({ errors })` accepts canonical `HttpProblemDefinition` values. `createOpenApiDocument(...)` first builds the normal Nest/Swagger document and then projects those errors, preserving these invariants:

- runtime and OpenAPI reuse the same canonical problem definitions;
- variants sharing one status are grouped under one OpenAPI response;
- successful status is not controlled by `@ApiEndpoint`; Nest defaults and explicit `@HttpCode(...)` remain runtime truth;
- successful schemas stay on the standard Nest/Swagger path;
- controllers do not repeat status/title/type/schema literals in stacks of `Api*Response` decorators;
- generic internal errors are not mechanically repeated on every endpoint.

Do not move Swagger types into `/http/errors`. Runtime error adaptation and OpenAPI projection remain separate entrypoints joined only by canonical problem definitions.

## HTTP health

`@agentic-workspace/runtime-presenters/http/health` owns the reusable Nest + Terminus adapter for internal-service liveness and readiness HTTP endpoints.

`HttpHealthModule.register(...)` is the canonical composition boundary. A consuming Nest service supplies an explicit factory for its `ReadinessCheck[]`; the shared package MUST NOT discover checks, maintain a registry, or depend on concrete service capabilities.

The adapter MUST:

- expose `health/live` and `health/ready` relative to the consuming application's global prefix;
- keep liveness independent from readiness checks;
- execute the explicitly supplied readiness checks and use each check's `name` as the Terminus indicator key;
- convert readiness failures to a down indicator without exposing the underlying error message;
- own the shared Terminus graceful-shutdown delay of 1,000 ms.

The consuming application remains responsible for its global prefix and for enabling Nest shutdown hooks. The health adapter MUST NOT set either one.

This subpath may depend on the transport-independent `@agentic-workspace/runtime-health` contract and Nest/Terminus only. It MUST NOT import `@agentic-workspace/runtime-health/typeorm`, TypeORM, service modules, business packages, EDP execution packages, or concrete readiness checks.

Health remains a separate Terminus-owned system contract even when the global ordinary-error filter is installed. Preserve that through the shared health controller/filter ownership boundary; do not add URL-string health checks to the generic error filter and do not require ordinary `@ApiEndpoint`/Problem Details declarations on health methods.

Tests here own the HTTP adapter behavior: route composition, liveness isolation, readiness success/failure mapping, stable indicator names, sensitive-error suppression, and graceful-shutdown response. Service tests should retain only integration evidence that the service supplies its own checks correctly.
