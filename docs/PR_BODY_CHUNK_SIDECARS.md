## Summary

Adds **optional [CircleCI Chunk sidecar](https://circleci.com/blog/chunk-sidecars/)** remote validation to RalphCI’s deterministic **Review Gate**, plus **`ralphci check-chunk`** for setup diagnostics. Targets **v1.1.0** (see `CHANGELOG.md`).

## Why read this PR (context for users)

AI coding loops often push a lot of churn to **outer-loop CI**. CircleCI CTO **Rob Zuber** describes how **Chunk sidecars** and **microbuilds** bring fast, CI-like checks into the **inner loop** so agents get feedback while context is still fresh:

**[_Introducing Chunk sidecars: Inner loop validation that keeps up with your agents_](https://circleci.com/blog/chunk-sidecars/)** (CircleCI blog)

RalphCI fits that model by running local format/lint/tests first, then **optionally** `chunk sidecar sync` + `chunk validate --remote` before push — without replacing your real CircleCI pipeline after the push.

## What shipped

| Area        | Change                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Review Gate | `reviewGate.chunkSidecar.*` — sync + remote validate after local gate passes; timeouts, `strictCli`, `skipSync`, `validateTarget`          |
| CLI         | `ralphci check-chunk` (+ `-w`, `-v`, `--no-brew-install`); auto `brew install` Chunk on macOS/Linux when Chunk is missing (opt out for CI) |
| Docs        | README section, `docs/CHUNK_SIDECARS.md`, CHANGELOG **1.1.0**                                                                              |
| Tests       | Config merge, review-gate feedback, `check-chunk`, `chunk-cli`                                                                             |

## How to try it

1. Read the blog post above for product context.
2. In **your** app repo: Chunk CLI, `chunk init`, auth, active sidecar (see README).
3. `ralphci check-chunk -v`
4. Set `"reviewGate": { "chunkSidecar": { "enabled": true } }` in `ralphci.json`.

## Notes

- Chunk is **opt-in**; default behavior is unchanged.
- Consumer repos own `chunk init` / sidecar lifecycle — we do not commit Chunk config into the RalphCI source tree by default.
