// ---------------------------------------------------------------------------
// act2-lineage-diagram — WHICH WAY A TRAIL RUNS, drawn once instead of decorated ninety times.
//
// ⚠ THIS IS THE ANSWER TO THE ARROWHEADS FORK, AND THE FORK IS CLOSED (ADR-0501 D1). The edges beat
// landed describing a direction the picture does not show, and
// `oq-the-reworked-act-2-is-live-does-it-read-and-should-the-li` put three options to the owner:
// leave it, arrowheads on every line, or arrowheads only when the camera is close. He chose NONE of
// them: *"dont add them to the paths, you can just explain it with an animated diagram that the
// linage flows from the bottom upwards."*
//
// That is better than either declined option on three counts he did not have to state. It costs
// nothing at the resting zoom he already signed off. It needs no change to the shared render core,
// so it cannot land in the desktop app. And it teaches the RULE once rather than decorating 90
// lines with a glyph that is 1.4 CSS px wide at the resting frame — a smudge, not a signal.
//
// ⚠ SO THE ARROWHEAD IN HERE IS NOT A CONTRADICTION. What D1 forbids is arrowheads on the MAP's
// trails. A teaching figure that explains direction obviously draws one; `act2-loop-diagram.ts` has
// shipped an arrowhead marker beside this one since the loop landed. The map still measures zero
// `<marker>` elements and `marker-end: none` on every segment, and that is the property to keep.
//
// ── HOW IT ANIMATES WITHOUT A CLOCK ─────────────────────────────────────────────────────────────
//
// Two mechanisms, both borrowed rather than invented, and NEITHER is a timer in this module:
//
//   1. **The dashes flow upward** — `stroke-dasharray` plus an animated `stroke-dashoffset`, which
//      is exactly how `.act2-loop-arc` has drawn its circulating loop since it landed. Pure CSS, so
//      the global `prefers-reduced-motion` block neutralises it along with every other transition
//      on the page, and nothing here has to ask.
//   2. **It assembles from the BOTTOM UP** — each part is parked `is-hidden` and the CALLER
//      un-hides them in the order this function returns them, the same contract
//      `buildLoopDiagram` already has with `applyFigure`. The order is bottom box → connector →
//      top box, so the reader watches the thing grow the way the lineage runs. That is the
//      sentence enacted rather than captioned, and it is why the reveal order is a returned
//      guarantee rather than an implementation detail.
//
// ⚠ PURE UNTIL CALLED, AND NO CLOCK ANYWHERE. No `setTimeout`, no `setInterval`, no
// `requestAnimationFrame`, no `Math.random`, no wall-clock — the same floor `act2-loop-diagram.ts`
// holds. Geometry is a function of the constants below and of nothing else, so two builds of this
// figure are byte-identical.
//
// ── WHY TWO BOXES AND NOT THREE ─────────────────────────────────────────────────────────────────
//
// A chain of three would say "and it keeps going", which is true and which the beat's own third
// line already says ("Together they make a DAG"). What the figure has to carry is the RELATION, and
// a relation needs exactly two ends. The middle box of a three-box stack is both ends at once and
// has no honest label; leaving it blank between two labelled siblings reads as a missing caption
// rather than as an ellipsis. The map behind the figure is the chain.
//
// ⚠ THE BOXES ARE DELIBERATELY NEUTRAL, NOT GREEN. Colour means PROVEN on this map (ADR-0040), and
// a green box in a figure about POSITION would assert a status the figure knows nothing about. The
// two labels are the whole content.
// ---------------------------------------------------------------------------

/**
 * The two ends of a dependency, in the reader's words.
 *
 * ⚠ THESE STRINGS MUST MATCH THE EDGES BEAT'S OWN SENTENCE, and `act2-tell.test.ts` asserts it
 * rather than trusting two files to agree from memory. The prose says a trail runs "from what is
 * needed to what needs it"; the figure is that sentence drawn, so a reword on one side that did not
 * reach the other would leave the picture explaining a sentence the page no longer makes. The
 * inversion is the specific mistake worth catching — `roam-falsify.mjs` already seeds a reversed
 * dependency as one of its defects, one surface along.
 */
export const LINEAGE_UPPER = 'what needs it';
export const LINEAGE_LOWER = 'what is needed';

