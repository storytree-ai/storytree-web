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
//   3. The two pictures are decided to be different: this one's labels are illegible BY DESIGN
//      (ADR-0453 D3) and its box PANS rather than scrolls (ADR-0502); the studio's is a working
//      tool with legible cards.
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

/**
 * The default box size. Small ON PURPOSE: ADR-0453 D3 decided the map's labels stay illegible, so
 * the message this picture carries is the SHAPE and the COLOUR, not the words. Sizing the cards for
 * readable text would make every graph too wide to fit its panel at rest, and the resting view is
 * the one that has to mean something (`legible-at-the-resting-view`). Zoom is what makes a label
 * readable; fit is what makes the shape readable.
 */
export const DAG_METRICS: DagMetrics = { nodeW: 84, nodeH: 30, gapX: 16, gapY: 26, pad: 10 };

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
 * Wrap a kebab-case id across up to two lines, breaking at a hyphen.
 *
 * ⚠ THIS IS NOT A TRANSLATION, AND MUST NEVER BECOME ONE. ADR-0453 D3 decided the map's own labels
 * stay our real corpus names — the visitor is meant to project their own system onto an unreadable
 * shape, and our names are the substrate rather than the message. This only decides where the
 * string breaks.
 */
export function idLines(id: string, max = 13): readonly string[] {
  if (id.length <= max) return [id];
  const head = id.slice(0, max);
  let cut = head.lastIndexOf('-');
  if (cut < Math.floor(max * 0.4)) cut = max;
  const first = id.slice(0, cut);
  const rest = id.slice(cut).replace(/^-/, '');
  if (rest === '') return [first];
  return [first, rest.length > max ? `${rest.slice(0, max - 1)}…` : rest];
}
