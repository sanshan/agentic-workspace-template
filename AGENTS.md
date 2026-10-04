<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects,
  targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e.
  `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using
  globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed
  without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST
  before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# Workspace Agent Rules

These rules apply to the entire repository. Reusable engineering architecture belongs under `docs/engineering/`; nested `AGENTS.md` files add project- or subtree-local routing and constraints.

## 1. Instruction Precedence

Before modifying a file, inspect its directory and ancestor directories for applicable `AGENTS.md` files.

Rules are cumulative:

- this root file defines workspace-wide conventions;
- nested files define project- or directory-specific conventions;
- the nearest applicable nested instructions take precedence when rules differ.

MUST NOT modify a project using only root instructions when a nested `AGENTS.md` exists for that project.

Work under `packages/` MUST follow `packages/AGENTS.md`. `docs/engineering/package-guidelines.md` applies to business packages and business-package integration contracts; technical capability packages follow their nearest package instructions and the engineering guide for the responsibility being changed.

## 2. Repository Purpose

Agentic Workspace is a reusable project template. It contains production-oriented baseline implementation and conventions that future developers and coding agents should inspect before introducing new patterns.

Existing implementation is not placeholder/demo code to be replaced casually. Inspect it first and reuse established conventions where they apply.

MUST NOT introduce placeholder CRUD features, speculative abstractions, or parallel tooling merely to make the repository look more complete.

When agent assumptions conflict with the repository, the repository is the source of truth.

## 3. Canonical Development Workflow

When asked to plan or implement new behavior:

1. Read this file and every applicable nested `AGENTS.md`.
2. Identify the owning Nx project or projects.
3. Inspect the closest existing implementation with similar responsibilities.
4. Identify which existing architectural boundaries actually apply.
5. Prepare an implementation plan before modifying code when planning is requested.
6. Reuse established conventions instead of introducing a parallel pattern.
7. Add abstractions only when current requested behavior requires them.
8. Add tests at the architectural boundary that owns the behavior.
9. Run the smallest relevant Nx verification targets.
10. Avoid unrelated refactoring.

Reference implementations are architectural guidance, not templates that must be copied mechanically.

### UseCase implementation task readiness

Before finalizing an implementation issue for a concrete service UseCase, perform the UseCase preflight required by `docs/engineering/service-guidelines.md` together with every applicable local service `AGENTS.md`.

The issue MUST contain a `## Do not` section populated with concrete behaviors already owned by EDP runtime, called Operations/Reads, handlers, or persistence/DB semantics discovered during that preflight. Generic statements such as "do not duplicate existing mechanisms" are insufficient when the investigation can name the existing owner or mechanism.

MUST NOT start UseCase implementation from assumptions about idempotency, deduplication, recovery, retry, transactions, concurrency, or read/write behavior that can be verified in the current runtime and called boundaries.

## 4. Repository Navigation

Before adding code, inspect the owning project and, when relevant:

- its `project.json` or inferred Nx configuration;
- its `package.json`;
- its nearest `AGENTS.md`;
- the closest implementation serving the same responsibility.

Use the Nx project name reported by Nx. Do not infer project names solely from directory names or package manifests.

## 5. Workspace Tooling

This is an Nx monorepo managed with pnpm.

MUST:

- use `pnpm` for package management;
- use Nx targets for workspace tasks when a target exists;
- prefix Nx commands with `pnpm`;
- preserve existing project boundaries and workspace layout;
- inspect project configuration before changing build/test/serve behavior.

MUST NOT:

- use npm or Yarn for dependency installation;
- create another lockfile;
- bypass Nx with ad-hoc commands when an equivalent Nx target exists;
- introduce a second build, lint, or test system without a concrete requirement.

Prefer:

```bash
pnpm nx <command>
pnpm nx run <project>:<target>
pnpm nx run-many -t <target>
pnpm nx affected -t <target>
```

## 6. Package Management

Install dependencies at the narrowest correct scope.

Workspace-wide development tooling belongs at the root:

```bash
pnpm add -Dw <package>
```

A dependency used by one application/package belongs to that project's package:

```bash
pnpm --filter <project-package-name> add <package>
pnpm --filter <project-package-name> add -D <package>
```

MUST:

- classify runtime vs development dependencies correctly;
- reuse workspace catalog versions where the workspace already manages that dependency through the pnpm catalog;
- keep project package manifests minimal;
- update `pnpm-lock.yaml` whenever dependency resolution changes;
- check whether the repository already provides the required capability before adding a package.

MUST NOT:

- add project-specific runtime dependencies to the workspace root for convenience;
- duplicate dependencies without need;
- manually edit resolved versions in the lockfile;
- introduce a library solely because a generic framework guide recommends it.

## 7. Nx Projects and Boundaries

Every application or library must remain an explicit Nx project.

Every project MUST declare one repository architecture tag:

