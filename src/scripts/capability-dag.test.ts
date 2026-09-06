// The layered layout behind the island panel's capability graph (ADR-0453 D6's unbuilt floor,
// ADR-0502's pannable box). Geometry only — every assertion here is about where boxes go, because
// that is all the module decides.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import {
  cardMetricsFor,
  DAG_METRICS,
  idLines,
  LABEL_CHARS,
  LABEL_CHARS_MAX,
  LABEL_FONT,
  LABEL_LINES,
  labelPxAtRest,
  layoutCapabilityDag,
  MIN_RESTING_SPAN,
  restingBox,
} from './capability-dag';
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
  for (const story of roamPayload(snapshotJson as never).stories) {
    if (story.capabilities.length === 0) continue;
    // The metrics the PANEL lays out with — per-island, since ADR-0522 sizes the card from the
    // labels each island actually holds. Asserting against the fallback would prove nothing about
    // what ships.
    const { nodeW, nodeH } = cardMetricsFor(story.capabilities.map((c) => c.id));
    const layout = layoutCapabilityDag(story.capabilities, cardMetricsFor(story.capabilities.map((c) => c.id)));
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
    const layout = layoutCapabilityDag(story.capabilities, cardMetricsFor(story.capabilities.map((c) => c.id)));
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

test('an id wraps to at most three lines and never silently loses its tail', () => {
  assert.deepEqual(idLines('short'), ['short']);
  const wrapped = idLines('prove-it-gate-and-then-some-more-besides');
  assert.equal(wrapped.length, LABEL_LINES);
  for (const line of wrapped) assert.ok(line.length <= LABEL_CHARS_MAX, `"${line}" is wider than the card`);
  assert.match(wrapped[wrapped.length - 1] ?? '', /…$/, 'an over-long tail must be elided visibly');
});

test('the wrap PACKS words instead of cutting at a fixed offset, so a fitting tail is not thrown away', () => {
  // ⚠ THE RED. The version this replaces sliced the first `max` characters and searched BACKWARDS
  // for a hyphen, so a break landing just past a word discarded the rest of the name even when it
  // fitted. `live-author-accounting-override` came out `live-author` / `accounting-o…`: a whole
  // word elided with two lines' worth of room going spare. Packed into three, the same id fits whole.
  assert.deepEqual(idLines('live-author-accounting-override'), ['live-author', 'accounting', 'override']);
  assert.deepEqual(idLines('halt-aware-sequence'), ['halt-aware', 'sequence']);
  // Nothing is elided that fits, and nothing that does not fit is silently dropped.
  for (const id of ['a-b', 'prove-it-gate', 'red-green-phase-machine']) {
    assert.ok(!idLines(id).some((l) => l.endsWith('…')), `${id} fits and must not be elided`);
  }
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

// ── ADR-0522: the labels are rendered to be READ ─────────────────────────────
//
// The owner walked the live capability graph on 2026-09-05 and was told the labels were unreadable
// BY DESIGN. He said: *"looks decent, we don't need to make the labels deliberately unreadable."*
// ADR-0522 settles that ADR-0453 D3's "illegible" means SEMANTICALLY opaque — a stranger learns
// nothing from `prove-it-gate` at any size — and never optically unreadable.
//
// ⚠ WHAT MAKES THESE ASSERTIONS REAL RATHER THAN A RESTATEMENT OF INTENT. Every earlier claim in
// this repo about label size was a claim about PURPOSE ("small on purpose", "illegible by design"),
// which nothing could check. These assert MILLIMETRES: the size a label actually lands at on a
// reader's screen, which is `LABEL_FONT` times the scale the resting fit puts the graph at. It is
// arithmetic over the published corpus, so it needs no browser and it cannot pass vacuously.

/**
 * The graph frame, in CSS pixels, at the width the panel resolves to on a desktop viewport:
 * `min(30rem, 44vw)` less the panel's `1.05rem` of padding on each side, less the scrollbar.
 *
 * ⚠ THE SCROLLBAR IS NOT A ROUNDING ALLOWANCE, IT IS 4% OF THE ANSWER, and it was found by
 * measuring rather than by arithmetic. `.roam-body` is `overflow-y: auto`, so on a platform with
 * classic scrollbars it takes 17px off the frame the graph is fitted into — measured live at 429.4
 * against the 446.4 the padding alone predicts. Every number below is asserted against the NARROWER
 * frame, because a test that assumed the overlay-scrollbar platform would be claiming a legibility
 * this box does not have on the machine the site was walked on.
 */
const FRAME_W = 30 * 16 - 1.05 * 16 * 2 - 17;
/** `max-height: min(30rem, 52vh)`, at the 900px-tall viewport the arrival increment designed to. */
const FRAME_H = Math.min(30 * 16, 900 * 0.52);

const page = (): string => readFileSync(new URL('../pages/index.astro', import.meta.url), 'utf8');

const islands = (): { id: string; n: number; px: number }[] =>
  roamPayload(snapshotJson as never)
    .stories.filter((s) => s.capabilities.length > 0)
    .map((s) => {
      const ids = s.capabilities.map((c) => c.id);
      const layout = layoutCapabilityDag(s.capabilities, cardMetricsFor(ids));
      return { id: s.id, n: ids.length, px: labelPxAtRest(layout, FRAME_W, FRAME_H) };
    });

test('THE INCREMENT: the busiest island the site can draw renders its labels at a readable size', () => {
  // ⚠ THIS IS THE RED. `drive-machinery` — 26 components and 37 dependency lines, the densest
  // picture on the site and the case ADR-0522 names to size against — drew its labels at 3.5px in
  // the shipped 84x30 card inside the flat 13rem frame. Three and a half pixels is not small type,
  // it is a grey smudge.
  //
  // ⚠ VERIFIED RED THREE WAYS, and the third is why the test below it exists. Putting the frame
  // back to the 23rem panel and the flat 13rem box fails this; putting `LABEL_FONT` back to 7.5
  // fails this. Putting the fixed 84x30 card back does NOT — it fails the CARD FIT assertion
  // instead, because this one measures the type against the graph and says nothing about the box
  // it sits in. Read the two as one proof; neither is sufficient alone.
  const dm = islands().find((i) => i.id === 'drive-machinery');
  assert.ok(dm, 'drive-machinery is not in the published snapshot');
  assert.equal(dm.n, 26, 'drive-machinery is no longer the 26-component case this was sized against');
  assert.ok(dm.px >= 8, `drive-machinery labels render at ${dm.px.toFixed(2)}px — ADR-0522 asks for type that reads`);
});

test('and the corpus as a whole reads, not just the one island that was measured', () => {
  // A floor under the WHOLE corpus rather than the named case alone, stated as the two numbers that
  // moved: the shipped worst was `studio` at 1.98px and the shipped median 7.83px, against 3.59 and
  // 15.74 now. Both are held here so a later change cannot buy `drive-machinery` its 8px by taking
  // it off everyone else.
  //
  // ⚠ THE FLOOR IS 3, NOT THE 3.59 WE ACTUALLY HAVE, AND THE SLACK IS DELIBERATE. It exists to
  // catch a RENDERING regression — reverting the type, the card or the frame each drops `studio`
  // back to 1.98 and reds this — not to red an ordinary CORPUS change. `studio` is bounded by how
  // many components sit in its widest rank, so one more capability landing there would trip a
  // tighter floor while nothing about the website had moved, which is a test failing at the wrong
  // author. The set assertion below is what watches the corpus.
  const all = islands();
  for (const island of all) {
    assert.ok(island.px >= 3, `${island.id}: labels render at ${island.px.toFixed(2)}px`);
  }
  const sorted = all.map((i) => i.px).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  assert.ok(median >= 14, `the median island renders at ${median.toFixed(2)}px`);
  const reads = all.filter((i) => i.px >= 7).length;
  assert.ok(reads >= all.length - 3, `only ${reads} of ${all.length} islands render at 7px or better`);
});

test('THE RESIDUAL IS FENCED, NOT TOLERATED: only the known wide-and-shallow islands fall short', () => {
  // ⚠ ADR-0522 D3 SAYS THE CEILING IS REAL, AND THIS IS IT, MEASURED. A label's size at rest is
  // `frameWidth x fontPerCard / cardsAcross`, so an island whose widest RANK is broad is bounded by
  // arithmetic no rendering choice can beat: `studio` puts 12 components in one rank, which leaves
  // 33px of frame per card. The remedies left are ones this increment is fenced out of — wrapping a
  // rank across sub-rows is a LAYOUT change, and a panel wide enough for twelve readable cards would
  // be most of the screen.
  //
  // So it is named rather than hidden. The point of the assertion is the SET: an export that widened
  // another island until its labels stopped reading fails here instead of shipping quietly.
  const short = islands()
    .filter((i) => i.px < 7)
    .map((i) => i.id)
    .sort();
  assert.deepEqual(
    short,
    ['cli', 'library-tech-tree-overlay', 'studio'],
    `the set of islands whose labels do not read has moved: ${short.join(', ')}`,
  );
});

test('a small island is drawn at a sane size rather than blown up to fill the frame', () => {
  // The floor's other side. `forest-world` holds ONE component; fitted to the frame it would draw
  // that card the full width of the panel with its label at heading size, which reads as a
  // different surface rather than as the same graph with less in it.
  const biggest = Math.max(...islands().map((i) => i.px));
  assert.ok(biggest <= 20, `the largest label renders at ${biggest.toFixed(2)}px — the small-island floor is not holding`);
  const tiny = layoutCapabilityDag([cap('a')], cardMetricsFor(['a']));
  assert.equal(restingBox(tiny).w, MIN_RESTING_SPAN, 'a one-card graph must be padded, not magnified');
  assert.ok(restingBox(tiny).x < 0, 'the padding must be centred on the graph');
});

test('the resting view still contains the WHOLE graph — the fit that must not regress', () => {
  // ADR-0522 leaves this untouched and the increment names it explicitly: at rest the reader sees
  // the entire island, so nothing is off-frame and no "fit" control is owed until they move away.
  for (const story of roamPayload(snapshotJson as never).stories) {
    if (story.capabilities.length === 0) continue;
    const layout = layoutCapabilityDag(story.capabilities, cardMetricsFor(story.capabilities.map((c) => c.id)));
    const box = restingBox(layout);
    assert.ok(box.x <= 0 && box.y <= 0, `${story.id}: the resting view starts inside the graph`);
    assert.ok(box.x + box.w >= layout.width, `${story.id}: the resting view cuts the graph off on the right`);
    assert.ok(box.y + box.h >= layout.height, `${story.id}: the resting view cuts the graph off at the bottom`);
  }
});

test('the stylesheet and the layout agree about the type size and the frame', () => {
  // ⚠ THE DRIFT THIS CLOSES. The font is declared in CSS and the CARD IS SIZED AROUND IT here; if
  // the two ever disagree the labels either spill over their cards or sit in a box of white space,
  // and every number the tests above assert becomes fiction. Nothing else can catch it — the font
  // is applied by a stylesheet this module cannot import.
  const css = page();
  const font = /\.roam-dag-label\s*\{[^}]*font-size:\s*([\d.]+)px/.exec(css);
  assert.ok(font, 'no .roam-dag-label font-size in index.astro');
  assert.equal(Number(font[1]), LABEL_FONT, 'the stylesheet draws the label at a different size than the card is built for');

  const width = /\.roam-panel\s*\{(?:[^}]|\n)*?width:\s*min\((\d+(?:\.\d+)?)rem/.exec(css);
  assert.ok(width, 'no .roam-panel width in index.astro');
  assert.equal(
    Number(width[1]) * 16 - 1.05 * 16 * 2 - 17,
    FRAME_W,
    'the panel is not the width these assertions measure against',
  );

  const maxH = /\.roam-dag\s*\{(?:[^}]|\n)*?max-height:\s*min\((\d+(?:\.\d+)?)rem/.exec(css);
  assert.ok(maxH, 'no .roam-dag max-height in index.astro');
  assert.ok(Number(maxH[1]) * 16 >= FRAME_H, 'the frame cannot reach the height these assertions measure against');

  // The frame height is the graph's own aspect, set inline — the letterbox this increment removed
  // comes straight back the moment anyone puts a flat `height` on this box again.
  const frame = /\.roam-dag\s*\{(?:[^}]|\n)*?\}/.exec(css);
  assert.ok(frame, 'no .roam-dag rule in index.astro');
  assert.ok(
    !/[^-]height:\s*\d/.test(frame[0]),
    'a flat height on .roam-dag re-letterboxes every graph whose shape is not the frame',
  );
});

test('the label wrap is sizing, never naming — ADR-0522 D4 restates ADR-0453 D3 verbatim', () => {
  // The fence, asserted on the CARD path rather than only on `idLines`. Whatever the card is sized
  // to, what it holds is the corpus id: every line, joined back up, is a prefix of the real name.
  for (const story of roamPayload(snapshotJson as never).stories) {
    for (const capability of story.capabilities) {
      const joined = idLines(capability.id).join('-').replace(/…/g, '');
      assert.ok(
        capability.id.startsWith(joined),
        `${capability.id} is rendered as "${joined}" — a label may be wrapped or elided, never rewritten`,
      );
    }
  }
});

test('THE OTHER HALF OF THE RED: the type fits inside the card it is drawn in', () => {
  // ⚠ WITHOUT THIS ASSERTION THE ONE ABOVE IS BUYABLE BY CHEATING, and that is not hypothetical —
  // it was caught by trying. Reverting `cardMetricsFor` to the shipped fixed 84x30 card left every
  // legibility assertion GREEN, because `labelPxAtRest` measures the type against the GRAPH and
  // says nothing about the CARD: three lines of 11px type need 41 layout units of height and the
  // old card gave them 30, so the labels would have spilled over their own boxes and out the other
  // side while the tests reported the graph as legible.
  //
  // So the pair is the proof. One says the type is big enough to read; this one says the card is
  // big enough to hold it. Raising the font without growing the card now fails here, which is the
  // only remaining way to satisfy ADR-0522 dishonestly.
  const leading = LABEL_FONT * 1.25;
  for (const story of roamPayload(snapshotJson as never).stories) {
    if (story.capabilities.length === 0) continue;
    const ids = story.capabilities.map((c) => c.id);
    const { nodeW, nodeH } = cardMetricsFor(ids);
    for (const id of ids) {
      const lines = idLines(id);
      const widest = Math.max(...lines.map((l) => l.length));
      // 0.6em is the advance of every monospace face in the stack; the card carries its padding on
      // top of that, so a slightly wider face still sits inside its box.
      assert.ok(
        widest * 0.6 * LABEL_FONT <= nodeW,
        `${story.id}/${id}: "${lines.join('|')}" is ${(widest * 0.6 * LABEL_FONT).toFixed(1)} units wide in a ${nodeW}-unit card`,
      );
      assert.ok(
        lines.length * leading <= nodeH,
        `${story.id}/${id}: ${lines.length} lines need ${(lines.length * leading).toFixed(1)} units in a ${nodeH}-unit card`,
      );
    }
  }
});

test('and the renderer draws the label at the size the card was built for', () => {
  // The third way to break the pair: leave the module's constants alone and hardcode a different
  // number in the SVG. `act2-roam.ts` owns the emit, so the leading it writes has to come from
  // `LABEL_FONT` rather than from a literal — the shipped version spaced its lines by a bare `9`,
  // which is why the font could not be raised without the lines colliding.
  const roam = readFileSync(new URL('./act2-roam.ts', import.meta.url), 'utf8');
  assert.match(roam, /const leading = LABEL_FONT \* 1\.25;/, 'the label leading must follow LABEL_FONT, not a literal');
  assert.match(roam, /cardMetricsFor\(story\.capabilities\.map\(\(c\) => c\.id\)\)/, 'the panel must lay out with the per-island card');
  assert.ok(!/DAG_METRICS/.test(roam), 'the panel must not fall back to the fixed card the corpus outgrew');
});
