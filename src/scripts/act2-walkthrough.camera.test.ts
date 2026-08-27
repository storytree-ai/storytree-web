// WHAT THE DISC'S GROUND CARRIES DOES NOT DEPEND ON THE CAMERA IT IS SEEN FROM (ADR-0367 D1).
//
// The parent repo fences this for the engine core in `packages/forest-world/src/scatter-camera.test.ts`
// ("a mark belongs to the GROUND — the same ground island must place the same marks at the same
// ground spots at every elevation, and only their SCREEN positions may move"). This is that
// invariant for the WEBSITE'S OWN hand-edited surface, which the engine sync never reaches and which
// therefore kept the last unfixed instance of the class long after PR #1356 declared it closed.
// Increment: `website-decor-proximity-moves-to-ground-space` on `ground-space-truth-arc`.
//
// THE MEASURED DEFECT this replaces. `discGround`'s tree keep-out used to be
// `Math.hypot(c.x - cx, c.y - (cy - 6)) < 42` — a threshold applied to PROJECTED tile centres. Under
// the declared camera a ground separation running away from the viewer covers only `sin 20° ≈ 0.342`
// of the screen it covered in plan view, so the screen form OVER-enforces on the vertical axis and
// culls conifers that should stand. Over the ten discs this site actually builds it yielded 16 in
// plan view and 15 at the declared camera. The failure has ONE direction — `groundGap >= hypot`
// always holds — so the camera can only ever take marks AWAY, never wrongly admit one.
//
// ⚠ THE THIRD TEST IS THE TEETH, and it is why the first two cannot pass vacuously. A camera sweep
// over a predicate that had become constant, or over a fixture whose tiles do not actually move,
// would pass while proving nothing. So the suite pins BOTH halves: that the tiles genuinely
// foreshorten between the elevations compared, and that the OLD screen-space predicate really does
// give a different answer at 20° than in plan view on this exact fixture. Delete the fix and test 1
// goes red; break the fixture and test 3 goes red first.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAN_VIEW_ELEVATION_DEG,
  axialKey,
  hash,
  hexCenter,
  rand01,
  type Axial,
} from '../lib/forest-world';
import { discGround, discTiles } from './act2-walkthrough';

/** The declared camera plus a sweep either side, matching the parent suite's range. */
const SWEEP = [PLAN_VIEW_ELEVATION_DEG, 60, 45, 30, 20, 12] as const;

/** The discs this site actually builds — the walkthrough's six beats and the Phase-Z studio forest. */
const DISCS: readonly { readonly rings: number; readonly seed: string }[] = [
  { rings: 2, seed: 'act2-disc-first-light' },
  { rings: 2, seed: 'act2-disc-website' },
  { rings: 1, seed: 'act2-disc-backend' },
  { rings: 1, seed: 'act2-disc-database' },
  { rings: 2, seed: 'act2-studio-home' },
  { rings: 1, seed: 'act2-studio-a' },
  { rings: 1, seed: 'act2-studio-e' },
];

/** The disc's projected centroid at `elevationDeg` — exactly what `buildDisc` computes. */
function centroid(tiles: readonly Axial[], elevationDeg: number): { cx: number; cy: number } {
  const cs = tiles.map((h) => hexCenter(h, { elevationDeg }));
  return {
    cx: cs.reduce((s, c) => s + c.x, 0) / cs.length,
    cy: cs.reduce((s, c) => s + c.y, 0) / cs.length,
  };
}

const keysOf = (tiles: readonly Axial[]): string[] => tiles.map(axialKey).sort();

