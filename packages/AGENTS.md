# Package Agent Rules

References labeled “upstream example” describe the source project at a pinned revision; they are not local files or required applications. Reuse only the relevant responsibilities.

These rules apply under `packages/` in addition to the root workspace rules.

`docs/engineering/package-guidelines.md` is the canonical reusable guide for **business feature packages**. Apply it when changing a business package or the Core identity/reference contracts that business packages depend on. Do not apply business-package rules wholesale to technical capability packages merely because they also live under `packages/`.

Technical packages follow their nearest package-local `AGENTS.md` when one exists, plus only the engineering guides relevant to the concrete responsibility being changed.

## Proven business-feature reference

For a business feature package that owns domain state plus EDP Operations, Reads, handlers, and persistence, use [upstream example: packages/documents](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/packages/documents) as the canonical working reference. Apply only the boundaries that the new feature actually needs; do not copy Documents-specific behavior mechanically.

The proven package boundary is:

- the root entrypoint exposes only business-facing contracts and runtime values required by consumers;
- `@agentic-workspace/<feature>/execution` owns package handler construction descriptors and Operation/Read binding groups while concrete handler wiring stays private;
- `@agentic-workspace/<feature>/typeorm` owns feature persistence composition contracts, entities, migrations, persistence tokens, and adapter factories while the hosting service owns the real `DataSource` lifecycle;
- `@agentic-workspace/<feature>/runtime` exposes one framework-agnostic runtime manifest that aggregates the package's hosting contributions without duplicating their implementation knowledge;
- package tests prove aggregate, handler, persistence, and composition contracts at the boundary that owns them rather than duplicating service-level behavioral specifications.

Use [upstream example: packages/documents/src/runtime.ts](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/packages/documents/src/runtime.ts) as the manifest reference and [upstream example: apps/services/documents](https://github.com/sanshan/accounterbro/tree/9e389454ce5976fcad79ead7cca22e1e92586399/apps/services/documents) as the paired host reference. Standard Nest hosting registers package manifests through `@agentic-workspace/runtime-executions/nest`; the service chooses hosted packages and does not recreate package execution/persistence provider wiring.

This reference does not turn technical capability packages such as `runtime-executions`, `runtime-presenters`, `object-storage`, `runtime-config`, or `core` into business feature packages. Keep their responsibility-specific boundaries and local instructions where present.
