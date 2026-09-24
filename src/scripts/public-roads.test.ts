// public-roads.test.ts — the public map's 3D roads run where the drawing's roads run.
//
// ⚠ THE OWNER'S DEFECT (2026-09-25, the live site): "pathways that are broken - seems to have hidden
// pathways that dont show up unless you click on them." Measured, not guessed: the land carried all
// 117 road segments, but sizing each island to its component count (every public island shrinks to
// 0.55–0.83 of its drawn size) dragged every road point toward its nearest island by
// `(p − centre)·(s − 1)` — median 24 units, worst 48, all 117 segments off route. Clicking an island
// lights the DRAWN route (the SVG's selection lane), which the 3D road had left, so a road appeared
// where none was drawn. The engine now moves a road with an island only near that island's shore
// (`spanShift`, true-footprint.ts); in open ground it is exactly the drawn route.
//
// This holds the REAL published snapshot to that, so a rule that bends the public roads again reds
// here rather than on the live site.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import snapshotJson from '../data/forest-snapshot.json';
import { islandCentres, islandReaches } from '../lib/forest-world-r3f/true-footprint';
import { landStreamFromDrawing, trueGroundFromDrawing } from '../lib/forest-world-r3f/true-ground';
import { worldTo3D, type InstanceDescriptor } from '../lib/forest-world-r3f/world-to-3d';
import { assertSnapshot, publicForestDrawing } from './forest-snapshot-map';

const snap = assertSnapshot(snapshotJson);
const scene = publicForestDrawing(snap);
const strips = (ds: readonly { kind: string }[]): InstanceDescriptor[] =>
  ds.filter((d): d is InstanceDescriptor => d.kind === 'trail-strip');

// The drawing on true ground, before any island is sized: the route the SVG draws, un-projected.
const drawn = trueGroundFromDrawing(worldTo3D(scene, { landAreaPerCapability: null }));
const route = new Map(strips(drawn).map((s) => [s.segment, s.points ?? []]));
const shipped = landStreamFromDrawing(scene);
const roads = strips(shipped);
const centres = islandCentres(drawn);
const reaches = islandReaches(drawn, centres);

/** Distance from a point to the nearest island, in that island's reaches. */
function reachesAway(p: { x: number; z: number }): number {
  let best = Infinity;
  for (const [id, c] of centres) best = Math.min(best, Math.hypot(p.x - c.x, p.z - c.z) / (reaches.get(id) as number));
  return best;
}

test('the public 3D roads: every road segment the drawing carries is a 3D road, and every dependency rides one', () => {
  assert.equal(roads.length, route.size);
  assert.ok(roads.length > 100, `${roads.length} roads`);
  const carried = new Set(roads.flatMap((r) => (r.edges ?? []) as string[]));
  const ids = new Set(snap.stories.map((s) => s.id));
  const wanted = snap.stories.flatMap((s) => s.dependsOn.filter((d) => ids.has(d)).map((d) => `${d}->${s.id}`));
  assert.deepEqual(wanted.filter((e) => !carried.has(e)), []);
});

test('the public 3D roads: ⚠⚠ in open ground a road is EXACTLY its drawn route — sizing the islands does not bend it', () => {
  let open = 0;
  let total = 0;
  const bent: string[] = [];
  for (const road of roads) {
    const want = route.get(road.segment) as NonNullable<InstanceDescriptor['points']>;
    (road.points ?? []).forEach((p, i) => {
      total += 1;
      // Two reaches out is past every band on this map (every factor is within ½ of 1).
      if (reachesAway(want[i]!) < 2) return;
      open += 1;
      if (Math.hypot(p.x - want[i]!.x, p.z - want[i]!.z) > 1e-9) bent.push(`${road.segment}#${i}`);
    });
  }
  // Non-vacuity: a large share of the network is open ground (42% of its points, measured), which
  // is why the old rule bent so much of it.
  assert.ok(open / total > 0.3, `${open} of ${total} points in open ground`);
  assert.deepEqual(bent, []);
});

test('the public 3D roads: near a shore a road follows its island by no more than the island shrank', () => {
  // The retired rule's worst was 48 units and its median 24; following a shore is bounded by the
  // largest shrink an island on this map takes, which is a small fraction of a reach.
  const maxReach = Math.max(...reaches.values());
  let worst = 0;
  for (const road of roads) {
    const want = route.get(road.segment)!;
    (road.points ?? []).forEach((p, i) => {
      worst = Math.max(worst, Math.hypot(p.x - want[i]!.x, p.z - want[i]!.z));
    });
  }
  assert.ok(worst < 0.5 * maxReach, `worst ${worst} against reach ${maxReach}`);
});

test('the public 3D roads: roads that met in the drawing still meet: no junction splits', () => {
  const key = (p: { x: number; z: number }): string => `${p.x.toFixed(6)},${p.z.toFixed(6)}`;
  const at = new Map<string, { x: number; z: number }[]>();
  for (const road of roads) {
    const want = route.get(road.segment)!;
    const pts = road.points ?? [];
    for (const i of [0, pts.length - 1]) {
      const k = key(want[i]!);
      at.set(k, [...(at.get(k) ?? []), pts[i]!]);
    }
  }
  const shared = [...at.values()].filter((g) => g.length > 1);
  assert.ok(shared.length > 20, `${shared.length} shared junctions`);
  const split = shared.filter((g) => g.some((p) => Math.hypot(p.x - g[0]!.x, p.z - g[0]!.z) > 1e-9));
  assert.equal(split.length, 0);
});
