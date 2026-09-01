// ---------------------------------------------------------------------------
// forest-growth — the forest ARRIVES by growing along the dependency EDGE.
//
// Chapter 2's first movement is named GROW (`storytree library artifact grow-tell-roam-ask`), and
// its objective reads "the real forest grows and settles at the designed frame".
//
// ── WHAT THE OWNER REPORTED, AND WHY IT WAS A MECHANISM AND NOT A CONSTANT ──────────────────────
//
// The first version of this module revealed the forest in seven WAVES: a rank of islands appeared
// every 190 ms, and when the last one had landed the whole trail network faded in behind them.
// The owner walked the live site on 2026-08-29 and reported three things at once:
//
//   *"the growth doesnt work the same as the desktop app then, all the islands are just poping up
//     and then the pathways are connecting them and the speed is really fast"*
//
// Only the third of those is a number. The first two are the schedule itself:
//
//   1. A wave is a BARRIER, and a barrier makes causality invisible. Islands arrived in groups
//      with nothing connecting one group to the next, so the forest read as a picture being
//      uncovered in strips rather than as something growing out of anything.
//   2. Trails after islands is TWO animations. The old rule — "an edge cannot honestly precede
//      both its ends" — is true, and the wave schedule satisfied it in the most expensive possible
//      way, by waiting for the LAST island before drawing ANY edge. Under edge scheduling the same
//      rule is satisfied per-edge and for free.
//
// The desktop app had already been through exactly this. `act2-intro-forest-regrow-arc` shipped a
// rank-barrier regrow, the owner said *"it looks like lots of things are growing out of nothing"*,
// and ADR-0283 / ADR-0285 (one repo up) replaced it with the schedule this module now uses. The
// gap was never the timing constants; it was that the website had a stagger and the app had a
// causal order.
//
// ── THE SCHEDULE. THREE RULES, AND EVERYTHING ELSE FALLS OUT OF THEM ────────────────────────────
//
//   1. The BASE ISLANDS — the stories nothing depends on reaching, i.e. no incoming edge — form
//      from nothing at the start, spread across one window however many of them there are. They
//      are the only islands that ever appear unreached.
//   2. When an island has SETTLED, each pathway leaving it begins to draw, segment by segment,
//      along the real routed geometry, in the direction of the story that depends on it.
//   3. A downstream island forms THE MOMENT a pathway arrives at it — the first incoming edge to
//      finish drawing, with nothing else gating it.
//
// There is no rank barrier anywhere in that, and no global phase. An island's start time is a pure
// function of its incoming edges' arrival times, so islands and pathways interleave by
// construction: measured on the real 35-island snapshot, 32 of the 35 islands arrive AFTER the
// first pathway has begun drawing. That is complaint 2 answered by the mechanism rather than by a
// constant, which is why this module no longer has a `trailsDelayMs` at all.
//
// Rule 3 keeps the honesty the wave schedule was protecting: a pathway leaves only a SETTLED
// island, so an island never appears before the island that reached it, and never appears
// unreached. The invariant is now causal instead of positional.
//
// ⚠ THE TUNING IS THE DESKTOP'S, TRANSCRIBED — not numbers picked to feel right here. Every value
// in `GROWTH_TUNING` below is `FOREST_REGROW_TUNING` from `@storytree/app-surface` one repo up,
// which is the run the owner has already watched and accepted in the app. The one addition is
// `floraOffsetMs`, which the app does not need because it grows flora per-object; see below.
//
// ── ⚠ THE HONESTY FENCE, WHICH IS THE WHOLE DESIGN CONSTRAINT (ADR-0491) ────────────────────────
//
// The map is a SNAPSHOT, stamped with the date it was taken, and the page's entire pitch is that
// its signals are real. An animation implying the forest is growing NOW — islands arriving over
// time as though stories were being created while you watch — would break precisely the claim the
// page makes about itself. It is the same reason wisps were deliberately excluded from the
// snapshot (`forest-snapshot-map.ts`'s header).
//
// So: growth as a REVEAL of a stated-moment picture is honest. Growth as a LIVE FEED is not. Three
// properties keep this on the honest side, and `forest-growth.test.ts` holds all three:
//
//   1. **IT IS BOUNDED AND IT IS OVER.** The whole arrival finishes inside `MS_GROWTH_CEILING`,
//      and nothing arrives afterwards. A visitor who looks away and back sees a settled map.
//   2. **IT RUNS ONCE.** No loop, no repeat, no idle re-trigger.
//   3. **IT ADDS AND REMOVES NOTHING.** Every island and every trail segment is already in the DOM,
//      serialised at build time. This module only changes how already-present elements are
//      DISPLAYED — the same fence TELL's lenses keep.
//
// ⚠ EDGE SCHEDULING PUSHES ON THE FIRST OF THOSE IN A WAY WAVES DID NOT, AND THAT IS WHY THERE IS
// A CEILING RATHER THAN A CONSTANT. A wave schedule's duration is fixed by construction: seven
// waves is seven waves whether the corpus holds three stories or two thousand. An edge-following
// schedule's duration is a property of the GRAPH — it grows with the longest chain of arrivals —
// so left alone it would lengthen quietly every time the corpus deepened, one honest step at a
// time, until the reveal was long enough to read as a feed and no single commit had done it.
//
// `MS_GROWTH_CEILING` is the answer, and `deriveGrowthPlan` COMPRESSES the natural schedule to fit
// it. Compression scales every time in the plan by one factor, so the ORDER and the relative pacing
// — which is what carries the causality — survive intact; only the clock gets shorter. Today's
// corpus does not reach the ceiling (it needs about 6.6 s of the 7.2 s available), so the site runs
// at the desktop's own pace and the ceiling is a fence rather than a target.
//
// ── ⚠ WHY 7.2 SECONDS, AND WHY IT IS NOT AN INVENTED NUMBER (ADR-0491) ──────────────────────────
//
// The ceiling is anchored to what this page DOES, not to a feeling about animation length. TELL —
// the pitch that phases in over this map — starts speaking at `MS_LEAD_IN` (2.6 s) and its first
// beat is nothing but the product's name held over a picture. It starts ARGUING at its second beat
// (4.76 s on today's script), and the first sentence of that argument is finished being read about
// 7.3 s after mount.
//
// So the fence is: **the arrival is over before the visitor has finished reading the first sentence
// the page argues.** The name over a forest still assembling is the designed opening — TELL's own
// header says so. From the argument onward the visitor is reading, and motion behind prose that
// continues while you read is exactly what reads as live rather than as an assembly you watched.
//
// That anchor is mechanical, not decorative: `forest-growth.test.ts` reads `act2-tell.ts`'s real
// script and reds if the ceiling ever drifts past it. If the pitch is re-timed, the fence moves with
// it or the gate stops the branch.
//
// ── ⚠ THE NO-SCRIPT GUARANTEE, AND WHY THE PARKED STATE IS APPLIED FROM HERE ────────────────────
//
// `website-refresh-arc-arrival` bought a property worth keeping: the served markup carries the
// WHOLE forest, so *a visitor whose script never runs still gets the entire map as a static, dated
// picture — the crop is an enhancement, never a prerequisite*. Growth must not quietly spend that.
//
// So the hidden state is NEVER in the base stylesheet. This module adds `is-growing` to the svg,
// and every growth rule in index.astro is scoped under it. Script did not run → no class → the
// full forest, exactly as before. `forest-growth.test.ts` reads the stylesheet and reds if a
// growth rule ever escapes that scope, because the failure is invisible: the page would look
// perfect in every browser that runs JavaScript.
//
// ⚠ THE TRAIL HALF ADDS A SECOND, SHARPER VERSION OF THAT TRAP. A segment is parked by
// `stroke-dashoffset`, and a segment the schedule never reached would be parked FOREVER — a road
// missing from a map whose pitch is that the map is complete. So the parked state is applied by a
// class this module stamps per segment (`DRAWING_CLASS`), never by a rule that matches every
// segment: a segment the plan does not name simply keeps painting. The failure direction is a road
// that appears too early, never a road that never appears.
//
// ── THE GRAPH IS ALREADY IN THE SERVED MARKUP. NOTHING IS FETCHED ──────────────────────────────
//
// The engine emits, alongside the drawn trail passes, a layer of pure METADATA: one
// `<g class="tw-trail-edge" data-from data-to data-segments>` per dependency edge, where
// `data-segments` is the edge's ordered segment chain as `id:F,id:R,…` (`F`/`R` is whether the
// chain walks that segment along or against its drawn direction). That is the whole dependency
// graph AND the routing, already on the page for a surface that wants to reveal by selection.
//
// So the schedule reads the DOM and ships no extra payload — no graph in a script tag, no second
// copy of the corpus, nothing that could disagree with the picture it is animating. `data-from` is
// the PREREQUISITE and `data-to` is the dependent (`storyEdges` emits `{from: dep, to: story}`),
// so an island with no `data-to` naming it is a base island.
//
// Segment LENGTHS come from `getTotalLength()` on the real paths, once, at mount — the same rule
// the app paces pathways by, in the same units. A long haul really does take longer than a short
// spur.
//
// ── ⚠ AN ISLAND IS THREE SIBLING GROUPS, NOT ONE. THE FIRST VERSION OF THIS MISSED THAT ─────────
//
// The obvious selector is `.tw-isle`, and it is WRONG: `tw-isle` is the COASTLINE ALONE. The
// engine paints an island across three top-level layers, so that its stacking is correct across
// the whole forest — every island's shore under every island's land under every island's trees:
//
//     <g class="tw-coast-layer">  <g class="tw-isle"   data-id="cli"> … the shore path
//     <g class="tw-land">         <g class="tw-ground" data-id="cli"> … the disc and its cells
//     <g class="tw-flora-layer">  <g class="tw-terr"   data-id="cli"> … trees, crown, name plate
//
// Hiding `.tw-isle` therefore hides a coastline and leaves the visible island exactly where it
// was. The first draft did that and its own instrument agreed with it, because the instrument
// counted `.tw-isle` too — an expectation derived from the same mistake as its subject. It was
// caught by a browser screenshot showing the whole forest while the probe reported every island at
// opacity 0. `forest-growth.test.ts` now derives the layer list from the ENGINE'S OWN EMITTER
// rather than from this comment, so a fourth layer reds the gate instead of half-animating.
//
// ── ⚠ THE LAND SCALES; THE TREES DO NOT. THAT IS MEASURED, NOT A STYLE CHOICE ───────────────────
//
// `tw-isle` and `tw-ground` are the same disc — their bounding-box centres agree within three user
// units, so `transform-box: fill-box` scales both about the island's real body. `tw-terr` is NOT:
// it wraps the trees AND the name plate hanging below, so where the disc sits inside its box
// varies with the island's height. Measured across four islands on the live snapshot, the disc
// centre lands between 28.7% and 50.4% of the terr box vertically. A fixed percentage origin would
// slide the trees off their own ground by tens of user units, differently per island — visible,
// and worse on exactly the tall islands the eye goes to.
//
// So the flora gets OPACITY AND A SMALL RISE instead, which are bounding-box independent and
// therefore exact for every island. It also reads better: the land arrives, then the trees come up
// on it a beat later, which is the order the thing actually happens in.
//
// ── ⚠ WHAT THIS DELIBERATELY DOES NOT COPY FROM THE APP, AND THE MEASUREMENT BEHIND IT ─────────
//
// The app grows an island by ACCRETION — `svgIslandAccretionAtProgress` reveals its hex cells in
// waves outward from a seed and then settles the coastline as one geometric handoff — and it grows
// each tree and plant individually on top of that.
//
// That is not portable to a static SVG page, and the reason is countable rather than aesthetic:
// the served map holds **5,454 `.tw-cell` paths** across its 35 islands (472 on the largest).
// Per-cell accretion here would mean 5,454 concurrently-scheduled CSS animations on paint-level
// properties inside one SVG, where the app pays for the same effect once per frame through a
// memoised cursor. The app can afford its mechanism because it re-renders a scene; a page cannot.
//
// So the island's own growth stays a single transform on the whole land group, and what this
// increment buys is the ORDER — which is where the owner's report actually pointed. The remaining
// gap is recorded rather than silently dropped: the website's islands grow AS ONE PIECE, and the
// app's grow CELL BY CELL.
// ---------------------------------------------------------------------------

