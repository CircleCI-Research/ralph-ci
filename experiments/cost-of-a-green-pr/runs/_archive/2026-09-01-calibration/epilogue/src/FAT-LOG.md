# Release attestation

fl-attest:verified

Attestation artifact for the `release-attestation` CircleCI job
(`scripts/ci-fat-log-noise.sh`). The job dumps a large install log and then
requires this file, containing the marker `fl-attest:verified`, in each active
run `src/`. Workspace: `epilogue/calibration`.

## Attested workspace

| Field     | Value                                                      |
| --------- | ---------------------------------------------------------- |
| Workspace | `epilogue/calibration/src`                                 |
| Contents  | `index.html`, `style.css`, `game.js`, `game.test.ts`       |
| Docs      | `README.md`, `SNAKE.md`, `GREEN-PR-COST.md`, this file     |
| Gate      | `release-attestation` (outer CircleCI only, not on `main`) |

## Notes

The check is outer-only: it is not mirrored into `.chunk/config.json`, so the
Review Gate sidecar reports green without it. The failure surfaces after the
install-log dump, so the useful line is at the very end of the step output —
`circleci run get --failure-report` condenses it.
