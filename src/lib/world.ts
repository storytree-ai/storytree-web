// ---------------------------------------------------------------------------
// world.ts — a self-contained layout engine for the storytree "story world"
// demo, now SOURCED FROM the shared forest-world render core (ADR-0093).
//
// It lays a set of stories (and their dependency edges) out as a
// Dorfromantik-style world of relaxed-mesh TERRITORIES — the most depended-upon
// "foundation" stories sit at the bottom and dependents fan upward, so the eye
// traces the load-bearing base up through the canopy. Each story claims a
// cluster of hex tiles and grows ONE central tree whose SIZE scales with its
// capability count, so a richer story is a visibly bigger tree. Garden flora are
// its capabilities; procedurally routed "trails" (ADR-0169, hidden by default on
// the public map) are dependency edges; a signpost marks a
// human-witnessed story; "blooms" announce fresh passing verdicts; "wisps" are
// the sessions working right now. Each story also carries a laid-out capability
// sub-DAG for the drill-down.
//
// The GEOMETRY (hex math, sizing curves, the Townscaper mesh, the organic coast)
// now lives in the shared core (`./forest-world/index`) — the studio's canonical
// numbers (HEX_R=27, crownRadius=min(32,18+2.2·caps), …). A studio look change
// flows here through that one core. This file keeps only the LAYOUT (ranking,
// seed positions, territory growth, bounds) + the demo's data shape (World /
// Territory / CapSpot / CapDag) the page consumes.
//
// Everything is computed deterministically at BUILD TIME (pure functions, no
// randomness that isn't hashed from ids), so the world renders identically every
// visit and ships as static HTML.
// ---------------------------------------------------------------------------

import {
  type Pt,
  type Axial,
  type RelaxedCell,
  type BuildPhase,
  type TrailNetwork,
  routeTrails,
  HEX_R,
  HEX_W,
  TILE_DEPTH,
  axialKey,
  AXIAL_DIRS,
  hexCenter,
  pixelToHex,
  hexDist,
  hexCorners,
  hash,
  rand01,
  ringsOf,
  estRadius,
  crownRadius,
  storyTreeReach,
  smoothCoast,
  buildRelaxedCells,
  type BoundarySeg,
} from './forest-world/index';

export type Status = 'healthy' | 'mapped' | 'proposed' | 'building' | 'unhealthy';

export interface Verdict {
  outcome: 'pass' | 'fail';
  at: string;
}
export interface Capability {
  id: string;
  title: string;
  status: Status;
  /** Leaf-test count. Optional — derived from the id when absent. */
  contracts?: number;
  dependsOn?: string[];
  verdict?: Verdict;
}
export interface Story {
  id: string;
  title: string;
  outcome: string;
  status: Status;
  witness: 'human' | 'machine';
  dependsOn: string[];
  verdict?: Verdict;
  capabilities: Capability[];
}
export interface Session {
  id: string;
  branch: string;
  workingOn: string;
  band: 'fresh' | 'stale';
  nodes: string[];
  /** The live prove-it-gate phase of this session's in-flight build, when it has
   *  one (ADR-0048 §3 v2). The core folds it to the wisp's red→green band. */
  phase?: BuildPhase;
}
export interface Dataset {
  project: string;
  tagline?: string;
  note: string;
  stories: Story[];
  sessions?: Session[];
}

// The instant the demo world is "as of" — fresh passing verdicts within
// BLOOM_WINDOW of this bloom on the map (a one-shot game-feel layer).
const DEMO_NOW = Date.parse('2026-06-14T09:30:00Z');
const BLOOM_WINDOW = 60 * 60 * 1000 * 48; // 48h

// ---------- graph helpers ----------

const ALIVE: Record<Status, Status> = {
  healthy: 'healthy', mapped: 'mapped', proposed: 'proposed',
  building: 'proposed', unhealthy: 'unhealthy', // building wears proposed
};
const display = (s: Status): Status => ALIVE[s] ?? s;

