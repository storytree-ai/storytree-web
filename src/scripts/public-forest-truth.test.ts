// The public forests tell the truth again (2026-09-24, after the 3D land mounted — ADR-0608 D4).
//
// Three defects the land's first picture carried, each pinned where it was caused:
//   1. the flat map's criterion flowers had no class, so they painted in SVG's default BLACK and
//      floated over the land;
//   2. a microservice's proven / not-yet-proven status had no mark left once the ground went
//      per-component, so the nameplate now carries it as a word;
//   3. an island sat under TELL's first sentence, so the map is cleared under the prose.
//
// ⚠ `bun test` TRANSPILES AND DOES NOT TYPECHECK. `npm run typecheck` covers this file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { sceneToSvg } from '../lib/worldSvg';
import { buildScene } from '../lib/forest-world';
import { STATUS_READING } from './act2-roam';
import {
  assertSnapshot,
  forestArrivalSvg,
  forestSceneInput,
  forestSvg,
  nameplateTally,
  nameplateWidth,
  toSceneStatus,
} from './forest-snapshot-map';
import { clearingHoles, clearingMaskUrl, cornerBox, CLEARING_PAD } from './prose-clearing';
import snapshotJson from '../data/forest-snapshot.json';

const SNAP = assertSnapshot(snapshotJson);

test('the public forests emit no flat picture — the 3D land stands its own flowers, ground and trees', () => {
  // ADR-0608 D2/D4 (and ADR-0600 D1: the land stands a flower per criterion). The first land picture
  // carried the flat map's classless criterion flowers, painting in SVG's default BLACK over the
  // land. The fix is not a class on them but their absence: the public serialisation never emits
  // the flat look at all, so there is nothing to hide and nothing to paint black.
  const criteria = SNAP.stories.reduce((n, s) => n + s.uat.length, 0);
  assert.ok(criteria > 0, 'the published snapshot carries criteria — so a flat drawing WOULD have flowers');
  for (const [name, svg] of [
    ['forestArrivalSvg', forestArrivalSvg(SNAP)],
    ['forestSvg', forestSvg(SNAP)],
  ] as const) {
    for (const cls of ['tw-uat', 'tw-cell', 'tw-crown', 'tw-bg', 'tw-ground', 'tw-land', 'tw-flora', 'tw-conifer']) {
      assert.ok(!new RegExp(`class="(?:[^"]* )?${cls}[ "]`).test(svg), `${name} still emits the flat ${cls}`);
    }
    assert.ok(!svg.includes('tall-flower-'), `${name} still emits a flat criterion flower part`);
    assert.ok(!svg.includes('id="tw-board"'), `${name} still carries the retired board gradient`);
    // …while keeping what a reader reads and acts through: one nameplate and one hit disc per island.
    const plates = svg.match(/class="tw-plate"/g) ?? [];
    const hits = svg.match(/class="tw-hit"/g) ?? [];
    assert.equal(plates.length, SNAP.stories.length, `${name}: one nameplate per island`);
    assert.equal(hits.length, SNAP.stories.length, `${name}: one hit disc per island`);
  }
});

