import { test } from 'node:test';
import assert from 'node:assert/strict';

import snapshotJson from '../data/forest-snapshot.json';
import { LAND_CAMERA_ELEVATION_DEG } from '../lib/forest-world';
import { landStreamFromDrawing } from '../lib/forest-world-r3f/true-ground';
import { deriveGrowthPlan, type GrowthPlan } from './forest-growth';
import {
  LAND_ELEVATION_DEG,
  aspectMode,
  landGrowthAt,
  landRegistration,
  landStackMissing,
  parseViewBox,
} from './forest-land-layer';
import { assertSnapshot, forestSceneInput, publicForestDrawing } from './forest-snapshot-map';

const SNAP = assertSnapshot(snapshotJson);

test('the land is drawn at the same declared elevation as the map', () => {
  assert.equal(LAND_ELEVATION_DEG, LAND_CAMERA_ELEVATION_DEG);
  assert.equal(forestSceneInput(SNAP).cameraElevationDeg, LAND_CAMERA_ELEVATION_DEG);
});

test('one drawing: the land streams from the same scene the SVG serialises', () => {
  const drawing = publicForestDrawing(SNAP);
  assert.deepEqual(publicForestDrawing(SNAP), drawing, 'the drawing is a pure function of the snapshot');
  const land = landStreamFromDrawing(drawing).filter((d) => d.kind !== 'skipped');
  assert.ok(land.some((d) => d.kind === 'cell-ground'), 'the drawing yields drawable ground');
  const islands = new Set(land.flatMap((d) => ('island' in d && typeof d.island === 'string' ? [d.island] : [])));
  for (const story of SNAP.stories) assert.ok(islands.has(story.id), `${story.id} has land`);
});

test('no published coverage is fabricated: every parcel stays unreported', () => {
  for (const territory of forestSceneInput(SNAP).territories) {
    for (const parcel of territory.parcels ?? []) assert.equal(parcel.testCount, undefined, parcel.capId);
  }
});

test('registration: a meet-fitted viewBox lands the frame centre on the ground it shows', () => {
  const box = { x: 0, y: 0, w: 1000, h: 500 };
  const reg = landRegistration(box, { width: 500, height: 500 }, 'meet')!;
  assert.equal(reg.zoom, 0.5);
  assert.equal(reg.target.x, 500);
  const sin = Math.sin((LAND_ELEVATION_DEG * Math.PI) / 180);
  assert.ok(Math.abs(reg.target.z - 250 / sin) < 1e-9, 'depth is the drawing y un-projected');
});

test('registration: slice crops, meet letterboxes, and a panned viewBox moves the target', () => {
  const box = { x: 0, y: 0, w: 1000, h: 500 };
  assert.equal(landRegistration(box, { width: 500, height: 500 }, 'slice')!.zoom, 1);
  const panned = landRegistration({ ...box, x: 200 }, { width: 500, height: 500 }, 'slice')!;
  assert.equal(panned.target.x, 700);
});

test('registration refuses a box or frame with no size', () => {
  assert.equal(landRegistration({ x: 0, y: 0, w: 0, h: 10 }, { width: 10, height: 10 }, 'meet'), null);
  assert.equal(landRegistration({ x: 0, y: 0, w: 10, h: 10 }, { width: 0, height: 10 }, 'meet'), null);
});

test('viewBox and aspect parsing', () => {
  assert.deepEqual(parseViewBox('1 2 3 4'), { x: 1, y: 2, w: 3, h: 4 });
  assert.deepEqual(parseViewBox('1,2, 3 ,4'), { x: 1, y: 2, w: 3, h: 4 });
  assert.equal(parseViewBox(null), null);
  assert.equal(parseViewBox('1 2 3'), null);
  assert.equal(parseViewBox('1 2 x 4'), null);
  assert.equal(aspectMode('xMidYMid slice'), 'slice');
  assert.equal(aspectMode('xMidYMid meet'), 'meet');
  assert.equal(aspectMode(null), 'meet');
});

function tinyPlan(): GrowthPlan {
  return deriveGrowthPlan({
    storyIds: ['a', 'b'],
    edges: [{ from: 'a', to: 'b', segments: [{ id: 's1', reversed: false }] }],
    segmentLengths: new Map([['s1', 100]]),
  });
}

test('growth: the land reads the host plan — absent, then growing, then settled', () => {
  const plan = tinyPlan();
  const a = plan.islands.get('a')!;
  const b = plan.islands.get('b')!;
  const seg = plan.segments.get('s1')!;

  const start = landGrowthAt(plan, 0);
  assert.equal(start.settled, false);
  assert.ok(start.absentStoryIds.has('b'), 'the downstream island is absent at the start');
  assert.ok(start.hiddenSegmentIds.has('s1'), 'the road is hidden before its window');

  const mid = landGrowthAt(plan, (a.startMs + a.endMs) / 2);
  assert.ok(mid.growing.some((g) => g.storyId === 'a' && g.progress > 0 && g.progress < 1));

  const drawing = landGrowthAt(plan, (seg.startMs + seg.endMs) / 2);
  const front = drawing.drawingSegments.find((d) => d.id === 's1')!;
  assert.ok(front.drawn > 0 && front.drawn < 1);
  assert.equal(front.fromEnd, seg.fromEnd);

  const end = landGrowthAt(plan, Math.max(plan.totalMs, b.endMs));
  assert.equal(end.settled, true);
  assert.equal(end.absentStoryIds.size, 0);
  assert.equal(end.hiddenSegmentIds.size, 0);
  assert.equal(end.progress, 1);
});

test('growth: a clock read before the plan started is the plan at zero, never negative', () => {
  const plan = tinyPlan();
  assert.deepEqual(landGrowthAt(plan, -500), landGrowthAt(plan, 0));
});

test('stack probe: WebGL 2 present is supported; absent or throwing is missing', () => {
  const doc = (ctx: unknown, throws = false) =>
    ({
      createElement: () => ({
        getContext: () => {
          if (throws) throw new Error('blocked');
          return ctx;
        },
      }),
    }) as unknown as Pick<Document, 'createElement'>;
  assert.equal(landStackMissing(doc({})), false);
  assert.equal(landStackMissing(doc(null)), true);
  assert.equal(landStackMissing(doc({}, true)), true);
});
