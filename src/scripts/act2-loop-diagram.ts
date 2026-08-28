// ---------------------------------------------------------------------------
// act2-loop-diagram — the honest TDD LOOP: the four-node ring content
// (ADR-0157 §5) and its deterministic SVG builder.
//
// HISTORY: this module was act2-overlays.ts — the corner drive-machinery
// overlays of ADR-0153 §5/§6 (the top-left agent-loop panel; the top-right
// "Proof, not a promise" / "Wired to the code" CI/CD row-lists). ADR-0165 §2
// RETIRED the corner overlays fully (accepted default 5): the loop diagram —
// the strongest landed asset — is ABSORBED into the one growing system diagram
// (act2-diagram.ts renders the ring at stage D5 from the data below, verbatim),
// and the CI/CD row-lists' teach compresses to the two load-bearing words in
// the D5/D6 chat copy ("gate", "signed" — act2-guide.ts). The persistent
// mini-map (act2-minimap.ts) replaces the corner-overlay pattern. No overlay
// mounts anywhere any more; `DRIVE_OVERLAYS` / `mountDriveOverlay` and the
// `window.__act2overlay` witness are GONE.
//
// What remains here is the loop's SINGLE SOURCE:
//   • the LoopNode/LoopDiagram types and HONEST_LOOP — the landed beat-2 loop
//     data VERBATIM (four nodes, two SYSTEM checks, the centre caption), with
//     every ADR-0157 §5 honesty obligation intact: it is a LOOP; the two
//     write-scoped phases read at vibe-coder altitude; the referee is the
//     SYSTEM — never an AI grading its own homework. Grounded in the real
//     ADR-0020 phase machine (AUTHOR_TEST → CONFIRM_RED → IMPLEMENT →
//     CONFIRM_GREEN); red/green is OBSERVED by the deterministic spine, never
//     claimed by the model.
//   • buildLoopDiagram — the landed compact ring builder (kept for reuse; the
//     growing diagram draws the same nodes/arcs/centre at the wide-canvas
//     geometry the approved proposal mocked, in act2-diagram.ts).
//
// Pure data + pure geometry: no Math.random, no wall-clock, no live data.
// ---------------------------------------------------------------------------

/** One node of the honest TDD LOOP DIAGRAM (ADR-0157 §5). Two kinds of node go
 *  round the loop: a WRITE step done by an agent ('author' = write the failing
 *  test; 'build' = write the code), and a CHECK done by the SYSTEM ('check' — the
 *  referee observes RED, then GREEN). The 'check' kind is styled unmistakably as
 *  the system's, never an AI's — that is the load-bearing honest element. */
export interface LoopNode {
  /** Stable id (clockwise from the top). */
  readonly id: string;
  /** 'author' / 'build' = an agent writes (a write-scoped phase); 'check' = the
   *  SYSTEM checks (the referee — red then green, never the model). */
  readonly kind: 'author' | 'build' | 'check';
  /** The step's plain-language label (one short line, vibe-coder altitude). */
  readonly label: string;
  /** Who does it — shown small under the label ("an agent" / "the system"). The
   *  'check' nodes MUST read as the system, not an AI (ADR-0157 §5). */
  readonly who: string;
}

/** The honest TDD loop diagram: four nodes on a ring (write test → system checks it
 *  fails → write code → system checks it passes → back to the top), drawn as boxes +
 *  arrows that visibly LOOP. The looping shape is the point (ADR-0157 §5). */
export interface LoopDiagram {
  /** The four nodes, in clockwise reveal order from the top. */
  readonly nodes: readonly LoopNode[];
  /** The centre caption — names the referee (the system, not the AI). */
  readonly centre: string;
}

/** The landed loop CONTENT, verbatim (the ADR-0165 §2 relocation keeps it
 *  unchanged — only its HOME moved, from transient corner chrome into the one
 *  growing picture's D5). */
