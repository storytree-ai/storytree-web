// ---------------------------------------------------------------------------
// act2-walkthrough — the visitor-paced SIX-beat walkthrough ON THE REAL 2.5D MAP
// (ADR-0145), the ONE continuous walk that grows the mock website green then keeps
// going UPSTREAM into the backend + database it depends on (ADR-0150, direction
// CORRECTED by ADR-0153). STATE is the proven engine's (the synced act2-director —
// a MULTI-STORY world with dependsOn edges); the LOOK is the product's own: each
// beat folds into the shared `buildScene` scene-graph and renders through the same
// `sceneToSvg` rail the home map rides, so the walk inherits the site's `tw-*`
// vocabulary (TreeWorld.astro's global CSS) — never a re-implementation.
//
// Reached EXCLUSIVELY through the inflection seam (act1-storm's dynamic
// import('./inflection') at the transform click; inflection imports this module).
// Plain TS + DOM — NO React, NO three.js, NO WebGL anywhere here. (The director is
// imported from src/lib/forest-world-r3f, but only its PURE zod state machine —
// advance / initialState / types — never a WebGL surface; and this whole module is
// a DYNAMIC import, so it never enters index.astro's static closure — the WebGL
// wall, check:web-experience, walks the static graph from the page.)
//
// ── ADR-0153 corrections/redirections in this module (BaaS diamond by ADR-0157) ─
//  1. Direction (§1) + the BaaS DIAMOND (ADR-0157 §1). The synced director's
//     `add-upstream-story` delta carries `dependentId` (now string | string[]); each
//     named dependent's `dependsOn` gains the new story's id. So the diamond:
//     `website.dependsOn=[backend, database]`, `backend.dependsOn=[database]`,
//     `database.dependsOn=[]` (the website READS the catalog directly from the
//     database AND needs the backend for checkout). The FOLD computes each story's
//     dependency DEPTH from `dependsOn` (depth = 1 + max depth of prerequisites; a
//     story that depends on nothing is depth 0). The ANCHOR is the deepest dependent
//     (the website — the story nothing else depends on), rendered as the big disc;
//     the shallower stories (backend, database) are the smaller upstream discs it
//     rests on. The direct `website → database` edge SPANS two layers; the shared
//     trail router (routeTrails, ADR-0169) winds it clear of the backend island by
//     construction, and the render styles it as the distinct "reads directly" curve.
//  2. Spatial (§5 — frontend HIGH / foundation BELOW). y = -depth * LAYER_RISE, so
//     the website (max depth) renders HIGHEST and the database (depth 0) sits at
//     the BASE — the foundation below. The dependency edges are drawn from the
//     dependent DOWN to each prerequisite (the arrow points at what you rest on).
//  3. Real app UI + progressive disclosure (§2). The orchestrator chat dock is the
//     real-app surface — and since ADR-0165 §3 it is THE advance surface: the guide
//     (act2-orchestrator) drives next()/back() through this handle; the walk renders
//     no advance affordance of its own. The map itself is already the real render.
//  4. The corner drive-machinery overlays are RETIRED (ADR-0165 §2, accepted
//     default 5): the honest-TDD loop relocated into the growing system diagram's
//     D5 (act2-diagram.ts, from act2-loop-diagram's HONEST_LOOP), the CI/CD
//     row-lists' teach compressed into D5/D6 chat copy ("gate", "signed"), and the
//     persistent mini-map (act2-minimap.ts) replaced the corner pattern. Nothing
//     mounts over the map's corners here any more; the callout is a pure anchored
//     narration POINTER (tail + step label + title + body — no buttons, no dots).
//  5. No escape hatches (§3). No in-walk "skip the walk" jump and no path to any
//     deprecated page — the visitor-paced chat chips are the only progression;
//     Escape stays the page's global disarm to the a11y fallback (never
//     intercepted here). (ADR-0150 §4: the wrong-way road + its ghost/flag
//     furniture is RETIRED — the honest dependency layers ARE the teach.)
//  6. The wisp ORBITS (ADR-0165 §5, sharpening ADR-0157 §6's as-built drift):
//     renderScene post-processes each emitted wisp layer into an island-centred
//     orbit structure — a rotating group nested in a flattened plane (scaleY
//     0.55) so the circle reads as an ellipse lying on the 2.5D map; one lap
//     ≈ 9 s (pure CSS), the glow pulse kept; reduced-motion: stationary at a
//     fixed orbit point + pulse only. Fixed initial angle — byte-identical on
//     Back replay.
//
// Determinism: every piece of geometry and every scene string is a pure function
// of the beat data (hash/rand01 seeding — no Math.random, no wall-clock); elapsed
// time drives MOTION only (the viewBox tween). The same beat state renders the
// identical stage SVG on every visit — Back replay is byte-identical.
// ---------------------------------------------------------------------------

import {
  AXIAL_DIRS,
  HEX_R,
  LAND_CAMERA_ELEVATION_DEG,
  axialKey,
  buildRelaxedCells,
  buildScene,
  crownRadius,
  hash,
  hexCenter,
  hexCorners,
  rand01,
  routeTrails,
  smoothCoast,
  unprojectGround,
  type Axial,
  type BoundarySeg,
  type Pt,
  type RelaxedCell,
  type SceneInput,
  type ScenePlantInput,
  type SceneStatus,
  type SceneTerritoryInput,
} from '../lib/forest-world';
import { sceneToSvg } from '../lib/worldSvg';
import {
  advance,
  initialState,
  type Beat,
  type CameraTarget,
  type DirectorState,
  type StoryNode,
  type WorldState,
} from '../lib/forest-world-r3f/act2-director';

// The synced director exposes the tri-state status as the inline union on
// StoryNode.status (it exports no named StoryStatus type). Derive the alias from
// it so this stays in lockstep with the @generated director.
type StoryStatus = StoryNode['status'];
// The FICTION is site-owned (ADR-0093 fictional-data precedent): the walk plays
// the shopping-checkout script, not the director's default. The director's pure
// state machine (advance / initialState / the zod contract) is still the engine.
import {
  walkthroughScript,
  STORY_INSPECT,
  STORY_BACKEND,
  STORY_DATABASE,
  type StoryInspect,
} from './act2-script';
import { DONE_KEY, INTRO, NARRATION, type BeatNarration } from './act2-narration';

// ── the parameters (few, meaningful, named — never a knob per pixel) ─────────

/** Rings of hex tiles in the ANCHOR (website) land disc (2 → 19 tiles). */
const DISC_RINGS = 2;
/** Rings in an UPSTREAM story's disc — a smaller, younger island (1 → 7 tiles), so
 *  the proposed foundation layers read as growing, not as second full continents. */
const UPSTREAM_RINGS = 1;
/** Scene frame carried into SceneInput (the empty-land idiom). */
const SCENE_W = 1400;
const SCENE_H = 1200;
/** Where the WEBSITE island sits inside the scene frame (the anchor, TOP of the
 *  stack — the foundation layers sit BELOW it toward larger y). The offset centres
 *  the whole column comfortably given the website is highest at y = -maxDepth*RISE. */
const OFFSET: Pt = { x: 700, y: 380 };
/** The website island territory's declared radius (wisp orbit + plate sizing ride it). */
const ISLAND_R = 64;
/** An upstream island's declared radius (smaller — a younger disc). */
const UPSTREAM_R = 40;
/** Vertical rise between stacked layers (scene units, pre-offset): each layer sits
 *  this far below the one that depends on it. Sized to clear both discs' coasts AND
 *  the upper disc's nameplate row with a calm gap. */
const LAYER_RISE = 250;
/** How far capability limbs sit from the story tree, and their fan spread. */
const LIMB_RING_R = 40;
const LIMB_FAN_STEP = 0.78; // radians between limbs, fanned south of the tree
/** The website nameplate sits this far below its tree spot — FIXED so the plate
 *  never hops when the garden grows (layout stability across beats). */
const PLATE_Y = 80;
/** An upstream story's nameplate sits closer under its (smaller) tree. */
const UPSTREAM_PLATE_Y = 52;
/** Camera: zoom 0 = widest, 1 = tightest (the director's CameraTarget contract).
 *  half-width of the viewBox in scene units at the two extremes. */
