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
| `roam-clicks.mjs` | ROAM in a real browser: clicks every target, reads the panel's text off the DOM, and screenshots each one — controls read from `src/data/forest-snapshot.json`, never from the payload the build wrote |
| `roam-falsify.mjs` | twelve defects introduced into ROAM one at a time, each one shown to red a NAMED test — the suite's proof that it can fail |

⚠ **`roam-clicks.mjs` PASSED A CHECK ITS OWN SCREENSHOT DISPROVED.** It asserted "the panel carries
the snapshot date" by reading `textContent`, and passed — while the picture beside it showed the
date scrolled off the panel's own `max-height`, along with the floor note. Present in the DOM and
on the screen are different claims, and only one of them is what a visitor gets. The check now
measures `getBoundingClientRect` against the panel's own box. Read the screenshots; they are the
point rather than a courtesy.

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
node scripts/probe/roam-clicks.mjs            # clicks + screenshots; exits non-zero on a failure
node scripts/probe/roam-falsify.mjs           # needs bun on PATH; restores every file it edits
```

`playwright-core` is resolved out of the parent monorepo (`ST_PW_FROM` overrides), and Chrome is
`/usr/bin/google-chrome`.
