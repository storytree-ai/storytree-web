// The arrival's framing and its two gestures (forest-arrival.ts).
//
// ⚠ THE COMPOSITION ITSELF IS NOT TESTED HERE. `restingFrame` is the shared render core's, proven
// in `packages/forest-world/src/resting-view.test.ts` one repo up, and duplicating its assertions
// against a hand-copied idea of what it does would be exactly the confound this project keeps
// hitting — two copies of one belief agreeing with each other whatever the world does. What is
// tested here is what this file actually owns: turning that scale into a bottom-anchored viewBox,
// and the pan/zoom bounds that decide whether a reader can still find the forest afterwards.
//
// ⚠ `bun test` TRANSPILES AND DOES NOT TYPECHECK. `npm run typecheck` covers this file; run it
// before believing anything below.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  clampViewBox,
  clampZoom,
  formatViewBox,
  readFramePayload,
  restingViewBox,
  wholeWorldWidth,
  zoomAbout,
  type ForestFramePayload,
  type ViewBox,
} from './forest-arrival';

/** The live corpus's shape, frozen: a PORTRAIT forest, which is the whole reason a landscape frame
 *  cannot both contain it and show it at a readable size. */
const FOREST: ForestFramePayload = {
  width: 3238,
  height: 4005,
  islandDiameters: [154.4, 196, 196, 196, 196, 366.2],
};

const FRAME_W = 1600;
const FRAME_H = 900;

test('the arrival is bottom-anchored — the foundation is on screen and the canopy is not', () => {
  const box = restingViewBox(FOREST, FRAME_W, FRAME_H);
  // The world's bottom edge is the view's bottom edge: the DAG's most foundational rank.
  assert.ok(Math.abs(box.y + box.h - FOREST.height) < 1e-9, `bottom was ${box.y + box.h}`);
  // And the top of the world is above the view, so there is visibly more to pan to.
  assert.ok(box.y > 0, `y was ${box.y} — nothing was cut off the top`);
});

test('the arrival is horizontally centred', () => {
  const box = restingViewBox(FOREST, FRAME_W, FRAME_H);
  assert.ok(Math.abs(box.x + box.w / 2 - FOREST.width / 2) < 1e-9);
});

test('the arrival shows LESS than the whole forest, and matches the frame’s aspect', () => {
  const box = restingViewBox(FOREST, FRAME_W, FRAME_H);
  assert.ok(box.h < FOREST.height, 'the whole height is in frame — nothing was cropped');
  assert.ok(
    Math.abs(box.w / box.h - FRAME_W / FRAME_H) < 1e-9,
    `viewBox aspect ${box.w / box.h} does not match the frame's ${FRAME_W / FRAME_H}`,
  );
});

test('THE WHOLE FOREST STAYS REACHABLE — zooming out always reaches it, whatever the crop', () => {
  // The promise the crop makes. A ratio-only limit (`resting / MIN_ZOOM`) says nothing about
  // whether the forest fits inside it, so on a hard enough crop the reader would hit the stop with
  // the forest still off-screen. Swept across corpora far taller than the frame, where the crop
  // ratio grows without bound.
  for (const height of [4005, 8000, 20000, 60000]) {
    const forest = { ...FOREST, height };
    const resting = restingViewBox(forest, FRAME_W, FRAME_H).w;
    const whole = wholeWorldWidth(forest, FRAME_W, FRAME_H);
    const loosest = clampZoom(Number.MAX_SAFE_INTEGER, resting, whole);
    assert.ok(
      loosest >= whole - 1e-6,
      `at height ${height} the reader could only zoom out to ${loosest}, short of the whole forest at ${whole}`,
    );
  }
});

test('zooming IN is bounded, so the reader cannot fall through the map', () => {
  const resting = restingViewBox(FOREST, FRAME_W, FRAME_H).w;
  const whole = wholeWorldWidth(FOREST, FRAME_W, FRAME_H);
  const tightest = clampZoom(0, resting, whole);
  assert.ok(tightest > 0, 'the zoom-in stop is not positive');
  assert.ok(tightest < resting, 'the reader cannot zoom in past the resting view at all');
});

test('a zoom request inside the range is passed through untouched', () => {
  const resting = restingViewBox(FOREST, FRAME_W, FRAME_H).w;
  const whole = wholeWorldWidth(FOREST, FRAME_W, FRAME_H);
  assert.equal(clampZoom(resting, resting, whole), resting);
  assert.equal(clampZoom(resting * 1.5, resting, whole), resting * 1.5);
});

test('zoom keeps the world point under the cursor fixed', () => {
  // The zoom-to-cursor invariant, asserted as the invariant rather than as an arithmetic result:
  // the world point under a given fraction of the frame is the same before and after.
  const before: ViewBox = { x: 100, y: 200, w: 800, h: 450 };
  for (const [fx, fy] of [[0, 0], [0.5, 0.5], [1, 1], [0.2, 0.8]] as [number, number][]) {
    const after = zoomAbout(before, 400, fx, fy);
    assert.ok(Math.abs(before.x + fx * before.w - (after.x + fx * after.w)) < 1e-9, `x at ${fx}`);
    assert.ok(Math.abs(before.y + fy * before.h - (after.y + fy * after.h)) < 1e-9, `y at ${fy}`);
  }
});

