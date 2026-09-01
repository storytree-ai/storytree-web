// ---------------------------------------------------------------------------
// forest-snapshot-map — THE REAL FOREST, as of a stated moment.
//
// Every other map on this site is fiction: the Act 2 walk grows a scripted three-story
// example, and the Phase-Z studio diorama lays out six invented islands. This one is
// storytree's OWN corpus, published by a job into `src/data/forest-snapshot.json` and
// rendered through the same shared engine every other map here uses.
//
// ⚠ IT IS NOT LIVE, AND THE PAGE MUST SAY SO. `renderStamp()` below turns the snapshot's
// `generatedAt` into the line the page prints. A snapshot that presents itself as a live
// reading is the single way this backfires — the site's whole claim is that its signals
// are real, and "real" includes being honest about when the picture was taken. The stamp
// is not decoration; treat removing it as removing the map.
//
// ⚠ NO NEW STATUS COMPUTATION HAPPENS HERE, and none may be added. The colour on every
// island arrives already folded, by the studio's own reader, at export time — a signed
// verdict is the only thing that greens anything (the parent repo's ADR-0040 / ADR-0453
// D7). This module reads `status` and paints it. If you find yourself wanting to derive a
// colour here from anything else, the answer lives in the exporter, one repo up.
//
// ⚠ NO WISPS. A wisp renders a session working RIGHT NOW; in an asynchronously-refreshed
// snapshot it would show last night's sessions as live. The exporter does not publish
// them and this renderer does not draw them.
//
// WHAT THIS FILE DOES OWN is the LAYOUT — where the islands sit. That is a look decision,
// not a reading, so it is allowed to differ from the studio app's arrangement; it uses the
// same shared primitives (dependency ranks, size-from-capability-count, the trail router)
// so it differs in composition rather than in kind.
// ---------------------------------------------------------------------------

import {
  HEX_R,
  buildScene,
  descendantCounts,
  estRadius,
  hash,
  rand01,
  rankStories,
  ringsOf,
  routeTrails,
  storyEdges,
  type Pt,
  type RelaxedCell,
  type SceneInput,
  type SceneStatus,
  type SceneTerritoryInput,
} from '../lib/forest-world';
import { sceneToSvg } from '../lib/worldSvg';
import { buildDisc, escXml } from './act2-walkthrough';

// ── the published artifact's shape ──────────────────────────────────────────
//
// Hand-written rather than zod-parsed on purpose: this file is inlined into the page at
// build time from a machine-written JSON in this repo, so there is no runtime boundary for
// a parse to guard — and `assertSnapshot` below refuses the shapes that CAN actually reach
// us (a hand-edited file, a schema the exporter has moved past) at BUILD time, where the
// failure is a red build rather than a blank map on the live site.

export interface SnapshotCapability {
  readonly id: string;
  readonly title: string;
  readonly status: string | null;
  readonly dependsOn: readonly string[];
}

/** How one story reaches one arc, and by which of the two edges (`via` — the exporter's ADR-0306 D4
 *  note explains why the provenance travels with the link instead of being flattened away). */
export interface SnapshotStoryArc {
  readonly id: string;
  readonly via: string;
}

/**
 * ONE DECISION — number, status and title, and that is the whole tier (ADR-0494 D2).
 *
 * ⚠ THE BODY IS NOT HERE AND CANNOT BE ADDED FROM THIS REPO. The exporter one repo up publishes
 * title and identity only; a field added to this interface would render blank. The owner priced the
 * exposure at exactly this depth — a stranger may see what was DECIDED, never the reasoning, which
 * is what the app opens.
 *
 * Reached by NUMBER from both a story and an arc, so one decision has one record however many
 * things point at it. See {@link ForestSnapshot.decisions}.
 */
export interface SnapshotAdr {
  readonly number: number;
  readonly status: string;
  readonly title: string;
}

/**
 * ONE UAT LEG — a step of the story's own acceptance journey, and the verdict signed against it
 * (ADR-0494 D1).
 *
 * ⚠ THE PUBLIC DEPTH FLOOR NOW SITS HERE rather than at the capability tree, and this is the tier
 * that makes the page's claim checkable instead of asserted: everything above says "25 of 35 are
 * proven", and this says what the proving consisted of.
 *
 * ⚠ NO ID, AND NO BODY. The exporter publishes the authored one-line title and nothing else of the
 * leg's prose — a `## UAT Test Criteria` section is long-form, and the criterion's own id is a
 * random hash no line renders. Both were measured and dropped upstream; neither is retrievable here.
 */
