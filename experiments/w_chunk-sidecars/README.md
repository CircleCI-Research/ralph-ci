# Chunk sidecar Snake builds

Five Classic Snake builds from the early-May study: local checks, a Chunk sidecar Review Gate, then CircleCI. Each iteration is a playable game.

Background: [What snake games have taught us about shipping with AI agents](https://www.confidentcommit.com/p/what-snake-games-have-taught-us-about).

Open a game from `iteration-1` through `iteration-5`:

```bash
python3 -m http.server -d experiments/w_chunk-sidecars/iteration-1/src
```

Then visit `http://127.0.0.1:8000/`. The page loads `game.js` as a module, so a local static server is the reliable way to play. `activity.md` and `metrics.json` next to each iteration are the run record.