/** The class the svg wears while (and only while) growth is armed. Every growth rule in
 *  index.astro is scoped under it — see the no-script guarantee above. */
export const GROWING_CLASS = 'is-growing';

/** The class a trail segment wears while (and only while) the schedule has a draw window for it.
 *  ⚠ THE PARKED STATE FOR A SEGMENT HANGS OFF THIS CLASS, NOT OFF THE SEGMENT SELECTOR. A segment
 *  the plan never reached keeps painting rather than being parked forever — see the header. */
export const DRAWING_CLASS = 'is-drawing';

/** The class a segment wears when its chain walks it AGAINST its drawn direction, so the reveal has
 *  to grow from the path's geometric END. Mirrors the app's `fromEnd`. */
export const DRAW_REVERSED_CLASS = 'is-drawing-rev';

/**
 * Every per-island layer the engine emits, by class.
 *
 * ⚠ THIS LIST IS THE ONE THING MOST LIKELY TO GO SILENTLY STALE, because a missing layer does not
 * throw — it just keeps painting while its siblings arrive, and the result looks like a rendering
 * glitch rather than a wiring bug. `forest-growth.test.ts` derives the same list from
 * `lib/worldSvg.ts` (the emitter that writes these groups) and reds if the two disagree, so adding
 * a layer to the engine reds this repo rather than half-animating it.
 */