- `type:core` for framework-free shared primitives;
- `type:business` for business packages;
- `type:runtime` for reusable technical capabilities and adapters;
- `type:app` for deployable applications and services;
- `type:e2e` for black-box test projects;
- `type:tooling` for repository generators and other development tooling.

The dependency directions for these tags are enforced in the root ESLint configuration. Service-local
layer imports are enforced there as well: the composition chain is `App -> Presenters -> Application ->
Infrastructure`, domain code cannot depend on outer layers or frameworks, and only
`application.module.ts` may cross from application into infrastructure for composition.

When necessary, inspect project configuration with:

```bash
pnpm nx show project <project>
```

MUST NOT:

- create hidden cross-project dependencies through private relative imports;
- reach into another application's private source tree;
- weaken boundaries merely to make an import compile;
- create a shared library before there is a real cross-project consumer.

If code genuinely has multiple project consumers, extract an appropriate workspace library rather than importing private application internals.

## 8. Nx-Managed Configuration and Generators

Prefer official Nx generators for Nx-managed applications, libraries, and integrations. Inspect unfamiliar generator options and use dry-run when output may touch multiple files.

New business packages under `packages/` MUST be created with `pnpm nx g @agentic-workspace/generators:package <name>`. MUST NOT invoke `@nx/js:lib` directly for a new business package.

New internal services under `apps/services/` MUST be created with `pnpm nx g @agentic-workspace/generators:service <name>`. MUST NOT invoke a low-level Nx/Nest/Node application generator directly for a new internal service.

The section between:

```text
<!-- nx configuration start-->
<!-- nx configuration end-->
```

is managed by Nx tooling.

MUST NOT manually modify, reorder, duplicate, or customize content inside that managed section. Repository-specific instructions belong outside it so Nx can update the managed block independently.

Generated code is a starting point, not an architectural authority. Review generated changes and adapt them to existing repository conventions.

## 9. TypeScript and Source Conventions

Use TypeScript for application source unless existing tooling requires otherwise.

MUST:

- preserve strict TypeScript settings;
- use explicit types at architectural/public boundaries;
- use `import type` for type-only imports where appropriate;
- follow existing naming and directory conventions;
- keep files focused on one clear responsibility.

MUST NOT:

- weaken global TypeScript settings to solve a local problem;
- use `any` as a shortcut around a known type;
- disable lint/type checks globally for one change;
- reformat unrelated files.

Fix errors at their source.

## 10. Testing Strategy

Tests belong to the project and architectural boundary that owns the behavior. Nested project instructions define more specific placement and coverage rules.

MUST:

- use configured Nx test/E2E targets;
- add or update tests when behavior changes;
- keep deterministic default tests independent from public network availability;
- preserve API and browser E2E harnesses as integration boundaries rather than substitutes for lower-level tests.

MUST NOT:

- delete, skip, or weaken a failing test solely to make CI green;
- use empty-suite support as justification for omitting tests for implemented behavior.

## 11. Configuration and Environment

Use the repository's established configuration mechanisms.

MUST:

- keep secrets out of source control;
- document newly required environment variables;
- keep environment-specific values outside application source;
- ensure documented commands work from the repository root unless explicitly stated otherwise.

MUST NOT:

- commit credentials, tokens, passwords, or private keys;
- hardcode machine-specific absolute paths;
- assume globally installed tools, usernames, or local port ownership.

## 12. Change Discipline

Make the smallest coherent change that satisfies the requested behavior.

Before introducing a new pattern, search the repository for an existing implementation serving the same responsibility.

MUST NOT:

- refactor unrelated code;
- reorganize project structure merely to match personal preference;
- introduce generic abstractions without an immediate consumer;
- replace existing tooling without a concrete requirement;
- duplicate an existing repository capability;
- change multiple projects merely to make one project conform to a speculative design.

## 13. Required Verification

Run the smallest relevant Nx targets that prove the affected projects are healthy.

Typical project checks are:

```bash
pnpm nx run <project>:lint
pnpm nx run <project>:typecheck
pnpm nx run <project>:test
pnpm nx run <project>:build
```

For multi-project changes, prefer Nx orchestration:

```bash
pnpm nx run-many -t lint typecheck test build
```

Nested `AGENTS.md` files may require additional checks. Those checks are mandatory for changes in their scope.

MUST NOT declare work complete with known failing relevant tests, type/build errors, broken Nx project discovery, unresolved plugin errors, or an inconsistent lockfile.

If a required check cannot be run, state exactly which check was not run and why.

## Code Review Rules

For code-changing pull requests and pull requests that change repository review policy or review routing anywhere in the repository, read `docs/review/README.md` and follow its reviewer procedure using the applicable active rules under `docs/review/rules/`.

## Template scope

No business application is included. Use `docs/template-bootstrap.md` for adoption. Frontend projects follow `docs/engineering/frontend-guidelines.md` and their local instructions. Do not create product-specific services or require a database for baseline verification.
