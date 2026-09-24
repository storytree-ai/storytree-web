// forest-growth.ts — the forest's arrival.
//
// ⚠ WHAT THIS SUITE IS FOR. Most of what can go wrong here is INVISIBLE to anyone running a browser
// with JavaScript on, which is everyone who reviews this:
//
//   1. the parked state escaping its `is-growing` scope, which hides the whole map from a visitor
//      whose script never runs while looking perfect to everybody else;
//   2. an island dropped from the schedule, which leaves part of the forest permanently invisible
//      on a page whose pitch is that the map is complete;
//   3. a trail segment parked and never drawn, which is the same failure one layer down and is
//      STRICTLY EASIER to commit now that a segment's parked state is a `stroke-dashoffset` rather
//      than a group opacity;
//   4. the reveal running long enough to read as a live feed rather than a picture assembling,
//      which is the honesty fence (ADR-0491) and which edge scheduling pushes on in a way the old
//      wave schedule could not.
//
// ⚠ `bun test` TRANSPILES AND DOES NOT TYPECHECK. `npm run typecheck` covers this file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DRAWING_CLASS,
  DRAW_REVERSED_CLASS,
  GROWING_CLASS,
  GROWTH_TUNING,
  ISLAND_LAYERS,
  ISLAND_LIST_LAYER,
  LAND_LAYERS,
  MS_GROWTH_CEILING,
  MS_GROWTH_LEAD_IN,
  NESTED_LAYERS,
  TRAIL_PASSES,
  deriveGrowthPlan,
  parseSegmentChain,
  readGrowthGraph,
  type GrowthEdge,
  type GrowthGraph,
} from './forest-growth';
import { TELL_SCRIPT, beatStarts } from './act2-tell';
import { assertSnapshot, forestArrivalSvg } from './forest-snapshot-map';
import snapshotJson from '../data/forest-snapshot.json';

const SNAP = assertSnapshot(snapshotJson);
/** The markup the home page actually serves — since ADR-0608 the land serialisation, which carries
 *  fewer layers than the engine's emitter can write. What the growth animates is read off THIS. */
const served = (): string => forestArrivalSvg(SNAP);

/**
 * A minimal stand-in for the served `<svg>` element: enough of `querySelectorAll` to answer the
 * `.class[attr][attr]` selectors `readGrowthGraph` issues, over the real markup. No DOM library is
 * installed here, and a hand-written list of ids would agree with whatever the reader assumed.
 */
function fakeMap(svg: string): Element {
  const tags = [...svg.matchAll(/<([a-zA-Z]+)(\s[^>]*?)?\/?>/g)].map((m) => {
    const attrs = new Map<string, string>();
    for (const a of (m[2] ?? '').matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) attrs.set(a[1] ?? '', a[2] ?? '');
    return {
      classes: new Set((attrs.get('class') ?? '').split(/\s+/)),
      getAttribute: (name: string): string | null => attrs.get(name) ?? null,
    };
  });
  return {
    querySelectorAll(sel: string) {
      const m = /^\.([a-z-]+)((?:\[[a-z-]+\])*)$/.exec(sel);
      if (m === null) throw new Error(`fakeMap cannot answer ${sel}`);
      const need = [...(m[2] ?? '').matchAll(/\[([a-z-]+)\]/g)].map((a) => a[1] ?? '');
      return tags.filter((t) => t.classes.has(m[1] ?? '') && need.every((a) => t.getAttribute(a) !== null));
    },
  } as unknown as Element;
}

const page = (): string => readFileSync(new URL('../pages/index.astro', import.meta.url), 'utf8');
/**
 * The stylesheet with its comments removed.
 *
 * ⚠ EVERY SELECTOR SCAN BELOW MUST USE THIS. A rule is matched as "anything up to a `{`", and this
 * file's comments sit directly above their rules and quote the very class names being searched for
 * — so the un-stripped text hands a scan a "selector" made of prose. Found by seeding the fault
 * these scans exist for: the `.is-drawing` check read a comment mentioning `.tw-trail-fill` as if
 * it were a selector, and reported on that instead of on the rule.
 */