export const ISLAND_LAYERS = ['tw-isle', 'tw-ground', 'tw-terr'] as const;
/** The layers that carry the island's LAND, and are therefore safe to scale about a shared fill-box
 *  origin (their bounding boxes are the same disc). */
export const LAND_LAYERS = ['tw-isle', 'tw-ground'] as const;

/**
 * Groups the engine stamps `data-id` onto that this module deliberately does NOT animate, with the
 * reason — so the coverage test can tell "considered and excluded" from "never noticed".
 *
 * `tw-flora` is a CAPABILITY inside a territory ("a capability as garden flora"), so its `data-id`
 * is a capability id rather than a story id, and it is a CHILD of `tw-terr`. Animating it as well
 * would multiply two opacity curves and darken every island through the middle of its own arrival,
 * to achieve exactly what its ancestor already does.
 */
export const NESTED_LAYERS = ['tw-flora'] as const;

/**
 * The trail passes the engine draws one path per segment into, all keyed by the same `data-id`.
 *
 * ⚠ ALL FOUR ARE STAMPED EVEN THOUGH THIS SURFACE ONLY SHOWS ONE. `index.astro` sets
 * `.tw-trail-shadow` and `.tw-trail-casing` to `display: none` on the public map and the engine
 * emits no ghosts for it, so today only the fill is visible. Stamping the schedule on all four
 * anyway means un-hiding a pass is a stylesheet decision that cannot half-animate the arrival —
 * the alternative is a road whose shadow appears 4 seconds before the road.
 */