export interface SnapshotUatCriterion {
  readonly title: string;
  readonly state: string;
  readonly witness: string;
  /** Whether anything CAN sign this step as authored — see {@link RoamUatCriterion.signable}. */
  readonly signable: boolean;
}

/**
 * ONE ARC AT TITLE-AND-SHAPE DEPTH — the initiative layer above the code (ADR-0453 D12).
 *
 * ⚠ THE ABSENT PROSE IS THE PROTECTION, AND IT IS ABSENT UPSTREAM. The forest is publishable because
 * it is illegible by construction (D3); arc titles are readable English about strategy, so that
 * argument does not carry up here and what makes this tier safe is that the bodies — `intent`,
 * `endState`, every increment objective, every question's stakes — are not in the exported file at
 * all. A field added to this interface would render nothing, because the data is not there; the
 * fence lives in `apps/studio/server/forestSnapshot.ts` one repo up, and that is deliberate.
 */
export interface SnapshotArc {
  readonly id: string;
  readonly title: string;
  readonly lifecycle: string;
  readonly incrementsClosed: number;
  readonly incrementsOpen: number;
  /** Decision NUMBERS into {@link ForestSnapshot.decisions} — inline records until schema 3. */
  readonly adrs: readonly number[];
}

export interface SnapshotStory {
  readonly id: string;
  readonly title: string;
  readonly status: string | null;
  readonly dependsOn: readonly string[];
  readonly building?: boolean;
  readonly capabilities: readonly SnapshotCapability[];
  /** The acceptance journey IN AUTHORED ORDER — never sorted, because the order IS the journey.
   *  Always present, empty when the story declares no witnessable leg (11 of 35 do not). */
  readonly uat: readonly SnapshotUatCriterion[];
  /** The deciding ADR numbers, into {@link ForestSnapshot.decisions}. Always present, empty when
   *  the story declares none. */
  readonly decisions: readonly number[];
  /** Always present, empty when no arc reaches this story — the drawer's designed empty state. */
  readonly arcs: readonly SnapshotStoryArc[];
}

export interface ForestSnapshot {
  readonly schemaVersion: number;
  /** ISO-8601 UTC — the moment this picture was taken. */
  readonly generatedAt: string;
  readonly source: string;
  readonly storyCount: number;
  readonly provenStoryCount: number;
  readonly capabilityCount: number;
  readonly stories: readonly SnapshotStory[];
  /** Every arc a story above reaches, id-sorted — normalised, so a hub arc appears once. */
  readonly arcs: readonly SnapshotArc[];
  /** Every decision a story or an arc above reaches, number-sorted — normalised for the same
   *  reason, and more sharply: the 35 stories make 211 citations over 117 distinct decisions. */
  readonly decisions: readonly SnapshotAdr[];
}

/**
 * The schema version this renderer understands.
 *
 * 2 — the arc layer (ADR-0453 D12).
 * 3 — the depth floor moves to the UAT proof and decisions become reachable (ADR-0494 D1/D2), with
 *     the decision records normalised out of the arc tier into `snapshot.decisions`.
 *
 * The pin is EXACT and `assertSnapshot` refuses anything else at build time, which is what stops
 * the two repos disagreeing about what a published file means: an exporter that has moved past this
 * site reds the build rather than rendering half a map. Schema 3 is why that matters concretely —
 * a reader still pinned to 2 would have walked `arc.adrs` expecting records and printed
 * `undefined` down the drawer.
 */
export const SUPPORTED_SCHEMA_VERSION = 3;

/**
 * Refuse a snapshot this renderer cannot honestly draw, LOUDLY and at build time.
 *
 * Every branch here is a shape that can genuinely arrive: a file someone hand-edited, a
 * schema the exporter moved past without this site following, or a publish that produced a
 * forest with nothing in it. A silent fallback to an empty map would be the worst outcome
 * available — the page would still render, still carry its stamp, and quietly assert that
 * storytree has no stories.
 */