test('the decor conifers a disc carries are the same at every camera elevation', () => {
  for (const disc of DISCS) {
    const tiles = discTiles(disc.rings);
    const reference = (() => {
      const { cx, cy } = centroid(tiles, PLAN_VIEW_ELEVATION_DEG);
      return discGround(tiles, cx, cy, disc.seed, PLAN_VIEW_ELEVATION_DEG);
    })();
    for (const elevationDeg of SWEEP) {
      const { cx, cy } = centroid(tiles, elevationDeg);
      const got = discGround(tiles, cx, cy, disc.seed, elevationDeg);
      assert.deepEqual(
        keysOf(got.decor),
        keysOf(reference.decor),
        `${disc.seed}: the decor set moved at ${elevationDeg}° — ` +
          `${got.decor.length} conifers against ${reference.decor.length} in plan view. ` +
          'A conifer belongs to the ground, so the camera may move where it is DRAWN and never ' +
          'whether it stands.',
      );
    }
  }
});

test('the wheat patches a disc carries are the same at every camera elevation', () => {
  for (const disc of DISCS) {
    const tiles = discTiles(disc.rings);
    const { cx: pcx, cy: pcy } = centroid(tiles, PLAN_VIEW_ELEVATION_DEG);
    const reference = [...discGround(tiles, pcx, pcy, disc.seed, PLAN_VIEW_ELEVATION_DEG).wheat].sort();
    for (const elevationDeg of SWEEP) {
      const { cx, cy } = centroid(tiles, elevationDeg);
      const got = [...discGround(tiles, cx, cy, disc.seed, elevationDeg).wheat].sort();
      assert.deepEqual(got, reference, `${disc.seed}: the wheat set moved at ${elevationDeg}°`);
    }
  }
});

test('TEETH — the fixture really foreshortens, and the OLD screen-space predicate really did move', () => {
  // (a) the tiles genuinely move on screen between the elevations compared. Without this, a sweep
  //     could be comparing identical inputs and would pass with any predicate at all.
  const offAxis: Axial = { q: 0, r: 2 };
  const plan = hexCenter(offAxis, { elevationDeg: PLAN_VIEW_ELEVATION_DEG });
  const angled = hexCenter(offAxis, { elevationDeg: 20 });
  assert.ok(plan.y !== 0, 'the probe tile must be off the horizontal axis');
  assert.ok(
    Math.abs(angled.y) < Math.abs(plan.y) * 0.5,
    `the fixture does not foreshorten: ${plan.y} → ${angled.y}. The sweep would be vacuous.`,
  );

  // (b) the screen-space predicate this fix REPLACED gives a different answer at 20° than in plan
  //     view, on a disc this site actually builds. This is the defect, pinned: if it ever stops
  //     being reproducible the invariance tests above have stopped being able to fail.
  const screenSpaceDecor = (rings: number, seed: string, elevationDeg: number): string[] => {
    const tiles = discTiles(rings);
    const { cx, cy } = centroid(tiles, elevationDeg);
    const out: Axial[] = [];
    for (const tile of tiles) {
      const c = hexCenter(tile, { elevationDeg });
      const roll = rollOf(seed, tile);
      // screen-space: the ORIGINAL, DEFECTIVE form, reproduced here as a control and nowhere else.
      const nearTree = Math.hypot(c.x - cx, c.y - (cy - 6)) < 42;
      const inGarden = c.y > cy + 8;
      if (roll < 0.42 && !nearTree && !inGarden) out.push(tile);
    }
    return keysOf(out);
  };
  const before = screenSpaceDecor(2, 'act2-studio-home', PLAN_VIEW_ELEVATION_DEG);
  const after = screenSpaceDecor(2, 'act2-studio-home', 20);
  assert.notDeepEqual(
    after,
    before,
    'the screen-space predicate no longer moves under the camera, so this suite can no longer ' +
      'tell the fix from the defect it replaced',
  );
  assert.ok(
    after.length < before.length,
    `the class starves, it never over-admits: expected fewer conifers at 20° than in plan view, ` +
      `got ${after.length} against ${before.length}`,
  );
});

/** The disc's own decor roll, duplicated in the control above so it draws from the same stream. */
function rollOf(seed: string, tile: Axial): number {
  return rand01(hash(`${seed}:dec:${axialKey(tile)}`));
}