const SVGNS = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** viewBox + stack layout (diagram units). Deliberately narrow: it sits UNDER the prose column in
 *  the same flex layer, so its height is what competes for the screen, not its width. */
const W = 240;
const H = 150;
const BOX_W = 176;
const BOX_H = 36;
const BOX_X = (W - BOX_W) / 2; // 32
const TOP_Y = 4;
const BOTTOM_Y = 110;
/** Where the connector starts and stops — the gap between the two boxes, trimmed at the top so the
 *  arrowhead sits clear of the box it points at rather than under its stroke. */
const STEM_X = W / 2; // 120
const STEM_FROM_Y = BOTTOM_Y; // the bottom box's TOP edge — the trail leaves what is needed…
const STEM_TO_Y = TOP_Y + BOX_H + 6; // …and arrives just below what needs it

/**
 * Build the lineage figure: two boxes and one upward arrow, returned with the parts in BOTTOM-TO-TOP
 * reveal order.
 *
 * Each returned element is parked `is-hidden` (unless the visitor asked for reduced motion, in which
 * case the whole figure arrives assembled) so the caller can stagger them — the same contract
 * `buildLoopDiagram` has, honoured by the same branch of `applyFigure`.
 */
export function buildLineageDiagram(reducedMotion: boolean): {
  body: HTMLElement;
  nodeEls: Element[];
} {
  const body = document.createElement('div');
  body.className = 'act2-lineage';

  const s = svg('svg', {
    class: 'act2-lineage-svg',
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    // The figure's whole content, for a reader who gets no picture. It says the RULE, because the
    // rule is the thing the diagram exists to carry.
    'aria-label':
      'Two boxes, one above the other, joined by an arrow that points upward: ' +
      `the lower box is ${LINEAGE_LOWER}, the upper box is ${LINEAGE_UPPER}. ` +
      'On the map, what something is built on sits below it.',
  });

  const defs = svg('defs', {});
  const marker = svg('marker', {
    // Scoped id, so it cannot clash with the loop figure's `a2loop-arrow` when both have been in
    // the DOM within one sequence.
    id: 'a2lineage-arrow',
    viewBox: '0 0 10 10',
    refX: 8,
    refY: 5,
    markerWidth: 7,
    markerHeight: 7,
    orient: 'auto-start-reverse',
  });
  marker.appendChild(svg('path', { d: 'M 0 1.4 L 8 5 L 0 8.6 z', class: 'act2-lineage-arrowhead' }));
  defs.appendChild(marker);
  s.appendChild(defs);

  /** One labelled box. */
  const box = (y: number, label: string, id: string): SVGGElement => {
    const g = svg('g', { class: 'act2-lineage-node', 'data-node': id });
    g.appendChild(
      svg('rect', { class: 'act2-lineage-box', x: BOX_X, y, width: BOX_W, height: BOX_H, rx: 8 }),
    );
    const text = svg('text', {
      class: 'act2-lineage-label',
      x: W / 2,
      y: y + BOX_H / 2 + 3.4,
      'text-anchor': 'middle',
    });
    text.textContent = label;
    g.append(text);
    return g;
  };

  // ⚠ THE STEM IS DRAWN FIRST SO IT SITS UNDER THE BOXES, and revealed SECOND. Paint order and
  // reveal order are different questions, and conflating them is how the arrowhead ends up drawn
  // over the box it points at.
  const stem = svg('g', { class: 'act2-lineage-node', 'data-node': 'stem' });
  stem.appendChild(
    svg('path', {
      class: 'act2-lineage-stem',
      d: `M ${STEM_X} ${STEM_FROM_Y} L ${STEM_X} ${STEM_TO_Y}`,
      'marker-end': 'url(#a2lineage-arrow)',
    }),
  );
  const upper = box(TOP_Y, LINEAGE_UPPER, 'upper');
  const lower = box(BOTTOM_Y, LINEAGE_LOWER, 'lower');
  s.append(stem, lower, upper);

  // Bottom to top: the lineage's own direction, which is the one thing this figure is for.
  const nodeEls: Element[] = [lower, stem, upper];
  if (!reducedMotion) for (const node of nodeEls) node.classList.add('is-hidden');

  body.appendChild(s);
  return { body, nodeEls };
}