const styleRules = (): string => page().replace(/\/\*[\s\S]*?\*\//g, '');
const emitter = (): string => readFileSync(new URL('../lib/worldSvg.ts', import.meta.url), 'utf8');

// ── graph fixtures ──────────────────────────────────────────────────────────

/** A graph whose segment lengths are all the fallback, so pacing is deterministic here. */
function graphOf(storyIds: readonly string[], edges: readonly GrowthEdge[]): GrowthGraph {
  return { storyIds, edges, segmentLengths: new Map() };
}
function edge(from: string, to: string, segs = 1): GrowthEdge {
  return {
    from,
    to,
    segments: Array.from({ length: segs }, (_, i) => ({ id: `${from}-${to}-${i}`, reversed: false })),
  };
}
/** A → B → C → … : the deepest possible graph for `n` islands, and the worst case for a schedule
 *  whose length is a property of the longest chain. */
function chain(n: number): GrowthGraph {
  const ids = Array.from({ length: n }, (_, i) => `s${i}`);
  return graphOf(ids, ids.slice(1).map((id, i) => edge(`s${i}`, id)));
}
/** One base island, everything else hanging directly off it — the shallowest non-trivial graph. */
function star(n: number): GrowthGraph {
  const ids = Array.from({ length: n }, (_, i) => `s${i}`);
  return graphOf(ids, ids.slice(1).map((id) => edge('s0', id)));
}
/** `layers` ranks of `width` islands, fully connected rank to rank — the shape a real corpus is
 *  closest to, and the one that produces the most pathways. */
function layered(layers: number, width: number): GrowthGraph {
  const ids: string[] = [];
  for (let l = 0; l < layers; l += 1) for (let w = 0; w < width; w += 1) ids.push(`l${l}w${w}`);
  const edges: GrowthEdge[] = [];
  for (let l = 1; l < layers; l += 1) {
    for (let w = 0; w < width; w += 1) {
      for (let p = 0; p < width; p += 1) edges.push(edge(`l${l - 1}w${p}`, `l${l}w${w}`, 2));
    }
  }
  return graphOf(ids, edges);
}

// ── the layers an island is actually made of ────────────────────────────────

test('TEETH: every per-island layer the ENGINE emits is animated — none is left painting', () => {
  // ⚠ THE BUG THIS EXISTS FOR SHIPPED IN THIS MODULE'S FIRST DRAFT. The obvious selector is
  // `.tw-isle`, and `tw-isle` is the COASTLINE ALONE — the engine paints an island across three
  // sibling top-level layers so the whole forest stacks correctly. Animating one of the three
  // hides a shore and leaves the island exactly where it was, and NOTHING THROWS: the page looks
  // like it has no growth, which is the report that started this increment.
  //
  // ⚠ AND THE EXPECTATION IS DERIVED FROM THE SERVED MAP, NOT FROM A LIST TYPED HERE. A hand-copied
  // list would have been copied from the same wrong belief as the code (the first draft's own
  // probe counted `.tw-isle` too, and agreed with it). This reads the markup the home page ships
  // (`forestArrivalSvg`) and asks which groups carry a `data-id`, because `data-id` is exactly the
  // marker that says "this group belongs to one story". It reads the SERVED markup rather than the
  // emitter's source since ADR-0608: the emitter can still write `tw-ground` (the Act 2 walk draws
  // it), but the public map never carries it, and animating a layer that is not there does nothing.
  const emitted = new Set<string>();
  for (const m of served().matchAll(/<g class="(tw-[a-z-]+)[^"]*"[^>]*?data-id=/g)) {
    if (m[1] !== undefined) emitted.add(m[1]);
  }
  assert.ok(emitted.size >= 2, `only found ${emitted.size} per-island layers on the served map — the extractor has gone blind`);
  // The retired flat layers must not come back unannounced either: a `tw-ground` reappearing here
  // would be the flat picture over the land again (ADR-0608).
  assert.ok(!emitted.has('tw-ground'), 'the served map carries tw-ground again — the flat ground is back');
  // Covered = animated directly, or a descendant of something animated and named as such. The
  // second set is what stops this test being satisfiable by animating everything blindly: an
  // exclusion has to be written down with its reason before it counts.
  const covered = new Set<string>([...ISLAND_LAYERS, ...NESTED_LAYERS]);
  const missed = [...emitted].filter((c) => !covered.has(c));
  assert.deepEqual(
    missed,
    [],
    `worldSvg.ts emits per-island layer(s) the growth never touches: ${missed.join(', ')}. ` +
      'They will keep painting while their siblings arrive.',
  );
});

test('TEETH: every animated layer has a rule in the stylesheet — a listed layer that is not styled does nothing', () => {
  // The other half. `ISLAND_LAYERS` naming a class buys nothing if index.astro has no rule for it:
  // the module would stamp a delay onto an element no animation reads, and the layer would stay
  // painted. Both halves have to be checked or the pair can drift into agreeing about nothing.
  const css = page();
  for (const layer of ISLAND_LAYERS) {
    assert.ok(
      new RegExp(`\\.forest-arrival-svg\\.${GROWING_CLASS} \\.${layer}\\b`).test(css),
      `${layer} is in ISLAND_LAYERS but index.astro has no growth rule for it`,
    );
  }
});

test('the trees are not scaled — a fixed origin would slide them off their own ground', () => {
  // Measured on the live snapshot, the disc's centre sits between 28.7% and 50.4% of the way down
  // the `tw-terr` bounding box depending on how tall the island's trees are and how long its name
  // plate is. There is no fixed percentage that is right for every island, so the flora is moved
  // and faded rather than scaled. This pins the decision so "make them all scale, it's simpler"
  // has to argue with the measurement.
  const css = page();
  const terr = /\.forest-arrival-svg\.is-growing \.tw-terr \{([^}]*)\}/.exec(css);
  assert.ok(terr !== null, 'no growth rule for the flora layer');
  assert.ok(!/transform-box|scale\(/.test(terr[1] ?? ''), 'the flora layer is being scaled about a fixed origin');
  for (const land of LAND_LAYERS) {
    assert.ok(
      new RegExp(`\\.${land},?[\\s\\S]{0,140}?transform-box:\\s*fill-box`).test(css),
      `${land} should scale about its own fill-box centre`,
    );
  }
  assert.ok(
    (terr[1] ?? '').includes('--flora-delay'),
    'the flora rule does not read the per-island flora delay the module stamps',
  );
  // Enough that the land is essentially settled before an unscaled tree becomes readable on it.
  assert.ok(
    GROWTH_TUNING.floraOffsetMs >= GROWTH_TUNING.islandGrowthMs * 0.4,
    `the trees start ${GROWTH_TUNING.floraOffsetMs}ms in while the land takes ` +
      `${GROWTH_TUNING.islandGrowthMs}ms — a full-size tree on a part-grown disc`,
  );
});

test('TEETH: the island growth no longer overshoots — an overshoot reads as landing, not growing', () => {
  // The owner's words were that the islands "pop up". The previous curve was
  // `cubic-bezier(0.34, 1.32, 0.44, 1)`: it passes final size and comes back. That is the shape of
  // something arriving, and no amount of extra duration removes it — a slow pop is still a pop.
  const css = page();
  const rule = /\.forest-arrival-svg\.is-growing \.tw-isle \{([^}]*)\}/.exec(css);
  assert.ok(rule !== null, 'no growth rule for the land');
  const curve = /cubic-bezier\(([^)]*)\)/.exec(rule[1] ?? '');
  assert.ok(curve !== null, 'the land growth has no named easing curve');
  const points = (curve[1] ?? '').split(',').map((n) => Number(n.trim()));
  assert.equal(points.length, 4, 'unreadable easing curve');
  for (const p of [points[1], points[3]]) {
    assert.ok(p !== undefined && p <= 1, `the easing overshoots (control point ${p}) — the islands will pop`);
  }
});

