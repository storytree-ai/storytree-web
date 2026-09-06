// ---------------------------------------------------------------------------
// CAPABILITY-DAG — the pure layered layout behind the island panel's shape.
//
// ROAM's "inside this island" section used to be a COUNT that expanded to a text LIST. The owner,
// 2026-09-01, supplying a screenshot of the studio's own capability graph: *"i'm not seeing this
// pretty dag graph on the website - this is what i meant by the capability tree."* ADR-0453 D6 had
// named the public depth floor as "Forest → island → capability tree" long before that, so this is
// an UNBUILT COMMITMENT rather than new scope — the same class as ADR-0299's legend.
//
// ── WHAT THIS MODULE IS, AND WHAT IT DELIBERATELY IS NOT ────────────────────────────────────────
//
// It is GEOMETRY AND NOTHING ELSE: ids and edges in, coordinates and paths out. It never touches
// `document`, never reads a status, and never renders. That is what lets the whole layout run under
// `bun test` with no DOM, the same discipline `act2-roam.ts` keeps by staying pure until `mountRoam`.
// The caller owns colour, labels and the panel — this file owns where the boxes go.
//
// ── WHY NOT `@dagrejs/dagre`, WHICH THE STUDIO USES ─────────────────────────────────────────────
//
// The studio's `layoutSubdag` (`apps/studio/src/components/TreeView.tsx`) lays the same relation out
// with dagre. Reusing it was considered and rejected on evidence, recorded here because a later
// reader will ask:
//
//   1. The studio's layout is welded to React — it returns nodes its own JSX renders, over
//      `TreeStory`/`TreeCapability` types. This surface builds vanilla DOM. Only the pure geometry
//      was ever shareable, never the rendering, so "one implementation" was not on the table.
//   2. The shared engine (`packages/forest-world` → `web/src/lib/forest-world*`, ADR-0093) mirrors
//      MAP geometry — islands, coasts, hexes, camera — which both surfaces draw as the same
//      picture. A side-panel widget is not map geometry, and promoting one would drag dagre into
//      the render core and therefore into the desktop app, which does not draw this.
//   3. The two pictures are decided to be different: this one's box PANS rather than scrolls
//      (ADR-0502), and it draws a whole island at rest where the studio's is a working tool the
//      reader drives. ⚠ THE THIRD DIFFERENCE THIS LIST USED TO CLAIM IS GONE: it said this one's
//      labels were "illegible BY DESIGN (ADR-0453 D3)". ADR-0522 (accepted 2026-09-05) settles
//      that D3's "illegible" means SEMANTICALLY opaque, never optically unreadable — the names
//      stay our real corpus ids, and they are RENDERED to be read.
//
// So the drift the fork warns about is bounded to ~90 lines of layering that this file's own tests
// pin. That was judged the cheaper side. The studio's scrollbars are fixed in the same increment
// regardless — that fix was never conditional on this choice.
//
// ── THE ALGORITHM, AND WHY IT IS DETERMINISTIC ──────────────────────────────────────────────────
//
// Sugiyama-lite in three passes: longest-path ranking, barycentre ordering, then coordinates.
// Every tie breaks on the id, and the sweep count is fixed rather than convergence-tested, so the
// same input always produces byte-identical output. That matters more here than layout quality: the
// picture is built at click time on the visitor's machine, and a layout that shuffled between two
// renders of the same island would read as the map changing under them.
// ---------------------------------------------------------------------------

/** The only thing the layout needs to know about a capability: who it is, and what it rests on. */
export interface DagInput {
  readonly id: string;
  /** Ids this one depends on. Pointers out of the story, and self-edges, are dropped by the walk. */
  readonly dependsOn: readonly string[];
}

/** One laid-out box. `x`/`y` are its TOP-LEFT corner in layout space. */
export interface DagNode {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Rank 0 is the foundation — a capability that rests on nothing else in this story. */
  readonly rank: number;
}

/** One laid-out edge, as an SVG path from the dependency up to its dependent. */
export interface DagEdge {
  readonly from: string;
  readonly to: string;
  readonly d: string;
}

export interface DagLayout {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly DagNode[];
  readonly edges: readonly DagEdge[];
}