test('zoom preserves the aspect ratio', () => {
  const before: ViewBox = { x: 0, y: 0, w: 1600, h: 900 };
  const after = zoomAbout(before, 400, 0.5, 0.5);
  assert.ok(Math.abs(after.w / after.h - before.w / before.h) < 1e-9);
});

test('panning is bounded — the reader cannot lose the forest off-screen', () => {
  const box = restingViewBox(FOREST, FRAME_W, FRAME_H);
  const far = clampViewBox({ ...box, x: 1e9, y: -1e9 }, FOREST);
  // Still overlapping the world on both axes, with only the declared overscroll outside it.
  assert.ok(far.x < FOREST.width, `panned to x=${far.x}, past the world's right edge at ${FOREST.width}`);
  assert.ok(far.y + far.h > 0, `panned to y=${far.y}, entirely above the world`);
  assert.ok(far.x + far.w > 0);
  assert.ok(far.y < FOREST.height);
});

test('a view WIDER than the world is centred on that axis rather than left to drift', () => {
  // What happens the moment anyone zooms out past the fit: there is nothing to pan to on that axis,
  // and letting the position stand would slide the forest off one edge for no reason.
  const wide: ViewBox = { x: 99999, y: 0, w: FOREST.width * 3, h: FOREST.height * 3 };
  const clamped = clampViewBox(wide, FOREST);
  assert.ok(Math.abs(clamped.x + clamped.w / 2 - FOREST.width / 2) < 1e-9);
  assert.ok(Math.abs(clamped.y + clamped.h / 2 - FOREST.height / 2) < 1e-9);
});

test('a pan within bounds is left exactly alone', () => {
  const box = restingViewBox(FOREST, FRAME_W, FRAME_H);
  const nudged = { ...box, y: box.y - 50 };
  assert.deepEqual(clampViewBox(nudged, FOREST), nudged);
});

test('the emitted viewBox is four finite numbers in SVG order', () => {
  const s = formatViewBox({ x: -1.005, y: 2, w: 3.456, h: 4 });
  const parts = s.split(' ').map(Number);
  assert.equal(parts.length, 4);
  assert.ok(parts.every((n) => Number.isFinite(n)), s);
  assert.equal(s, '-1 2 3.46 4');
});

// ── the payload the build hands the browser ────────────────────────────────

/** The minimum of an `Element` this module actually touches, so the payload reader can be proven
 *  without a DOM. Deliberately not a stub of the whole interface: what is under test is the parse,
 *  and a fake that answered more than `getAttribute` would be inviting the test to drift. */
const svgWith = (raw: string | null): Element =>
  ({ getAttribute: (name: string): string | null => (name === 'data-forest-frame' ? raw : null) }) as unknown as Element;

test('a good payload is read back exactly', () => {
  const el = svgWith(JSON.stringify({ width: 10, height: 20, islandDiameters: [1, 2] }));
  assert.deepEqual(readFramePayload(el), { width: 10, height: 20, islandDiameters: [1, 2] });
});

test('EVERY unusable payload returns null rather than a confident wrong frame', () => {
  // The failure mode this guards: a half-valid payload yielding a plausible viewBox that frames the
  // wrong thing. Refusing leaves the static whole-world picture the build already rendered — a
  // worse composition, never a blank screen or a wrong one.
  const bad = [
    null,
    'not json',
    '[]',
    'null',
    JSON.stringify({ height: 20, islandDiameters: [1] }),
    JSON.stringify({ width: 10, islandDiameters: [1] }),
    JSON.stringify({ width: 10, height: 20 }),
    JSON.stringify({ width: 10, height: 20, islandDiameters: [] }),
    JSON.stringify({ width: 0, height: 20, islandDiameters: [1] }),
    JSON.stringify({ width: 10, height: 0, islandDiameters: [1] }),
    JSON.stringify({ width: '10', height: 20, islandDiameters: [1] }),
    JSON.stringify({ width: 10, height: 20, islandDiameters: 'nope' }),
  ];
  for (const raw of bad) {
    assert.equal(readFramePayload(svgWith(raw)), null, `accepted ${String(raw)}`);
  }
});

test('non-numeric island sizes are dropped, and an all-junk list is refused outright', () => {
  const mixed = readFramePayload(
    svgWith(JSON.stringify({ width: 10, height: 20, islandDiameters: [1, 'x', null, 2] })),
  );
  assert.deepEqual(mixed?.islandDiameters, [1, 2]);
  assert.equal(
    readFramePayload(svgWith(JSON.stringify({ width: 10, height: 20, islandDiameters: ['x', null] }))),
    null,
  );
});