export function assertSnapshot(raw: unknown): ForestSnapshot {
  const s = raw as Partial<ForestSnapshot> | null;
  if (s === null || typeof s !== 'object') {
    throw new Error('forest snapshot: not an object');
  }
  if (s.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `forest snapshot: schemaVersion ${String(s.schemaVersion)} — this site renders ` +
        `version ${SUPPORTED_SCHEMA_VERSION}. Re-sync the renderer with the exporter.`,
    );
  }
  if (typeof s.generatedAt !== 'string' || Number.isNaN(Date.parse(s.generatedAt))) {
    throw new Error(
      'forest snapshot: no usable `generatedAt`. The map may not render without a stamp — ' +
        'an undated snapshot presents itself as live, which is the one thing it must not do.',
    );
  }
  if (!Array.isArray(s.stories) || s.stories.length === 0) {
    throw new Error('forest snapshot: no stories — refusing to publish an empty forest.');
  }
  return s as ForestSnapshot;
}

// ── the stamp ───────────────────────────────────────────────────────────────

/** e.g. "28 August 2026" — the date, in the visitor's plain reading, always UTC. */
export function formatStampDate(generatedAt: string): string {
  return new Date(generatedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The line the page prints under the map. It states three things and no more: that this is
 * storytree's own system, WHEN the picture was taken, and that it is not live.
 */
export function renderStamp(snap: ForestSnapshot): string {
  const proven = `${snap.provenStoryCount} of ${snap.storyCount}`;
  return (
    `storytree's own system, as of ${formatStampDate(snap.generatedAt)}. ` +
    // ⚠ MICROSERVICES, NOT STORIES (ADR-0494 D5). This is the single most prominent sentence under
    // the map and it is the FIRST prose a visitor reads, seconds before TELL says "Every island is a
    // microservice" — so our noun here made the page contradict itself inside ten seconds. Found by
    // reading the LIVE site after the vocabulary pass landed: the fence covered TELL, ROAM and two
    // strings in index.astro, and this fifth surface was generated here and scanned by nothing.
    // `vocabulary.test.ts` now renders this stamp against the real snapshot and holds it to the same
    // list.
    `${proven} microservices are proven — each one green because a signed test said so, not because ` +
    `anyone marked it done. This is a snapshot, refreshed from time to time. It is not live.`
  );
}

// ── the strings the map BUILDS, which are the ones a fence forgets ──────────
//
// ⚠ EVERY STRING BELOW IS VISITOR-FACING AND NONE OF THEM IS A CONSTANT. A nameplate's second line,
// an island's hover title and the map's own accessible description are assembled from counts at
// render time, which is exactly the shape `vocabulary.test.ts` cannot see by reading copy: there is
// no literal to scan. They are pulled out as named functions for that reason and no other — a word
// a test cannot import is a word the fence does not cover, and all three of these said `capability`
// or `story` for a day after the pass that was supposed to have retired both (ADR-0494 D5).
//
// ⚠ AND NONE OF THEM CARRIES A CORPUS NAME. `islandTitle` composes a story's real title with
// {@link provenTally}; only the tally half is exported for scanning, because the map's own labels
// are our untranslated ids ON PURPOSE (ADR-0453 D3) and a fence that read one would report the
// substrate as a violation.

/** A nameplate's second line: how many components the island holds. */
export function nameplateTally(capCount: number): string {
  return capCount === 1 ? '1 component' : `${capCount} components`;
}

/** An island's hover title, minus its name: how much of it is proven. */
export function provenTally(proven: number, total: number): string {
  return `${proven} of ${total} components proven`;
}

/**
 * The whole map's accessible description — what a screen reader is told the picture IS.
 *
 * It carries the same three claims the stamp does (whose system, when, not live) plus the two
 * gestures, because a reader who cannot see the map still has to know it can be moved.
 */
export function arrivalLabel(snap: ForestSnapshot): string {
  return (
    `A map of storytree's own system as of ${formatStampDate(snap.generatedAt)}: ` +
    `${snap.storyCount} islands, one microservice each, ${snap.provenStoryCount} of them green ` +
    `because a signed test proved them, connected by trails where one depends on another. ` +
    `Not live. Drag to move around it; scroll to zoom.`
  );
}

// ── layout ──────────────────────────────────────────────────────────────────

/** Margin around the laid-out forest. The top clears a story tree's crown, the bottom its
 *  nameplate; the frame itself is DERIVED from the layout rather than declared, so adding a
 *  story grows the picture instead of clipping it off the edge. */
const MARGIN_TOP = 150;
const MARGIN_BOTTOM = 130;
const MARGIN_SIDE = 90;
/** Gap between rank rows and between islands within a row (scene units). */
const RANK_GAP = 40;
const ISLAND_GAP = 190;
/** A lone island in a row swings off the column so its roads sweep as diagonals. */
const RANK_SWING = 300;
/** Nameplate baseline, below the island's centre. */
const PLATE_Y = 62;

/** Tile quota for a story — the studio's own curve: capability count plus headroom. */
function quotaOf(story: SnapshotStory): number {
  return Math.max(3, story.capabilities.length + 2);
}

/**
 * The published status, as a scene status.
 *
 * `unknown` is the honest reading of a null: the story's spec failed to load, so the map
 * says it does not know rather than picking a colour. Anything the engine does not have a
 * hue for reads the same way — a NEW status arriving from a future exporter must show up as
 * "we do not know", never silently as one of the colours we do have.
 */
export function toSceneStatus(status: string | null): SceneStatus {
  switch (status) {
    case 'healthy':
    case 'mapped':
    case 'proposed':
    case 'building':
    case 'unhealthy':
      return status;
    default:
      return 'unknown';
  }
}

interface Placed {
  readonly story: SnapshotStory;
  readonly centre: Pt;
  readonly radius: number;
  readonly rings: number;
}

/**
 * Place every island: dependency rank stacks the rows bottom-up (the most foundational
 * stories sit at the bottom, the things that depend on them fan up and out), and within a
 * row an island sits near the average x of the dependencies already placed below it. The
 * foundation row interleaves centre-out so the most load-bearing story lands in the middle.
 *
 * The same shape the studio app lays out, at a fraction of its machinery — the ranking, the
 * size curve and the trail routing are the shared engine's; the packing is this file's.
 */
export function placeStories(stories: readonly SnapshotStory[]): Placed[] {
  const edgeStories = stories.map((s) => ({
    id: s.id,
    dependsOn: [...s.dependsOn],
    capabilities: s.capabilities.map((c) => ({ id: c.id, dependsOn: [...c.dependsOn] })),
  }));
  const edges = storyEdges(edgeStories);
  const depsOf = new Map<string, string[]>(stories.map((s) => [s.id, []]));
  const dependentsOf = new Map<string, string[]>(stories.map((s) => [s.id, []]));
  for (const e of edges) {
    depsOf.get(e.to)?.push(e.from);
    dependentsOf.get(e.from)?.push(e.to);
  }

  const ranks = rankStories(edgeStories, depsOf);
  const loadBearing = descendantCounts(edgeStories, dependentsOf);
  const maxRank = Math.max(0, ...ranks.values());
  const byRank: SnapshotStory[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const s of stories) byRank[ranks.get(s.id) ?? 0]?.push(s);

  const radiusOf = (s: SnapshotStory): number => estRadius(quotaOf(s));

  // Row centre-lines, bottom-up, each clearing the tallest island on either side of the gap.
  const rowY: number[] = [];
  let y = 0;
  for (let r = 0; r <= maxRank; r++) {
    const tallest = Math.max(...(byRank[r] ?? []).map(radiusOf), HEX_R);
    if (r === 0) y = -tallest;
    else {
      const below = Math.max(...(byRank[r - 1] ?? []).map(radiusOf), HEX_R);
      y -= below + tallest + RANK_GAP;
    }
    rowY.push(y);
  }

  const placed = new Map<string, Pt>();
  const baryOf = (s: SnapshotStory): number => {
    const xs = (depsOf.get(s.id) ?? []).map((d) => placed.get(d)?.x).filter((x) => x !== undefined);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  };

  const out: Placed[] = [];
  for (let r = 0; r <= maxRank; r++) {
    const row = byRank[r] ?? [];
    const ordered = [...row].sort((a, b) =>
      r === 0
        ? (loadBearing.get(b.id) ?? 0) - (loadBearing.get(a.id) ?? 0)
        : baryOf(a) - baryOf(b) || (hash(a.id) % 997) - (hash(b.id) % 997),
    );
    // foundation row: most load-bearing in the middle, the rest alternating outward
    let display = ordered;
    if (r === 0) {
      display = [];
      ordered.forEach((s, k) => (k % 2 === 0 ? display.push(s) : display.unshift(s)));
    }
    const widths = display.map(radiusOf);
    const total =
      widths.reduce((sum, w) => sum + 2 * w, 0) + ISLAND_GAP * Math.max(0, display.length - 1);
    let centreX =
      r === 0 ? 0 : display.reduce((sum, s) => sum + baryOf(s), 0) / Math.max(display.length, 1);
    if (r > 0 && display.length === 1) centreX += (r % 2 === 1 ? 1 : -1) * RANK_SWING;
    let cursor = centreX - total / 2;
    display.forEach((story, k) => {
      const w = widths[k] ?? HEX_R;
      const seed = hash(story.id);
      const centre: Pt = {
        x: cursor + w + (rand01(seed) - 0.5) * 40,
        y: (rowY[r] ?? 0) + (rand01(seed + 1) - 0.5) * 26,
      };
      placed.set(story.id, centre);
      out.push({ story, centre, radius: w, rings: ringsOf(quotaOf(story)) });
      cursor += 2 * w + ISLAND_GAP;
    });
  }
  return out;
}

// ── the scene ───────────────────────────────────────────────────────────────

/** The frame the laid-out forest needs, and the offset that centres it in that frame. */
export function frameFor(placed: readonly Placed[]): { width: number; height: number; offset: Pt } {
  const minX = Math.min(...placed.map((p) => p.centre.x - p.radius));
  const maxX = Math.max(...placed.map((p) => p.centre.x + p.radius));
  const minY = Math.min(...placed.map((p) => p.centre.y - p.radius));
  const maxY = Math.max(...placed.map((p) => p.centre.y + p.radius));
  return {
    width: Math.round(maxX - minX + 2 * MARGIN_SIDE),
    height: Math.round(maxY - minY + MARGIN_TOP + MARGIN_BOTTOM),
    offset: { x: MARGIN_SIDE - minX, y: MARGIN_TOP - minY },
  };
}

/** Build the scene input for the whole forest. Pure — same snapshot in, same SVG out. */
export function forestSceneInput(snap: ForestSnapshot): SceneInput & { width: number; height: number } {
  const placed = placeStories(snap.stories);
  const byId = new Map(snap.stories.map((s) => [s.id, s]));
  const cells: RelaxedCell[] = [];
  const territories: SceneTerritoryInput[] = [];

  placed.forEach(({ story, centre, radius, rings }, owner) => {
    const disc = buildDisc(centre, rings, `forest-disc-${story.id}`);
    for (const c of disc.cells) cells.push({ ...c, owner });
    const capCount = story.capabilities.length;
    const proven = story.capabilities.filter((c) => c.status === 'healthy').length;
    territories.push({
      id: story.id,
      status: toSceneStatus(story.status),
      caps: capCount,
      centroid: centre,
      // One declared radius feeding both spaces — see the note on the same split in
      // act2-walkthrough.ts. The islands here are discs, so the two agree.
      groundRadius: radius,
      screenRadius: radius,
      treeSpot: disc.treeSpot,
      labelY: centre.y + PLATE_Y,
      coastPaths: disc.coastPaths,
      decor: disc.decor,
      plants: [],
      treeTitle: `${story.title} — ${provenTally(proven, capCount)}`,
      // no wisps: a snapshot has no live session (see the file header)
      wisps: [],
      plate: {
        w: Math.max(96, story.id.length * 7.4 + 24),
        h: 30,
        rx: 7,
        idY: 14,
        subY: 26,
        idText: story.id,
        subText: nameplateTally(capCount),
        title: story.title,
      },
    });
  });

  const trails = routeTrails(
    placed.map((p) => ({ id: p.story.id, x: p.centre.x, y: p.centre.y, r: p.radius })),
    storyEdges(
      snap.stories.map((s) => ({
        id: s.id,
        dependsOn: [...s.dependsOn],
        capabilities: s.capabilities.map((c) => ({ id: c.id, dependsOn: [...c.dependsOn] })),
      })),
    ).map((e) => ({
      from: e.from,
      to: e.to,
      title: `${byId.get(e.to)?.title ?? e.to} needs ${byId.get(e.from)?.title ?? e.from}`,
    })),
    'forest-snapshot-trails',
  );

  const frame = frameFor(placed);
  return {
    offset: frame.offset,
    width: frame.width,
    height: frame.height,
    empties: [],
    relaxedCells: cells,
    drawTiles: [],
    wheatSets: [],
    trails,
    territories,
  };
}

/** Every island's on-screen DIAMETER, in the map's own units — what the designed resting frame is
 *  pinned to (ADR-0471). Exported so the ARRIVAL can hand these to the browser as a payload rather
 *  than shipping the whole layout engine to the client to recompute what the build already knew. */
export function islandDiameters(snap: ForestSnapshot): number[] {
  return placeStories(snap.stories).map((p) => 2 * p.radius);
}

// ── the ROAM payload ────────────────────────────────────────────────────────

/** One capability, as ROAM needs it: an id, a title, and the status the export folded. */
export interface RoamCapability {
  readonly id: string;
  readonly title: string;
  readonly status: SceneStatus;
  /**
   * WHAT THIS COMPONENT RESTS ON — the edges the island panel draws its capability graph from.
   *
   * ⚠ THE SNAPSHOT ALWAYS CARRIED THIS AND THIS FOLD USED TO DROP IT. ADR-0453 D6 named the public
   * depth floor as "Forest → island → capability tree", and until ADR-0502 the panel rendered a
   * COUNT that expanded to a text list — so the gap read as a rendering task with the data already
   * in hand. It was not quite: `forest-snapshot.json` has carried `dependsOn` per capability all
   * along, but this second fold published `id`/`title`/`status` alone, and the browser never saw an
   * edge. Widening the fold is the whole export half of the work.
   *
   * Published UNFILTERED, and the layout drops any pointer whose other end is not in the same
   * island — that is a decision about the PICTURE, not about the data, so it belongs there rather
   * than here. Measured on this snapshot every edge is already in-story (186 of 186), so the drop
   * is a guard against a future export rather than something that fires today.
   */
  readonly dependsOn: readonly string[];
}

/** The states a UAT leg's own signed verdict folds to. Narrowed on the way in, like a status. */
export type RoamUatState = 'proven' | 'pending' | 'failing';
/** Who witnesses a leg: a harness the spine owns, a person, or either. */
export type RoamWitness = 'machine' | 'human' | 'either';

const UAT_STATES: readonly RoamUatState[] = ['proven', 'pending', 'failing'];
const WITNESSES: readonly RoamWitness[] = ['machine', 'human', 'either'];

/** Narrow a leg's state, defaulting to `pending` — the reading that claims LEAST. A state this site
 *  cannot read must never borrow `proven`, on the page whose whole pitch is that green is earned. */
export function toRoamUatState(raw: unknown): RoamUatState {
  return typeof raw === 'string' && (UAT_STATES as readonly string[]).includes(raw)
    ? (raw as RoamUatState)
    : 'pending';
}

/** Narrow a leg's witness, defaulting to `either` — the parser's own default for an untagged leg,
 *  so an unreadable value reads as the weakest true claim rather than naming a person or a harness. */
export function toRoamWitness(raw: unknown): RoamWitness {
  return typeof raw === 'string' && (WITNESSES as readonly string[]).includes(raw)
    ? (raw as RoamWitness)
    : 'either';
}

/**
 * One UAT leg, as ROAM needs it — the authored step, and the verdict signed against it.
 *
 * ⚠⚠ `signable` IS WHAT STOPS THE PANEL CONTRADICTING THE ISLAND IT IS DRAWN OVER. An acceptance
 * step deliberately authored with nothing able to witness it does not hold its story's green
 * (ADR-0443 D2), so a story is legitimately GREEN while such a step carries no verdict. Measured
 * 2026-09-01 on this snapshot: five green islands have not one of their listed steps signed, and
 * `website-experience` has eight. Reading `state` alone would put "8 acceptance tests, 0 proven"
 * under a green island, and a page that appears to contradict itself is worse than either fact.
 */
export interface RoamUatCriterion {
  readonly title: string;
  readonly state: RoamUatState;
  readonly witness: RoamWitness;
  /** `false` = an authored step nothing can witness yet. A real state, never a defect. */
  readonly signable: boolean;
}

/** One story, as ROAM needs it. `status` is the SAME value the island is painted with — folded
 *  once here and read by both the picture and the panel, so the two can never disagree. */
export interface RoamStory {
  readonly id: string;
  readonly title: string;
  readonly status: SceneStatus;
  readonly capabilities: readonly RoamCapability[];
  /** The acceptance journey in AUTHORED order — the public depth floor since ADR-0494 D1. */
  readonly uat: readonly RoamUatCriterion[];
  /** Decision numbers — keys into {@link RoamPayload.decisions}, never inline records. */
  readonly decisions: readonly number[];
  /** Arc ids only — keys into {@link RoamPayload.arcs}. The exporter's `via` provenance is dropped
   *  on the way to the browser: the drawer's copy is true of both edges, so shipping the
   *  distinction would put a field on the page that no sentence reads. */
  readonly arcs: readonly string[];
}

/** One decision at title-and-identity depth (ADR-0494 D2). The body is absent because the EXPORTER
 *  never wrote it — see `SnapshotAdr` above; this shape only refuses to re-add it. */
export interface RoamAdr {
  readonly number: number;
  readonly status: string;
  readonly title: string;
}

/** One arc at title-and-shape depth (ADR-0453 D12). The prose is absent because the EXPORTER never
 *  wrote it — see `SnapshotArc` above; this shape only refuses to re-add it. */
export interface RoamArc {
  readonly id: string;
  readonly title: string;
  readonly lifecycle: string;
  readonly incrementsClosed: number;
  readonly incrementsOpen: number;
  /** Decision numbers — the same keys a story's `decisions` uses, into the same registry. */
  readonly adrs: readonly number[];
}

/** What ROAM is handed at build time. `asOf` is the SAME stamp the page prints under the map. */
export interface RoamPayload {
  readonly asOf: string;
  readonly stories: readonly RoamStory[];
  readonly arcs: readonly RoamArc[];
  /** Every decision a story or an arc names, number-sorted — one record per decision. */
  readonly decisions: readonly RoamAdr[];
}

/**
 * The facts ROAM explains, taken from the snapshot at build time.
 *
 * ⚠ IT ADDS NOTHING AND DERIVES NOTHING. Every field here is already in the snapshot, and every
 * status runs through the SAME `toSceneStatus` the island's own colour class does — so a panel
 * that says "proven" is reading the value that painted the island green, not a second opinion
 * about it. That is D7's fence (`asset:adr-0453`) held at the panel rather than merely at the
 * picture: no new status computation happens on this site, in either surface.
 *
 * ⚠ AND IT IS A BUILD-TIME PAYLOAD FOR THE SAME REASON `data-forest-counts` IS. The alternative —
 * fetching or recomputing in the browser — would put a second reader on this page, which is the
 * exact drift D7 exists to prevent, and would make the panel able to disagree with the map it is
 * drawn over.
 */
export function roamPayload(snap: ForestSnapshot): RoamPayload {
  return {
    asOf: formatStampDate(snap.generatedAt),
    stories: snap.stories.map((story) => ({
      id: story.id,
      title: story.title,
      status: toSceneStatus(story.status),
      capabilities: story.capabilities.map((cap) => ({
        id: cap.id,
        title: cap.title,
        status: toSceneStatus(cap.status),
        // The edges, published because the panel now DRAWS them (ADR-0502). Measured on this
        // snapshot: 203 capabilities, 126 of which carry at least one edge, 186 edges in all.
        dependsOn: [...cap.dependsOn],
      })),
      // The acceptance journey, in the exporter's authored order — never re-sorted here, or the
      // panel would print the steps of a walk in an order nobody walks them in.
      uat: (story.uat ?? []).map((u) => ({
        title: u.title,
        state: toRoamUatState(u.state),
        witness: toRoamWitness(u.witness),
        // Defaults to signable — the majority shape, and the one that claims nothing extra: an
        // unreadable value reads as "not yet proven", never as an authored gap.
        signable: u.signable !== false,
      })),
      // Numbers, resolved against the registry below at render time.
      decisions: [...(story.decisions ?? [])],
      // The edge only. `via` is dropped here BECAUSE it is dropped: the drawer's copy says "the
      // initiative that built this", which is true of both edges, so shipping the distinction to
      // the browser would put a field on the page with no reader and no sentence.
      arcs: (story.arcs ?? []).map((a) => a.id),
    })),
    // Named field by field, exactly as the story fold above is, and for the same reason: a spread
    // would publish whatever the exporter adds next without anyone choosing to.
    arcs: snap.arcs.map((arc) => ({
      id: arc.id,
      title: arc.title,
      lifecycle: arc.lifecycle,
      incrementsClosed: arc.incrementsClosed,
      incrementsOpen: arc.incrementsOpen,
      adrs: [...arc.adrs],
    })),
    decisions: (snap.decisions ?? []).map((d) => ({
      number: d.number,
      status: d.status,
      title: d.title,
    })),
  };
}

/**
 * The same map, prepared for chapter 2's ARRIVAL rather than for the `/forest/` poster.
 *
 * Three differences, all of them because this one is a VIEWPORT the visitor moves around in while
 * the poster is a picture in a scrolling document:
 *
 *  1. it carries `data-forest-frame`, the extent and island sizes the client needs to compute the
 *     designed resting view for whatever viewport it lands in;
 *  2. `preserveAspectRatio` is `slice`, so it fills the frame rather than letterboxing while a
 *     resize is in flight;
 *  3. its `viewBox` is the WHOLE world, which is the honest thing to serve: if the client script
 *     never runs, the visitor gets the entire forest as a static picture instead of a blank div.
 *     The crop is an enhancement, never a prerequisite;
 *  4. it carries `data-forest-counts`, which is what TELL's copy says its numbers OUT OF;
 *  5. it carries `data-forest-roam` — the story/capability facts ROAM explains when the visitor
 *     clicks. Same fence as (4) and for the same reason: the panel reads the value that painted
 *     the island, so the sentence and the picture cannot disagree.
 *
 * ⚠ (4) IS A CORRECTNESS FENCE, NOT A CONVENIENCE. TELL speaks over this map — "{proven} of them
 * are green" — and this snapshot is republished by a job, so any count written into the copy by
 * hand becomes false the first time the forest moves, on the one page whose whole pitch is that its
 * signals are real. Emitting the numbers with the picture means the sentence and the map it is
 * spoken over can never disagree: they came from the same `snap`.
 *
 * The poster's own `forestSvg` is deliberately left alone — its shape is pinned by tests and it has
 * no viewport to frame against.
 */
export function forestArrivalSvg(snap: ForestSnapshot): string {
  const input = forestSceneInput(snap);
  const label = arrivalLabel(snap);
  const frame = JSON.stringify({
    width: input.width,
    height: input.height,
    islandDiameters: islandDiameters(snap),
  });
  const counts = JSON.stringify({
    stories: snap.storyCount,
    proven: snap.provenStoryCount,
    capabilities: snap.capabilityCount,
  });
  const roam = JSON.stringify(roamPayload(snap));
  return (
    `<svg class="tw-svg forest-arrival-svg" viewBox="0 0 ${input.width} ${input.height}" ` +
    `preserveAspectRatio="xMidYMid slice" role="img" aria-label="${escXml(label)}" ` +
    `data-forest-frame="${escXml(frame)}" data-forest-counts="${escXml(counts)}" ` +
    `data-forest-roam="${escXml(roam)}">` +
    `<defs>` +
    `<radialGradient id="tw-board" cx="50%" cy="40%" r="80%">` +
    `<stop offset="0" stop-color="#fbf3ea"/><stop offset="1" stop-color="#edd9c9"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect class="tw-bg" x="0" y="0" width="${input.width}" height="${input.height}"/>` +
    sceneToSvg(buildScene(input)) +
    `</svg>`
  );
}

/** The whole map as one inert SVG string. */
export function forestSvg(snap: ForestSnapshot): string {
  const label =
    `A map of storytree's own system as of ${formatStampDate(snap.generatedAt)}: ` +
    `${snap.storyCount} story islands, ${snap.provenStoryCount} of them green because a signed ` +
    `test proved them, connected by trails where one depends on another. Not live.`;
  const input = forestSceneInput(snap);
  return (
    `<svg class="tw-svg forest-snapshot-svg" viewBox="0 0 ${input.width} ${input.height}" ` +
    `preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escXml(label)}">` +
    // the board backdrop the shared stylesheet's `.tw-bg` fills from — each host supplies
    // its own defs (the home map uses `#tw-board`, the Act 2 stage `#a2-board`).
    `<defs>` +
    `<radialGradient id="tw-board" cx="50%" cy="40%" r="80%">` +
    `<stop offset="0" stop-color="#fbf3ea"/><stop offset="1" stop-color="#edd9c9"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect class="tw-bg" x="0" y="0" width="${input.width}" height="${input.height}"/>` +
    sceneToSvg(buildScene(input)) +
    `</svg>`
  );
}
