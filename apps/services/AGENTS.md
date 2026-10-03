# Internal Service Agent Rules

These rules apply to internal services under `apps/services/` in addition to the root workspace rules.

## Canonical guidance

Reusable internal-service architecture and application boundaries are owned by `docs/engineering/service-guidelines.md`.

Read the engineering guide that owns each additional responsibility before changing it:

- `docs/engineering/http-presenter-guidelines.md` for HTTP presenters and service E2E;
- `docs/engineering/observability-and-http-errors.md` for shared observability and failure ownership;
- `docs/engineering/database-guidelines.md` for service database lifecycle, TypeORM composition, and migrations;
- `docs/engineering/environment-guidelines.md` and `docs/engineering/service-configuration-guidelines.md` for environment and typed service configuration;
- `docs/engineering/package-guidelines.md` when the service hosts a business package.

Implementation-local invariants for changing a technical package itself remain in that package's nearest `AGENTS.md`; do not copy them into a service.

## Local reference

Use the [upstream Documents host](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/documents) as the current proven business-service host reference. Reuse only the behavior required by the service being changed; do not copy Documents-specific behavior mechanically.

For explicit event-driven ingress, follow the `Event ingress presenters` section in `docs/engineering/service-guidelines.md` and its canonical implementation reference.

## Verification

Use the service's current Nx project configuration to select the smallest relevant lint, typecheck, test, build, migration, and E2E targets required by the change. Do not guess the Nx project name from the directory name.