// ── reading the graph off the page ──────────────────────────────────────────

test('TEETH: the emitter still stamps everything the schedule reads off the DOM', () => {
  // ⚠ THE SCHEDULE READS THE DEPENDENCY GRAPH OUT OF THE SERVED MARKUP AND SHIPS NO OTHER COPY OF
  // IT. That is the property worth having — nothing can disagree with the picture it animates — and
  // its cost is that the reader is coupled to attribute names written one repo up and copied here
  // by `sync:web-engine`. A rename there would leave `readGrowthGraph` finding zero edges, which
  // does not throw: every island would become a base island and the whole forest would arrive at
  // once, looking like a fade. This is the check that reds instead.
  const src = emitter();
  for (const attr of ['data-from', 'data-to', 'data-segments']) {
    assert.ok(
      new RegExp(`tw-trail-edge[\\s\\S]{0,400}?${attr}=`).test(src),
      `worldSvg.ts no longer stamps ${attr} on tw-trail-edge — the schedule reads it`,
    );
  }
  // ⚠ THE PASS LIST IS DERIVED FROM THE SERVED MAP, NOT TYPED HERE — same reason as the island
  // layers above. Since ADR-0608 the public map carries only the casing and fill passes (the land
  // draws the road's shadow and ghost), so the list is read off `forestArrivalSvg`: a pass that
  // came back — or a new one added upstream — would otherwise arrive unscheduled and jump into
  // place mid-arrival.
  const servedPasses = new Set<string>();
  for (const m of served().matchAll(/<path class="(tw-trail-[a-z]+)[^"]*"[^>]*?data-id=/g)) {
    if (m[1] !== undefined) servedPasses.add(m[1]);
  }
  assert.ok(servedPasses.size >= 2, `only found ${servedPasses.size} trail passes on the served map — the extractor has gone blind`);
  const unscheduled = [...servedPasses].filter((p) => !(TRAIL_PASSES as readonly string[]).includes(p));
  assert.deepEqual(unscheduled, [], `the served map carries trail pass(es) the schedule never stamps: ${unscheduled.join(', ')}`);
  const unserved = TRAIL_PASSES.filter((p) => !servedPasses.has(p));
  assert.deepEqual(unserved, [], `TRAIL_PASSES names pass(es) the served map no longer carries: ${unserved.join(', ')}`);
});

