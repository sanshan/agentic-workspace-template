# Bootstrap a new repository

1. Create a repository from this GitHub template. Each new repository has an independent lifecycle; template updates are not automatically propagated.
2. Choose the workspace npm scope. Update workspace package names, imports, generator output and its tests together; regenerate the lockfile and run all verification targets. The initial scope is `@agentic-workspace`.
3. Retain the original license attribution. Adapt README and product-specific specifications.
4. Enable GitHub Actions. Configure branch protection/rulesets for `main`, require PRs and both `Verify workspace` and `Verify SQL adapters` checks, and disable force pushes/deletion as appropriate for the owner.
5. Connect the intended independent reviewer separately. Apps, repository permissions, secrets, environments, Pages and branch protection do not transfer with source files.
6. Verify the provider's post-CI review trigger. Follow `docs/review/README.md`; upstream calibration evidence is historical, not proof for this repository.
7. Add apps using the applicable Nx generators. Add databases, deployments and secrets only for applications that require them.
8. Inspect generated changes and run the affected Nx checks before merging.

Do not configure product deployment credentials in the template. GitHub Template mode itself must be enabled in repository settings.

## Extraction decisions

Preserved: reusable runtime packages, tenant core contracts, object storage, generators, Nx/build/lint/test conventions and agent/review guidance.
Removed: document/document-processing business identities and packages, OCR capability, existing apps/E2E/load harness, product architecture topology (LikeC4 tooling is retained), compose configuration and product workflows.
Retired rule PRR-006: it governed document upload restrictions in the removed product specification. Its ID must not be reused.
The remaining inherited review rules and fixtures retain their semantics; integration and any necessary calibration must be verified in each consumer repository.

## Extraction verification status

- Passed: 17 review-validator tests, six-rule catalog validation, git diff whitespace checks.
- Pending: complete frozen install, Nx project discovery/sync, lint, typecheck, tests, builds, and real generator smoke checks. Package installation was blocked by the execution environment's npm network policy; offline metadata was insufficient.
- Pending: independent review, GitHub Template setting and branch protection.
- GitHub write access was granted after the initial 403; publication and CI checks are in progress.

This extraction is a draft and must not be advertised as a validated starter until the pending checks pass.

Frozen offline installation accepted the existing lockfile without resolution changes, but could not complete because the package cache is incomplete.
