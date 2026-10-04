# Runtime Observability Agent Rules

These rules apply to `@agentic-workspace/runtime-observability` in addition to root and `packages/AGENTS.md`.

## Responsibility

`@agentic-workspace/runtime-observability` owns reusable service logging and observability composition for Agentic Workspace runtime hosts.

The root entrypoint owns framework-agnostic structured logging policy, diagnostics, OpenTelemetry SDK composition, and adapters from published EDP observer contracts. Nest-specific lifecycle/composition lives under `@agentic-workspace/runtime-observability/nest`.

Pino is the canonical production logger. Production output is structured stdout/stderr suitable for external collection; this package MUST NOT synchronously deliver logs to a remote backend on request execution paths.

## Error diagnostics

EDP `ExecutionFailureError` remains the canonical classified execution failure. Logging MUST preserve its `executionFailure.code`, `executionFailure.retryable`, message, stack, and safe cause chain without defining another failure taxonomy.

Unknown `Error` instances remain ordinary diagnostic errors and MUST NOT be assigned an EDP failure code or retryability. Non-Error thrown/cause values MUST NOT cause arbitrary application objects to be serialized into logs.

A terminal thrown exception is logged with full diagnostics once at the boundary that consumes the occurrence. Lower layers MUST NOT catch-log-rethrow the same exception. Expected business/client outcomes are not server errors merely because an HTTP adapter may later present them as non-2xx responses.

EDP observer events are lifecycle facts, not terminal-error payloads. Observer adapters MUST NOT invent failure codes/messages/stacks/causes that are absent from the published observation contract.

## Sensitive data

Logging is deny-by-default for request payloads and identity/security data:

- automatic HTTP request/response logging is disabled by the shared Nest adapter;
- request/response bodies and uploaded file bytes MUST NOT be logged by default;
- authorization values, cookies, passwords, tokens, API keys, secrets, and trusted Agentic Workspace actor/tenant headers MUST NOT appear in logs;
- shared serializers expose only bounded HTTP metadata when a request/response object is explicitly logged;
- arbitrary DTOs or persistence/application objects MUST NOT be logged merely for convenience.

Keep central Pino redaction enabled as defense in depth even when a serializer already omits sensitive fields.

## OpenTelemetry

OpenTelemetry SDK and EDP observer adaptation are owned here; EDP execution semantics remain owned by EDP.

- OTLP exporters target a standard OpenTelemetry Collector-compatible endpoint;
- traces MUST use batching rather than synchronous per-span remote export;
- push metrics MUST use periodic export rather than synchronous request-path delivery;
- Runner/Reader/UseCaseExecutor adapters consume only the published EDP observation fields;
- Runner `attempt.*` / `retry.scheduled` and Reader `read.attempt.*` / `read.retry.scheduled` are the only sources for execution retry telemetry;
- UseCaseExecutor MUST NOT gain synthetic retry events or metrics;
- Intent IDs, correlation IDs, attempt IDs/numbers, actor/entity/cache identities, messages, and stacks MUST NOT become metric labels;
- stable UseCase/operation/read names, lifecycle event names, bounded outcomes/scopes/reasons, and retryable booleans are acceptable bounded metric dimensions;
- tenant is not a metric dimension by default;
- high-cardinality correlation values may be trace attributes where useful;
- OpenTelemetry `traceId` and EDP `correlationId` are separate identities and MUST NOT be collapsed;
- observer/exporter failure MUST NOT change Runner/Reader/UseCaseExecutor semantics. EDP `SafeObserver` remains the execution-side failure-isolation owner;
- EDP metric instruments MUST bind to the current global `MeterProvider` when observations are recorded and rebind if that provider changes, because runtime observer bundles may be constructed before the hosting Nest lifecycle starts the OpenTelemetry SDK.

`createEdpOpenTelemetryObservers()` is the canonical adapter bundle. Stable EDP UseCase, Operation, and Read identities map to the shared `edp.name` metric dimension; their boundary-specific identity may also be retained as trace attributes. `@agentic-workspace/runtime-executions/nest` creates this bundle once for its Runner/Reader/UseCaseExecutor composition; hosting services MUST NOT create service-local EDP observer providers.

## Nest adapter

`@agentic-workspace/runtime-observability/nest` owns the smallest common Nest/Pino/OpenTelemetry lifecycle composition.

- services register the shared module once with service identity and optional version/environment metadata;
- OTLP SDK initialization is enabled by supplying the module's `telemetry` options and is shut down through Nest application lifecycle;
- `pino-http` request context may be used, but automatic HTTP access/error logging remains disabled to avoid duplicate terminal exception records and accidental request payload/header exposure;
- service application/bootstrap code may select the exported Nest logger as the Nest application logger;
- business/domain packages and concrete UseCases MUST NOT depend on Nest/Pino/OpenTelemetry types merely to emit local telemetry.

Add tests only for behavior owned here: logger configuration, safe error serialization, redaction/HTTP serializers, trace correlation helpers, OpenTelemetry composition, EDP-observation mapping/cardinality guarantees, and Nest composition. Do not duplicate Pino, Nest, EDP execution semantics, or OpenTelemetry SDK internals.
