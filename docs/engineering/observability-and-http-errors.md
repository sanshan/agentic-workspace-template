# Observability and Failure Engineering Guidelines

References labeled “upstream example” describe the source project at a pinned revision; they are not local files or required applications. Reuse only the relevant responsibilities.

These rules record the canonical service-wide observability and failure-classification flow proven by [upstream example: apps/services/documents](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/documents) and [upstream example: apps/api](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api).

Use the owner closest to the responsibility. Do not rebuild the same policy in a service. HTTP failure presentation, Problem Details, endpoint OpenAPI error contracts, and the separate health HTTP contract are owned by `docs/engineering/http-presenter-guidelines.md`.

## Canonical owners

- EDP owns `ExecutionFailure`, `ExecutionFailureError`, Runner, Reader, UseCaseExecutor, and their retry/observation semantics.
- `@agentic-workspace/runtime-executions` owns Agentic Workspace composition around those published EDP contracts; its Nest entrypoint is `@agentic-workspace/runtime-executions/nest`.
- `@agentic-workspace/runtime-observability` owns structured logging policy, OpenTelemetry SDK composition, trace-log correlation, and EDP-observer adaptation; Nest lifecycle composition lives under `/nest`.

[upstream example: apps/services/documents](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/documents) is the business-service consumer reference. [upstream example: apps/api](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/api) proves that the shared Pino/OpenTelemetry runtime does not require Runner, Reader, or UseCaseExecutor when the service has no hosted business execution pipeline.

## Runtime topology

Production logs are structured Pino output to stdout/stderr for external collection. Request execution MUST NOT synchronously deliver logs to a remote backend.

OpenTelemetry uses OTLP exporters compatible with an OpenTelemetry Collector. Traces use batched export and push metrics use periodic export. Exporter or observer failures MUST NOT alter execution semantics.

The runtime topology is therefore:

```text
service
  ├─ structured Pino stdout/stderr -> external log collection
  └─ OpenTelemetry SDK
       ├─ batched traces ─┐
       └─ periodic metrics ─> OTLP / OpenTelemetry Collector
```

Do not select a concrete telemetry backend or SLO policy in the shared runtime unless a separate requirement owns that decision.

## Failure classification and adapter ownership

`ExecutionFailure` / `ExecutionFailureError` are the only classified execution-failure model.

A handler or infrastructure adapter may create an `ExecutionFailureError` only when that boundary knows the semantics of the concrete failure it is classifying. Preserve the original failure as `cause` where useful. Unknown PostgreSQL, TypeORM, network, storage, or arbitrary thrown errors remain unknown; shared composition MUST NOT infer a code or retryability globally.

Do not introduce an Agentic Workspace `classification`, retry scope, parallel error hierarchy, or message-based classifier.

HTTP adapters consume this classified model without becoming a second classification owner. The HTTP mapping and presentation rules are defined in `docs/engineering/http-presenter-guidelines.md`.

## Retry ownership

Retry is owned by the EDP request/boundary that actually performs it:

- Runner retries only when the `Command` carries `Command.options.retry` and the classified failure is retryable according to EDP semantics.
- Reader source retry is Query-owned through `QueryOptions.retry`; shared runtime does not broaden that policy around cache/coordinator behavior.
- UseCaseExecutor has no internal retry loop or retry configuration.

Observability follows the same ownership. Runner `attempt.*` / `retry.scheduled` observations describe Runner retries; Reader `read.attempt.*` / `read.retry.scheduled` observations describe Reader source retries. Do not synthesize retry events in UseCaseExecutor or infer them in the observability adapter.

## Logging and telemetry safety

Automatic HTTP access/error logging is disabled in the shared Nest/Pino adapter. Request/response bodies, uploaded-file bytes, authorization/cookie values, trusted actor/tenant headers, passwords, tokens, API keys, and secrets are deny-by-default and centrally redacted as defense in depth.

A terminal thrown exception is logged with full diagnostics once at the boundary that consumes the occurrence. Lower layers do not catch-log-rethrow the same exception. EDP lifecycle observations are telemetry facts, not a second place to copy stack/cause/message payloads.

Metric dimensions MUST remain bounded. Intent IDs, correlation IDs, tenant IDs, attempt identities, actor/entity/cache identities, messages, and stacks do not belong in metric labels. Operation/read names, lifecycle event names, bounded outcomes/scopes/reasons, and retryable booleans are acceptable where the current adapter exposes them.

OpenTelemetry `traceId` and EDP `correlationId` are distinct identities. Keep both where available; never substitute one for the other. High-cardinality correlation values belong in logs/traces, not metrics.

## Verification ownership

`@agentic-workspace/runtime-observability` tests own shared logger, telemetry SDK, trace/log correlation, redaction, and EDP-observer adaptation semantics. Service tests add only service-owned composition or observable integration evidence; they MUST NOT repeat shared observability behavior merely because the service consumes it.

HTTP Problem Details/filter/OpenAPI/health semantics and their service/E2E verification boundaries are owned by `docs/engineering/http-presenter-guidelines.md` and the corresponding runtime-presenter package tests.
