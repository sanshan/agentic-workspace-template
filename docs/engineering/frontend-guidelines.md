# Web Agent Rules

These rules apply to `apps/web` in addition to the workspace rules from the root `AGENTS.md`.

## 1. Current Frontend Foundation

The current Web application is deliberately minimal and uses:

```text
React 19
TypeScript
Vite
Mantine
Nx
```

The repository does not currently establish a router, server-state library, global-state manager, or form framework in the product baseline.

MUST inspect the project's current dependencies and existing code before adding one. Do not document or introduce a library merely because it is common in generic React applications.

Existing repository code and installed versions are the source of truth. For version-specific React APIs or performance patterns, follow current React guidance rather than patterns remembered from older React versions.

## 2. Frontend Organization

Prefer feature ownership over speculative shared architecture.

Keep feature-specific code with the feature. Promote code to a shared area only after it has a real cross-feature consumer.

The application may grow toward structures such as:

```text
src/
├── app/
├── features/
├── components/
├── hooks/
├── api/
├── types/
└── utils/
```

This is guidance for responsibility, not a requirement to create empty directories or abstractions in advance.

MUST NOT create hooks, contexts, stores, services, adapters, shared components, or utility layers merely to make a feature structure look complete.

## 3. Components and Composition

Use functional TypeScript components.

Prefer:

- one clear UI responsibility per component;
- composition over oversized components;
- explicit props at component boundaries;
- semantic HTML and Mantine primitives;
- colocating feature-specific components with the feature that owns them.

MUST NOT:

- extract a component solely because a JSX block is several lines long;
- create large APIs composed mostly of boolean props when composition expresses the behavior more clearly;
- wrap every Mantine component in a project abstraction without a repeated project-specific need;
- create a generic component before there is a real reusable responsibility.

## 4. State Ownership and Render Boundaries

Performance is part of implementation correctness.

State should live at the narrowest level that owns it.

MUST:

- keep local UI state close to the components that use it;
- lift state only to the nearest real common owner when multiple children genuinely share it;
- consider which subtree will re-render when frequently changing state moves upward;
- derive values during render instead of storing redundant derived state;
- keep transient interaction state out of `App` or page-level components unless those components actually own it;
- prefer component boundaries and correct ownership before adding memoization.

MUST NOT:

- lift state to `App` for convenience or hypothetical future reuse;
- duplicate the same logical state in multiple components and synchronize it with Effects;
- introduce Context or a global store merely to avoid ordinary component ownership/props;
- mechanically add `memo`, `useMemo`, or `useCallback` to every component.

Use memoization when referential stability is required by an API or when there is an understood/identified rendering or computation cost.

## 5. Derived State

If a value can be calculated from current props/state during render, calculate it instead of storing another state variable.

Avoid patterns such as:

```text
state A
  ↓
Effect
  ↓
state B containing a transformed copy of A
```

Prefer a single source of truth and derived values.

## 6. Effects and Synchronization

Treat `useEffect` as an escape hatch for synchronizing React with systems outside React, not as a generic lifecycle callback.

Appropriate examples include integration with browser APIs, subscriptions, imperative third-party widgets, or other external systems that need synchronization.

MUST NOT use Effects for:

- values that can be derived during render;
- ordinary transformations of props/state;
- logic that belongs directly in click/submit/change handlers;
- synchronizing two redundant React states;
- moving logic out of render merely to control when it executes.

When an Effect is genuinely required, keep its dependency model explicit and make setup/cleanup safe for repeated execution.

## 7. Remote Data and Async Work

There is no repository-wide server-state library today. When a feature needs remote data:

1. inspect current dependencies and nearby code;
2. determine whether the requirement is small enough for the existing application boundary or whether a dedicated data-fetching library is justified;
3. keep transport/data-fetching concerns out of presentational components where they would be duplicated;
4. introduce one coherent pattern rather than multiple parallel approaches.

Regardless of the chosen abstraction:

- do not create network requests during render;
- avoid independent request waterfalls;
- start independent async work in parallel when possible;
- handle stale/obsolete request results using the selected abstraction's supported mechanism;
- treat loading, error, and empty states as part of feature behavior;
- do not copy remote data into local React state unless local ownership/editing semantics genuinely require a separate copy.

## 8. Rendering and React Performance

When designing or reviewing React code, consider:

- unnecessary component re-renders;
- state scope and render propagation;
- expensive repeated computations;
- unstable object/function creation only when it affects real consumers;
- large-list rendering;
- unnecessary client-side work;
- component mount/unmount churn;
- expensive Effects or subscriptions.

Prefer architectural fixes over indiscriminate memoization.

For frequently changing interactions such as typing, pointer movement, filters, or transient UI state, keep the update boundary as narrow as the ownership model permits.

Use React scheduling/deferred APIs only when the installed React version supports them and the interaction has a real responsiveness problem they solve.