function longestRank(ids: string[], depsOf: Map<string, string[]>): Map<string, number> {
  const rank = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    const known = rank.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    let r = 0;
    for (const d of depsOf.get(id) ?? []) r = Math.max(r, visit(d) + 1);
    visiting.delete(id);
    rank.set(id, r);
    return r;
  };
  for (const id of ids) visit(id);
  return rank;
}
function transitiveClosure(start: string, next: Map<string, string[]>): string[] {
  const seen = new Set<string>();
  const stack = [...(next.get(start) ?? [])];
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(next.get(id) ?? []));
  }
  return [...seen];
}

// A capability's contract (leaf-test) count — the proxy for "how much is proven
// here". Authored when present, else a stable hash-derived 2..10 so the mock
// still shows a believable spread of complexity at a glance.
const contractsOf = (c: Capability): number => c.contracts ?? 2 + (hash(c.id) % 9);

// ---------- view structures ----------

export interface CapSpot { id: string; title: string; status: Status; x: number; y: number; variant: number; bloom: boolean; contracts: number; }
interface DecorSpot { x: number; y: number; seed: number; }
interface WispView { id: string; band: 'fresh' | 'stale'; workingOn: string; phase?: BuildPhase; }

export interface DagNode { id: string; title: string; status: Status; contracts: number; x: number; y: number; }
export interface CapDag { w: number; h: number; nodes: DagNode[]; edges: { d: string }[]; }

export interface Territory {
  i: number;
  id: string; title: string; outcome: string;
  status: Status; vis: Status; witness: 'human' | 'machine';
  capCount: number; contractTotal: number; weight: number; crownR: number; verdict?: Verdict;
  cx: number; cy: number; radius: number;
  treeX: number; treeY: number; labelY: number; plateW: number;
  coastPaths: string[];
  caps: CapSpot[]; decor: DecorSpot[]; wisps: WispView[]; capDag: CapDag;
  bloom: boolean; sapling: boolean; young: boolean; withered: boolean;
  sealFilled: boolean;
  deps: string[]; ancestors: string[]; descendants: string[];
  sessions: { id: string; workingOn: string; band: string }[];
}
export interface World {
  project: string;
  width: number; height: number; ox: number; oy: number;
  relaxedCells: RelaxedCell[];
  /** The routed `depends_on` trail network (ADR-0169) — `routeTrails`' output,
   *  carried whole so the scene fold passes it straight through as `trails`. */
  trails: TrailNetwork;
  territories: Territory[];
  drawOrder: number[];
  stats: { stories: number; caps: number; contracts: number; proven: number; building: number; unhealthy: number; sessions: number };
}

// ---------- capability sub-DAG layout (the drill-down) ----------

// A simple layered (longest-path) layout of a story's capabilities, dependencies
// at the bottom. Cards are a fixed CW×CH; CLIENT renders with the same numbers.
export const DAG_CW = 112;
export const DAG_CH = 42;
const DAG_HGAP = 26;
const DAG_WGAP = 12;