export const HONEST_LOOP: LoopDiagram = {
  nodes: [
    {
      id: 'author',
      kind: 'author',
      label: 'Write a test that must pass',
      who: 'one agent',
    },
    {
      id: 'red',
      kind: 'check',
      label: 'Check it really fails first',
      who: 'the system',
    },
    {
      id: 'build',
      kind: 'build',
      label: 'Write code to pass the test',
      who: 'another agent',
    },
    {
      id: 'green',
      kind: 'check',
      label: 'Check it really passes now',
      who: 'the system',
    },
  ],
  centre: 'the system checks — not the AI',
};

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

const SVGNS = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

// ── the compact ring builder (the landed geometry) ───────────────────────────
// Four nodes on a squashed ring, clockwise from the top — top = write test
// (agent) → right = system checks it FAILS → bottom = write code (agent) →
// left = system checks it PASSES → (back to top). Curved arrows connect
// consecutive nodes AND close the loop, so the looping shape is unmistakable.
// Pure geometry (no Math.random, no clock); everything is a function of the data.

/** viewBox + ring layout (diagram units). Sized so all FOUR node boxes fit inside
 *  the viewBox with margin; the centre of the ring stays free (a small caption
 *  sits there). */
const LOOP_W = 308;
const LOOP_H = 250;
const RING_CX = LOOP_W / 2; // 154
const RING_CY = 121;
const RING_RX = 74;
const RING_RY = 86;
const NODE_W = 124;
const NODE_H = 42;

/** The four clockwise ring anchors (top, right, bottom, left) in diagram space. */
function ringAnchors(): { x: number; y: number }[] {
  // start at the TOP (−90°) and go clockwise.
  return [0, 1, 2, 3].map((i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 2;
    return { x: RING_CX + Math.cos(a) * RING_RX, y: RING_CY + Math.sin(a) * RING_RY };
  });
}

/** A curved arrow path (quadratic, bowed outward around the ring) from node i's
 *  edge to node j's edge, so the arc reads as travelling AROUND the loop. */
function loopArc(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  // bow the control point away from the ring centre (outward) for a round loop.
  const ox = mx - RING_CX;
  const oy = my - RING_CY;
  const olen = Math.hypot(ox, oy) || 1;
  const bow = 22;
  const cx = mx + (ox / olen) * bow;
  const cy = my + (oy / olen) * bow;
  // trim the endpoints toward the control point so the arrowhead sits off the box.
  const trim = (p: { x: number; y: number }, c: number): { x: number; y: number } => {
    const dx = cx - p.x;
    const dy = cy - p.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / l) * c, y: p.y + (dy / l) * c };
  };
  const a = trim(from, 30);
  const b = trim(to, 30);
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

/**
 * Build the honest TDD loop diagram (ADR-0157 §5) as a COMPACT standalone
 * element: boxes + arrows that visibly LOOP. Returns the body element and the
 * revealable node groups (in clockwise scaffold order); each node group carries
 * `is-hidden` (unless reduced motion) so a caller can stagger-reveal them.
 *
 * ⚠ THIS IS TELL'S ONE FIGURE, and the reason it earns the page is worth keeping written down: the
 * map behind it can show which islands are green, but it CANNOT show the loop that makes green mean
 * anything, because that happens between the agents rather than in the corpus. A diagram that only
 * redrew what the forest already says would be decoration; this one carries the single thing the
 * forest structurally cannot.
 *
 * It survived the narrator's retirement (`website-refresh-arc-pitch-overlays`) while
 * `act2-diagram.ts` — which drew the same HONEST_LOOP content as one stage of a six-stage growing
 * system diagram — did not. That is the same call in both directions: the owner rejected the
 * presenter's VOICE and its six-stage lesson, not the one picture that answers "who checks?".
 */
