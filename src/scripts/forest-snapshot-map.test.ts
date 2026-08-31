// The real forest's renderer (forest-snapshot-map.ts).
//
// ⚠ WRITTEN TO FAIL. The snapshot map has one property that matters more than how it looks —
// that it cannot quietly lie. So the tests below are mostly about REFUSAL and about the two
// claims the page makes out loud: that the picture is dated, and that green means proven.
//
// The layout property carries its own TEETH (the last case): a DAG assertion like "a
// dependent sits above its dependency" is worthless unless the fixture can violate it, so
// the same fixture is fed with its edges reversed and the property is asserted to BREAK.
// Without that, the test passes on a layout that puts every island in one place.
//
// ⚠ `bun test` TRANSPILES AND DOES NOT TYPECHECK, so a wrong argument order here would run
// to completion and print a confident pass. `npm run typecheck` covers this file; run it
// before believing anything below.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPORTED_SCHEMA_VERSION,
  assertSnapshot,
  formatStampDate,
  frameFor,
  placeStories,
  renderStamp,
  toSceneStatus,
  type ForestSnapshot,
  type SnapshotStory,
} from './forest-snapshot-map';

function story(id: string, dependsOn: string[] = [], capabilities = 2): SnapshotStory {
  return {
    id,
    title: `the ${id} story`,
    status: 'proposed',
    dependsOn,
    capabilities: Array.from({ length: capabilities }, (_, i) => ({
      id: `${id}-cap-${i}`,
      title: `cap ${i}`,
      status: 'proposed',
      dependsOn: [],
    })),
    arcs: [],
  };
}

function snapshot(over: Partial<ForestSnapshot> = {}): ForestSnapshot {
  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    generatedAt: '2026-08-28T07:44:22.433Z',
    source: 'a test',
    storyCount: 2,
    provenStoryCount: 1,
    capabilityCount: 4,
    stories: [story('base'), story('top', ['base'])],
    arcs: [],
    ...over,
  };
}

// ── refusals: every branch is a shape that can genuinely reach the build ─────

test('refuses a snapshot whose schema this renderer does not know', () => {
  assert.throws(
    () => assertSnapshot(snapshot({ schemaVersion: SUPPORTED_SCHEMA_VERSION + 1 })),
    /schemaVersion/,
  );
});

test('refuses a snapshot with no usable date — an undated picture reads as live', () => {
  assert.throws(() => assertSnapshot(snapshot({ generatedAt: 'sometime' })), /generatedAt/);
  assert.throws(
    () => assertSnapshot({ ...snapshot(), generatedAt: undefined as unknown as string }),
    /generatedAt/,
  );
});

test('refuses an empty forest rather than asserting storytree has no stories', () => {
  assert.throws(() => assertSnapshot(snapshot({ stories: [] })), /no stories/);
});

test('refuses a non-object', () => {
  assert.throws(() => assertSnapshot(null), /not an object/);
  assert.throws(() => assertSnapshot('{}'), /not an object/);
});

test('accepts the shape the exporter actually publishes', () => {
  assert.equal(assertSnapshot(snapshot()).storyCount, 2);
});

// ── the stamp: the one thing the page must never lose ────────────────────────

test('the stamp names the snapshot’s own date, and MOVES when the snapshot does', () => {
  const a = renderStamp(snapshot({ generatedAt: '2026-08-28T07:44:22.433Z' }));
  const b = renderStamp(snapshot({ generatedAt: '2026-01-02T00:00:00.000Z' }));
  assert.match(a, /28 August 2026/);
  assert.match(b, /2 January 2026/);
  // a constant string would satisfy every other assertion here
  assert.notEqual(a, b);
});

test('the stamp says outright that it is not live', () => {
  assert.match(renderStamp(snapshot()), /not live/i);
});

test('the stamp counts what is proven, and the count is the snapshot’s', () => {
  assert.match(renderStamp(snapshot({ storyCount: 35, provenStoryCount: 21 })), /21 of 35/);
});

test('the date is read in UTC, so the picture is not dated by the reader’s timezone', () => {
  // 23:30 UTC is already "tomorrow" east of Greenwich and still "today" west of it.
  assert.equal(formatStampDate('2026-08-28T23:30:00.000Z'), '28 August 2026');
});

// ── status: a colour the engine does not have must not be invented ───────────

test('maps the published statuses to their own hues', () => {
  assert.equal(toSceneStatus('healthy'), 'healthy');
  assert.equal(toSceneStatus('proposed'), 'proposed');
  assert.equal(toSceneStatus('mapped'), 'mapped');
  assert.equal(toSceneStatus('unhealthy'), 'unhealthy');
});

test('an unreadable or FUTURE status reads as unknown, never as a colour we happen to have', () => {
  assert.equal(toSceneStatus(null), 'unknown');
  // the shape that matters: an exporter one version ahead sends something new
  assert.equal(toSceneStatus('quarantined'), 'unknown');
});

// ── layout ──────────────────────────────────────────────────────────────────

test('places every story exactly once', () => {
  const stories = [story('a'), story('b', ['a']), story('c', ['b']), story('d', ['a'])];
  const placed = placeStories(stories);
  assert.equal(placed.length, stories.length);
  assert.equal(new Set(placed.map((p) => p.story.id)).size, stories.length);
});

test('sizes an island from its capability count', () => {
  const placed = placeStories([story('small', [], 1), story('big', [], 20)]);
  const small = placed.find((p) => p.story.id === 'small');
  const big = placed.find((p) => p.story.id === 'big');
  assert.ok(small && big);
  assert.ok(big.radius > small.radius, `${big.radius} should exceed ${small.radius}`);
});

test('the frame contains every island — nothing is laid out off the edge', () => {
  const stories = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
    story(id, i === 0 ? [] : ['a'], i * 3 + 1),
  );
  const placed = placeStories(stories);
  const { width, height, offset } = frameFor(placed);
  for (const p of placed) {
    const x = p.centre.x + offset.x;
    const y = p.centre.y + offset.y;
    assert.ok(x - p.radius >= 0 && x + p.radius <= width, `${p.story.id} outside x`);
    assert.ok(y - p.radius >= 0 && y + p.radius <= height, `${p.story.id} outside y`);
  }
});

test('a dependent sits ABOVE what it depends on — and the fixture CAN break it', () => {
  // the property: the forest reads bottom-up, foundations at the bottom.
  const chain = [story('base'), story('mid', ['base']), story('top', ['mid'])];
  const yOf = (stories: SnapshotStory[]): Map<string, number> =>
    new Map(placeStories(stories).map((p) => [p.story.id, p.centre.y]));

  const y = yOf(chain);
  // scene y grows DOWNWARD, so "above" is a smaller y
  assert.ok((y.get('top') ?? 0) < (y.get('mid') ?? 0), 'top should sit above mid');
  assert.ok((y.get('mid') ?? 0) < (y.get('base') ?? 0), 'mid should sit above base');

  // TEETH: reverse every edge and the same assertion must FAIL. Without this, a layout that
  // ignored dependencies entirely (one row, every island at the same y) could still pass —
  // and so could one that read the edges backwards.
  const reversed = [story('base', ['mid']), story('mid', ['top']), story('top')];
  const ry = yOf(reversed);
  assert.ok(
    !((ry.get('top') ?? 0) < (ry.get('mid') ?? 0) && (ry.get('mid') ?? 0) < (ry.get('base') ?? 0)),
    'reversing the dependency edges must change the vertical order — otherwise the property above is vacuous',
  );
});