## 9. Network and Async Performance

Avoid making latency sequential when operations are independent.

Consider:

```text
independent requests → parallel
required dependency → sequential
```

Do not await unrelated work earlier than necessary.

Debounce/throttle only when the user interaction or external API behavior benefits from it; do not add timing complexity automatically.

When input drives remote work, ensure obsolete work does not overwrite newer user intent.

## 10. Bundle and Dependency Discipline

Every frontend dependency has runtime/download/maintenance cost.

Before adding a package:

- check whether React, the browser platform, Mantine, or existing project dependencies already provide the capability;
- evaluate whether the package is needed by the current feature rather than a hypothetical future feature;
- consider bundle impact, tree-shaking behavior, and whether a narrower import is available;
- avoid importing a large library for one trivial helper.

Use lazy loading/code splitting when a real feature is large or infrequently needed and splitting provides a meaningful benefit. Do not split tiny components merely to demonstrate optimization.

MUST NOT add a second UI kit, CSS framework, or state/data library without a concrete requirement and repository-level decision.

## 11. Browser Performance

Consider browser cost in addition to React render cost.

Avoid:

- layout thrashing from repeated alternating layout reads/writes;
- unbounded rendering of very large collections;
- expensive work in high-frequency event handlers;
- unnecessary DOM measurement during every render/update;
- loading large assets/data before they are needed.

Use virtualization, deferred work, or browser scheduling only when the actual data/interactions justify the added complexity.

## 12. Mantine and UI Composition

Mantine is the established UI foundation.

Prefer existing Mantine components, hooks, layout primitives, accessibility behavior, and theme capabilities before implementing equivalent controls manually.

MUST NOT:

- replace Mantine primitives with hand-built equivalents without a feature/design requirement;
- wrap every Mantine primitive behind a local abstraction;
- introduce another component library to solve functionality Mantine already provides.

Project abstractions should represent repeated project-specific behavior/design, not hide the underlying UI kit by default.

## 13. Styling

Follow the styling mechanisms already established by the application and Mantine.

Keep component-specific styles close to the component/feature when appropriate.

MUST NOT add Tailwind, styled-components, another CSS framework, or a second styling system merely for convenience in one feature.

Avoid global styles for behavior that belongs to a focused component or feature.

## 14. Accessibility

Accessibility is part of component correctness.

MUST:

- prefer semantic HTML elements;
- use buttons for actions and links for navigation;
- associate labels with form controls;
- preserve keyboard access;
- provide accessible names for controls/icons where needed;
- reuse Mantine's accessibility behavior instead of recreating it manually.

MUST NOT create clickable generic containers when a semantic interactive element is appropriate.

## 15. Forms and User Interaction

Keep event-driven logic in event handlers when it is caused by a user interaction.

Do not convert click/submit/change behavior into state + Effect chains.

For forms, start with the simplest approach appropriate to the feature. Introduce a form library only when validation, field orchestration, performance, or reuse creates a concrete need.

Keep validation behavior user-visible and deterministic. Client-side validation improves UX but must not be treated as a security boundary for server-owned rules.

## 16. Error, Loading, and Empty States

Remote or asynchronous UI must deliberately handle relevant states:

```text
idle/loading
success
empty
error
```

Do not leave a feature with only the happy-path rendering when failure/empty behavior is meaningful to the user.

Avoid duplicating the same status across multiple state variables when one source of truth can represent it.

## 17. Testing

Frontend tests should verify observable behavior rather than internal implementation details.

Prefer tests that:

```text
render UI
  ↓
perform user interaction
  ↓
assert observable result
```

Avoid asserting private state transitions, hook internals, or implementation-specific calls when user-visible behavior proves the requirement more robustly.

Use the project's existing test tooling and Testing Library conventions.

## 18. New Feature Workflow

When planning or implementing a frontend feature:

1. Read root and Web `AGENTS.md` files.
2. Inspect the closest existing component/feature and current dependencies.
3. Identify the feature's UI ownership boundary.
4. Identify state ownership and expected render scope.
5. Decide whether remote data, shared client state, routing, forms, or new dependencies are genuinely required.
6. Reuse React/browser/Mantine capabilities before adding abstractions or packages.
7. Consider async waterfalls, rendering cost, bundle impact, accessibility, loading/error/empty behavior.
8. Implement the smallest coherent feature.
9. Add behavior-focused tests.
10. Run relevant Nx verification.

Do not create speculative architecture for features that do not yet exist.

## 19. Required Verification

For Web changes, run the relevant subset of:

```bash
pnpm nx run @agentic-workspace/web:lint
pnpm nx run @agentic-workspace/web:typecheck
pnpm nx run @agentic-workspace/web:test
pnpm nx run @agentic-workspace/web:build
```

Do not declare Web work complete with known lint/type/build/test failures or unresolved accessibility/performance issues introduced by the change.
