// THE WEBSITE'S COAST IS BUILT ON THE GROUND, SO BOTH MAPS DRAW ONE BEACH (ADR-0554).
//
// An island's sandy rim is its hex-edge boundary pushed out one beach width and corner-rounded
// (`smoothCoast`). The studio builds that boundary from PLAN-VIEW tile centres and corners
// (`packages/forest-layout/src/pack.ts`, the boundary loop above its `smoothCoast` call), so the push
// and the rounding run on the GROUND and the core projects the result at its own camera. `buildDisc`
// used to build the boundary at the declared 20° camera — already a drawing — push and round it on
// the SCREEN, and then UN-PROJECT the loops at the boundary so the core could flatten them back. That
// preserved a different coastline rather than sharing the arithmetic: the push is a beach WIDTH, and
// a width pushed out on the screen is `1 / sin 20° ≈ 2.9×` too wide on the ground along the
// east–west shores (ADR-0367's "fourth named cost"). ADR-0527 end-state item 6, "the two maps agree
// by construction", is this file stopping doing that.
//
// THE FIXTURE IS WHAT THE SITE DRAWS: every island `placeStories` lays out from the committed
// snapshot, built with the seed `forestSceneInput` gives it — the same discs /forest and chapter 2's
// arrival map draw — plus three fixed discs far off the origin, so the suite keeps its teeth whatever
// a future snapshot holds.
//
// ⚠ TEST 4 IS THE TEETH. Test 2's bound would pass vacuously on a camera that did not foreshorten the
// ground, or if the recipe it replaced happened to stay inside it. So the suite reproduces the OLD
// recipe as a control and pins that it breaks the bound on this very fixture: put the screen-space
// build back and test 1 and test 2 go red together.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import snapshotJson from '../data/forest-snapshot.json';
import {
  AXIAL_DIRS,
  COAST_OUTSET_ON_TILE,
  HEX_R,
  LAND_CAMERA_ELEVATION_DEG,
  PLAN_VIEW_ELEVATION_DEG,
  axialKey,
  boundaryRingLoops,
  groundFlattening,
  hexCenter,
  hexCorners,
  jitteredOutset,
  projectGround,
  smoothCoast,
  unprojectGround,
  type Axial,
  type BoundarySeg,
  type Pt,
} from '../lib/forest-world';
import { buildDisc, discTiles } from './act2-walkthrough';
import { assertSnapshot, placeStories } from './forest-snapshot-map';

interface Disc {
  readonly centre: Pt;
  readonly rings: number;
  readonly seed: string;
}

/** Far off the origin on purpose: a move onto the ground carried in the wrong space shifts the coast
 *  by `dy · (1 − sin 20°)`, which at these offsets is hundreds of units, never a rounding error. */
const FIXED_DISCS: readonly Disc[] = [
  { centre: { x: 137.5, y: -420.25 }, rings: 1, seed: 'coast-fixture-1' },
  { centre: { x: -610, y: 233.75 }, rings: 2, seed: 'coast-fixture-2' },
  { centre: { x: 48.5, y: -1290 }, rings: 3, seed: 'coast-fixture-3' },
];

/** Every island the live site draws, built with the seed `forestSceneInput` gives it. */
const SITE_DISCS: readonly Disc[] = placeStories(assertSnapshot(snapshotJson).stories).map(
  ({ story, centre, rings }) => ({ centre, rings, seed: `forest-disc-${story.id}` }),
);

const DISCS: readonly Disc[] = [...FIXED_DISCS, ...SITE_DISCS];

/** The hex-union boundary as edge segments, with centres AND corners evaluated at `elevationDeg`. */
function boundarySegs(tiles: readonly Axial[], elevationDeg: number): BoundarySeg[] {
  const mine = new Set(tiles.map(axialKey));
  const segs: BoundarySeg[] = [];
  for (const tile of tiles) {
    const c = hexCenter(tile, { elevationDeg });
    const cor = hexCorners(c.x, c.y, HEX_R, elevationDeg);
    AXIAL_DIRS.forEach((d, e) => {
      if (mine.has(axialKey({ q: tile.q + d.q, r: tile.r + d.r }))) return;
      const a = cor[e];
      const b = cor[(e + 1) % 6];
      if (a && b) segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    });
  }
  return segs;
}

