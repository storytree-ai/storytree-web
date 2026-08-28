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

export interface SnapshotStory {
  readonly id: string;
  readonly title: string;
  readonly status: string | null;
  readonly dependsOn: readonly string[];
  readonly building?: boolean;
  readonly capabilities: readonly SnapshotCapability[];
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
}

/** The schema version this renderer understands. */
export const SUPPORTED_SCHEMA_VERSION = 1;

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
    `${proven} stories are proven — each one green because a signed test said so, not because ` +
    `anyone marked it done. This is a snapshot, refreshed from time to time. It is not live.`
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
      treeTitle: `${story.title} — ${proven} of ${capCount} capabilities proven`,
      // no wisps: a snapshot has no live session (see the file header)
      wisps: [],
      plate: {
        w: Math.max(96, story.id.length * 7.4 + 24),
        h: 30,
        rx: 7,
        idY: 14,
        subY: 26,
        idText: story.id,
        subText: capCount === 1 ? '1 capability' : `${capCount} capabilities`,
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