test('TEETH: the island list is read from a layer the served map carries for EVERY island', () => {
  // ⚠ THE FAILURE THIS EXISTS FOR SHIPPED WITH ADR-0608. The list used to be read from `tw-ground`,
  // which the land serialisation no longer emits — so `readGrowthGraph` would find ZERO islands,
  // `mountForestGrowth` would return inert, and the arrival would silently never run. Nothing
  // throws. `tw-isle` is not a safe substitute either: it is skipped for an island with no coast
  // loops. This reads the real served markup and requires every published story to be found.
  const graph = readGrowthGraph(fakeMap(served()), () => null);
  const expected = SNAP.stories.map((s) => s.id).sort();
  assert.ok(expected.length > 0, 'the published snapshot has no stories');
  assert.deepEqual([...graph.storyIds].sort(), expected, `the island list (read from .${ISLAND_LIST_LAYER}) is not the published stories`);
  assert.ok(graph.edges.length > 0, 'no dependency edge read off the served map — every island would be a base island');
  assert.ok(
    graph.edges.every((e) => e.segments.length > 0),
    'an edge on the served map has no segment chain — its road would never draw',
  );
  // Every segment an edge names has a pass on the served map to draw.
  const svg = served();
  const segs = new Set(graph.edges.flatMap((e) => e.segments.map((s) => s.id)));
  for (const pass of TRAIL_PASSES) {
    const ids = new Set([...svg.matchAll(new RegExp(`<path class="${pass}[ "][^>]*?data-id="([^"]+)"`, 'g'))].map((m) => m[1]));
    const missing = [...segs].filter((id) => !ids.has(id));
    assert.deepEqual(missing.slice(0, 5), [], `${missing.length} routed segment(s) have no ${pass} path to draw`);
  }
});

