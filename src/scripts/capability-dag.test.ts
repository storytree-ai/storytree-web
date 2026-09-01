// The layered layout behind the island panel's capability graph (ADR-0453 D6's unbuilt floor,
// ADR-0502's pannable box). Geometry only — every assertion here is about where boxes go, because
// that is all the module decides.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DAG_METRICS, idLines, layoutCapabilityDag } from './capability-dag';
import type { DagInput } from './capability-dag';
import { roamPayload } from './forest-snapshot-map';
import snapshotJson from '../data/forest-snapshot.json';

const cap = (id: string, ...dependsOn: string[]): DagInput => ({ id, dependsOn });

const byId = (layout: ReturnType<typeof layoutCapabilityDag>, id: string) => {
  const node = layout.nodes.find((n) => n.id === id);
  assert.ok(node, `no node laid out for ${id}`);
  return node;
};

// ── the thing that was missing: a node per capability, an edge per dependsOn ─

test('THE INCREMENT: every exported capability becomes a node and every in-story dependsOn an edge', () => {
  // This is the red→green. Before this module the panel rendered `capabilityTally` — a COUNT that
  // expanded to a text list — and drew nothing. Nodes and edges are what the owner asked for when
  // he said the capability tree was not on the website.
  const caps = [cap('a'), cap('b', 'a'), cap('c', 'a'), cap('d', 'b', 'c')];
  const layout = layoutCapabilityDag(caps);
  assert.equal(layout.nodes.length, 4);
  assert.equal(layout.edges.length, 4);
  const drawn = layout.edges.map((e) => `${e.from}->${e.to}`).sort();
  assert.deepEqual(drawn, ['a->b', 'a->c', 'b->d', 'c->d']);
  for (const e of layout.edges) assert.match(e.d, /^M [\d.]+ [\d.]+ C /, `edge ${e.from}->${e.to} has no path`);
});

test('the foundation is at the BOTTOM — a capability sits above what it rests on', () => {
  // `rankdir: BT`, the same reading direction the studio's sub-DAG uses and the one the corpus's
  // own "stands on" language carries.
  const layout = layoutCapabilityDag([cap('base'), cap('mid', 'base'), cap('top', 'mid')]);
  assert.equal(byId(layout, 'base').rank, 0);
  assert.equal(byId(layout, 'mid').rank, 1);
  assert.equal(byId(layout, 'top').rank, 2);
  assert.ok(byId(layout, 'base').y > byId(layout, 'mid').y, 'the base must be BELOW what rests on it');
  assert.ok(byId(layout, 'mid').y > byId(layout, 'top').y);
});

test('rank is the LONGEST path, so an edge never points sideways within a rank', () => {
  // `d` depends on both `a` (one hop away) and `c` (three). Shortest-path ranking would put `d` at
  // rank 1 and draw the c->d edge flat across its own row.
  const layout = layoutCapabilityDag([cap('a'), cap('b', 'a'), cap('c', 'b'), cap('d', 'a', 'c')]);
  assert.equal(byId(layout, 'd').rank, 3);
  for (const e of layout.edges) {
    assert.ok(byId(layout, e.from).rank < byId(layout, e.to).rank, `${e.from}->${e.to} does not climb`);
  }
});

test('an edge leaving the story is dropped rather than drawn to a node that is not there', () => {
  // The export carries cross-story dependencies. Drawing a stub for one would assert a box this
  // picture does not contain.
  const layout = layoutCapabilityDag([cap('a'), cap('b', 'a', 'somewhere-else')]);
  assert.equal(layout.nodes.length, 2);
  assert.deepEqual(
    layout.edges.map((e) => `${e.from}->${e.to}`),
    ['a->b'],
  );
});

test('a self-edge is dropped', () => {
  const layout = layoutCapabilityDag([cap('a', 'a')]);
  assert.equal(layout.edges.length, 0);
  assert.equal(byId(layout, 'a').rank, 0);
});

test('TEETH: a cycle reaching the browser lays out instead of hanging', () => {
  // `check:library-dag-acyclic` holds the authored graph acyclic upstream, but this code runs on a
  // visitor's machine against a published file. A naive longest-path recursion would not return.
  const layout = layoutCapabilityDag([cap('a', 'b'), cap('b', 'a'), cap('c', 'a')]);
  assert.equal(layout.nodes.length, 3);
  assert.ok(layout.width > 0 && layout.height > 0);
});

test('the same input always lays out identically, whatever order it arrives in', () => {
  // The picture is built at click time. A layout that shuffled between two renders of one island
  // would read as the map changing under the reader.
  const caps = [cap('a'), cap('b', 'a'), cap('c', 'a'), cap('d', 'b', 'c'), cap('e', 'a')];
  const once = layoutCapabilityDag(caps);
  const twice = layoutCapabilityDag([...caps].reverse());
  assert.deepEqual(twice.nodes.map((n) => `${n.id}@${n.x},${n.y}`).sort(), once.nodes.map((n) => `${n.id}@${n.x},${n.y}`).sort());
});

