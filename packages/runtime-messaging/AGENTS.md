# Runtime Messaging Agent Rules

These rules apply to `@agentic-workspace/runtime-messaging` in addition to the root `AGENTS.md` and `packages/AGENTS.md`.

## Responsibility

`@agentic-workspace/runtime-messaging` owns Agentic Workspace's transport-neutral event ingress boundary around the published EDP `EventEnvelope` contract.

The framework-independent root entrypoint owns:

- `EventIdentity`, exactly `eventName + schemaVersion`;
- executable `EventHandler` contracts;
- one structural `validateEventEnvelope(...)` boundary for untrusted logical envelope input;
- `EventHandlerRegistry` registration, exact resolution, duplicate rejection and seal state;
- `EventIngress` validation, exact dispatch and explicit unhandled outcomes.

The validator checks the required published envelope structure and metadata before handlers can trust it. It returns the original envelope object unchanged, preserves additional fields, and treats `payload` as unknown business content. Business payload validation belongs to the selected EDP `EventContract`, not this package.

Handler-thrown values, including EDP `ExecutionFailureError`, are not reclassified or wrapped by ingress. Invalid-envelope and unhandled outcomes remain distinct from execution failures.

## Registry lifecycle

One event identity maps to one handler. Resolution has no version fallback, latest selection, scanning, fan-out or dynamic post-startup mutation.

Registration is explicit. A duplicate registration is a configuration failure and prevents the registry from being sealed even if the immediate registration exception is caught. Resolution before seal and registration after seal are configuration errors.

`@agentic-workspace/runtime-messaging/nest` provides the ordinary `RuntimeMessagingModule`. It owns one Nest-managed registry per application context and exports that registry plus `EventIngress`. It is not global and does not use a static singleton.

Explicit application-local registrars register handlers during `onModuleInit`. `RuntimeMessagingModule` seals during `onApplicationBootstrap`, after module initialization has completed. Future consumers must start only after that sealed state; broker lifecycle is not implemented here.

## Boundaries

MUST NOT:

- import `runtime-presenters`, business packages or service internals;
- add UseCase lookup, subscription mapping, Actor/application-context conversion or Intent derivation here;
- add broker SDKs, wire codecs, retries, acknowledgement, DLQ, offsets, polling, consumer drain or database state;
- add decorators/scanning for handler discovery or multiple handlers for one event identity;
- turn structural validation into producer authentication or business payload validation.

Framework-specific composition stays behind explicit integration subpaths such as `/nest`; the root entrypoint remains framework-independent.

## Verification

The Nx project name is `@agentic-workspace/runtime-messaging`.

Run:

```bash
pnpm nx run @agentic-workspace/runtime-messaging:lint
pnpm nx run @agentic-workspace/runtime-messaging:typecheck
pnpm nx run @agentic-workspace/runtime-messaging:test
pnpm nx run @agentic-workspace/runtime-messaging:build
```

Tests in this package cover only Agentic Workspace-owned validation, registry, ingress and Nest lifecycle behavior. Do not copy EDP execution, event-factory or business-contract test suites here.
