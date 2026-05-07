# Chunk sidecars + RalphCI

**Start here:** CircleCI CTO **Rob Zuber** explains why inner-loop validation matters for AI-assisted development and how Chunk sidecars restore balance between local work and CI — [_Introducing Chunk sidecars: Inner loop validation that keeps up with your agents_](https://circleci.com/blog/chunk-sidecars/).

## What RalphCI adds

RalphCI is agent-agnostic orchestration: Build Agent, CI Doctor, and a deterministic **Review Gate**. This integration wires **optional** [Chunk](https://github.com/CircleCI-Public/chunk-cli) **remote microbuilds** into that gate:

1. Local steps run first (`format:fix`, `lint:fix`, `test:run` — same as before).
2. If `reviewGate.chunkSidecar.enabled` is true in `ralphci.json`, the CLI runs `chunk sidecar sync` and `chunk validate --remote` before push.

That gives **CI-parity feedback** (e.g. Linux, cloud environment) **before** your full pipeline runs on the branch. It does **not** replace CircleCI after push.

## Commands and config

| Piece                                       | Role                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `ralphci check-chunk`                       | Verify Chunk CLI, auth, validation list, active sidecar; optional Homebrew install of Chunk |
| `reviewGate.chunkSidecar` in `ralphci.json` | Enable timeouts, `strictCli`, `skipSync`, `validateTarget`                                  |

See the main [README](../README.md#optional-circleci-chunk-sidecars) and [CHANGELOG](../CHANGELOG.md).

## Consumer setup (your app repo)

Chunk project setup (`chunk init`, sidecar create/use) lives in **your** repository — not committed into the `ralph-ci` tool repo by default. See the README section **Optional: CircleCI Chunk sidecars**.

## References

- [Introducing Chunk sidecars](https://circleci.com/blog/chunk-sidecars/) — Rob Zuber (CircleCI blog)
- [Chunk CLI](https://github.com/CircleCI-Public/chunk-cli)