const HALF_WIDE = 720;
const HALF_TIGHT = 120;
const CAMERA_MS = 1100; // viewBox tween length (motion only)
const FIT_PAD = 1.14; // a focus bbox always fits with this margin
/** Callout placement. */
const CALLOUT_GAP = 20; // px between the anchor and the callout box
const CALLOUT_MARGIN = 12; // px the callout keeps from the stage edges
/** The persistent guide chat dock (ADR-0165 §3) owns the BOTTOM band of the
 *  frame for the whole walk, so the camera centres the focused content in the
 *  VISIBLE band above it and the callout never places under the dock. A fixed
 *  reserve (matching the dock's CSS max-height, min(46vh, 420px)) keeps the
 *  geometry deterministic — no live dock measuring. */
const DOCK_RESERVE_FRAC = 0.46;
const DOCK_RESERVE_MAX_PX = 420;

/** How much of the stage height the dock reserve leaves visible (0..1). */
function visibleFrac(stageH: number): number {
  if (stageH <= 0) return 1;
  const reserve = Math.min(stageH * DOCK_RESERVE_FRAC, DOCK_RESERVE_MAX_PX);
  return Math.max(0.3, 1 - reserve / stageH);
}

/** Fold a director tri-state story status → the scene's visual status. proven →
 *  green (healthy), building → sapling (proposed), broken → withered (unhealthy).
 *  The mapping the pull-back legend reads (ADR-0150 honest legend). */