function layoutCapDag(story: Story): CapDag {
  const caps = story.capabilities;
  if (caps.length === 0) return { w: DAG_CW, h: DAG_CH, nodes: [], edges: [] };
  const ids = new Set(caps.map((c) => c.id));
  const depsOf = new Map<string, string[]>(
    caps.map((c) => [c.id, (c.dependsOn ?? []).filter((d) => d !== c.id && ids.has(d))]),
  );
  const rankMap = longestRank(caps.map((c) => c.id), depsOf);
  const maxR = Math.max(0, ...rankMap.values());
  const byR: Capability[][] = Array.from({ length: maxR + 1 }, () => []);
  caps.forEach((c) => byR[rankMap.get(c.id) ?? 0].push(c));
  const rowW = byR.map((row) => row.length * DAG_CW + Math.max(0, row.length - 1) * DAG_WGAP);
  const w = Math.max(DAG_CW, ...rowW);
  const h = (maxR + 1) * DAG_CH + maxR * DAG_HGAP;
  const pos = new Map<string, Pt>();
  byR.forEach((row, r) => {
    const y = (maxR - r) * (DAG_CH + DAG_HGAP); // rank 0 sits at the bottom
    let x = (w - rowW[r]) / 2;
    for (const c of row) { pos.set(c.id, { x, y }); x += DAG_CW + DAG_WGAP; }
  });
  const nodes: DagNode[] = caps.map((c) => {
    const p = pos.get(c.id)!;
    return { id: c.id, title: c.title, status: display(c.status), contracts: contractsOf(c), x: p.x, y: p.y };
  });
  const edges: { d: string }[] = [];
  for (const c of caps) {
    for (const d of depsOf.get(c.id) ?? []) {
      const cp = pos.get(c.id)!, dp = pos.get(d)!;
      const x1 = dp.x + DAG_CW / 2, y1 = dp.y;          // top of the dependency
      const x2 = cp.x + DAG_CW / 2, y2 = cp.y + DAG_CH; // bottom of the dependent
      const my = (y1 + y2) / 2;
      edges.push({ d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${x1.toFixed(1)} ${my.toFixed(1)}, ${x2.toFixed(1)} ${my.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}` });
    }
  }
  return { w, h, nodes, edges };
}

// ---------- build ----------

/**
 * DEAD, AND DELIBERATELY LEFT THAT WAY - verified 2026-08-27 against this checkout.
 *
 * `buildWorld` has ZERO non-comment references anywhere in `web/src` (checked across .ts / .tsx /
 * .svelte / .astro / .js); the only mentions are three prose comments in `src/lib/forest-world/`.
 * The live home map is `worldSvg.ts` over the synced engine core, and the walkthrough builds its
 * own discs in `src/scripts/act2-walkthrough.ts`.
 *
 * It carries THREE instances of the ADR-0367 screen-space-distance class - an island radius, a
 * hero-tile argmin and a decor keep-out, all measured on PROJECTED coordinates, plus a hand-picked
 * `* 0.7` cap-ring squash where the declared camera says sin(20 deg) = 0.342. They are MARKED
 * rather than fixed: `website-decor-proximity-moves-to-ground-space` established that this file is
 * superseded by the website refresh, which removes it, and fixing code with no caller would be
 * work spent on something about to be deleted. The markers exist so `check:ground-space` in the
 * parent repo can see them declared rather than reporting them as undeclared every run - and so
 * that whoever deletes the file knows what went with it.
 */
export function buildWorld(data: Dataset): World {
  const stories = data.stories;
  const sessions = data.sessions ?? [];
  const n = stories.length;
  const idIndex = new Map(stories.map((s, i) => [s.id, i]));
  // weight = total contracts in the story (drives island size + the legacy
  // crown weight; the crown itself now grows from the core's capability-count
  // curve so the tree sizing matches the studio).
  const weights = stories.map((s) => s.capabilities.reduce((sum, c) => sum + contractsOf(c), 0));
  const quotas = stories.map((_, i) => Math.max(4, Math.min(13, 3 + Math.round(weights[i] / 4))));

  // edges: declared story-level depends_on, filtered to real, non-self
  const depsOf = new Map<string, string[]>(stories.map((s) => [s.id, []]));
  const dependentsOf = new Map<string, string[]>(stories.map((s) => [s.id, []]));
  const edgeList: { from: string; to: string }[] = [];
  for (const s of stories) {
    for (const d of s.dependsOn ?? []) {
      if (d !== s.id && idIndex.has(d)) {
        depsOf.get(s.id)!.push(d);
        dependentsOf.get(d)!.push(s.id);
        edgeList.push({ from: d, to: s.id });
      }
    }
  }

  const ranks = longestRank(stories.map((s) => s.id), depsOf);
  const loadBearing = new Map(stories.map((s) => [s.id, transitiveClosure(s.id, dependentsOf).length]));
  const maxRank = Math.max(0, ...ranks.values());
  const byRank: number[][] = Array.from({ length: maxRank + 1 }, () => []);
  stories.forEach((s, i) => byRank[ranks.get(s.id) ?? 0].push(i));

  // row centre-lines, bottom (rank 0) up
  const RANK_GAP = 30, ISLAND_GAP = 52, SWING = 210;
  const rowY: number[] = [];
  let yC = 0;
  for (let r = 0; r <= maxRank; r++) {
    const tallest = Math.max(...byRank[r].map((i) => estRadius(quotas[i])), HEX_R);
    if (r === 0) yC = -tallest;
    else {
      const below = Math.max(...byRank[r - 1].map((i) => estRadius(quotas[i])), HEX_R);
      yC -= below + tallest + RANK_GAP;
    }
    rowY.push(yC);
  }

  // seed pixel positions per row
  const seedPx = new Map<number, Pt>();
  const baryOf = (idx: number): number => {
    const xs = (depsOf.get(stories[idx].id) ?? [])
      .map((d) => idIndex.get(d)!)
      .filter((j) => seedPx.has(j))
      .map((j) => seedPx.get(j)!.x);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  };
  for (let r = 0; r <= maxRank; r++) {
    const row = byRank[r];
    const ordered = [...row].sort((a, b) => {
      if (r === 0) return (loadBearing.get(stories[b].id) ?? 0) - (loadBearing.get(stories[a].id) ?? 0);
      return baryOf(a) - baryOf(b) || (hash(stories[a].id) % 997) - (hash(stories[b].id) % 997);
    });
    let display2 = ordered;
    if (r === 0) {
      display2 = [];
      ordered.forEach((i, k) => (k % 2 === 0 ? display2.push(i) : display2.unshift(i)));
    }
    const seq = display2.map((idx) => ({ idx, w: estRadius(quotas[idx]) }));
    const total = seq.reduce((s, x) => s + 2 * x.w, 0) + ISLAND_GAP * Math.max(0, seq.length - 1);
    let rowCenter = r === 0 ? 0 : display2.reduce((s, i) => s + baryOf(i), 0) / Math.max(display2.length, 1);
    if (r > 0 && seq.length === 1) rowCenter += (r % 2 === 1 ? 1 : -1) * SWING;
    let x = rowCenter - total / 2;
    for (const it of seq) {
      const seed = hash(stories[it.idx].id);
      seedPx.set(it.idx, { x: x + it.w + (rand01(seed) - 0.5) * 40, y: rowY[r] + (rand01(seed + 1) - 0.5) * 26 });
      x += 2 * it.w + ISLAND_GAP;
    }
  }

  // snap to lattice + spread overlapping seeds
  const seeds: Axial[] = stories.map((_, i) => pixelToHex(seedPx.get(i) ?? { x: 0, y: 0 }));
  for (let pass = 0; pass < 30; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const floor = ringsOf(quotas[i]) + ringsOf(quotas[j]) + 1;
        if (hexDist(seeds[i], seeds[j]) < floor) {
          seeds[j] = { q: seeds[j].q + 1, r: seeds[j].r };
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  // grow territories round-robin (each claims its nearest free frontier hex)
  const owner = new Map<string, number>();
  const tiles: Axial[][] = stories.map(() => []);
  seeds.forEach((sd, i) => { owner.set(axialKey(sd), i); tiles[i].push(sd); });
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < n; i++) {
      if (tiles[i].length >= quotas[i]) continue;
      let best: Axial | null = null;
      let bestCost = Infinity;
      for (const t of tiles[i]) {
        for (const d of AXIAL_DIRS) {
          const cand = { q: t.q + d.q, r: t.r + d.r };
          if (owner.has(axialKey(cand))) continue;
          const cost = hexDist(seeds[i], cand) + rand01(hash(`${stories[i].id}:${axialKey(cand)}`)) * 1.3;
          if (cost < bestCost) { bestCost = cost; best = cand; }
        }
      }
      if (best) { owner.set(axialKey(best), i); tiles[i].push(best); progress = true; }
    }
  }

  // per-territory geometry + contents
  const wheatSets: Set<string>[] = stories.map(() => new Set<string>());
  const territories: Territory[] = stories.map((story, i) => {
    const cs = tiles[i].map(hexCenter);
    const cx = cs.reduce((s, p) => s + p.x, 0) / cs.length;
    const cy = cs.reduce((s, p) => s + p.y, 0) / cs.length;
    // screen-space-defect: website-decor-proximity-moves-to-ground-space — a max-distance over
    // PROJECTED tile centres, so this island's radius shrinks with the camera (ADR-0367 D1).
    const radius = Math.max(0, ...cs.map((p) => Math.hypot(p.x - cx, p.y - cy))) + HEX_R;
    // The hero tile is chosen by an argmin taken in SCREEN space, which under-weights the
    // foreshortened axis and so can pick a different tile than the ground would. Its live twin in
    // the studio disagrees with the ground-space choice on 26.8% of grown islands (measured).
    const centerTile = [...tiles[i]].sort((a, b) => {
      const ca = hexCenter(a), cb = hexCenter(b);
      // screen-space-defect: website-decor-proximity-moves-to-ground-space (see above)
      return Math.hypot(ca.x - cx, ca.y - cy) - Math.hypot(cb.x - cx, cb.y - cy);
    })[0];
    const tp = hexCenter(centerTile);
    const vis = display(story.status);
    const caps = story.capabilities;
    const weight = weights[i];
    // Crown size grows with capability count (the core's canonical curve) — a
    // richer story is a visibly bigger tree, matching the studio.
    const crownR = crownRadius(caps.length);
    const ringR = Math.max(crownR * 0.9, Math.min(crownR + 16, radius - HEX_R * 0.5));
    const ARC = (Math.PI * 4) / 3;
    const capSpots: CapSpot[] = caps.map((cap, j) => {
      const a = -Math.PI / 6 + ((j + 0.5) / caps.length) * ARC + (rand01(hash(`${cap.id}:a`)) - 0.5) * 0.3;
      const rr = ringR + (rand01(hash(`${cap.id}:r`)) - 0.5) * 9;
      let x = tp.x + Math.cos(a) * rr;
      let y = tp.y + Math.sin(a) * rr * 0.7;
      for (let k = 0; k < 4 && owner.get(axialKey(pixelToHex({ x, y }))) !== i; k++) {
        x += (tp.x - x) * 0.28; y += (tp.y - y) * 0.28;
      }
      const cv = display(cap.status);
      // Capability-level blooms are disabled: the mock verdicts cluster at each
      // story's timestamp, so per-cap sparkles bunch up. The crown bloom alone
      // carries "this story just passed" cleanly.
      return { id: cap.id, title: cap.title, status: cv, x, y, variant: hash(`${cap.id}:v`) % 3, bloom: false, contracts: contractsOf(cap) };
    });

    const decor: DecorSpot[] = [];
    const wheat = new Set<string>();
    for (const tile of tiles[i]) {
      if (axialKey(tile) === axialKey(centerTile)) continue;
      const roll = rand01(hash(`${story.id}:dec:${axialKey(tile)}`));
      const c = hexCenter(tile);
      // screen-space-defect: website-decor-proximity-moves-to-ground-space — the same keep-out
      // `act2-walkthrough.ts` just moved to ground space, still measured on the screen here.
      const near = Math.hypot(c.x - tp.x, c.y - tp.y) < crownR + 18;
      if (roll < 0.3 && !near) decor.push({ x: c.x, y: c.y, seed: hash(`${axialKey(tile)}:f`) });
      else if (roll >= 0.3 && roll < 0.55) wheat.add(axialKey(tile));
    }
    wheatSets[i] = wheat;

    const labelY = Math.max(...cs.map((p) => p.y), cy) + HEX_R + TILE_DEPTH + 7;
    const witnessSessions = sessions.filter((se) =>
      se.nodes.some((nd) => nd === story.id || caps.some((c) => c.id === nd)));
    const wisps: WispView[] = witnessSessions.map((se) => ({
      id: se.id, band: se.band, workingOn: se.workingOn,
      ...(se.phase ? { phase: se.phase } : {}),
    }));
    const bloom = vis !== 'unhealthy' && !!story.verdict && story.verdict.outcome === 'pass'
      && DEMO_NOW - Date.parse(story.verdict.at) >= 0 && DEMO_NOW - Date.parse(story.verdict.at) < BLOOM_WINDOW;

    return {
      i, id: story.id, title: story.title, outcome: story.outcome,
      status: story.status, vis, witness: story.witness, capCount: caps.length, contractTotal: weight, weight, crownR, verdict: story.verdict,
      cx, cy, radius, treeX: tp.x, treeY: tp.y, labelY, plateW: Math.max(110, story.title.length * 7.6 + 26),
      coastPaths: [],
      caps: capSpots, decor, wisps, capDag: layoutCapDag(story),
      bloom, sapling: caps.length === 0 && vis !== 'unhealthy', young: vis === 'proposed' && caps.length > 0, withered: vis === 'unhealthy',
      sealFilled: story.witness === 'human' && !!story.verdict && story.verdict.outcome === 'pass',
      deps: depsOf.get(story.id) ?? [],
      ancestors: transitiveClosure(story.id, depsOf),
      descendants: transitiveClosure(story.id, dependentsOf),
      sessions: witnessSessions.map((se) => ({ id: se.id, workingOn: se.workingOn, band: se.band })),
    };
  });

  // relaxed Townscaper mesh: every claimed hex as an axial + owner pair, dissolved
  // into one organic, cobbled landmass per territory (the studio's default look).
  // The geometry comes from the shared core (`buildRelaxedCells(..., 'mesh')`).
  const meshInput = [...owner.entries()].map(([k, idx]) => {
    const parts = k.split(',');
    return { h: { q: Number(parts[0]), r: Number(parts[1]) } as Axial, owner: idx };
  });
  const relaxedCells = buildRelaxedCells(meshInput, wheatSets, 'mesh');

  // smoothed organic coastline per territory: chain the hex-edge boundary into a
  // ring, outset a beach margin, Chaikin-round it into a soft sandy shore. The
  // core's `smoothCoast` returns { loops, paths } — we keep the `paths`.
  for (let i = 0; i < n; i++) {
    const mine = new Set(tiles[i].map(axialKey));
    const segs: BoundarySeg[] = [];
    for (const tile of tiles[i]) {
      const c = hexCenter(tile);
      const cor = hexCorners(c.x, c.y, HEX_R);
      AXIAL_DIRS.forEach((d, e) => {
        if (mine.has(axialKey({ q: tile.q + d.q, r: tile.r + d.r }))) return;
        const a = cor[e], b = cor[(e + 1) % 6];
        if (a && b) segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      });
    }
    territories[i].coastPaths = smoothCoast(segs, stories[i].id).paths;
  }

  // trails (dep -> dependent): the shared core's deterministic cost-grid router
  // (ADR-0169 §1) — islands from the territory centroids/radii, edges from the
  // declared depends_on list, a stable seed from the story ids. Never hand-forged.
  const trails = routeTrails(
    territories.map((t) => ({ id: t.id, x: t.cx, y: t.cy, r: t.radius })),
    edgeList.map(({ from, to }) => ({ from, to, title: `${to} depends on ${from}` })),
    `web:${stories.map((s) => s.id).join('|')}`,
  );

  // bounds (the smoothed coast extends only ~COAST_OUTSET beyond the land, well
  // inside MARGIN; the tree canopy reach comes from the core's storyTreeReach).
  const tileCenters: Pt[] = [];
  for (const [k] of owner) { const p = k.split(','); tileCenters.push(hexCenter({ q: Number(p[0]), r: Number(p[1]) })); }
  const MARGIN = 56;
  const minX = Math.min(...tileCenters.map((p) => p.x)) - HEX_W / 2 - MARGIN;
  const maxX = Math.max(...tileCenters.map((p) => p.x)) + HEX_W / 2 + MARGIN;
  const minY = Math.min(
    ...tileCenters.map((p) => p.y - HEX_R),
    ...territories.map((t) => t.treeY - storyTreeReach(t.capCount)),
  ) - MARGIN;
  const maxY = Math.max(...tileCenters.map((p) => p.y), ...territories.map((t) => t.labelY + 30)) + HEX_R + TILE_DEPTH + MARGIN / 2;

  const drawOrder = territories.map((_, i) => i).sort((a, b) => territories[a].treeY - territories[b].treeY);

  const caps = stories.reduce((s, st) => s + st.capabilities.length, 0);
  const contractsTotal = weights.reduce((a, b) => a + b, 0);
  const proven = territories.filter((t) => t.vis === 'healthy').length;
  const building = stories.filter((s) => s.status === 'building').length;
  const unhealthy = territories.filter((t) => t.vis === 'unhealthy').length;

  return {
    project: data.project,
    width: Math.ceil(maxX - minX), height: Math.ceil(maxY - minY), ox: -minX, oy: -minY,
    relaxedCells, trails, territories, drawOrder,
    stats: { stories: n, caps, contracts: contractsTotal, proven, building, unhealthy, sessions: sessions.length },
  };
}