test("TEETH: the chain encoding this parses is the one the engine writes", () => {
  // `data-segments` is `id:F,id:R`, and the F/R is what decides which END a road grows from. If the
  // engine's encoding changed, `parseSegmentChain` would read every hop as forward and half the
  // network would draw backwards — visible, but only to someone watching closely, and nothing
  // would fail. The encoding lives in the SYNCED engine, so this reads it there.
  const scene = readFileSync(new URL('../lib/forest-world/scene.ts', import.meta.url), 'utf8');
  assert.ok(
    /reversed\s*\?\s*'R'\s*:\s*'F'/.test(scene),
    "the engine no longer encodes a reversed hop as 'R' — parseSegmentChain reads it as forward",
  );
  assert.ok(
    /segments:\s*e\.segments\.map[\s\S]{0,120}?\.join\(','\)/.test(scene),
    'the engine no longer joins the chain with commas',
  );
  assert.deepEqual(parseSegmentChain('ta:F,tb:R,tc:F'), [
    { id: 'ta', reversed: false },
    { id: 'tb', reversed: true },
    { id: 'tc', reversed: false },
  ]);
  // Tolerant, on purpose: a chain that gained a field must not take the whole arrival down.
  assert.deepEqual(parseSegmentChain(''), []);
  assert.deepEqual(parseSegmentChain(null), []);
  assert.deepEqual(parseSegmentChain('ta'), [{ id: 'ta', reversed: false }]);
});

// ── the schedule ────────────────────────────────────────────────────────────

test('TEETH: every island gets a window — none is dropped from the schedule', () => {
  // The failure: an island the walk never reaches gets no delay, or one past the moment the armed
  // class is removed. Either way that island never appears, and nothing on the page says so.
  // Checked across shapes because today's corpus is not a promise — including a graph with a CYCLE,
  // which is the shape that can strand an island off the map entirely.
  const cyclic = graphOf(
    ['a', 'b', 'c', 'd'],
    [edge('a', 'b'), edge('c', 'd'), edge('d', 'c')], // c and d depend on each other; nothing reaches them
  );
  for (const g of [chain(1), chain(2), chain(35), star(35), layered(6, 6), cyclic]) {
    for (const id of g.storyIds) {
      const island = deriveGrowthPlan(g).islands.get(id);
      assert.ok(island !== undefined, `island ${id} has no window at all`);
      assert.ok(
        island.floraEndMs <= deriveGrowthPlan(g).totalMs + 0.5,
        `island ${id} is still growing after the arrival is declared over`,
      );
      assert.ok(island.startMs >= MS_GROWTH_LEAD_IN - 0.5, `island ${id} starts before the lead-in`);
    }
  }
  // And the cycle is REPORTED rather than silently smoothed over.
  const plan = deriveGrowthPlan(cyclic);
  assert.deepEqual([...plan.unreachedStoryIds].sort(), ['c', 'd']);
  for (const id of plan.unreachedStoryIds) {
    assert.equal(plan.islands.get(id)?.reach, 'unreached');
  }
});

test('TEETH: every routed segment gets a draw window — no road is parked for good', () => {
  // The sharper half of the same failure. A segment is parked by `stroke-dashoffset`, so a segment
  // the walk never reached would be invisible for the whole session, on a map whose pitch is that
  // it is complete. Every segment named by an edge between two islands on the map must be drawn.
  const g = layered(5, 4);
  const plan = deriveGrowthPlan(g);
  const named = new Set(g.edges.flatMap((e) => e.segments.map((s) => s.id)));
  const missing = [...named].filter((id) => !plan.segments.has(id));
  assert.deepEqual(missing, [], `${missing.length} routed segment(s) never draw: ${missing.slice(0, 5).join(', ')}`);
  for (const [id, seg] of plan.segments) {
    assert.ok(seg.endMs > seg.startMs, `segment ${id} draws in zero time`);
    assert.ok(seg.endMs <= plan.totalMs + 0.5, `segment ${id} is still drawing after the arrival ends`);
  }
});