export interface DagMetrics {
  readonly nodeW: number;
  readonly nodeH: number;
  readonly gapX: number;
  readonly gapY: number;
  readonly pad: number;
}

// ── how big the type is, and why the card is sized from it rather than the other way round ──────
//
// ⚠ THE ARITHMETIC THAT GOVERNS THIS WHOLE SECTION, because it is counter-intuitive and it is what
// an earlier version got wrong. The label lands on screen at
//
//     px = LABEL_FONT x min(frameW / boxW, frameH / boxH)
//
// and the box is the CARDS, so `boxW` grows with the card, which grows with the font. **Raising the
// font alone changes NOTHING** — measured: font 14 and font 22 both land within 4% of each other.
// The only two levers that move the number are the RATIO of type to card (fewer characters per
// line, so the card can be narrow for the same type) and the FRAME. Everything below is one or the
// other, and neither is a licence to re-shrink the type (ADR-0522 D3).

/** The label's type size, in LAYOUT UNITS — the SVG's own coordinate system, not CSS pixels. What a
 *  reader sees is this multiplied by the resting scale; `labelPxAtRest` is the number that matters. */
export const LABEL_FONT = 11;

/**
 * How many characters a wrapped line AIMS to hold, the width it may not exceed, and how many lines
 * a card gives them.
 *
 * ⚠ 11 IS A TARGET AND 13 IS A CEILING, AND THE GAP IS THE WHOLE POINT. A word wider than the
 * target takes its own line rather than being cut in half; the ceiling is what stops a future
 * forty-character word from widening every card on its island. Measured over the 203 published
 * capability ids, the two together elide 15 labels (7%) and cut NONE of them mid-word — against 98
 * (48%) under the two-line 13 this replaces. The tighter targets read very slightly larger and cost
 * three times the elisions: 10/10 lands `drive-machinery` at 8.4px against 8.5px here while eliding
 * 47 labels, which is a worse picture, not a better one.
 */
export const LABEL_CHARS = 11;
export const LABEL_CHARS_MAX = 13;
export const LABEL_LINES = 3;

/** Advance width of one monospace character, in ems. `ui-monospace`/Menlo/SFMono all sit at 0.6;
 *  the card carries `CARD_PAD_X` of slack on top, so a font whose advance is slightly wider still
 *  fits rather than spilling over the card's edge. */
const ADVANCE = 0.6;
const LINE_HEIGHT = 1.25;
const CARD_PAD_X = 10;
const CARD_PAD_Y = 10;

/**
 * The card size a PARTICULAR island needs — derived from the labels it actually holds, not fixed.
 *
 * ⚠ THIS IS THE CHANGE ADR-0522 ASKED FOR, and the reason it is per-graph. A uniform card has to be
 * wide enough for the longest id anywhere in the corpus (35 characters), which every island then
 * pays for whether or not it holds one — and since the type lands on screen at `font x frameW/boxW`,
 * every unused character of card width is type size thrown away. `forest-world`'s single component
 * needs a 6-character card; sizing it for `transcript-decision-read-extraction` would draw its label
 * at half the size for nothing.
 *
 * It is sizing, not naming: the ids that come in are the ids that go out (ADR-0453 D3, restated by
 * ADR-0522 D4 — no renames, no public-facing labels, no glossary).
 */
export function cardMetricsFor(ids: readonly string[]): DagMetrics {
  let chars = 1;
  let lines = 1;
  for (const id of ids) {
    const wrapped = idLines(id);
    lines = Math.max(lines, wrapped.length);
    for (const line of wrapped) chars = Math.max(chars, line.length);
  }
  return {
    nodeW: Math.round(chars * ADVANCE * LABEL_FONT) + CARD_PAD_X,
    nodeH: Math.round(lines * LINE_HEIGHT * LABEL_FONT) + CARD_PAD_Y,
    gapX: 13,
    gapY: 24,
    pad: 10,
  };
}

/**
 * The fallback card size, for a caller that has no ids to measure. `cardMetricsFor` is what the
 * panel uses; this is what the shape looks like for the widest label the corpus can hold, so a
 * graph laid out with it is never too SMALL for its own text.
 */
export const DAG_METRICS: DagMetrics = cardMetricsFor(['x'.repeat(LABEL_CHARS)]);