export function buildLoopDiagram(
  loop: LoopDiagram,
  reducedMotion: boolean,
): { body: HTMLElement; nodeEls: Element[] } {
  const body = el('div', 'act2-loop');
  const s = svg('svg', {
    class: 'act2-loop-svg',
    viewBox: `0 0 ${LOOP_W} ${LOOP_H}`,
    role: 'img',
    'aria-label':
      'A loop: an agent writes a test that must pass; the system checks it really fails; ' +
      'another agent writes code to pass it; the system checks it really passes; then the loop repeats. ' +
      'The system does the checking, not the AI.',
  });
  // arrowhead marker (scoped id so it can't clash with the map's a2-arrow).
  const defs = svg('defs', {});
  const marker = svg('marker', {
    id: 'a2loop-arrow',
    viewBox: '0 0 10 10',
    refX: 8,
    refY: 5,
    markerWidth: 6.5,
    markerHeight: 6.5,
    orient: 'auto-start-reverse',
  });
  marker.appendChild(svg('path', { d: 'M 0 1.4 L 8 5 L 0 8.6 z', class: 'act2-loop-arrowhead' }));
  defs.appendChild(marker);
  s.appendChild(defs);

  const anchors = ringAnchors();

  // the connecting arcs (drawn UNDER the nodes) — consecutive + the closing edge.
  const arcLayer = svg('g', { class: 'act2-loop-arcs' });
  for (let i = 0; i < anchors.length; i++) {
    const from = anchors[i]!;
    const to = anchors[(i + 1) % anchors.length]!;
    const path = svg('path', {
      class: 'act2-loop-arc',
      d: loopArc(from, to),
      'marker-end': 'url(#a2loop-arrow)',
    });
    arcLayer.appendChild(path);
  }
  s.appendChild(arcLayer);

  // the centre caption (names the referee — the system, not the AI).
  const centre = svg('text', {
    class: 'act2-loop-centre',
    // sit in the CLEAR band between the top node (bottom ≈ 56) and the left/right
    // node row (top ≈ 100) — centred across the full width, clear of every box.
    x: RING_CX,
    y: 80,
    'text-anchor': 'middle',
  });
  // split the caption over up to two lines so it fits inside the ring.
  const centreWords = loop.centre.split(' — ');
  if (centreWords.length === 2) {
    const l1 = svg('tspan', { x: RING_CX, dy: '-0.4em' });
    l1.textContent = centreWords[0]!;
    const l2 = svg('tspan', { x: RING_CX, dy: '1.25em', class: 'act2-loop-centre-em' });
    l2.textContent = centreWords[1]!;
    centre.append(l1, l2);
  } else {
    centre.textContent = loop.centre;
  }
  s.appendChild(centre);

  // the nodes (drawn OVER the arcs), in clockwise reveal order.
  const nodeEls: Element[] = loop.nodes.map((node, i) => {
    const p = anchors[i] ?? { x: RING_CX, y: RING_CY };
    const g = svg('g', {
      class: `act2-loop-node kind-${node.kind}`,
      'data-node': node.id,
      transform: `translate(${(p.x - NODE_W / 2).toFixed(1)} ${(p.y - NODE_H / 2).toFixed(1)})`,
    });
    g.appendChild(
      svg('rect', { class: 'act2-loop-box', x: 0, y: 0, width: NODE_W, height: NODE_H, rx: 8 }),
    );
    // the label (line 1) + who (line 2), centred in the box.
    const label = svg('text', {
      class: 'act2-loop-label',
      x: NODE_W / 2,
      y: 18,
      'text-anchor': 'middle',
    });
    label.textContent = node.label;
    const who = svg('text', {
      class: 'act2-loop-who',
      x: NODE_W / 2,
      y: 31,
      'text-anchor': 'middle',
    });
    who.textContent = node.who;
    g.append(label, who);
    if (!reducedMotion) g.classList.add('is-hidden');
    s.appendChild(g);
    return g;
  });

  body.appendChild(s);
  return { body, nodeEls };
}
