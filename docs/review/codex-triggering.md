# Reviewer triggering

Provider integration is not yet verified for this repository. See `codex-integration.md`.

Keep implementation PRs in draft until deterministic CI is green. Then request independent review using the provider mechanism actually enabled and verified by the repository owner. A new relevant commit requires green CI and a fresh review of that exact head. Do not merge without the review required by `README.md`.

AccounterBro historically used the Codex GitHub integration and a manual `@codex review` trigger. Verify that behavior separately in this repository; copying these files does not connect the integration.