function mean(ps: readonly Pt[]): Pt {
  return {
    x: ps.reduce((s, p) => s + p.x, 0) / ps.length,
    y: ps.reduce((s, p) => s + p.y, 0) / ps.length,
  };
}

/** The SCREEN move `buildDisc` gives every tile so the disc's centroid lands on `centre`. */
function screenMove(tiles: readonly Axial[], centre: Pt): Pt {
  const c = mean(tiles.map((h) => hexCenter(h)));
  return { x: centre.x - c.x, y: centre.y - c.y };
}

/** The land the page draws, placed on the ground: the hex-union boundary where the page draws the
 *  tiles, un-projected point by point. A measurement of the drawing — it never uses the move the
 *  implementation computes, so a wrong move cannot agree with it. */
function groundLand(tiles: readonly Axial[], centre: Pt): Pt[][] {
  const m = screenMove(tiles, centre);
  return boundaryRingLoops(boundarySegs(tiles, LAND_CAMERA_ELEVATION_DEG)).map((loop) =>
    loop.map((p) => unprojectGround({ x: p.x + m.x, y: p.y + m.y })),
  );
}

/** The widest beach `smoothCoast` pushes any vertex of this island out by. */
function widestPush(tiles: readonly Axial[], seed: string): number {
  let widest = 0;
  for (const loop of boundaryRingLoops(boundarySegs(tiles, PLAN_VIEW_ELEVATION_DEG))) {
    for (let i = 0; i < loop.length; i++) {
      widest = Math.max(widest, jitteredOutset(seed, i, loop.length, COAST_OUTSET_ON_TILE));
    }
  }
  return widest;
}

function distanceToLoops(p: Pt, loops: readonly Pt[][]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      if (!a || !b) continue;
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / (ex * ex + ey * ey || 1)));
      best = Math.min(best, Math.hypot(p.x - (a.x + t * ex), p.y - (a.y + t * ey)));
    }
  }
  return best;
}

/** The recipe `buildDisc` shipped before ADR-0554, reproduced here as a control and nowhere else. */
function screenSpaceRecipe(tiles: readonly Axial[], disc: Disc): Pt[][] {
  const m = screenMove(tiles, disc.centre);
  return smoothCoast(boundarySegs(tiles, LAND_CAMERA_ELEVATION_DEG), disc.seed, COAST_OUTSET_ON_TILE).loops.map(
    (loop) => loop.map((p) => unprojectGround({ x: p.x + m.x, y: p.y + m.y })),
  );
}

test('the disc coast is the shared recipe run on the GROUND, moved to where the disc is drawn', () => {
  for (const disc of DISCS) {
    const tiles = discTiles(disc.rings);
    const move = unprojectGround(screenMove(tiles, disc.centre));
    const want = smoothCoast(boundarySegs(tiles, PLAN_VIEW_ELEVATION_DEG), disc.seed, COAST_OUTSET_ON_TILE).loops;
    const got = buildDisc(disc.centre, disc.rings, disc.seed).coastGroundLoops;
    assert.equal(got.length, want.length, `${disc.seed}: the coast has ${got.length} loops, the recipe ${want.length}`);
    got.forEach((loop, l) => {
      const ref = want[l] ?? [];
      assert.equal(loop.length, ref.length, `${disc.seed}: loop ${l} has ${loop.length} vertices, the recipe ${ref.length}`);
      loop.forEach((p, i) => {
        const q = ref[i];
        assert.ok(q, `${disc.seed}: loop ${l} has no recipe vertex ${i}`);
        const off = Math.max(Math.abs(p.x - (q.x + move.x)), Math.abs(p.y - (q.y + move.y)));
        assert.ok(
          off < 1e-6,
          `${disc.seed}: vertex ${i} of loop ${l} sits ${off.toFixed(3)} units from the ground recipe. The ` +
            "website's coast has left the studio's arithmetic — build the boundary from PLAN-VIEW centres " +
            'and corners and run `smoothCoast` there, never at the declared camera.',
        );
      });
    });
  }
});