/** A rectangle in layout space — the SVG `viewBox`, in the order it is written. */
export interface DagBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * The floor on the resting view's WIDTH, in layout units.
 *
 * ⚠ WITHOUT IT THE SMALLEST ISLANDS BREAK THE OTHER WAY. A two-component island is one card across;
 * fitted to the frame it draws that card the width of the panel and its label at heading size, which
 * reads as a different surface rather than as the same graph with less in it. The floor pads the
 * viewBox instead, so a small graph is drawn at a sane size and CENTRED, with the slack as margin.
 * Only the width needs it: the frame takes the graph's own aspect, so nothing balloons vertically.
 */
export const MIN_RESTING_SPAN = 300;

/**
 * The resting view — the whole graph, centred, with the small-island floor applied.
 *
 * This is the at-rest camera the panel opens on, and the property it holds is the one that must not
 * regress: the ENTIRE graph is inside it, so nothing is off-frame and no "fit" control is owed until
 * the reader moves away from it.
 */
export function restingBox(layout: DagLayout): DagBox {
  const w = Math.max(layout.width, MIN_RESTING_SPAN);
  return { x: (layout.width - w) / 2, y: 0, w, h: layout.height };
}

/**
 * What a label MEASURES on screen, in CSS pixels, once this graph is at rest in a frame this size.
 *
 * ⚠ THIS FUNCTION IS THE INCREMENT. ADR-0522 is about a number a reader can or cannot read, and
 * every earlier statement about label size in this file was a claim about intent rather than about
 * millimetres. Making it a function makes it assertable: `capability-dag.test.ts` holds the
 * published corpus to a floor, so an export that widened an island until its type stopped reading
 * fails a test instead of shipping.
 */
export function labelPxAtRest(layout: DagLayout, frameW: number, frameH: number): number {
  const box = restingBox(layout);
  return LABEL_FONT * Math.min(frameW / box.w, frameH / box.h);
}

/** How many barycentre sweeps to run. Fixed rather than convergence-tested, so the result is a
 *  pure function of the input — see the determinism note in the header. Four is where the measured
 *  crossing count stopped improving on this corpus's widest island (`studio`, 12 across). */
const SWEEPS = 4;

/**
 * Rank every node by LONGEST PATH from the foundation: rank 0 rests on nothing in this story, and
 * every other node sits one rank above its deepest dependency.
 *
 * ⚠ CYCLE-DEFENSIVE EVEN THOUGH THE CORPUS IS ACYCLIC. `check:library-dag-acyclic` holds the
 * authored graph acyclic upstream, but this runs in a visitor's browser against a published
 * snapshot, and a cycle reaching it would hang a naive recursion rather than degrade. A node caught
 * on the current path contributes nothing to its own depth, which drops the back-edge from the
 * ranking and leaves the rest of the picture honest.
 */
function rankNodes(ids: readonly string[], deps: ReadonlyMap<string, readonly string[]>): Map<string, number> {
  const rank = new Map<string, number>();
  const onPath = new Set<string>();
  const depth = (id: string): number => {
    const done = rank.get(id);
    if (done !== undefined) return done;
    if (onPath.has(id)) return 0;
    onPath.add(id);
    let best = 0;
    for (const dep of deps.get(id) ?? []) best = Math.max(best, depth(dep) + 1);
    onPath.delete(id);
    rank.set(id, best);
    return best;
  };
  for (const id of ids) depth(id);
  return rank;
}

/** The mean position of a node's neighbours in the rank below, or `null` when it has none — a node
 *  with no anchor keeps its current slot rather than being swept to one end. */
function barycentre(id: string, neighbours: readonly string[], order: ReadonlyMap<string, number>): number | null {
  let sum = 0;
  let n = 0;
  for (const nb of neighbours) {
    const at = order.get(nb);
    if (at !== undefined) {
      sum += at;
      n += 1;
    }
  }
  return n === 0 ? null : sum / n;
}

/**
 * Lay a story's capabilities out as a layered DAG, dependencies at the BOTTOM.
 *
 * The direction is deliberate and matches the studio's `rankdir: 'BT'`: what a thing rests on sits
 * under it, so the picture reads as a foundation with things built on top. It is also the reading
 * the corpus's own "stands on" language already carries.
 *
 * An empty input lays out to a zero box — the caller decides what to show instead, because "this
 * island records no components" is a sentence, not a picture.
 */