test('the Act 2 walk still draws the flat flowers, and every flower part is classed — unclassed SVG paints black', () => {
  // ⚠ The wrapper carries a `transform` after its class; an earlier `class="tw-uat[^"]*">` pattern
  // matched no wrapper at all and passed on zero parts — hence the count guard below.
  // The walk serialises through plain `sceneToSvg` and keeps its flat drawing, so the black-spike
  // defect is still possible THERE: every primitive inside a flower wrapper must carry a class.
  const svg = sceneToSvg(buildScene(forestSceneInput(SNAP)));
  const criteria = SNAP.stories.reduce((n, s) => n + s.uat.length, 0);
  const wrappers = svg.match(/class="tw-uat tall-flower-(proven|pending|failing)"/g) ?? [];
  assert.equal(wrappers.length, criteria, 'one classed flower per criterion');
  let parts = 0;
  for (const m of svg.matchAll(/<g class="tw-uat[^"]*"[^>]*>([\s\S]*?)<\/g>/g)) {
    for (const el of (m[1] ?? '').matchAll(/<(path|circle|ellipse)(\s[^>]*)?\/>/g)) {
      parts += 1;
      assert.match(el[2] ?? '', /class="/, `an unclassed <${el[1]}> inside a criterion flower`);
    }
  }
  assert.ok(parts >= criteria, `only ${parts} flower parts examined — the extractor has gone blind`);
  // …and the stylesheet paints what it is given.
  const css = readFileSync(new URL('../styles/tree-world-map.css', import.meta.url), 'utf8');
  for (const part of ['stem', 'leaf', 'bud', 'glow', 'petal', 'center']) {
    assert.ok(css.includes(`.tall-flower-${part}`), `no paint for .tall-flower-${part}`);
  }
});

test('every nameplate says whether its microservice is proven, in ROAM\'s own words', () => {
  assert.equal(nameplateTally(7, 'healthy'), 'proven · 7 components');
  assert.equal(nameplateTally(1, 'proposed'), 'not yet proven · 1 component');
  for (const status of ['healthy', 'mapped', 'proposed', 'building', 'unhealthy', 'unknown'] as const) {
    assert.ok(nameplateTally(3, status).startsWith(STATUS_READING[status].word + ' · '));
  }
  // On the page: each island's plate leads with its own status word.
  const svg = forestArrivalSvg(SNAP);
  for (const story of SNAP.stories) {
    const word = STATUS_READING[toSceneStatus(story.status)].word;
    assert.ok(svg.includes(`>${word} · `), `no status word for ${story.id}`);
  }
  // …and the plate is wide enough for the longer line.
  const long = nameplateTally(26, 'proposed');
  assert.ok(nameplateWidth('cli', long) > long.length * 5.5, 'the plate is narrower than its own tally');
  assert.equal(nameplateWidth('a', 'b'), 96);
});

test('the map is cleared under every box of text, and nowhere else', () => {
  const frame = { left: 0, top: 0, width: 1600, height: 1000 };
  const column = { left: 48, top: 50, width: 480, height: 101 };
  const stamp = { left: 432, top: 844, width: 736, height: 72 };
  const P = CLEARING_PAD;
  assert.deepEqual(clearingHoles(frame, [column, stamp]), [
    { x: 48 - P, y: 50 - P, w: 480 + 2 * P, h: 101 + 2 * P },
    { x: 432 - P, y: 844 - P, w: 736 + 2 * P, h: 72 + 2 * P },
  ]);
  // A collapsed or hidden element is not text on the map; nothing to clear means no mask at all.
  assert.deepEqual(clearingHoles(frame, [{ ...column, width: 0 }]), []);
  assert.equal(clearingMaskUrl(frame, []), null);
  assert.equal(clearingMaskUrl(frame, [{ ...stamp, height: 0 }]), null);
  // Frame-relative, and clipped to the frame; text wholly off the frame clears nothing.
  assert.deepEqual(clearingHoles({ left: 100, top: 40, width: 800, height: 600 }, [column], 0), [
    { x: 0, y: 10, w: 428, h: 101 },
  ]);
  assert.deepEqual(clearingHoles(frame, [{ left: 2000, top: 10, width: 50, height: 50 }]), []);
  // The mask is the frame with one even-odd hole per box, feathered.
  const url = clearingMaskUrl(frame, [column, stamp]) ?? '';
  const svg = decodeURIComponent(url.slice('url("data:image/svg+xml,'.length, -2));
  assert.match(svg, /fill-rule='evenodd'/);
  assert.match(svg, /feGaussianBlur/);
  assert.ok(svg.includes(`M${48 - P} ${50 - P}h${480 + 2 * P}v${101 + 2 * P}`), 'no hole under the prose');
  assert.ok(svg.includes(`M${432 - P} ${844 - P}h${736 + 2 * P}v${72 + 2 * P}`), 'no hole under the stamp');
  assert.equal((svg.match(/Z/g) ?? []).length, 3, 'the frame and exactly two holes');
});

test('top-left prose clears ONE corner to its longest line and last line — no island threads between lines', () => {
  const frame = { left: 0, top: 0, width: 1600, height: 1000 };
  const line1 = { left: 48, top: 50, width: 459, height: 28 };
  const line2 = { left: 48, top: 78, width: 319, height: 28 };
  const figure = { left: 48, top: 130, width: 400, height: 250 };
  assert.deepEqual(cornerBox(frame, [line1, line2]), { left: 0, top: 0, width: 507, height: 106 });
  assert.deepEqual(cornerBox(frame, [line1, line2, figure]), { left: 0, top: 0, width: 507, height: 380 });
  assert.equal(cornerBox(frame, []), null);
  assert.equal(cornerBox(frame, [{ ...line1, height: 0 }]), null);
  // Offset frame: the corner is the FRAME's.
  assert.deepEqual(cornerBox({ left: 100, top: 40, width: 800, height: 600 }, [line1]), { left: 100, top: 40, width: 407, height: 38 });
});
