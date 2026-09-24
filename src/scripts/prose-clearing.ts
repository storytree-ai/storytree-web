// ---------------------------------------------------------------------------
// prose-clearing — nothing on the map may sit under the words drawn over it.
//
// The entry forest carries page text ON the map: TELL's prose column (and its one diagram) at the
// top left, the key at the bottom left, the dated snapshot stamp across the bottom, and the ending
// that joins them. While the map was flat the resting view happened to clear most of it; the 3D
// land's 50° camera made the map about a quarter shorter, so the opening view reached one more row
// and put an island and its nameplate straight under the first sentence (measured 2026-09-24 at
// 1600x1000: `context-traversal-capture` under "You either read every line yourself, or you trust
// it and hope."). TELL's focus beats then fly the camera in close, and the islands around the one
// being talked about slid under the stamp and the key on every arm, the flat map's included. A
// sentence read over an island's name is two things said at once and neither of them legible.
//
// ⚠ IT CLEARS THE GROUND, IT DOES NOT MOVE THE MAP. The resting composition is a decision of the
// shared render core (`restingFrame`, ADR-0471) and TELL's focus framing is already biased clear of
// the column (`FOCUS_ANCHOR`). What was missing is a guarantee that holds for EVERY beat, every
// camera and every viewport, so the map is faded out under each piece of text's own measured box —
// the SVG and the 3D land together. The boxes are read live, so a two-line beat clears two lines,
// the loop diagram clears the diagram, and a key hidden on a narrow screen clears nothing.
//
// ⚠ A FEATHERED FADE, NOT A CARD. The prose column's own comment explains why the copy wears a
// soft scrim rather than a panel: a hard card reads as a dialog to dismiss. The map fades to the
// page's board over a short band around each box, the way the canopy already runs off the top.
// ---------------------------------------------------------------------------

/** The part of a DOMRect the clearing reads. */
export interface BoxLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** How far past the text the map stays fully cleared, in CSS px. */
export const CLEARING_PAD = 8;
/** How wide the fade back to the full map is, in CSS px. Short on purpose: an island half inside a
 *  long fade reads as a ghost of itself, which is its own kind of illegible. */
export const CLEARING_FEATHER = 14;

/**
 * Text anchored in the frame's TOP-LEFT corner — TELL's column, whose CSS pins it there — cleared as
 * ONE box running to that corner. Measured beat by beat, 2026-09-24: clearing the prose line by line
 * left an island threaded BETWEEN two lines and its crown poking out ABOVE the first, which is an
 * island sitting in the text by another route. The corner is the honest shape for top-left text: it
 * never removes map to the right of the longest line or below the last one.
 */
export function cornerBox(frame: BoxLike, text: readonly BoxLike[]): BoxLike | null {
  let right = -Infinity;
  let bottom = -Infinity;
  for (const box of text) {
    if (box.width <= 0 || box.height <= 0) continue;
    right = Math.max(right, box.left + box.width);
    bottom = Math.max(bottom, box.top + box.height);
  }
  if (!Number.isFinite(right) || right <= frame.left || bottom <= frame.top) return null;
  return { left: frame.left, top: frame.top, width: right - frame.left, height: bottom - frame.top };
}

/** The cleared holes, frame-relative and clipped to the frame — the pure half of the rule. */
export function clearingHoles(
  frame: BoxLike,
  text: readonly BoxLike[],
  pad = CLEARING_PAD,
): Array<{ x: number; y: number; w: number; h: number }> {
  const holes: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (const box of text) {
    if (box.width <= 0 || box.height <= 0) continue;
    const x0 = Math.max(0, box.left - frame.left - pad);
    const y0 = Math.max(0, box.top - frame.top - pad);
    const x1 = Math.min(frame.width, box.left - frame.left + box.width + pad);
    const y1 = Math.min(frame.height, box.top - frame.top + box.height + pad);
    if (x1 <= x0 || y1 <= y0) continue;
    holes.push({ x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) });
  }
  return holes;
}

/**
 * The alpha mask that shows the map everywhere except under the text: an opaque frame with a hole
 * cut per box (even-odd), blurred by the feather. Null when there is nothing to clear, so the
 * caller removes the mask rather than paying for an image that masks nothing.
 */