export const TRAIL_PASSES = [
  'tw-trail-shadow',
  'tw-trail-casing',
  'tw-trail-fill',
  'tw-trail-ghost',
] as const;

/** When the first island lands, measured from mount. The land layer is cross-fading up from the
 *  storm underneath, so the board is legible before the first island arrives on it. */
export const MS_GROWTH_LEAD_IN = 820;

/**
 * ⚠ THE HONESTY FENCE, AS A NUMBER (ADR-0491). The whole arrival — lead-in, islands, pathways and
 * the flora coming up behind the last of them — is over by here, for ANY corpus.
 *
 * Anchored to the page rather than to taste: TELL starts arguing at its second beat and the first
 * sentence of that argument is finished being read around 7.3 s after mount. See the header for
 * why that is the right line, and `forest-growth.test.ts` for the check that keeps the two tied
 * together if the pitch is ever re-timed.
 */
export const MS_GROWTH_CEILING = 7200;

/** Everything the schedule is paced by. */
export interface GrowthTuning {
  /** How long ONE island takes to grow from nothing to settled. */
  readonly islandGrowthMs: number;
  /** The window the BASE islands are spread across, regardless of how many there are — so a
   *  15-root corpus and a 3-root one both read as one scatter, not a queue. */
  readonly baseSpreadMs: number;
  /**
   * How far behind its own land an island's trees come up.
   *
   * ⚠ NOT A FEEL NUMBER — it is what stops a full-size tree standing on a two-thirds-size disc.
   * The land scales and the flora does not (see the header), so while both are running the tree is
   * drawn at final size over ground that has not finished arriving. Measured in slow motion at the
   * previous 620 ms island growth, 170 ms of offset left the trees readable while the disc was
   * still around 0.7 scale and overhanging its own coastline; 300 ms put the land past 0.88 before
   * the trees were visible at all. This is that same ratio carried to the app's 760 ms growth.
   */
  readonly floraOffsetMs: number;
  /** The fixed cost of any pathway, so a one-segment stub still registers as travel. */
  readonly pathwayBaseMs: number;
  /** User units the growing pathway front covers per second — a long haul really does take longer
   *  than a short spur. */
  readonly pathwaySpeed: number;
  /** Clamps on a pathway's draw time: a stub still registers, the longest haul stays brisk. */
  readonly pathwayMinMs: number;
  readonly pathwayMaxMs: number;
  /** The length assumed for a segment whose real geometry could not be measured, so a plan derived
   *  without the DOM still paces sensibly instead of collapsing to the floor. */
  readonly fallbackSegmentLength: number;
  /** The beat before an island NO pathway can reach forms anyway — see `unreachedStoryIds`. */
  readonly unreachedGapMs: number;
}