function sceneStatusOf(status: StoryStatus): SceneStatus {
  switch (status) {
    case 'proven':
      return 'healthy';
    case 'broken':
      return 'unhealthy';
    case 'building':
    default:
      return 'proposed';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE FOLD — pure functions of the director's multi-story world + the script
// ─────────────────────────────────────────────────────────────────────────────

export interface LimbMeta {
  id: string;
  label: string;
  green: boolean;
  signedProof: string | undefined;
  pos: Pt;
}

export interface RoadMeta {
  /** The dependent story (the one that NEEDS — higher in the stack). */
  from: string;
  /** The prerequisite story (what is depended ON — lower in the stack). */
  to: string;
  /** How many dependency layers this edge spans (|depth(from) − depth(to)|).
   *  1 = an adjacent layer. ≥2 = a LAYER-SKIPPING edge — the BaaS direct
   *  `website → database` read edge (ADR-0157 §1); its tooltip reads "reads
   *  directly", and the render styles its trail segments distinctly (keyed by
   *  the segments' data-edges). The GEOMETRY is the shared engine's now
   *  (routeTrails, ADR-0169) — island-avoiding, procedural, never hand-bowed. */
  span: number;
}

/** One folded story territory — everything the stage + the callout anchoring + the
 *  inspect affordance need, keyed by the director's story id. */
export interface TerritoryMeta {
  id: string;
  label: string;
  status: StoryStatus;
  /** Dependency DEPTH (0 = depends on nothing → the foundation/base; higher =
   *  depends on deeper stories → renders higher up the map). The website is the
   *  maximum depth (it depends on the backend which depends on the database). */
  depth: number;
  /** True for an inspectable PROPOSED upstream story (backend / database) — i.e.
   *  everything that is NOT the anchor website. */
  upstream: boolean;
  centre: Pt; // this disc's centre (scene space, pre-offset)
  treeSpot: Pt;
  radius: number;
  plateY: number;
  hasWisp: boolean;
  limbs: LimbMeta[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FoldedWorld {
  sceneInput: SceneInput;
  /** True before beat 1: the land is empty. The synthetic ground territory still
   *  exists in the scene graph (a territory always emits a tree), so the pre-story
   *  render suppresses the flora/hits layers via the `is-prestory` class. */
  preStory: boolean;
  /** The folded story territories, in insertion order (website first). */
  territories: TerritoryMeta[];
  roads: RoadMeta[];
  /** The website (anchor) disc's ground bounds (scene space, pre-offset) — the
   *  camera + intro anchor. */
  islandRect: Rect;
  /** Everything drawn (all discs + labels) — the full-forest frame. */
  contentRect: Rect;
}

/** All axial tiles within `radius` rings of the origin (a disc). */
export function discTiles(radius: number): Axial[] {
  const tiles: Axial[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      tiles.push({ q, r });
    }
  }
  return tiles;
}

const f = (n: number): string => n.toFixed(1);

/** One disc's geometry, built at the origin then TRANSLATED to `centre` — the
 *  cells, the smoothed coast, the tree spot, and the fixed ground decor/wheat.
 *  Pure + deterministic: seeded by a FIXED per-story id, so the ground never
 *  changes when a beat renames or greens the territory. */
export interface DiscGeometry {
  cells: RelaxedCell[];
  coastPaths: string[];
  treeSpot: Pt;
  decor: { x: number; y: number; seed: number }[];
  /** Ground bounds (scene space, pre-offset, already translated to centre). */
  rect: Rect;
}

/** Exported for the Phase-Z studio layer (act2-studio.ts): its hand-authored
 *  multi-island scene builds every disc through THIS generator, so the studio
 *  forest and the walked island share one geometry source. */
/** What {@link discGround} decides: which tiles carry a decor conifer, and which are wheat. */
export interface DiscGround {
  readonly decor: Axial[];
  readonly wheat: Set<string>;
}

/**
 * THE DISC'S FIXED GROUND — decor conifers + wheat patches, seeded by TILE KEY only (never the
 * story status), so the ground never changes between beats.
 *
 * ⚠ SPLIT OUT OF `buildDisc` SO THE CAMERA CAN BE VARIED (`ground-space-truth-arc`). The
 * `nearTree` keep-out below was the LAST unfixed instance of the ADR-0367 screen-space-distance
 * class, and the only one outside the synced engine core — PR #1356 fixed every site inside
 * `packages/forest-world/src`, which reaches this repo through a wholesale sync, and could not
 * touch this file. Its own increment is `website-decor-proximity-moves-to-ground-space`.
 *
 * WHAT WAS WRONG. `Math.hypot(c.x - cx, c.y - (cy - 6)) < 42` measured the tile's separation from
 * the tree on the SCREEN. ADR-0367 D1's camera foreshortens the ground by `sin 20° ≈ 0.342`, so a
 * screen threshold OVER-enforces on the vertical axis: `groundGap >= hypot` always holds, and the
 * failure mode is starvation, never wrongful admission. Measured over the ten discs this site
 * actually builds, the shipping predicate yields 16 conifers in plan view and 15 at the declared
 * camera; the ground-space form below yields 16 at every elevation. Small, and entirely one-way —
 * the camera can only ever take conifers away.
 *
 * THE `- 6` IS LEFT EXACTLY WHERE IT WAS, deliberately. It is the tree sprite's own anchor nudge
 * (`treeSpot`, below), and whether it means six screen pixels or six ground units is a question
 * this fix does not answer and must not silently decide: unprojecting the delta as a whole is the
 * faithful "same test, correct space" translation, and nothing else about the predicate moves.
 *
 * `inGarden` STAYS IN SCREEN SPACE and that is not an oversight — it is the southern band the
 * tree's limbs and the name plate occupy, both of which are screen art drawn at a fixed pixel size,
 * exactly like the nameplate band `packages/forest-world/src/scene.ts` keeps in screen space for
 * the same reason.
 */
export function discGround(
  tiles: readonly Axial[],
  cx: number,
  cy: number,
  seedId: string,
  elevationDeg: number = LAND_CAMERA_ELEVATION_DEG,
): DiscGround {
  const decor: Axial[] = [];
  const wheat = new Set<string>();
  for (const tile of tiles) {
    const key = axialKey(tile);
    const c = hexCenter(tile, { elevationDeg });
    const roll = rand01(hash(`${seedId}:dec:${key}`));
    // ground-space: how far this tile stands from the tree ACROSS THE GROUND — unproject the
    // separation before measuring it, or the camera silently culls conifers (ADR-0367 D1).
    const toTree = unprojectGround({ x: c.x - cx, y: c.y - (cy - 6) }, elevationDeg);
    const nearTree = Math.hypot(toTree.x, toTree.y) < 42;
    const inGarden = c.y > cy + 8; // SCREEN: the band the limbs + name plate own (see above)
    if (roll < 0.42 && !nearTree && !inGarden) decor.push(tile);
    else if (roll >= 0.42 && roll < 0.62 && !nearTree) wheat.add(key);
  }
  return { decor, wheat };
}

export function buildDisc(centre: Pt, rings: number, seedId: string): DiscGeometry {
  const tiles = discTiles(rings);
  // Never `tiles.map(hexCenter)`: `Array.prototype.map` calls its callback `(element, index,
  // array)`, so the bare form feeds each tile's ARRAY INDEX into `hexCenter`'s options slot
  // (ADR-0367 D1's `['1','2'].map(parseInt)` trap, which the synced `hex.ts` documents at length).
  const centres = tiles.map((h) => hexCenter(h));
  const cx = centres.reduce((s, c) => s + c.x, 0) / centres.length;
  const cy = centres.reduce((s, c) => s + c.y, 0) / centres.length;
  // translate everything so the disc's own centroid lands on `centre`.
  const dx = centre.x - cx;
  const dy = centre.y - cy;
  const tr = (p: Pt): Pt => ({ x: p.x + dx, y: p.y + dy });

  const treeSpot: Pt = tr({ x: cx, y: cy - 6 });

  // fixed ground: decor conifers + wheat patches — the decision itself lives in `discGround`,
  // which measures the tree keep-out on the GROUND rather than on the screen (see its doc).
  const { decor: decorTiles, wheat } = discGround(tiles, cx, cy, seedId);
  const decor = decorTiles.map((tile) => {
    const t = tr(hexCenter(tile));
    return { x: t.x, y: t.y, seed: hash(`${seedId}:${axialKey(tile)}:f`) };
  });

  // the mesh ground over the disc — the same shared-core call the home map makes
  // (`buildRelaxedCells(..., 'mesh')`), owner 0, then translated to centre.
  const drawTiles = tiles.map((h) => ({ h, owner: 0 }));
  const cells = buildRelaxedCells(drawTiles, [wheat], 'mesh').map((c) => ({
    ...c,
    poly: c.poly.map(tr),
  }));

  // the smoothed organic coastline of the disc (the exact home-map recipe), seeded
  // by the FIXED disc id — the coast belongs to the land, not the story, so it
  // cannot pop when a beat renames the territory. Built at origin then translated
  // (smoothCoast works on raw segments).
  const mine = new Set(tiles.map(axialKey));
  const segs: BoundarySeg[] = [];
  for (const tile of tiles) {
    const c = hexCenter(tile);
    const cor = hexCorners(c.x, c.y, HEX_R);
    AXIAL_DIRS.forEach((d, e) => {
      if (mine.has(axialKey({ q: tile.q + d.q, r: tile.r + d.r }))) return;
      const a = cor[e];
      const b = cor[(e + 1) % 6];
      if (a && b) segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    });
  }
  const rawCoast = smoothCoast(segs, seedId).loops;
  const coastPaths = rawCoast.map(
    (loop) =>
      loop.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p.x + dx)} ${f(p.y + dy)}`).join(' ') + ' Z',
  );

  // ground bounds (translated): a disc of `rings` spans ± (rings*HEX_W + HEX_R)
  // horizontally and ± (rings*1.5*HEX_R + HEX_R) vertically, with coast margin.
  const halfW = rings * Math.sqrt(3) * HEX_R + HEX_R + 8;
  const halfH = rings * 1.5 * HEX_R + HEX_R + 8;
  const rect: Rect = {
    x: centre.x - halfW,
    y: centre.y - halfH,
    w: halfW * 2,
    h: halfH * 2,
  };

  return { cells, coastPaths, treeSpot, decor, rect };
}

/**
 * THE FOLD: the director's accumulated multi-story WorldState + the script → a
 * fresh SceneInput (the beat-driven rebuild). Each story becomes its own
 * territory, placed by dependency DEPTH — the website (deepest dependent) at the
 * TOP, the layers it depends on stacked BELOW it (foundation below; ADR-0153 §5) —
 * plus the dependency edges and the site metadata the scene cannot carry. Pure and
 * deterministic.
 */
export function foldWorldToScene(world: WorldState, _script: Beat[]): FoldedWorld {
  const stories = world.stories;
  const preStory = stories.length === 0;

  // ── assign each story a dependency DEPTH from its dependsOn chain ──
  // depth(s) = 1 + max depth of the stories s dependsOn; a story that depends on
  // nothing is depth 0 (the foundation). Because dependsOn now points FROM the
  // dependent TO its prerequisite (ADR-0058 / ADR-0153), the website (which depends
  // on the backend which depends on the database) is the MAX depth — the anchor.
  const byId = new Map(stories.map((s) => [s.id, s] as const));
  const depthCache = new Map<string, number>();
  const depthOf = (s: StoryNode, seen: Set<string> = new Set()): number => {
    const cached = depthCache.get(s.id);
    if (cached !== undefined) return cached;
    if (seen.has(s.id)) return 0; // cycle guard (never expected in the fiction)
    seen.add(s.id);
    let base = -1;
    for (const dep of s.dependsOn) {
      const d = byId.get(dep);
      if (d) base = Math.max(base, depthOf(d, seen));
    }
    const depth = base + 1;
    depthCache.set(s.id, depth);
    return depth;
  };

  // the ANCHOR is the website: the deepest dependent (the story nothing else in the
  // stack depends on). Fall back to the first-planted story if depths tie (they
  // don't in the linear fiction). Rendered as the big disc, at the top.
  const maxDepth = stories.reduce((m, s) => Math.max(m, depthOf(s)), 0);
  const anchorStory = stories.find((s) => depthOf(s) === maxDepth) ?? stories[0];
  const anchorId = anchorStory?.id;

  // ── fold each story into a territory (disc geometry + limbs) ──
  const territories: TerritoryMeta[] = stories.map((s) => {
    const depth = depthOf(s);
    const upstream = s.id !== anchorId;
    const rings = upstream ? UPSTREAM_RINGS : DISC_RINGS;
    const radius = upstream ? UPSTREAM_R : ISLAND_R;
    const plateY = upstream ? UPSTREAM_PLATE_Y : PLATE_Y;
    // stacked straight up by DEPTH: the website (max depth) is highest (smallest
    // y); each less-deep layer sits LAYER_RISE lower (larger y) — the foundation
    // below (ADR-0153 §5). x stays 0 so the stack reads as a vertical column.
    const centre: Pt = { x: 0, y: -depth * LAYER_RISE };
    const disc = buildDisc(centre, rings, `act2-disc-${s.id}`);

    const limbs: LimbMeta[] = s.limbs.map((limb, i) => {
      const n = s.limbs.length;
      const a = Math.PI / 2 + (i - (n - 1) / 2) * LIMB_FAN_STEP;
      const r = LIMB_RING_R + (rand01(hash(`${limb.id}:ring`)) - 0.5) * 8;
      return {
        id: limb.id,
        label: limb.label,
        green: limb.green,
        signedProof: limb.signedProof,
        pos: {
          x: disc.treeSpot.x + Math.cos(a) * r * 1.2,
          y: disc.treeSpot.y + Math.sin(a) * r * 0.85 + 8,
        },
      };
    });

    return {
      id: s.id,
      label: s.label,
      status: s.status,
      depth,
      upstream,
      centre,
      treeSpot: disc.treeSpot,
      radius,
      plateY,
      hasWisp: s.hasWisp,
      limbs,
    };
  });
  const terrById = new Map(territories.map((t) => [t.id, t] as const));

  // ── the dependency edges: each edge runs from the DEPENDENT story (higher up)
  //    DOWN to its PREREQUISITE (lower/foundation). dependsOn now points FROM the
  //    dependent TO its prerequisite (ADR-0153), so for each story s and each dep
  //    in s.dependsOn we declare s → dep. This reads "the website NEEDS the
  //    backend NEEDS the database" (UAT 2/3). data-from = the dependent (upper),
  //    data-to = the prerequisite (lower); the tooltip reads "<dependent> needs
  //    <prereq>". The GEOMETRY is no longer bowed here: the shared trail router
  //    (routeTrails, ADR-0169) routes every edge procedurally — island-avoiding,
  //    so the layer-skipping BaaS edge (span ≥ 2, the direct website → database
  //    read, ADR-0157 §1) winds AROUND the intervening backend island by
  //    construction, never through it. ──
  const roads: RoadMeta[] = [];
  for (const s of stories) {
    const upper = terrById.get(s.id); // the dependent (higher up)
    if (!upper) continue;
    for (const depId of s.dependsOn) {
      const lower = terrById.get(depId); // the prerequisite (lower/foundation)
      if (!lower) continue;
      roads.push({ from: s.id, to: depId, span: Math.abs(upper.depth - lower.depth) });
    }
  }

  // ── assemble the SceneInput: one territory per story (owner index = insertion
  //    order), each disc's cells tagged with that owner. ──
  const allCells: RelaxedCell[] = [];
  const sceneTerritories: SceneTerritoryInput[] = [];

  territories.forEach((t, owner) => {
    const disc = buildDisc(t.centre, t.upstream ? UPSTREAM_RINGS : DISC_RINGS, `act2-disc-${t.id}`);
    for (const c of disc.cells) allCells.push({ ...c, owner });

    const storyStatus = sceneStatusOf(t.status);

    const plants: ScenePlantInput[] = t.limbs.map((l) => ({
      id: l.id,
      status: (l.green ? 'healthy' : 'proposed') as SceneStatus,
      x: l.pos.x,
      y: l.pos.y,
      title: l.green
        ? `${l.label} — proven (signed proof ${l.signedProof ?? ''})`
        : `${l.label} — in progress, no signed proof yet`,
    }));

    const plateW = Math.max(t.upstream ? 150 : 120, t.label.length * 7.6 + 26);
    const subText = t.upstream ? 'a story you depend on' : 'a story';
    const treeTitle =
      t.status === 'proven'
        ? `${t.label} — a story, proven`
        : `${t.label} — a story, proposed (not yet built)`;

    sceneTerritories.push({
      id: t.id,
      status: storyStatus,
      caps: t.limbs.length,
      centroid: t.centre,
      radius: t.radius,
      treeSpot: t.treeSpot,
      labelY: t.centre.y + t.plateY,
      coastPaths: disc.coastPaths,
      decor: disc.decor,
      plants,
      treeTitle,
      wisps: t.hasWisp
        ? [{ runId: `walk:${t.id}`, title: 'an agent at work — you can look away' }]
        : [],
      plate: {
        w: plateW,
        h: 34,
        rx: 7,
        idY: 15,
        subY: 28,
        idText: t.label,
        subText,
        title: t.label,
      },
    });
  });

  // pre-story: a single dormant ground disc so the empty land still has soil.
  if (preStory) {
    const disc = buildDisc({ x: 0, y: 0 }, DISC_RINGS, 'act2-disc-first-light');
    for (const c of disc.cells) allCells.push({ ...c, owner: 0 });
    sceneTerritories.push({
      id: 'first-light',
      status: 'proposed',
      caps: 0,
      centroid: { x: 0, y: 0 },
      radius: ISLAND_R,
      treeSpot: disc.treeSpot,
      labelY: PLATE_Y,
      coastPaths: disc.coastPaths,
      decor: disc.decor,
      plants: [],
      treeTitle: '',
      wisps: [],
      plate: { w: 120, h: 34, rx: 7, idY: 15, subY: 28, idText: '', subText: '', title: '' },
    });
  }

  // the trail network through the SHARED router (ADR-0169 §1): the stacked story
  // discs as obstacle islands, the declared dependency edges, a fixed seed —
  // procedural, never hand-forged `d` strings. Tooltips keep the walk's honest
  // vocabulary: the layer-skipping edge is the BaaS direct read (ADR-0157 §1).
  const trails = routeTrails(
    territories.map((t) => ({ id: t.id, x: t.centre.x, y: t.centre.y, r: t.radius })),
    roads.map((r) => {
      const fromLabel = terrById.get(r.from)?.label ?? r.from;
      const toLabel = terrById.get(r.to)?.label ?? r.to;
      const title =
        r.span >= 2
          ? `${fromLabel} reads directly from ${toLabel}`
          : `${fromLabel} needs ${toLabel}`;
      return { from: r.from, to: r.to, title };
    }),
    'act2-walk-trails',
  );

  const sceneInput: SceneInput = {
    offset: { x: OFFSET.x, y: OFFSET.y },
    width: SCENE_W,
    height: SCENE_H,
    empties: [],
    relaxedCells: allCells,
    drawTiles: [],
    wheatSets: [],
    trails,
    territories: sceneTerritories,
  };

  // ── bounds ──
  const anchor = territories.find((t) => !t.upstream) ?? territories[0];
  const islandRect: Rect = anchor
    ? buildDisc(anchor.centre, DISC_RINGS, `act2-disc-${anchor.id}`).rect
    : { x: -124, y: -116, w: 248, h: 232 };

  // content bounds = union of every disc's rect + its plate row.
  let minX = islandRect.x;
  let maxX = islandRect.x + islandRect.w;
  let minY = islandRect.y;
  let maxY = islandRect.y + islandRect.h;
  const src = preStory
    ? [{ centre: { x: 0, y: 0 }, upstream: false, plateY: PLATE_Y }]
    : territories;
  for (const t of src) {
    const rings = t.upstream ? UPSTREAM_RINGS : DISC_RINGS;
    const halfW = rings * Math.sqrt(3) * HEX_R + HEX_R + 24;
    const halfH = rings * 1.5 * HEX_R + HEX_R + 8;
    minX = Math.min(minX, t.centre.x - halfW);
    maxX = Math.max(maxX, t.centre.x + halfW);
    minY = Math.min(minY, t.centre.y - halfH);
    maxY = Math.max(maxY, t.centre.y + t.plateY + 40);
  }
  const contentRect: Rect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

  return { sceneInput, preStory, territories, roads, islandRect, contentRect };
}

/** The anchor (website) territory, if present. */
function anchorTerr(fold: FoldedWorld): TerritoryMeta | undefined {
  return fold.territories.find((t) => !t.upstream) ?? fold.territories[0];
}

/** The territory for a specific story id, if present. */
function terrOf(fold: FoldedWorld, id: string): TerritoryMeta | undefined {
  return fold.territories.find((t) => t.id === id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE STAGE — scene string + the viewBox camera
// ─────────────────────────────────────────────────────────────────────────────

export const escXml = (s: unknown): string =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** The stage svg for one beat state: the worldSvg shell pattern with act2's own
 *  defs ids (`a2-*`, so nothing depends on the hidden home-map svg), then the
 *  walked scene-graph. Pure string of the fold. */
function stageSvg(fold: FoldedWorld, beatIndex: number, viewBox: string): string {
  const scene = sceneToSvg(buildScene(fold.sceneInput));

  const label =
    'A staged map of fictional stories growing on quiet ground — the same look as the real ' +
    'storytree map. Nothing here is live; each reply you tap adds one idea.';
  return (
    `<svg class="tw-svg act2-svg${fold.preStory ? ' is-prestory' : ''}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="group" aria-roledescription="illustrated map" aria-label="${escXml(label)}" data-act2-beat="${beatIndex}">` +
    `<defs>` +
    `<radialGradient id="a2-board" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="#fbf3ea"/><stop offset="1" stop-color="#edd9c9"/></radialGradient>` +
    `</defs>` +
    `<rect class="tw-bg act2-bg" x="0" y="0" width="${SCENE_W}" height="${SCENE_H}"/>` +
    scene +
    `</svg>`
  );
}

/** What each beat ADDS over the previous one — the groups that wear the enter
 *  animation on arrival (a pure function of the beat index, so a Back-replay
 *  re-renders the identical DOM and replays the same growth). `scale` is only ever
 *  put on transform-attribute-free groups (a CSS transform would clobber an SVG
 *  transform attribute); everything else fades. */
function enterSelectorsFor(beatIndex: number): { scale: string[]; fade: string[] } {
  switch (beatIndex) {
    case 1:
      return { scale: ['.tw-flora-layer .tw-terr'], fade: [] };
    case 2:
      return { scale: [], fade: ['.tw-wisps'] };
    case 3:
      return { scale: [], fade: ['.tw-flora-layer .tw-flora'] };
    case 4:
    case 5:
      // the newest upstream disc (its ground + coast + tree) fades/scales in; the
      // trail network (re-routed whole for the grown world) fades in with it.
      return { scale: [], fade: ['.tw-trails'] };
    default:
      return { scale: [], fade: [] };
  }
}

// ── the camera: a beat's declared CameraTarget → a viewBox rect ──────────────

interface CamRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Resolve a semantic focus anchor to a scene rect (pre-offset). The synced
 *  director emits: story-tree, upstream-backend, upstream-database, full-forest,
 *  origin (ADR-0153). */
function focusRect(fold: FoldedWorld, focus: string): Rect {
  switch (focus) {
    case 'story-tree': {
      // the anchor (website) tree + its plate row.
      const anchor = anchorTerr(fold);
      if (!anchor) return fold.islandRect;
      const caps = anchor.limbs.length;
      const treeTop = anchor.treeSpot.y - (2.72 * crownRadius(caps) + 18);
      const plateBottom = anchor.centre.y + anchor.plateY + 36;
      const w = 240;
      return { x: -w / 2, y: treeTop - 8, w, h: plateBottom - treeTop + 16 };
    }
    case 'upstream-backend':
    case 'upstream-database': {
      // frame the newest upstream layer together with the website above it, so a
      // new foundation layer coming into view reads as "this sits below what I
      // already have" (the growing stack). Falls back to the content bounds.
      const id = focus === 'upstream-backend' ? STORY_BACKEND : STORY_DATABASE;
      const t = terrOf(fold, id);
      const anchor = anchorTerr(fold);
      if (t && anchor) {
        const halfW = UPSTREAM_RINGS * Math.sqrt(3) * HEX_R + HEX_R + 24;
        const top = anchor.treeSpot.y - (2.72 * crownRadius(anchor.limbs.length) + 18);
        const bottom = t.centre.y + t.plateY + 40;
        const left = Math.min(-halfW, t.centre.x - halfW);
        const right = Math.max(halfW, t.centre.x + halfW);
        return { x: left, y: top - 8, w: right - left, h: bottom - top + 16 };
      }
      return fold.contentRect;
    }
    case 'full-forest':
      return fold.contentRect;
    case 'origin':
    default:
      return fold.islandRect;
  }
}

/** The declared CameraTarget → an aspect-matched viewBox rect (absolute scene
 *  coordinates). zoom 0 = widest, 1 = tightest; the focus bbox always fits —
 *  inside the VISIBLE band above the persistent chat dock (`vf` = the visible
 *  fraction of the stage height): the fit constraint tightens by 1/vf and the
 *  focus centres in the band, not the occluded full frame. */
function cameraRect(fold: FoldedWorld, cam: CameraTarget, aspect: number, vf: number): CamRect {
  const rect = focusRect(fold, cam.focus);
  const cxa = rect.x + rect.w / 2 + OFFSET.x;
  const cya = rect.y + rect.h / 2 + OFFSET.y;
  const zoom = Math.min(1, Math.max(0, cam.zoom));
  let halfW = HALF_WIDE - zoom * (HALF_WIDE - HALF_TIGHT);
  halfW = Math.max(halfW, (rect.w / 2) * FIT_PAD, ((rect.h / 2) * FIT_PAD * aspect) / vf);
  const halfH = halfW / aspect;
  // centre the focus in the visible band: its centre sits at y + halfH*vf.
  return { x: cxa - halfW, y: cya - halfH * vf, w: halfW * 2, h: halfH * 2 };
}

const vbString = (r: CamRect): string => `${f(r.x)} ${f(r.y)} ${f(r.w)} ${f(r.h)}`;

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE PACING UI + the mount (plain DOM, the act1-storm idiom)
// ─────────────────────────────────────────────────────────────────────────────

export interface WalkthroughHandle {
  unmount(): void;
  /** Advance one beat programmatically — the guide chat's reply chips
   *  (ADR-0165 §3) are thin wrappers around the same advance() the retired Next
   *  button called; at the final beat (director.done) one more next() enters
   *  the landed done/CTA state. */
  next(): void;
  /** Step one beat back — pure replay (stateAt re-applies the director from
   *  zero; the fold re-renders byte-identical scenes). In the done/CTA state,
   *  the first back() leaves it (the landed leaveCta), the next steps a beat. */
  back(): void;
  /** Reveal the beat callout that {@link WalkthroughOptions.deferCallout}
   *  suppressed — called at the island handoff (I1), once the growing diagram
   *  compacts and the map becomes the focus. */
  revealCallout(): void;
}

export interface WalkthroughOptions {
  /** Jump-cut everything (camera, growth, the stage fade) — the visitor prefers
   *  reduced motion. Read once by the caller at begin. */
  reducedMotion: boolean;
  /** Keep the beat callout hidden until {@link WalkthroughHandle.revealCallout} is
   *  called — the walk mounts UNDER the guide chat + growing diagram (ADR-0165
   *  Phase D) and its narration must not compete until the island handoff (I1).
   *  Defaults to false. */
  deferCallout?: boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** SVG namespace for the orbit post-process (renderScene builds the orbit
 *  wrapper nodes directly — the scene string stays the fold's). */
const SVGNS = 'http://www.w3.org/2000/svg';

/** One wisp-bearing territory's orbit parameters for {@link orbitWispLayers}. */
export interface OrbitWispEntry {
  /** The territory's declared radius — the orbit ring rides it (r·0.72 + 10,
   *  the same idiom anchorFor's beat-2 rect uses). */
  radius: number;
  /** Optional FIXED initial angle (degrees): a static `rotate(θ)` wrapper
   *  INSIDE the flattened plane, so two orbits read at distinct points — and
   *  the phase holds under reduced motion (the wisp rests there). Omitted =
   *  exactly the run-1 structure, no wrapper (the walk's single wisp). */
  phaseDeg?: number;
}

/**
 * The wisp ORBIT post-process (ADR-0165 §5), shared by the walk's renderScene
 * and the Phase-Z studio layer (act2-studio.ts): rebuild each emitted
 * `.tw-wisps` layer (one per wisp-bearing territory, in territory order) into
 * an island-centred orbit structure — a plane flattened to the 2.5D tilt
 * (scaleY 0.55) holding a rotating group; the scene's own offset group
 * (translate(orbitR 0)) IS the carrier, so the wisp rides the ring the scene
 * already declared. A faint dashed orbit ring makes the path legible; an
 * invisible symmetric extent circle keeps the spin group's fill-box
 * transform-origin at the true centre. The rotation itself is pure CSS on
 * `.act2-orbit-spin` (fixed initial angle — byte-identical on Back replay;
 * reduced-motion: no rotation, the wisp rests at its fixed orbit point with
 * the glow pulse only).
 */
export function orbitWispLayers(scope: ParentNode, entries: readonly OrbitWispEntry[]): void {
  const wispLayers = scope.querySelectorAll<SVGGElement>('.tw-wisps');
  wispLayers.forEach((layer, i) => {
    const entry = entries[i];
    const orbitR = (entry ? entry.radius : ISLAND_R) * 0.72 + 10;
    const plane = document.createElementNS(SVGNS, 'g');
    plane.setAttribute('class', 'act2-orbit-plane');
    // the layer sits at the territory centroid; the tree spot is 6 above it.
    plane.setAttribute('transform', 'translate(0 -6) scale(1 0.55)');
    const spin = document.createElementNS(SVGNS, 'g');
    spin.setAttribute('class', 'act2-orbit-spin');
    const extent = document.createElementNS(SVGNS, 'circle');
    extent.setAttribute('r', f(orbitR + 17));
    extent.setAttribute('fill', 'none');
    extent.setAttribute('stroke', 'none');
    const ring = document.createElementNS(SVGNS, 'circle');
    ring.setAttribute('class', 'act2-orbit-ring');
    ring.setAttribute('r', f(orbitR));
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', 'rgba(217, 164, 65, 0.18)');
    ring.setAttribute('stroke-width', '1.4');
    ring.setAttribute('stroke-dasharray', '3 7');
    spin.append(extent, ring);
    while (layer.firstChild) spin.appendChild(layer.firstChild);
    spin
      .querySelectorAll(':scope > .tw-wisp > g')
      .forEach((c) => c.classList.add('act2-orbit-carrier'));
    if (entry !== undefined && entry.phaseDeg !== undefined) {
      const phase = document.createElementNS(SVGNS, 'g');
      phase.setAttribute('class', 'act2-orbit-phase');
      phase.setAttribute('transform', `rotate(${f(entry.phaseDeg)})`);
      phase.appendChild(spin);
      plane.appendChild(phase);
    } else {
      plane.appendChild(spin);
    }
    layer.appendChild(plane);
  });
}

/** Replay the pure director from zero to `n` beats (Back is cheap by design). */
function stateAt(n: number, script: Beat[]): DirectorState {
  let s = initialState;
  for (let i = 0; i < n; i++) s = advance(s, script);
  return s;
}

/** The per-beat callout anchor, in scene space (pre-offset): the exact map element
 *  the beat teaches. Also names the DOM selector the witness can hold the anchoring
 *  against. */
function anchorFor(fold: FoldedWorld, beatIndex: number): { rect: Rect; selector: string } {
  const anchor = anchorTerr(fold);
  const orbitR = ISLAND_R * 0.72 + 10;
  switch (beatIndex) {
    case 1: {
      if (!anchor) return { rect: fold.islandRect, selector: '.tw-land' };
      const top = anchor.treeSpot.y - (2.72 * crownRadius(anchor.limbs.length) + 18);
      return {
        rect: { x: -120, y: top, w: 240, h: anchor.centre.y + PLATE_Y + 34 - top },
        selector: '.tw-flora-layer .tw-terr',
      };
    }
    case 2: {
      const cy = anchor?.treeSpot.y ?? 0;
      return {
        rect: { x: -orbitR - 14, y: cy - orbitR - 14, w: orbitR * 2 + 28, h: orbitR * 2 + 28 },
        selector: '.tw-wisps',
      };
    }
    case 3: {
      const green = anchor?.limbs.find((l) => l.green);
      const p = green?.pos ?? anchor?.treeSpot ?? { x: 0, y: 0 };
      return {
        rect: { x: p.x - 16, y: p.y - 22, w: 32, h: 34 },
        selector: green ? `.tw-flora[data-id="${green.id}"]` : '.tw-terr',
      };
    }
    case 4: {
      // the newest upstream story (the backend) — anchor on its tree/disc.
      const t = terrOf(fold, STORY_BACKEND);
      if (t) {
        const halfW = UPSTREAM_RINGS * Math.sqrt(3) * HEX_R + HEX_R + 20;
        return {
          rect: { x: t.centre.x - halfW, y: t.centre.y - halfW, w: halfW * 2, h: halfW * 2 + 30 },
          selector: `.tw-terr[data-id="${t.id}"]`,
        };
      }
      return { rect: fold.contentRect, selector: '.tw-trails' };
    }
    case 5: {
      // the database (the base) — anchor on it.
      const t = terrOf(fold, STORY_DATABASE);
      if (t) {
        const halfW = UPSTREAM_RINGS * Math.sqrt(3) * HEX_R + HEX_R + 20;
        return {
          rect: { x: t.centre.x - halfW, y: t.centre.y - halfW, w: halfW * 2, h: halfW * 2 + 30 },
          selector: `.tw-terr[data-id="${t.id}"]`,
        };
      }
      return { rect: fold.contentRect, selector: '.act2-svg' };
    }
    case 6:
      return { rect: fold.contentRect, selector: '.act2-svg' };
    case 0:
    default:
      return { rect: fold.islandRect, selector: '.tw-land' };
  }
}

/**
 * Mount the walkthrough into the land layer. One container in, one unmount() out —
 * the inflection seam chains it into the page's existing disarm path (Escape / the
 * global disarm), so teardown is total.
 */
export function mountWalkthrough(land: HTMLElement, opts: WalkthroughOptions): WalkthroughHandle {
  const script = walkthroughScript;
  const reducedMotion = opts.reducedMotion;

  // ── state ──
  let director = initialState;
  let cta = false;
  let disposed = false;
  // While the orchestrator chat dock is up (ADR-0148 §2), the beat callout is
  // suppressed so the two do not compete; revealCallout() lifts it.
  let calloutDeferred = opts.deferCallout === true;
  // The inspect panel's open story id (null = closed). Only proposed upstream
  // stories are inspectable (STORY_INSPECT keys).
  let inspectId: string | null = null;

  // ── the stage scaffold (plain DOM; styled by index.astro's global CSS) ──
  const stage = el('div', 'act2-stage');
  stage.setAttribute('data-act2-stage', '');
  stage.setAttribute('role', 'group');
  stage.setAttribute('aria-label', 'Guided walkthrough — a staged story map, one step per tap');

  const canvas = el('div', 'act2-canvas');
  canvas.setAttribute('data-act2-canvas', '');

  // the anchored callout box — a pure narration POINTER since ADR-0165 §3:
  // tail + head step label + title + body (+ the inspect prompt / pull-back
  // legend). No Next, no Back, no dots — the chat chips advance the walk.
  const callout = el('div', 'act2-callout');
  callout.setAttribute('data-act2-callout', '');
  callout.setAttribute('role', 'group');
  callout.setAttribute('aria-label', 'Walk narration');
  const tail = el('div', 'act2-tail');
  tail.setAttribute('aria-hidden', 'true');
  const head = el('div', 'act2-head');
  const step = el('p', 'act2-step');
  step.setAttribute('data-act2-step', '');
  head.append(step);
  const voice = el('div', 'act2-voice');
  voice.setAttribute('aria-live', 'polite');
  const title = el('h2', 'act2-title');
  const body = el('p', 'act2-body');
  voice.append(title, body);
  // an inline "inspect" prompt shown on the upstream-reveal beats (UAT 5) — the
  // primary way in; the tree itself is also clickable (bound in renderScene).
  const inspectPrompt = el('button', 'act2-inspect-open');
  inspectPrompt.type = 'button';
  inspectPrompt.setAttribute('data-act2-inspect-open', '');
  inspectPrompt.hidden = true;
  voice.append(inspectPrompt);
  // the beat-6 legend (site furniture, shown only on the pull-back)
  const legend = el('ul', 'act2-legend');
  legend.setAttribute('aria-label', 'How to read the map');
  legend.innerHTML =
    '<li><span class="k k-green" aria-hidden="true"></span>green — proven</li>' +
    '<li><span class="k k-pale" aria-hidden="true"></span>sapling — in progress</li>' +
    '<li><span class="k k-with" aria-hidden="true"></span>withered — broken</li>';
  legend.hidden = true;
  voice.append(legend);
  callout.append(tail, head, voice);

  // ── the inspect panel (UAT 5): open a proposed upstream story → what + why ──
  const inspect = el('div', 'act2-inspect');
  inspect.setAttribute('data-act2-inspect', '');
  inspect.setAttribute('role', 'dialog');
  inspect.setAttribute('aria-modal', 'false');
  inspect.setAttribute('aria-label', 'What this proposed story is, and why');
  const inspectCard = el('div', 'act2-inspect-card');
  const inspectBadge = el('span', 'act2-inspect-badge', 'proposed — not built yet');
  inspectBadge.setAttribute('aria-hidden', 'true');
  const inspectTitle = el('h3', 'act2-inspect-title');
  const inspectWhatH = el('p', 'act2-inspect-h', 'What it is');
  const inspectWhat = el('p', 'act2-inspect-p');
  const inspectWhyH = el('p', 'act2-inspect-h', 'Why it’s proposed');
  const inspectWhy = el('p', 'act2-inspect-p');
  const inspectClose = el('button', 'act2-inspect-close', 'close');
  inspectClose.type = 'button';
  inspectClose.setAttribute('data-act2-inspect-close', '');
  inspectCard.append(
    inspectBadge,
    inspectTitle,
    inspectWhatH,
    inspectWhat,
    inspectWhyH,
    inspectWhy,
    inspectClose,
  );
  inspect.appendChild(inspectCard);
  inspect.hidden = true;

  // the honest diorama-closing card (revealed at the end; every exit is real)
  const done = el('div', 'act2-done');
  done.setAttribute('data-act2-cta', '');
  done.setAttribute('role', 'group');
  done.setAttribute('aria-label', 'The end of the walk');
  done.setAttribute('tabindex', '-1'); // focus lands here when the close is revealed (was the retired CTA)
  const doneTitle = el('h2', 'act2-title', NARRATION[DONE_KEY]!.title);
  const doneBody = el('p', 'act2-body', NARRATION[DONE_KEY]!.body);
  // The info pages retired (2026-07-07) — the walk's onward links (get-involved,
  // how-it-works) went with them; the experience is now the whole site, so the
  // done state is the honest close itself, with no onward page link. The contact
  // door may be added back later (owner's call). Replay is the chat's single Back
  // control (ADR-0165 §3); the card's own back retired with the callout buttons.
  done.append(doneTitle, doneBody);
  done.hidden = true;

  stage.append(canvas, callout, inspect, done);
  land.appendChild(stage);

  // ── the camera (a tweened viewBox; MOTION only — geometry is the fold's) ──
  let svgEl: SVGSVGElement | null = null;
  let camFrom: CamRect | null = null;
  let camTo: CamRect | null = null;
  let camStart = 0;
  let camRaf = 0;
  let settled = false;
  let onSettle: (() => void) | null = null;

  const stageAspect = (): number => {
    const r = stage.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r.width / r.height : 16 / 9;
  };

  const currentFold = (): FoldedWorld => foldWorldToScene(director.world, script);

  const applyViewBox = (r: CamRect): void => {
    if (svgEl) svgEl.setAttribute('viewBox', vbString(r));
  };

  const settle = (): void => {
    settled = true;
    exposeWitness();
    const cb = onSettle;
    onSettle = null;
    if (cb) cb();
  };

  const camTick = (now: number): void => {
    if (disposed || !camFrom || !camTo) return;
    const t = Math.min(1, (now - camStart) / CAMERA_MS);
    const k = easeInOutCubic(t);
    applyViewBox({
      x: camFrom.x + (camTo.x - camFrom.x) * k,
      y: camFrom.y + (camTo.y - camFrom.y) * k,
      w: camFrom.w + (camTo.w - camFrom.w) * k,
      h: camFrom.h + (camTo.h - camFrom.h) * k,
    });
    if (t >= 1) {
      applyViewBox(camTo);
      camFrom = null;
      settle();
      return;
    }
    camRaf = requestAnimationFrame(camTick);
  };

  const moveCamera = (target: CamRect, snap: boolean): void => {
    cancelAnimationFrame(camRaf);
    settled = false;
    exposeWitness();
    if (snap || reducedMotion || !svgEl) {
      camFrom = null;
      camTo = target;
      applyViewBox(target);
      camRaf = requestAnimationFrame(() => settle());
      return;
    }
    const vb = svgEl.viewBox.baseVal;
    camFrom = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
    camTo = target;
    camStart = performance.now();
    camRaf = requestAnimationFrame(camTick);
  };

  // ── scene ↔ stage mapping (for the callout anchoring) ──
  const sceneToStagePx = (p: Pt): Pt => {
    const sr = stage.getBoundingClientRect();
    const vb = svgEl?.viewBox.baseVal;
    if (!vb || vb.width === 0) return { x: sr.width / 2, y: sr.height / 2 };
    const scale = sr.width / vb.width;
    return {
      x: (p.x + OFFSET.x - vb.x) * scale,
      y: (p.y + OFFSET.y - vb.y) * scale,
    };
  };

  // ── the callout placement (anchored NEXT TO the beat's map element) ──
  const narrationFor = (): BeatNarration => {
    if (director.beatIndex === 0) return INTRO;
    const beat = script[director.beatIndex - 1];
    return (beat && NARRATION[beat.id]) || INTRO;
  };

  const placeCallout = (): void => {
    if (cta || disposed || calloutDeferred) return;
    // beat 0 is the quiet ground UNDER the growing diagram (Phase D) — there is
    // nothing on the map to point at, and the guide chat carries the framing;
    // the callout only ever anchors the island beats (ADR-0165 §4b).
    if (director.beatIndex === 0) return;
    const fold = currentFold();
    const { rect } = anchorFor(fold, director.beatIndex);
    const a1 = sceneToStagePx({ x: rect.x, y: rect.y });
    const a2 = sceneToStagePx({ x: rect.x + rect.w, y: rect.y + rect.h });
    const anchor = { left: a1.x, top: a1.y, right: a2.x, bottom: a2.y };
    const sr = stage.getBoundingClientRect();
    // the persistent chat dock owns the bottom band — never place under it.
    const availH = sr.height * visibleFrac(sr.height);

    callout.hidden = false;
    callout.style.visibility = 'hidden';
    const cw = callout.offsetWidth;
    const ch = callout.offsetHeight;

    const M = CALLOUT_MARGIN;
    const G = CALLOUT_GAP;
    const acx = (anchor.left + anchor.right) / 2;
    const acy = (anchor.top + anchor.bottom) / 2;
    const clamp = (v: number, lo: number, hi: number): number =>
      Math.min(Math.max(v, lo), Math.max(lo, hi));

    type Cand = { side: 'right' | 'left' | 'bottom' | 'top'; x: number; y: number; fits: boolean };
    const mk = (side: Cand['side']): Cand => {
      let x = 0;
      let y = 0;
      if (side === 'right') {
        x = anchor.right + G;
        y = clamp(acy - ch / 2, M, availH - ch - M);
      } else if (side === 'left') {
        x = anchor.left - G - cw;
        y = clamp(acy - ch / 2, M, availH - ch - M);
      } else if (side === 'bottom') {
        x = clamp(acx - cw / 2, M, sr.width - cw - M);
        y = anchor.bottom + G;
      } else {
        x = clamp(acx - cw / 2, M, sr.width - cw - M);
        y = anchor.top - G - ch;
      }
      const fits = x >= M && y >= M && x + cw <= sr.width - M && y + ch <= availH - M;
      return { side, x, y, fits };
    };
    // the pull-back speaks about the whole board — a calm fixed corner spot;
    // otherwise hug the anchor on the first side that fits (the corner overlays
    // are retired, ADR-0165 §2 — no corner to dodge; the mini-map top-left is
    // small and the anchor-hugging sides clear it in practice).
    const wide = director.beatIndex === 6;
    const order: Cand['side'][] = wide
      ? ['bottom', 'right', 'left', 'top']
      : ['right', 'left', 'bottom', 'top'];
    let pick = order.map(mk).find((c) => c.fits);
    if (!pick) {
      const x = clamp(acx - cw / 2, M, Math.max(M, sr.width - cw - M));
      const y = clamp(anchor.bottom + G, M, Math.max(M, availH - ch - M));
      pick = { side: 'bottom', x, y, fits: false };
    }

    callout.style.left = `${pick.x.toFixed(1)}px`;
    callout.style.top = `${pick.y.toFixed(1)}px`;
    callout.dataset['side'] = pick.side;

    if (pick.side === 'right' || pick.side === 'left') {
      const ty = clamp(acy - pick.y, 18, ch - 18);
      tail.style.top = `${ty.toFixed(1)}px`;
      tail.style.left = pick.side === 'right' ? '-7px' : `${cw - 7}px`;
    } else {
      const tx = clamp(acx - pick.x, 18, cw - 18);
      tail.style.left = `${tx.toFixed(1)}px`;
      tail.style.top = pick.side === 'bottom' ? '-7px' : `${ch - 7}px`;
    }

    callout.style.visibility = '';
    callout.classList.add('is-placed');
  };

  // ── the witness hook ──
  const exposeWitness = (): void => {
    (
      window as unknown as {
        __act2?: {
          beatIndex: number;
          done: boolean;
          cta: boolean;
          settled: boolean;
          inspect: string | null;
        };
      }
    ).__act2 = {
      beatIndex: director.beatIndex,
      done: director.done,
      cta,
      settled,
      inspect: inspectId,
    };
  };

  // ── the inspect affordance (UAT 5) ──
  const inspectableAt = (beatIndex: number): TerritoryMeta | null => {
    // On the upstream-reveal beats, the newest revealed upstream story is the one
    // the prompt opens (beat 4 → backend, beat 5+ → database).
    const fold = currentFold();
    if (beatIndex === 4) return terrOf(fold, STORY_BACKEND) ?? null;
    if (beatIndex >= 5) return terrOf(fold, STORY_DATABASE) ?? terrOf(fold, STORY_BACKEND) ?? null;
    return null;
  };

  const openInspect = (id: string): void => {
    const data: StoryInspect | undefined = STORY_INSPECT[id];
    if (!data) return;
    inspectId = id;
    inspectTitle.textContent = data.label;
    inspectWhat.textContent = data.what;
    inspectWhy.textContent = data.why;
    inspect.hidden = false;
    requestAnimationFrame(() => {
      if (!disposed) inspect.classList.add('is-open');
    });
    try {
      inspectClose.focus({ preventScroll: true });
    } catch {
      /* focus is a courtesy */
    }
    exposeWitness();
  };

  const closeInspect = (): void => {
    if (inspectId === null) return;
    inspectId = null;
    inspect.classList.remove('is-open');
    inspect.hidden = true;
    exposeWitness();
    // focus returns to the guide chat's chip naturally (the walk renders no
    // advance affordance of its own — ADR-0165 §3).
  };

  // ── render: fold → buildScene → sceneToSvg → swap the stage svg ──
  const renderScene = (): void => {
    const fold = currentFold();
    const aspect = stageAspect();
    const sr = stage.getBoundingClientRect();
    const target = cameraRect(fold, director.camera, aspect, visibleFrac(sr.height));
    const startVb = svgEl
      ? (() => {
          const vb = svgEl.viewBox.baseVal;
          return { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
        })()
      : target;
    canvas.innerHTML = stageSvg(fold, director.beatIndex, vbString(startVb));
    svgEl = canvas.querySelector('svg');

    // the walk is a diorama, not the studio: the delegation hit layer goes inert —
    // the walk's own affordances are the only interactive surface.
    canvas.querySelectorAll('.tw-hit').forEach((h) => {
      h.removeAttribute('tabindex');
      h.removeAttribute('role');
      h.setAttribute('aria-hidden', 'true');
    });

    // an upstream story's tree/disc is clickable to INSPECT it (UAT 5) — a
    // first-class affordance, keyed by story id. Mark the proposed upstream
    // territories interactive.
    for (const t of fold.territories) {
      if (!t.upstream || !(t.id in STORY_INSPECT)) continue;
      const terr = canvas.querySelector(`.tw-terr[data-id="${t.id}"]`);
      if (terr) {
        terr.classList.add('act2-inspectable');
        terr.setAttribute('role', 'button');
        terr.setAttribute('tabindex', '0');
        terr.setAttribute('aria-label', `Inspect ${t.label} — what it is and why it’s proposed`);
        (terr as SVGElement & { dataset: DOMStringMap }).dataset['act2Inspect'] = t.id;
      }
    }

    // growth: what THIS beat added scales/fades in (deterministic per beat — a
    // Back-replay re-renders the identical DOM and replays the same growth).
    const enter = enterSelectorsFor(director.beatIndex);
    for (const sel of enter.scale) {
      canvas.querySelectorAll(sel).forEach((n) => n.classList.add('act2-enter'));
    }
    for (const sel of enter.fade) {
      canvas.querySelectorAll(sel).forEach((n, i) => {
        n.classList.add('act2-enter-fade');
        // the proven limb greens LAST, landing with the narration (never before)
        if (director.beatIndex === 3) {
          const id = n.getAttribute('data-id');
          const anchor = anchorTerr(fold);
          const greenLast = (anchor?.limbs ?? []).filter((l) => !l.green).map((l) => l.id);
          const ei =
            id === null ? i : greenLast.indexOf(id) === -1 ? greenLast.length : greenLast.indexOf(id);
          (n as SVGElement).style.setProperty('--ei', String(ei));
        }
      });
    }
    // on the upstream beats, the newest disc's flora/coast/ground fade in with the
    // trails (scoped to the newest territory by data-id).
    if (director.beatIndex === 4 || director.beatIndex === 5) {
      const id = director.beatIndex === 4 ? STORY_BACKEND : STORY_DATABASE;
      const t = terrOf(fold, id);
      if (t) {
        canvas
          .querySelectorAll(
            `.tw-terr[data-id="${t.id}"], .tw-isle[data-id="${t.id}"], .tw-ground[data-id="${t.id}"]`,
          )
          .forEach((n) => n.classList.add('act2-enter-fade'));
      }
    }

    // the wisp ORBITS the island (ADR-0165 §5): the shared orbit post-process
    // (orbitWispLayers, above — also the studio layer's) rebuilds each emitted
    // wisp layer into the island-centred orbit structure; the walk's single
    // wisp keeps the run-1 structure exactly (no phase wrapper).
    orbitWispLayers(
      canvas,
      fold.territories.filter((t) => t.hasWisp).map((t) => ({ radius: t.radius })),
    );

    moveCamera(target, false);
  };

  // ── panel sync (copy, step label, inspect prompt, witness) ──
  const syncPanel = (): void => {
    const n = narrationFor();
    title.textContent = n.title;
    body.textContent = n.body;
    legend.hidden = director.beatIndex !== script.length;

    step.textContent = cta
      ? 'the end of the walk'
      : director.beatIndex === 0
        ? 'before the walk'
        : `step ${director.beatIndex} of ${script.length}`;

    // the inspect prompt: shown on the upstream-reveal beats, labelled for the
    // story it opens (UAT 5 — comprehension on demand, first-class not a tooltip).
    const insp = inspectableAt(director.beatIndex);
    if (insp && !cta) {
      inspectPrompt.hidden = false;
      inspectPrompt.textContent = `what is “${insp.label}”, and why? →`;
      inspectPrompt.dataset['act2InspectId'] = insp.id;
    } else {
      inspectPrompt.hidden = true;
      delete inspectPrompt.dataset['act2InspectId'];
    }

    done.hidden = !cta;
    callout.classList.toggle('is-cta', cta);
    exposeWitness();
  };

  const hideCallout = (): void => {
    callout.classList.remove('is-placed');
  };

  const applyDirector = (next: DirectorState): void => {
    // any open inspect closes when the walk moves.
    if (inspectId !== null) closeInspect();
    director = next;
    hideCallout();
    renderScene();
    syncPanel();
    onSettle = (): void => {
      if (cta || disposed) return;
      placeCallout();
      // focus stays with the guide chat's chip — the walk renders no advance
      // affordance of its own (ADR-0165 §3), so it never steals focus.
    };
    if (settled) {
      const cb = onSettle;
      onSettle = null;
      cb();
    }
  };

  const enterCta = (): void => {
    cta = true;
    if (inspectId !== null) closeInspect();
    hideCallout();
    callout.hidden = true;
    syncPanel();
    try {
      done.focus({ preventScroll: true }); // move focus to the close card (its CTA retired)
    } catch {
      /* focus is a courtesy */
    }
  };

  const leaveCta = (): void => {
    cta = false;
    callout.hidden = false;
    syncPanel();
    onSettle = null;
    placeCallout();
  };

  // ── the advance/replay mechanics — driven ONLY through the handle by the
  //    guide chat's chips (ADR-0165 §3: thin wrappers around the same advance()
  //    the retired Next button called; nothing auto-advances). No in-walk skip
  //    (ADR-0153 §3 — Escape is the only exit, to the a11y fallback). ──
  const onNext = (): void => {
    if (cta) return;
    if (!director.done) applyDirector(advance(director, script));
    else enterCta();
  };
  const onBack = (): void => {
    if (cta) {
      leaveCta();
      return;
    }
    if (director.beatIndex > 0) applyDirector(stateAt(director.beatIndex - 1, script));
  };
  const onInspectPromptClick = (): void => {
    const id = inspectPrompt.dataset['act2InspectId'];
    if (id) openInspect(id);
  };
  // click/keyboard on an upstream tree opens its inspect panel too.
  const onCanvasClick = (ev: MouseEvent): void => {
    const target = ev.target as Element | null;
    const host = target?.closest<SVGElement>('[data-act2-inspect]');
    const id = host?.dataset?.['act2Inspect'];
    if (id) openInspect(id);
  };
  const onCanvasKey = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const target = ev.target as Element | null;
    const host = target?.closest<SVGElement>('[data-act2-inspect]');
    const id = host?.dataset?.['act2Inspect'];
    if (id) {
      ev.preventDefault();
      openInspect(id);
    }
  };
  inspectPrompt.addEventListener('click', onInspectPromptClick);
  inspectClose.addEventListener('click', closeInspect);
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('keydown', onCanvasKey);

  // re-anchor on resize (the viewBox rect is aspect-matched to the stage)
  const onResize = (): void => {
    if (disposed) return;
    const fold = currentFold();
    const sr = stage.getBoundingClientRect();
    const target = cameraRect(fold, director.camera, stageAspect(), visibleFrac(sr.height));
    cancelAnimationFrame(camRaf);
    camFrom = null;
    camTo = target;
    applyViewBox(target);
    settled = true;
    exposeWitness();
    if (!cta) placeCallout();
  };
  window.addEventListener('resize', onResize);

  // ── first paint: the empty land, beat 0 (fade-in is the caller's, via CSS) ──
  applyDirector(initialState);
  requestAnimationFrame(() => {
    if (!disposed) stage.classList.add('is-live');
  });

  return {
    next(): void {
      if (disposed) return;
      onNext();
    },
    back(): void {
      if (disposed) return;
      onBack();
    },
    revealCallout(): void {
      if (disposed || !calloutDeferred) return;
      calloutDeferred = false;
      if (!cta) placeCallout();
    },
    unmount(): void {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(camRaf);
      onSettle = null;
      inspectPrompt.removeEventListener('click', onInspectPromptClick);
      inspectClose.removeEventListener('click', closeInspect);
      canvas.removeEventListener('click', onCanvasClick);
      canvas.removeEventListener('keydown', onCanvasKey);
      window.removeEventListener('resize', onResize);
      stage.remove();
      delete (window as unknown as { __act2?: unknown }).__act2;
    },
  };
}
