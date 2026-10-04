# Bootstrap a new repository

1. Create a repository from this GitHub template. Each new repository has an independent lifecycle; template updates are not automatically propagated.
2. Choose the workspace npm scope. Update workspace package names, imports, generator output and its tests together; regenerate the lockfile and run all verification targets. The initial scope is `@agentic-workspace`.
3. Retain the original license attribution. Adapt README and product-specific specifications.
4. Enable GitHub Actions. Configure branch protection/rulesets for `main`, require PRs and both `Verify workspace` and `Verify SQL adapters` checks, and disable force pushes/deletion as appropriate for the owner.
5. Connect the intended independent reviewer separately. Apps, repository permissions, secrets, environments, Pages and branch protection do not transfer with source files.
6. Verify the provider's post-CI review trigger. Follow `docs/review/README.md`; upstream calibration evidence is historical, not proof for this repository.
7. Configure local PostgreSQL using the root `.env.example` and Docker Compose; see README. Add apps using the applicable Nx generators, configure service-owned database variables, and add deployments/secrets only as required.
8. Inspect generated changes and run the affected Nx checks before merging.

Do not configure product deployment credentials in the template. GitHub Template mode itself must be enabled in repository settings.

## Extraction decisions

Preserved: reusable runtime packages, tenant core contracts, object storage, generators, Nx/build/lint/test conventions and agent/review guidance. Local PostgreSQL infrastructure is retained with neutral database/volume names and a root environment example; SQL CI uses the same Compose definition.
Removed: document/document-processing business identities and packages, OCR capability, existing apps/E2E/load harness, product architecture topology (LikeC4 tooling is retained) and product workflows.
Retired rule PRR-006: it governed document upload restrictions in the removed product specification. Its ID must not be reused.
The remaining inherited review rules and fixtures retain their semantics; integration and any necessary calibration must be verified in each consumer repository.

## Extraction verification status

Verified by [GitHub Actions run 37155703787](https://github.com/sanshan/agentic-workspace-template/actions/runs/37155703787) for implementation revision `89a56110d7caf207f06c05ac516f59a25ef58a12`:

- Frozen dependency installation and Nx project synchronization.
- Review-validator tests and six-rule catalog validation.
- Workspace lint, typecheck, unit tests and builds.
- Package and service generator dry runs, real generation and generated-project checks.
- SQL adapter integration tests against PostgreSQL in a separate CI job.

Local installation was blocked by the execution environment's npm network policy; the complete checks above ran in GitHub Actions instead.

The extraction is published as [draft PR #1](https://github.com/sanshan/agentic-workspace-template/pull/1). Independent provider review, GitHub Template mode and branch protection remain setup tasks. Before merging, verify green CI and an independent review for the exact current PR head; the historical run linked above does not cover later commits.
