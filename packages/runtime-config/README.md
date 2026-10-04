# runtime-config

`@agentic-workspace/runtime-config` owns runtime values that need one shared contract across applications and workspace tooling.

The package currently:

- validates `API_PORT`, `DOCUMENTS_PORT`, `DOCUMENT_PROCESSING_PORT`, and `WEB_PORT` from the already-populated process environment;
- applies the repository defaults for those ports;
- exports the immutable `runtimeConfig` object used by runtime and tooling consumers;
- exports `PortSchema` for service-owned configuration that needs the same port primitive.

The package does not locate or load `.env` files. Nx, CI, deployment, or the invoking process is responsible for populating `process.env` before the package is evaluated.

Runtime consumers use the package root, which is built to `dist` like the other runtime packages. The `./workspace` subpath is reserved for Nx/Vite configuration that must resolve the shared port contract before project builds run.

Environment loading and ownership rules are defined in `docs/engineering/environment-guidelines.md`. Service-specific typed Nest configuration is defined in `docs/engineering/service-configuration-guidelines.md`.