test('TEETH: the order follows the EDGE — a road leaves a settled island, and an island waits for its road', () => {
  // The causal invariant, and the whole point of the increment. Under the retired wave schedule an
  // island's start time came from its RANK; here it comes from an arrival, which is what makes the
  // forest read as growing out of something rather than being uncovered in strips.
  const plan = deriveGrowthPlan(layered(5, 4));
  const eps = 0.5;
  for (const p of plan.pathways) {
    const source = plan.islands.get(p.from);
    assert.ok(source !== undefined);
    assert.ok(
      p.startMs >= source.endMs - eps,
      `the pathway ${p.from} → ${p.to} leaves before ${p.from} has settled — an edge preceding its own end`,
    );
  }
  for (const [id, island] of plan.islands) {
    if (island.reach !== 'pathway') continue;
    const arrivals = plan.pathways.filter((p) => p.to === id).map((p) => p.endMs);
    assert.ok(arrivals.length > 0, `${id} is reached by a pathway but no pathway names it`);
    assert.ok(
      Math.abs(island.startMs - Math.min(...arrivals)) < eps,
      `${id} starts at ${island.startMs} but its first road arrives at ${Math.min(...arrivals)} — ` +
        'something other than the arrival is gating it',
    );
  }
});

test('TEETH: it is ONE arrival, not islands and then trails', () => {
  // The owner's second complaint, as a property. The retired schedule waited for the LAST island
  // before drawing ANY edge, so the reveal was two animations queued. Under edge scheduling most
  // islands must arrive AFTER roads have started drawing, or the mechanism has silently reverted.
  const plan = deriveGrowthPlan(layered(5, 4));
  const firstRoad = Math.min(...plan.pathways.map((p) => p.startMs));
  const after = [...plan.islands.values()].filter((i) => i.startMs > firstRoad).length;
  const total = plan.islands.size;
  assert.ok(
    after / total >= 0.6,
    `only ${after}/${total} islands arrive after the first road starts drawing — the reveal is back in phases`,
  );
  // And the converse: roads are still drawing while islands are still arriving.
  const lastIsland = Math.max(...[...plan.islands.values()].map((i) => i.startMs));
  const drawingThen = plan.pathways.filter((p) => p.startMs <= lastIsland && p.endMs >= lastIsland).length;
  assert.ok(drawingThen > 0, 'no road is mid-draw when the last island arrives — the two are queued, not woven');
});

test('TEETH: the arrival is BOUNDED and stays a reveal, not a live feed', () => {
  // ⚠ THE HONESTY FENCE, AS A NUMBER (ADR-0491). The map is a snapshot stamped with a date, and the
  // page's whole pitch is that its signals are real. A reveal that runs long enough to be mistaken
  // for a forest still filling in breaks exactly that claim — the same reason wisps were excluded
  // from the snapshot.
  //
  // ⚠ EDGE SCHEDULING IS WHY THIS MATTERS MORE THAN IT USED TO. A wave schedule's length is fixed
  // by construction; this one is a property of the GRAPH, so without the ceiling it would lengthen
  // quietly every time the corpus deepened and no single commit would have done it. The deep chain
  // below is the shape that proves the compression actually bites rather than being decorative.
  const shapes: [string, GrowthGraph][] = [
    ['a lone island', chain(1)],
    ['three in a line', chain(3)],
    ["today's depth over today's count", layered(12, 3)],
    ['a wide flat corpus', star(200)],
    ['a very deep chain', chain(200)],
    ['a large layered corpus', layered(20, 100)],
  ];
  for (const [name, g] of shapes) {
    const plan = deriveGrowthPlan(g);
    assert.ok(
      plan.totalMs <= MS_GROWTH_CEILING,
      `${name}: the arrival takes ${Math.round(plan.totalMs)}ms — that is a wait, not an arrival`,
    );
    assert.ok(plan.totalMs > MS_GROWTH_LEAD_IN, `${name}: the growth has no duration at all`);
  }
  assert.ok(
    deriveGrowthPlan(chain(200)).compression < 1,
    'a 200-deep chain is not compressed at all — the ceiling is not connected to anything',
  );
  // Compression scales the whole plan by ONE factor, so the causal order survives it. If it ever
  // stopped doing that, a compressed corpus would draw roads into islands that had not settled.
  const deep = deriveGrowthPlan(chain(60));
  for (const p of deep.pathways) {
    assert.ok(
      p.startMs >= (deep.islands.get(p.from)?.endMs ?? 0) - 0.5,
      'compression broke the causal order — a road leaves before its island has settled',
    );
  }
});

