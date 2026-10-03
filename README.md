# Agentic Workspace Template

An Nx + pnpm workspace for agent-assisted development, derived from [AccounterBro](https://github.com/sanshan/accounterbro).

## Start

Use Node.js 24 and the pnpm version pinned in `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm nx show projects
pnpm review:validate
pnpm nx run-many -t lint typecheck test build --parallel=2
```

The baseline has no deployable application and requires no running database, broker or external service. Runtime adapters are optional building blocks, not started services.

## Included

- Nx project boundaries, strict TypeScript, ESLint, formatting and test configuration.
- Core tenant contracts, object storage, runtime configuration, executions, messaging, health, observability and presenter adapters.
- Business-package, Nest service and service-E2E generators in `tools/generators`.
- Scoped agent instructions, engineering guidance, independent review contract and validated review fixtures.
- Baseline checks without database services; a separate mandatory CI job verifies SQL adapters against PostgreSQL.

Read `AGENTS.md` before development, `tools/generators/README.md` before generating a project, and `docs/template-bootstrap.md` when creating a repository from this template.

## Scope

Business applications, document processing/OCR, application specifications and product deployment/performance workflows are intentionally absent. React/Vite tooling remains available for consumers; no UI or game-specific code is included.

Generated Nest services currently use TypeORM and require their own database configuration when run. That is an opt-in application requirement, not a baseline requirement.

## Provenance

Derived from `sanshan/accounterbro` at commit `9e389454ce5976fcad79ead7cca22e1e92586399`. The original MIT license and attribution are preserved. Upstream review calibration results are not evidence of integration in a newly created repository.

## SQL adapter integration tests

The default `test` targets require no database. SQL adapter suites are owned by `test-integration` in runtime-health and runtime-executions. CI runs them in a separate required job with ephemeral PostgreSQL. To run locally, supply PostgreSQL and `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, then run `pnpm nx run-many -t test-integration --parallel=1`. The user must be able to create test databases.