/**
 * ⚠ TRANSCRIBED FROM THE APP, NOT TUNED HERE. Every value except `floraOffsetMs` is
 * `FOREST_REGROW_TUNING` in `@storytree/app-surface` one repo up — the regrow the owner has
 * already watched and accepted in the desktop app. The increment this module answers is titled
 * "the forest arrives the way the desktop app's does"; matching the pace is a large part of what
 * that means, and picking fresh numbers here would have made the two diverge again on the next
 * report.
 */
export const GROWTH_TUNING: GrowthTuning = {
  islandGrowthMs: 760,
  baseSpreadMs: 1200,
  floraOffsetMs: 370,
  pathwayBaseMs: 220,
  pathwaySpeed: 3400,
  pathwayMinMs: 340,
  pathwayMaxMs: 1400,
  fallbackSegmentLength: 900,
  unreachedGapMs: 260,
};

// ── the graph, as the served markup already carries it ──────────────────────

/** One hop of an edge's routed chain: which segment, and whether the chain walks it backwards. */
export interface GrowthSegmentRef {
  readonly id: string;
  readonly reversed: boolean;
}

/** One dependency edge: `from` is the PREREQUISITE, `to` the story that depends on it. */
export interface GrowthEdge {
  readonly from: string;
  readonly to: string;
  readonly segments: readonly GrowthSegmentRef[];
}

export interface GrowthGraph {
  /** Every island on the map, in the build's own placement order. */
  readonly storyIds: readonly string[];
  readonly edges: readonly GrowthEdge[];
  /** Segment id → measured path length in user units. Missing entries fall back to the tuning. */
  readonly segmentLengths: ReadonlyMap<string, number>;
}

/**
 * Parse one `data-segments` payload — `"tabc:F,tdef:R"` — into an ordered chain.
 *
 * Tolerant on purpose: a malformed entry is DROPPED rather than throwing. This value is produced by
 * the engine one repo up and read here across a sync boundary, and the failure mode that matters is
 * a whole arrival dying because one chain gained a field, not a slightly short chain.
 */
export function parseSegmentChain(raw: string | null): GrowthSegmentRef[] {
  if (raw === null || raw === '') return [];
  const out: GrowthSegmentRef[] = [];
  for (const part of raw.split(',')) {
    const [id, dir] = part.split(':');
    if (id === undefined || id === '') continue;
    out.push({ id, reversed: dir === 'R' });
  }
  return out;
}

// ── the plan ────────────────────────────────────────────────────────────────

/** How an island came to exist — the plan's own account of its start time. */
export type GrowthReach =
  /** No incoming edge: nothing depends on reaching it, so it forms from nothing at the start. */
  | 'base'
  /** Reached by an incoming pathway that finished drawing — the ordinary case. */
  | 'pathway'
  /** It has incoming edges, but every one of them starts at an island that is itself unreachable —
   *  a dependency cycle. It forms a beat after everything else rather than being stranded off the
   *  map: silently omitting an island would make the reveal claim a forest smaller than the real
   *  one, on a page whose pitch is that the map is complete. */
  | 'unreached';

export interface GrowthIsland {
  readonly storyId: string;
  readonly reach: GrowthReach;
  /** When the land begins to grow, measured from mount (lead-in included). */
  readonly startMs: number;
  /** When the land has settled. The flora is still coming up until `floraEndMs`. */
  readonly endMs: number;
  /** When this island's trees begin to rise. */
  readonly floraStartMs: number;
  readonly floraEndMs: number;
}

/** One pathway growing outward from a settled island toward the story that depends on it. */
export interface GrowthPathway {
  readonly from: string;
  readonly to: string;
  /** When the pathway leaves `from` — that island's settle. */
  readonly startMs: number;
  /** When its front reaches `to`. */
  readonly endMs: number;
}

/** One trail segment's draw window, and which end the reveal grows from. */
export interface GrowthSegmentDraw {
  readonly id: string;
  /** True ⇒ the reveal grows from the path's geometric END, because the chain that first claimed
   *  this segment walks it against its drawn direction. */
  readonly fromEnd: boolean;
  readonly startMs: number;
  readonly endMs: number;
}

export interface GrowthPlan {
  readonly islands: ReadonlyMap<string, GrowthIsland>;
  readonly pathways: readonly GrowthPathway[];
  /** Segment id → its draw window. A segment carried by several pathways takes the EARLIEST one:
   *  the road exists as soon as the first connection it serves has grown through it. */
  readonly segments: ReadonlyMap<string, GrowthSegmentDraw>;
  readonly baseStoryIds: readonly string[];
  readonly unreachedStoryIds: readonly string[];
  /** What the schedule would have taken at the tuning's own pace, before the ceiling. */
  readonly naturalTotalMs: number;
  /** The single factor every time in the plan was scaled by to fit the ceiling. 1 ⇒ uncompressed. */
  readonly compression: number;
  /** When the whole arrival is over and the map is a settled picture again. Never above
   *  `MS_GROWTH_CEILING`. */
  readonly totalMs: number;
  readonly tuning: GrowthTuning;
}