test('TEETH: the ceiling is anchored to the page, not to taste — the arrival ends inside the first argued sentence', () => {
  // ⚠ WHY 7.2 SECONDS. The number is not a feeling about animation length; it is where this page
  // stops being a picture and starts being an argument.
  //
  // TELL's first beat is nothing but the product's name held over the map — its own header says the
  // overlap with a still-arriving forest is the designed opening. Its SECOND beat is the first
  // thing the visitor has to actually read and hold, and motion behind prose that keeps going while
  // you read is precisely what reads as live rather than as an assembly you watched.
  //
  // This reads the real script, so a re-timed pitch moves the fence or reds the branch. That is the
  // whole reason the ceiling is checked here rather than just asserted as a constant.
  const facts = { stories: 35, proven: 12, capabilities: 140 };
  const starts = beatStarts(TELL_SCRIPT, facts as never);
  const argueAt = starts[1];
  assert.ok(argueAt !== undefined, 'could not read when TELL starts arguing');
  assert.ok(
    MS_GROWTH_CEILING > argueAt,
    `the ceiling (${MS_GROWTH_CEILING}ms) is before TELL's second beat (${Math.round(argueAt)}ms) — ` +
      'the forest would be settled before the page has said its own name over it',
  );
  // The first sentence of the first argued beat, at the site's own reading rate plus the fade it
  // has to be acquired through. The arrival must be over before the visitor finishes it.
  const firstArgued = TELL_SCRIPT[1];
  assert.ok(firstArgued !== undefined, 'TELL has no second beat');
  const line = (firstArgued.lines ?? [])[0] ?? '';
  assert.ok(line.length > 0, 'the second beat has no first line to read');
  const readable = argueAt + 360 + (line.length / 13) * 1000;
  assert.ok(
    MS_GROWTH_CEILING <= readable,
    `the ceiling (${MS_GROWTH_CEILING}ms) runs past the first sentence the page argues ` +
      `(readable by ${Math.round(readable)}ms) — the visitor reads it against a forest still moving`,
  );
});

// ── the no-script guarantee ─────────────────────────────────────────────────

test('TEETH: the parked state never escapes the armed class — no-script keeps the whole map', () => {
  // ⚠ THE FAILURE THIS EXISTS FOR IS INVISIBLE IN A BROWSER. `…-arc-arrival` bought the property
  // that a visitor whose script never runs still gets the entire forest as a static, dated picture.
  // Hoisting `opacity: 0` or the growth animation out of `.is-growing` — the obvious "simplify the
  // selector" edit — hides the map from precisely the people who cannot report it, while every
  // scripted browser looks perfect.
  const css = page();
  // Selector lists span lines (several layers share one rule), so the selector half of the match
  // deliberately allows newlines — an earlier line-bound version silently matched nothing and
  // reported a confident pass, which is the same blindness this file is here to prevent.
  const rules = [...styleRules().matchAll(/([^{}]*\.tw-(?:isle|ground|terr|trails|trail-fill|trail-shadow|trail-casing|trail-ghost)\b[^{}]*)\{([^}]*)\}/g)];
  const growthRules = rules.filter(([, , body]) =>
    // A FULL hide (`opacity: 0`), not a dim — TELL's lenses legitimately set 0.62 on the same
    // selectors, and matching those would make this test fail for a reason it is not about. The
    // dash pair is the trail half's equivalent of a full hide.
    /animation:\s*act2-(?:forest|trail)-|opacity:\s*0\s*(?:;|$)|stroke-dasharray:\s*1 1/.test(body ?? ''),
  );
  assert.ok(growthRules.length >= 3, 'the growth rules are not in index.astro at all');
  for (const [, selector, body] of growthRules) {
    assert.ok(
      (selector ?? '').includes(`.${GROWING_CLASS}`),
      `a growth rule is not scoped to .${GROWING_CLASS} — a no-script visitor loses the map:\n  ${selector?.trim()} {${body?.trim()}}`,
    );
  }
});

