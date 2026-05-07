# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-05-07

### Added

- **Chunk sidecar integration (optional):** When `reviewGate.chunkSidecar.enabled` is set in `ralphci.json`, the Review Gate runs `chunk sidecar sync` and `chunk validate --remote` after local format/lint/tests pass, for CI-parity microbuilds. Background: CircleCI CTO **Rob Zuber**, [_Introducing Chunk sidecars: Inner loop validation that keeps up with your agents_](https://circleci.com/blog/chunk-sidecars/). Configurable timeouts, optional `validateTarget`, `skipSync`, and `strictCli` ([Chunk CLI](https://github.com/CircleCI-Public/chunk-cli)). See also `docs/CHUNK_SIDECARS.md`.
- **`ralphci check-chunk`:** Verifies Chunk CLI, `chunk auth status`, `chunk validate --list`, and `chunk sidecar current`. On macOS/Linux, installs Chunk via Homebrew automatically when the binary is missing (disable with `--no-brew-install`).
- Shared **`chunk-cli`** helpers for version detection used by the Review Gate and `check-chunk`.
- Tests and README documentation for the above.

### Changed

- README corrections (e.g. Key Files: `tasks.json` vs plan content).

[1.1.0]: https://github.com/CircleCI-Research/ralph-ci/releases