export function layoutCapabilityDag(
  caps: readonly DagInput[],
  metrics: DagMetrics = DAG_METRICS,
): DagLayout {
  const ids = caps.map((c) => c.id);
  if (ids.length === 0) return { width: 0, height: 0, nodes: [], edges: [] };

  // Only edges BOTH of whose ends are in this story are drawable. A capability may legitimately
  // depend on one in another story (the export carries cross-story edges); drawing a stub to
  // nowhere would assert a node this picture does not contain.
  const present = new Set(ids);
  const deps = new Map<string, readonly string[]>();
  for (const cap of caps) {
    deps.set(
      cap.id,
      cap.dependsOn.filter((d) => d !== cap.id && present.has(d)),
    );
  }

  const rank = rankNodes(ids, deps);
  const maxRank = Math.max(...ids.map((id) => rank.get(id) ?? 0));

  // ── rows, in a stable starting order ──────────────────────────────────────
  // Seeded by id rather than by input order so two exports that list the same capabilities in a
  // different order still draw the same picture.
  const rows: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const id of [...ids].sort()) rows[rank.get(id) ?? 0]?.push(id);

  // The reverse index, built once — the upward sweep needs "who rests on me".
  const dependents = new Map<string, string[]>();
  for (const id of ids) {
    for (const dep of deps.get(id) ?? []) {
      const list = dependents.get(dep);
      if (list) list.push(id);
      else dependents.set(dep, [id]);
    }
  }

  // ── barycentre sweeps, alternating up and down ────────────────────────────
  const order = new Map<string, number>();
  const reindex = (): void => {
    for (const row of rows) row.forEach((id, i) => order.set(id, i));
  };
  reindex();
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    const upward = sweep % 2 === 0;
    // Upward passes anchor each row on the row BELOW (its dependencies); downward passes anchor on
    // the row above (its dependents). Running both is what keeps a node between its two fans
    // instead of only above one of them.
    const ranks = upward
      ? Array.from({ length: rows.length }, (_, i) => i)
      : Array.from({ length: rows.length }, (_, i) => rows.length - 1 - i);
    for (const r of ranks) {
      const row = rows[r];
      if (!row || row.length < 2) continue;
      const keyed = row.map((id, i) => {
        const anchors = upward ? (deps.get(id) ?? []) : (dependents.get(id) ?? []);
        const bc = barycentre(id, anchors, order);
        return { id, key: bc === null ? i : bc, at: i };
      });
      // Ties break on the CURRENT slot, then on the id — never on iteration order, which is what
      // would make the layout depend on how the payload happened to be serialised.
      keyed.sort((a, b) => a.key - b.key || a.at - b.at || (a.id < b.id ? -1 : 1));
      rows[r] = keyed.map((k) => k.id);
      reindex();
    }
  }

  // ── coordinates ───────────────────────────────────────────────────────────
  const { nodeW, nodeH, gapX, gapY, pad } = metrics;
  const widest = Math.max(...rows.map((row) => row.length));
  const spanX = widest * nodeW + (widest - 1) * gapX;
  const width = spanX + pad * 2;
  const height = (maxRank + 1) * nodeH + maxRank * gapY + pad * 2;

  const nodes: DagNode[] = [];
  const centreOf = new Map<string, { cx: number; top: number; bottom: number }>();
  rows.forEach((row, r) => {
    const rowSpan = row.length * nodeW + (row.length - 1) * gapX;
    const startX = pad + (spanX - rowSpan) / 2;
    // Rank 0 at the BOTTOM — the foundation the rest is built on.
    const y = pad + (maxRank - r) * (nodeH + gapY);
    row.forEach((id, i) => {
      const x = startX + i * (nodeW + gapX);
      nodes.push({ id, x, y, rank: r });
      centreOf.set(id, { cx: x + nodeW / 2, top: y, bottom: y + nodeH });
    });
  });

  // ── edges ─────────────────────────────────────────────────────────────────
  // A cubic whose control points sit on the vertical, so an edge leaves the top of its dependency
  // and enters the bottom of its dependent head-on. Straight lines were tried and read as a mesh
  // once a rank fanned out; the curve keeps parallel edges visually separable.
  const edges: DagEdge[] = [];
  for (const cap of caps) {
    for (const dep of deps.get(cap.id) ?? []) {
      const from = centreOf.get(dep);
      const to = centreOf.get(cap.id);
      if (!from || !to) continue;
      const lift = Math.max(12, (from.top - to.bottom) / 2);
      edges.push({
        from: dep,
        to: cap.id,
        d:
          `M ${from.cx.toFixed(1)} ${from.top.toFixed(1)} ` +
          `C ${from.cx.toFixed(1)} ${(from.top - lift).toFixed(1)} ` +
          `${to.cx.toFixed(1)} ${(to.bottom + lift).toFixed(1)} ` +
          `${to.cx.toFixed(1)} ${to.bottom.toFixed(1)}`,
      });
    }
  }

  return { width, height, nodes, edges };
}