test('TEETH: a segment the schedule never named keeps painting — the parked state hangs off .is-drawing', () => {
  // ⚠ THE SECOND, SHARPER NO-SCRIPT FAILURE, AND IT SURVIVES SCRIPT RUNNING. If the dash-park were
  // written against `.tw-trail-fill` rather than `.tw-trail-fill.is-drawing`, any segment the walk
  // did not reach — an edge into a story dropped from the snapshot, a router change, a cycle —
  // would be parked at `stroke-dashoffset: 1` and never revealed. The road would simply be gone,
  // and the page would look finished.
  const css = page();
  const parked = [...styleRules().matchAll(/([^{}]*\.tw-trail-(?:fill|shadow|casing|ghost)\b[^{}]*)\{([^}]*)\}/g)].filter(
    ([, , body]) => /stroke-dasharray:\s*1 1|animation:\s*act2-trail-draw/.test(body ?? ''),
  );
  assert.ok(parked.length >= 1, 'the trail draw-on is not in index.astro at all');
  // ⚠ PER SELECTOR IN THE LIST, NOT PER RULE. These rules carry one selector per pass, comma
  // separated. An earlier version of this check asked whether the whole LIST mentioned
  // `.is-drawing` — which stays true when a single pass loses it, so the one fault that matters
  // survived the check. Seeded and confirmed: dropping `.is-drawing` from just `.tw-trail-fill`
  // passed. Split first.
  let checked = 0;
  for (const [, selectorList] of parked) {
    for (const selector of (selectorList ?? '').split(',')) {
      if (!/\.tw-trail-(?:fill|shadow|casing|ghost)\b/.test(selector)) continue;
      checked += 1;
      assert.ok(
        selector.includes(`.${DRAWING_CLASS}`),
        `a trail park rule matches every segment, not only scheduled ones:\n  ${selector.trim()}`,
      );
    }
  }
  assert.ok(checked >= TRAIL_PASSES.length, `only ${checked} trail selectors examined — the extractor has gone blind`);
  assert.ok(
    css.includes(DRAW_REVERSED_CLASS),
    'the stylesheet has no rule for a segment drawn from its far end — half the network draws backwards',
  );
});

test('the stylesheet reads every custom property the module stamps, and its fallbacks match the tuning', () => {
  // The durations live in two places by necessity — the CSS cannot be imported here, and the module
  // cannot read the CSS. This is the same joint act2-tell.test.ts holds for the prose fade, and it
  // fails the same way: silently. The fallbacks are what a segment or island gets if the stamp ever
  // fails to land, so they must be the real numbers rather than a placeholder.
  const css = page();
  for (const prop of ['--grow-delay', '--grow-dur', '--flora-delay', '--draw-delay', '--draw-dur']) {
    assert.ok(css.includes(`var(${prop}`), `the CSS never reads ${prop}, which the module stamps`);
  }
  const growDur = /var\(--grow-dur,\s*(\d+)ms\)/.exec(css);
  assert.ok(growDur !== null, 'the island growth has no duration fallback');
  assert.equal(
    Number(growDur[1]),
    GROWTH_TUNING.islandGrowthMs,
    'the CSS growth fallback and GROWTH_TUNING.islandGrowthMs disagree',
  );
  for (const pass of TRAIL_PASSES) {
    assert.ok(
      new RegExp(`\\.${pass}\\.${DRAWING_CLASS}`).test(css),
      `${pass} is stamped by the module but has no draw rule — a pass un-hidden later would jump`,
    );
  }
});

test('reduced motion turns the arrival off in the stylesheet as well as in the module', () => {
  // `mountForestGrowth` arms nothing under reduced motion, so this is belt and braces — but the
  // stylesheet must not be the ONLY thing between a reduced-motion visitor and an animation, nor
  // the only thing that is not.
  const css = page();
  const block = /@media \(prefers-reduced-motion: reduce\)([\s\S]*?)\n  \}\n/.exec(css);
  assert.ok(block !== null, 'index.astro has no reduced-motion block');
  const body = block[1] ?? '';
  assert.ok(/is-growing[\s\S]*?animation:\s*none/.test(body), 'reduced motion does not disable the forest growth');
  assert.ok(
    /is-drawing[\s\S]*?stroke-dashoffset:\s*0/.test(body),
    'reduced motion leaves the trail segments parked by their dash offset — the roads would be missing',
  );
});