test('the beach is a width ACROSS THE GROUND — no coast vertex stands farther from the land than its widest push', () => {
  for (const disc of DISCS) {
    const tiles = discTiles(disc.rings);
    const land = groundLand(tiles, disc.centre);
    const widest = widestPush(tiles, disc.seed);
    for (const loop of buildDisc(disc.centre, disc.rings, disc.seed).coastGroundLoops) {
      for (const p of loop) {
        const acrossGround = distanceToLoops(p, land);
        assert.ok(
          acrossGround <= widest * (1 + 1e-9),
          `${disc.seed}: a coast vertex stands ${acrossGround.toFixed(2)} ground units from the land, past ` +
            `the widest push of ${widest.toFixed(2)}. A beach pushed out on the SCREEN reaches the ground ` +
            'about 2.9× too wide along the east–west shores.',
        );
      }
    }
  }
});

test('drawn at the declared camera, the coast is centred on the island the page draws', () => {
  for (const disc of DISCS) {
    const drawn = buildDisc(disc.centre, disc.rings, disc.seed)
      .coastGroundLoops.flat()
      .map((p) => projectGround(p));
    const c = mean(drawn);
    assert.ok(
      Math.abs(c.x - disc.centre.x) < COAST_OUTSET_ON_TILE && Math.abs(c.y - disc.centre.y) < COAST_OUTSET_ON_TILE,
      `${disc.seed}: the drawn coast is centred at (${c.x.toFixed(1)}, ${c.y.toFixed(1)}) and the island at ` +
        `(${disc.centre.x}, ${disc.centre.y}) — the move onto the ground was carried in the wrong space.`,
    );
  }
});

test('TEETH — the camera foreshortens the ground, and the old screen-space recipe breaks the ground bound here', () => {
  assert.ok(SITE_DISCS.length > 0, 'the committed snapshot laid out no islands, so this suite tests no site disc');
  // ⚠ RE-BASED AT ADR-0593 D1 (2026-09-22), AND THE MARGIN GENUINELY NARROWED — read this before
  // touching either bound. `LAND_CAMERA_ELEVATION_DEG` moved 20 -> 50 so the flat map and the 3D
  // land share one elevation. The ground squash weakened with it, from `1/sin 20 = 2.92` to
  // `1/sin 50 = 1.31`, so the old screen-space recipe this file replaced is now much CLOSER to the
  // correct one than it used to be. Both bounds below were calibrated against the strong squash.
  //
  // The vacuity guard was `< 0.5`, which `sin 20 = 0.342` cleared and `sin 50 = 0.766` does not.
  // 0.5 was never the property — it was headroom. What the guard has to establish is that the
  // camera foreshortens AT ALL, since at plan view the two recipes are the same function and test
  // 2 would pass on either.
  assert.ok(
    groundFlattening(LAND_CAMERA_ELEVATION_DEG) < 1,
    'the declared camera no longer foreshortens the ground, so the two recipes cannot differ and test 2 is vacuous',
  );
  let worst = 0;
  for (const disc of DISCS) {
    const tiles = discTiles(disc.rings);
    const land = groundLand(tiles, disc.centre);
    const widest = widestPush(tiles, disc.seed);
    for (const loop of screenSpaceRecipe(tiles, disc)) {
      for (const p of loop) worst = Math.max(worst, distanceToLoops(p, land) / widest);
    }
  }
  // …and the substantive half, which is what actually gives test 2 its teeth: the old recipe must
  // push a coast point FURTHER off the ground than its own widest legitimate push, so test 2's
  // centring bound really does separate the two. `> 1` is the claim the test's own name makes
  // ("breaks the ground bound"); the previous `> 2` was headroom the strong squash happened to
  // supply. Measured: 2.58× at 20 degrees, 1.24× at 50 — still broken, by a narrower margin.
  //
  // ⚠ IF THIS EVER DROPS BELOW 1, DO NOT LOWER IT. That is the point at which the old recipe stops
  // being distinguishable from the correct one at the shipped camera, and test 2 above has become
  // vacuous — which is a finding about the camera, not a bound to adjust.
  assert.ok(
    worst > 1,
    `the screen-space recipe this file used to ship stays within ${worst.toFixed(2)}× its widest push on the ` +
      'ground, so test 2 can no longer tell it from the fix',
  );
});