export function clearingMaskUrl(
  frame: BoxLike,
  text: readonly BoxLike[],
  pad = CLEARING_PAD,
  feather = CLEARING_FEATHER,
): string | null {
  const holes = clearingHoles(frame, text, pad);
  const w = Math.round(frame.width);
  const h = Math.round(frame.height);
  if (holes.length === 0 || w <= 0 || h <= 0) return null;
  // The outer ring is drawn well past the frame so the blur never fades the frame's own edges.
  const m = feather * 3;
  const d =
    `M${-m} ${-m}H${w + m}V${h + m}H${-m}Z` +
    holes.map((r) => `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}Z`).join('');
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
    `<filter id='f' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='${feather / 2.5}'/></filter>` +
    `<path fill-rule='evenodd' fill='black' filter='url(#f)' d='${d}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** The class that turns the mask on; the custom property it reads is set alongside it. */
export const CLEARING_CLASS = 'has-prose-clearing';

/**
 * The boxes one piece of text actually occupies on screen.
 *
 * ⚠ TIGHT TO THE GLYPHS WHERE THERE IS NO CARD. TELL's column is a 30rem box whose lines rarely
 * fill it, and clearing the whole box faded islands that sat beside a short line rather than under
 * any word (measured: a two-line beat's box ran 160px past its second line). So an element with no
 * background of its own is measured by its text's line boxes plus any drawing inside it (the one
 * diagram); a CARD — the key, the stamp, the ending — is measured whole, because its background is
 * part of what covers the map.
 *
 * An element that is not showing — `display: none`, `visibility: hidden`, or fully transparent,
 * which is how the ending waits for its reveal — covers nothing and clears nothing.
 */
function textBoxes(el: Element): BoxLike[] {
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return [];
  const card = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';
  if (card || !(el instanceof HTMLElement)) return [el.getBoundingClientRect()];
  const boxes: BoxLike[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if ((node.textContent ?? '').trim() === '' || node.parentElement?.closest('svg')) continue;
    range.selectNodeContents(node);
    boxes.push(...range.getClientRects());
  }
  for (const drawing of el.querySelectorAll('svg')) boxes.push(drawing.getBoundingClientRect());
  return boxes;
}

/** How one caller's text is cleared: each box on its own, or all of it as one top-left corner. */
export type ClearingShape = 'boxes' | 'top-left';

interface Source {
  readonly text: readonly Element[];
  readonly shape: ClearingShape;
}

interface Registry {
  readonly sources: Set<Source>;
  readonly resize: ResizeObserver | null;
  readonly mutate: MutationObserver | null;
}
const registries = new WeakMap<HTMLElement, Registry>();

function redraw(frame: HTMLElement, registry: Registry): void {
  const rect = frame.getBoundingClientRect();
  const text = [...registry.sources].flatMap((source) => {
    const boxes = source.text.flatMap(textBoxes);
    if (source.shape === 'boxes') return boxes;
    const corner = cornerBox(rect, boxes);
    return corner === null ? [] : [corner];
  });
  const url = clearingMaskUrl(rect, text);
  if (url === null) {
    frame.classList.remove(CLEARING_CLASS);
    frame.style.removeProperty('--prose-clear-mask');
    return;
  }
  if (frame.style.getPropertyValue('--prose-clear-mask') !== url) frame.style.setProperty('--prose-clear-mask', url);
  frame.classList.add(CLEARING_CLASS);
}

/**
 * Keep `frame` (the element holding the map AND its land) cleared under `text`, re-measured
 * whenever the frame or any of the text resizes, changes, or is shown or hidden. Several callers
 * may clear under their own text at once — TELL its prose, the arrival its furniture — and the mask
 * is the union of all of them. Returns the teardown, which lifts this caller's text and nobody
 * else's.
 */
export function clearUnder(
  frame: HTMLElement,
  text: readonly Element[],
  shape: ClearingShape = 'boxes',
): () => void {
  let registry = registries.get(frame);
  if (!registry) {
    let queued = false;
    const schedule = (): void => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const current = registries.get(frame);
        if (current) redraw(frame, current);
      });
    };
    const fresh: Registry = {
      sources: new Set(),
      resize: typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule),
      mutate: typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedule),
    };
    fresh.resize?.observe(frame);
    registries.set(frame, fresh);
    registry = fresh;
  }
  const own = registry;
  const source: Source = { text, shape };
  own.sources.add(source);
  for (const el of text) {
    own.resize?.observe(el);
    // A line revealed, a beat swapped, the ending unhidden: none of these need change a size.
    own.mutate?.observe(el, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    // …and a fade that has just finished: a class change is read on the next frame, when a reveal's
    // opacity can still be exactly zero, so the end of the transition is read again.
    el.addEventListener('transitionend', () => {
      const current = registries.get(frame);
      if (current?.sources.has(source)) redraw(frame, current);
    });
  }
  redraw(frame, own);
  return () => {
    if (!own.sources.delete(source)) return;
    for (const el of text) {
      if (![...own.sources].some((s) => s.text.includes(el))) own.resize?.unobserve(el);
    }
    // A MutationObserver cannot unobserve one target; a mutation on a lifted source just redraws.
    redraw(frame, own);
  };
}