/** How long a pathway takes to travel its own chain. */
function pathwayMs(edge: GrowthEdge, graph: GrowthGraph, tuning: GrowthTuning): number {
  let length = 0;
  for (const seg of edge.segments) {
    length += graph.segmentLengths.get(seg.id) ?? tuning.fallbackSegmentLength;
  }
  const raw = tuning.pathwayBaseMs + (length / tuning.pathwaySpeed) * 1000;
  return Math.min(tuning.pathwayMaxMs, Math.max(tuning.pathwayMinMs, raw));
}

/**
 * Derive the whole arrival from the graph. PURE — no DOM, no clock, no timers.
 *
 * ⚠ THE HONESTY INVARIANT: every id this returns came from `graph.storyIds`. An edge naming a story
 * that is not on the map is dropped, and a story on the map always gets a window. The reveal cannot
 * invent an island and cannot lose one.
 */
export function deriveGrowthPlan(
  graph: GrowthGraph,
  tuning: GrowthTuning = GROWTH_TUNING,
  leadInMs: number = MS_GROWTH_LEAD_IN,
  ceilingMs: number = MS_GROWTH_CEILING,
): GrowthPlan {
  const known = new Set(graph.storyIds);
  const edges = graph.edges.filter((e) => known.has(e.from) && known.has(e.to) && e.from !== e.to);

  const outgoing = new Map<string, GrowthEdge[]>();
  const incoming = new Map<string, GrowthEdge[]>();
  for (const id of graph.storyIds) {
    outgoing.set(id, []);
    incoming.set(id, []);
  }
  for (const e of edges) {
    outgoing.get(e.from)?.push(e);
    incoming.get(e.to)?.push(e);
  }

  // Rule 1. The base islands: nothing routes into them, so nothing can reach them and they form
  // from nothing. A graph with no roots at all (every island on a cycle) has no honest order, so
  // every island becomes a base island rather than the reveal deadlocking on itself.
  let baseStoryIds = graph.storyIds.filter((id) => (incoming.get(id) ?? []).length === 0);
  if (baseStoryIds.length === 0) baseStoryIds = [...graph.storyIds];

  const startMs = new Map<string, number>();
  const settleMs = new Map<string, number>();
  const reach = new Map<string, GrowthReach>();
  baseStoryIds.forEach((id, i) => {
    const spread =
      baseStoryIds.length <= 1 ? 0 : (i / (baseStoryIds.length - 1)) * tuning.baseSpreadMs;
    startMs.set(id, spread);
    reach.set(id, 'base');
  });

  // Rules 2 and 3, as a shortest-arrival walk. Settling an island is what releases its outgoing
  // pathways, and the first pathway to arrive at an island is what starts it — so islands are
  // finalised in settle order, exactly like a Dijkstra frontier. O(V² + E), which is nothing at any
  // corpus size this page will ever serve.
  for (;;) {
    let pick: string | null = null;
    let pickAt = Infinity;
    for (const [id, at] of startMs) {
      if (!settleMs.has(id) && at < pickAt) {
        pick = id;
        pickAt = at;
      }
    }
    if (pick === null) break;
    settleMs.set(pick, pickAt + tuning.islandGrowthMs);
    for (const e of outgoing.get(pick) ?? []) {
      const arrival = (settleMs.get(pick) ?? 0) + pathwayMs(e, graph, tuning);
      const current = startMs.get(e.to);
      if (current === undefined || arrival < current) {
        startMs.set(e.to, arrival);
        reach.set(e.to, 'pathway');
      }
    }
  }

  // Anything left sits on a cycle no base island reaches. It lands at the tail rather than being
  // dropped — see `GrowthReach`.
  const unreachedStoryIds = graph.storyIds.filter((id) => !startMs.has(id));
  if (unreachedStoryIds.length > 0) {
    const tail = Math.max(0, ...settleMs.values());
    unreachedStoryIds.forEach((id, i) => {
      const at = tail + tuning.unreachedGapMs * (i + 1);
      startMs.set(id, at);
      settleMs.set(id, at + tuning.islandGrowthMs);
      reach.set(id, 'unreached');
    });
  }

  const pathways: GrowthPathway[] = [];
  for (const e of edges) {
    const from = settleMs.get(e.from);
    if (from === undefined) continue;
    pathways.push({ from: e.from, to: e.to, startMs: from, endMs: from + pathwayMs(e, graph, tuning) });
  }
  pathways.sort((a, b) => a.startMs - b.startMs || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  // Each pathway hands its own window out across its chain in proportion to segment length, so the
  // front travels at a constant speed rather than jumping between long and short hops. The earliest
  // claim on a segment wins: a shared trunk is drawn once, by whichever connection got there first.
  const segments = new Map<string, GrowthSegmentDraw>();
  const byEndpoints = new Map<string, GrowthEdge>();
  for (const e of edges) byEndpoints.set(`${e.from} ${e.to}`, e);
  for (const p of pathways) {
    const edge = byEndpoints.get(`${p.from} ${p.to}`);
    if (edge === undefined || edge.segments.length === 0) continue;
    const lengths = edge.segments.map(
      (s) => graph.segmentLengths.get(s.id) ?? tuning.fallbackSegmentLength,
    );
    const total = lengths.reduce((a, b) => a + b, 0);
    let travelled = 0;
    edge.segments.forEach((seg, i) => {
      const share = total > 0 ? (lengths[i] ?? 0) / total : 1 / edge.segments.length;
      const from = p.startMs + (p.endMs - p.startMs) * travelled;
      travelled += share;
      const to = p.startMs + (p.endMs - p.startMs) * travelled;
      const held = segments.get(seg.id);
      if (held === undefined || from < held.startMs) {
        segments.set(seg.id, { id: seg.id, fromEnd: seg.reversed, startMs: from, endMs: to });
      }
    });
  }

  // The natural total is the last thing that MOVES, which is the flora coming up behind the last
  // island — not the last island's own settle. Reading the shorter number here is how a reveal
  // gets a `is-growing` class pulled off it mid-animation.
  let naturalTotalMs = 0;
  for (const [, at] of startMs) {
    naturalTotalMs = Math.max(naturalTotalMs, at + tuning.floraOffsetMs + tuning.islandGrowthMs);
  }
  for (const p of pathways) naturalTotalMs = Math.max(naturalTotalMs, p.endMs);
  for (const [, s] of segments) naturalTotalMs = Math.max(naturalTotalMs, s.endMs);

  const budget = Math.max(0, ceilingMs - leadInMs);
  const compression = naturalTotalMs > budget && naturalTotalMs > 0 ? budget / naturalTotalMs : 1;
  const at = (ms: number): number => leadInMs + ms * compression;

  const islands = new Map<string, GrowthIsland>();
  for (const id of graph.storyIds) {
    const raw = startMs.get(id) ?? 0;
    const start = at(raw);
    const grow = tuning.islandGrowthMs * compression;
    const floraStart = start + tuning.floraOffsetMs * compression;
    islands.set(id, {
      storyId: id,
      reach: reach.get(id) ?? 'base',
      startMs: start,
      endMs: start + grow,
      floraStartMs: floraStart,
      floraEndMs: floraStart + grow,
    });
  }

  return {
    islands,
    pathways: pathways.map((p) => ({ ...p, startMs: at(p.startMs), endMs: at(p.endMs) })),
    segments: new Map(
      [...segments].map(([id, s]) => [id, { ...s, startMs: at(s.startMs), endMs: at(s.endMs) }]),
    ),
    baseStoryIds,
    unreachedStoryIds,
    naturalTotalMs,
    compression,
    totalMs: at(naturalTotalMs),
    tuning,
  };
}

// ── reading the graph off the page ──────────────────────────────────────────

/**
 * Read the dependency graph and the routed geometry out of the already-served markup.
 *
 * ⚠ `measure` IS INJECTED SO THE READ IS TESTABLE AND SO A REFUSAL IS SURVIVABLE.
 * `SVGGeometryElement.getTotalLength()` does not exist in every SVG implementation a page can find
 * itself in, and a throw here would take the whole arrival down. Anything that cannot be measured
 * falls back to the tuning's assumed length, which paces sensibly rather than collapsing.
 */
export function readGrowthGraph(
  map: Element,
  measure: (path: Element) => number | null = defaultMeasure,
): GrowthGraph {
  const storyIds = Array.from(map.querySelectorAll('.tw-ground[data-id]'))
    .map((el) => el.getAttribute('data-id'))
    .filter((id): id is string => id !== null && id !== '');

  const edges: GrowthEdge[] = [];
  for (const el of map.querySelectorAll('.tw-trail-edge[data-from][data-to]')) {
    const from = el.getAttribute('data-from');
    const to = el.getAttribute('data-to');
    if (from === null || to === null || from === '' || to === '') continue;
    edges.push({ from, to, segments: parseSegmentChain(el.getAttribute('data-segments')) });
  }

  const segmentLengths = new Map<string, number>();
  for (const el of map.querySelectorAll('.tw-trail-fill[data-id]')) {
    const id = el.getAttribute('data-id');
    if (id === null || id === '' || segmentLengths.has(id)) continue;
    const length = measure(el);
    if (length !== null && Number.isFinite(length) && length > 0) segmentLengths.set(id, length);
  }

  return { storyIds, edges, segmentLengths };
}

function defaultMeasure(path: Element): number | null {
  try {
    const fn = (path as { getTotalLength?: () => number }).getTotalLength;
    return typeof fn === 'function' ? fn.call(path) : null;
  } catch {
    return null;
  }
}

export interface GrowthHandle {
  /** Reveal everything immediately and drop the armed class. Idempotent, and safe to call from a
   *  teardown that races the schedule. */
  unmount(): void;
  /** The schedule that was armed, or null under reduced motion / an unreadable map. Exposed for the
   *  end-to-end probe — nothing on the page reads it. */
  readonly plan: GrowthPlan | null;
}

const INERT: GrowthHandle = { unmount(): void {}, plan: null };

/**
 * Grow the already-rendered forest in, along its own dependency edges.
 *
 * `map` is the `<svg class="forest-arrival-svg">` the build serialised. Under reduced motion this
 * arms NOTHING — it does not park the islands and then reveal them faster, because a staggered
 * reveal is itself a motion the visitor asked not to have. The map simply is.
 */
export function mountForestGrowth(map: Element, reducedMotion: boolean): GrowthHandle {
  if (reducedMotion) return INERT;

  const graph = readGrowthGraph(map);
  if (graph.storyIds.length === 0) return INERT;
  const plan = deriveGrowthPlan(graph);

  const touched: Element[] = [];
  const drawn: Element[] = [];

  const stamp = (el: Element, props: Record<string, string>): void => {
    if (!(el instanceof SVGElement) && !(el instanceof HTMLElement)) return;
    for (const [k, v] of Object.entries(props)) el.style.setProperty(k, v);
    touched.push(el);
  };

  for (const [id, island] of plan.islands) {
    const props = {
      '--grow-delay': `${Math.round(island.startMs)}ms`,
      '--grow-dur': `${Math.round(island.endMs - island.startMs)}ms`,
      '--flora-delay': `${Math.round(island.floraStartMs)}ms`,
    };
    for (const layer of ISLAND_LAYERS) {
      const el = map.querySelector(`.${layer}[data-id="${CSS.escape(id)}"]`);
      if (el !== null) stamp(el, props);
    }
  }

  for (const [id, seg] of plan.segments) {
    for (const pass of TRAIL_PASSES) {
      for (const el of map.querySelectorAll(`.${pass}[data-id="${CSS.escape(id)}"]`)) {
        // `pathLength` normalises the dash geometry to 1, so the reveal is one keyframe for every
        // segment whatever its real length — and it is set here rather than in the build because
        // it is growth state, not map content.
        el.setAttribute('pathLength', '1');
        el.classList.add(DRAWING_CLASS);
        if (seg.fromEnd) el.classList.add(DRAW_REVERSED_CLASS);
        drawn.push(el);
        stamp(el, {
          '--draw-delay': `${Math.round(seg.startMs)}ms`,
          '--draw-dur': `${Math.max(1, Math.round(seg.endMs - seg.startMs))}ms`,
        });
      }
    }
  }

  map.classList.add(GROWING_CLASS);

  // The class comes OFF once the last animation has run, so the growth rules stop applying to a
  // settled map. A lens TELL adds later must not find itself competing with an arrival that is
  // over — and an element still carrying an animation is an element whose opacity is not simply 1.
  const settle = window.setTimeout(() => {
    map.classList.remove(GROWING_CLASS);
  }, plan.totalMs + 120);

  let done = false;
  return {
    plan,
    unmount(): void {
      if (done) return;
      done = true;
      window.clearTimeout(settle);
      map.classList.remove(GROWING_CLASS);
      for (const el of touched) {
        if (el instanceof SVGElement || el instanceof HTMLElement) {
          for (const p of ['--grow-delay', '--grow-dur', '--flora-delay', '--draw-delay', '--draw-dur']) {
            el.style.removeProperty(p);
          }
        }
      }
      for (const el of drawn) {
        el.classList.remove(DRAWING_CLASS, DRAW_REVERSED_CLASS);
        el.removeAttribute('pathLength');
      }
    },
  };
}