/**
 * Wrap a kebab-case id across up to `lines` lines, packing whole hyphen-separated words onto each.
 *
 * ⚠ THIS IS NOT A TRANSLATION, AND MUST NEVER BECOME ONE. ADR-0453 D3 decided the map's own labels
 * stay our real corpus names, and ADR-0522 D4 restates it word for word while widening the type:
 * no renames, no public-facing labels, no glossary. This only decides where the string breaks.
 *
 * ⚠ IT PACKS, IT DOES NOT CUT AT A FIXED OFFSET. The version this replaces sliced the first `max`
 * characters and looked BACKWARDS for a hyphen, which threw away a whole word whenever the break
 * landed just past one — `live-author-accounting-override` came out as `live-author` +
 * `accounting-o…`, eliding a tail that fits comfortably on a third line. Filling greedily instead
 * costs nothing and is why the shorter 10-character line still shows more of the name.
 *
 * ⚠ `max` IS THE WRAP TARGET, NOT THE CEILING, AND A WORD IS NOT CUT IN HALF TO MEET IT. An earlier version
 * of this change did cut, and its own fence caught what that costs: `verification-decay-instruments`
 * came out `verificat…` / `decay` / `instrumen…` — three elisions in a name that fits in three lines,
 * and a first line that is no longer any word we published. A word wider than the target simply takes
 * its own over-long line; `cardMetricsFor` measures what this returns, so the card grows to hold it
 * and only the island containing the long word pays for it. `ceiling` is where that generosity
 * stops — a word past it IS cut, so a future runaway id cannot widen every card on its island. The
 * longest single word in the corpus today is 13 characters, which is the ceiling exactly, so no
 * published label is cut mid-word at all.
 *
 * A tail that will not fit in the lines available is elided with a `…`, so a truncated label always
 * SAYS it is truncated — the authored title is on the card's hover `<title>` either way.
 */
export function idLines(
  id: string,
  max = LABEL_CHARS,
  lines = LABEL_LINES,
  ceiling = Math.max(max, LABEL_CHARS_MAX),
): readonly string[] {
  if (id.length <= max) return [id];
  const words = id.split('-');
  const out: string[] = [];
  let line = '';
  let taken = 0;
  for (const word of words) {
    const merged = line === '' ? word : `${line}-${word}`;
    if (merged.length <= max || line === '') {
      line = merged;
      taken += 1;
      continue;
    }
    if (out.length === lines - 1) break; // the last line is full; whatever is left gets elided
    out.push(line);
    line = word;
    taken += 1;
  }
  out.push(line);
  // A word past the CEILING is cut — the only place a name is ever broken mid-word, and it exists so
  // one runaway id cannot widen every card on its island. Nothing in today's corpus reaches it: the
  // longest single word published is 13 characters.
  const drawn = out.map((text) => (text.length > ceiling ? `${text.slice(0, ceiling - 1)}…` : text));
  if (taken === words.length) return drawn;
  // Something did not fit at all. Elide the LAST line so the label says so — the card is sized from
  // the longest line this returns, so the extra character costs nothing but honesty.
  const i = drawn.length - 1;
  const tail = drawn[i] ?? '';
  if (!tail.endsWith('…')) drawn[i] = tail.length >= ceiling ? `${tail.slice(0, ceiling - 1)}…` : `${tail}…`;
  return drawn;
}
