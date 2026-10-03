# Agentic Workspace generators

`@agentic-workspace/generators` contains the repository-owned Nx generators for proven Agentic Workspace project shapes.

## Available generators

Create a business package:

```bash
pnpm nx g @agentic-workspace/generators:package <name>
```

Create an internal service:

```bash
pnpm nx g @agentic-workspace/generators:service <name>
```

Create the HTTP E2E project for an existing internal service:

```bash
pnpm nx g @agentic-workspace/generators:service-e2e <name>
```

Generator output is a repository baseline, not permission to invent unused architecture. Follow the root and applicable nested `AGENTS.md` plus the engineering guide for the responsibility being generated.

## Verification

Use the generator project's Nx targets from the repository root:

```bash
pnpm nx run @agentic-workspace/generators:lint
pnpm nx run @agentic-workspace/generators:typecheck
pnpm nx run @agentic-workspace/generators:test
pnpm nx run @agentic-workspace/generators:build
```

## Dependency baselines

Service dependencies come from `tools/generators/service-dependencies.json`; service E2E dependencies come from `tools/generators/service-e2e-dependencies.json`. No existing application is required. Keep these baselines aligned with workspace tooling and catalog versions.

Generated services are Nest application-context shells with TypeORM database configuration; running them opts into a database requirement. The E2E generator applies to an existing HTTP service with its own port and routes. It does not turn an application-context shell into an HTTP server.