test('no two boxes overlap, on any island in the published snapshot', () => {
  const { nodeW, nodeH } = DAG_METRICS;
  for (const story of roamPayload(snapshotJson as never).stories) {
    if (story.capabilities.length === 0) continue;
    const layout = layoutCapabilityDag(story.capabilities);
    for (let i = 0; i < layout.nodes.length; i++) {
      for (let j = i + 1; j < layout.nodes.length; j++) {
        const a = layout.nodes[i];
        const b = layout.nodes[j];
        if (!a || !b) continue;
        const apart = Math.abs(a.x - b.x) >= nodeW || Math.abs(a.y - b.y) >= nodeH;
        assert.ok(apart, `${story.id}: ${a.id} and ${b.id} overlap at ${a.x},${a.y}`);
      }
    }
  }
});

test('every published island lays out inside a box the panel can fit', () => {
  // Reported so the payload/frame cost of the widest and deepest islands is a measured number
  // rather than an assumption: `studio` is 12 wide, `drive-machinery` 8 deep.
  let widest = 0;
  let tallest = 0;
  for (const story of roamPayload(snapshotJson as never).stories) {
    if (story.capabilities.length === 0) continue;
    const layout = layoutCapabilityDag(story.capabilities);
    widest = Math.max(widest, layout.width);
    tallest = Math.max(tallest, layout.height);
    assert.equal(layout.nodes.length, story.capabilities.length, `${story.id}: node count != capability count`);
  }
  assert.ok(widest > 0 && tallest > 0);
  // A ceiling, not a target — it exists so a future export that widened an island tenfold would
  // fail here rather than silently produce a picture nothing can fit.
  assert.ok(widest < 4000, `widest island lays out ${widest}px across`);
  assert.ok(tallest < 4000, `tallest island lays out ${tallest}px down`);
});

// ── labels ──────────────────────────────────────────────────────────────────

test('an id wraps to at most two lines and never silently loses its tail', () => {
  assert.deepEqual(idLines('short'), ['short']);
  const wrapped = idLines('prove-it-gate-and-then-some-more');
  assert.equal(wrapped.length, 2);
  assert.ok(wrapped[0]?.length ?? 0 <= 13);
  assert.match(wrapped[1] ?? '', /…$/, 'an over-long tail must be elided visibly');
});

test('THE LABELS ARE NOT TRANSLATED — ADR-0453 D3 keeps them our real corpus names', () => {
  // The fence this test exists to hold: a session making the map legible to strangers has misread
  // the decision. The visitor projects their own system onto an unreadable shape.
  assert.deepEqual(idLines('prove-it-gate').join('-'), 'prove-it-gate');
});

// ── the export half ─────────────────────────────────────────────────────────

test('THE INCREMENT, EXPORT HALF: the roam payload publishes the edges at all', () => {
  // ⚠ THIS IS THE ASSERTION THAT WAS RED. The increment's brief said the data was already exported
  // and this was rendering only — true of `forest-snapshot.json`, which has carried `dependsOn` per
  // capability all along, but NOT of the payload the browser actually receives. `roamPayload`
  // published `id`/`title`/`status` and dropped the edges, so no amount of rendering could have
  // drawn a graph. Verified by removing the fold's `dependsOn` line again: this test fails.
  const payload = roamPayload(snapshotJson as never);
  const withEdges = payload.stories.flatMap((s) => s.capabilities).filter((c) => c.dependsOn.length > 0);
  assert.ok(withEdges.length > 0, 'the payload carries no capability edges — the graph has nothing to draw');
});

test('the published payload draws the number of edges the snapshot actually records', () => {
  // Measured 2026-09-01 on the pinned snapshot: 203 capabilities, 126 carrying an edge, 186 edges,
  // every one of them in-story. Asserted as a RELATION between the two files rather than as the
  // literals, so a re-export moves both together instead of reddening this.
  const payload = roamPayload(snapshotJson as never);
  let laidOut = 0;
  let recorded = 0;
  for (const story of payload.stories) {
    const ids = new Set(story.capabilities.map((c) => c.id));
    for (const c of story.capabilities) {
      recorded += c.dependsOn.filter((d) => d !== c.id && ids.has(d)).length;
    }
    if (story.capabilities.length > 0) laidOut += layoutCapabilityDag(story.capabilities).edges.length;
  }
  assert.ok(recorded > 0, 'no in-story edges in the payload at all');
  assert.equal(laidOut, recorded, 'the graph drops or invents edges the payload records');
});
