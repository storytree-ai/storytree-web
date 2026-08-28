# Verification instruments for chapter 2

Laptop-only. Nothing here ships, and nothing here runs in CI — these exist so that a claim about
how the page BEHAVES can be checked against the page rather than against the code that made it.

They were written for `website-refresh-arc-readable-pace` (2026-08-29), after the owner walked the
live site and reported that the overlay prose was unreadable and that the forest did not grow.

| script | what it answers |
|---|---|
| `tell-pace-probe.ts` | per line, how long it is LEGIBLE and at what rate — arithmetic over the shipped constants |
| `tell-pace-falsify.ts` | the same ceiling applied to the PRE-FIX constants, so the ceiling test is shown to be able to red |
| `chapter2-walk.mjs` | the whole arrival in a real browser: when each island lands, whether the storm's cross-fade masks it, and the opacity-measured legible window of every line |
| `growth-burst.mjs` | time-stamped frames of the arrival, each labelled with the page's own measurement |
| `tell-beats.mjs` | one screenshot per beat at 1600x900, for reading the copy at delivered size |

⚠ **THE FIRST VERSION OF `chapter2-walk.mjs` MEASURED THE WRONG THING, AND AGREED WITH A BUG.** It
counted `.tw-isle`, which is an island's COASTLINE alone — the same wrong selector the growth module
was using — so it reported a clean staggered arrival while the built page showed the entire forest
standing still. An instrument that shares its subject's assumption cannot contradict it. Both now
measure `.tw-ground`, the layer that actually paints, and `forest-growth.test.ts` derives the layer
list from the engine's own emitter rather than from either.

The `.ts` probes typecheck under `npm run typecheck`. The `.mjs` ones need a browser:

```
npm run build
node scripts/probe/chapter2-walk.mjs          # measurements
OUT_DIR=/tmp/beats node scripts/probe/tell-beats.mjs
```

`playwright-core` is resolved out of the parent monorepo (`ST_PW_FROM` overrides), and Chrome is
`/usr/bin/google-chrome`.
