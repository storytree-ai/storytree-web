// ---------------------------------------------------------------------------
// forest-arrival — GROW. Where the visitor lands when chapter 1 resolves.
//
// Chapter 1 is a storm in a terminal. Its transform button collapses that into quiet ground, and
// this is what the ground turns out to be: storytree's OWN forest, as of a stated moment, framed at
// a composition someone chose, and free to move around in.
//
// ⚠ THE FOREST IS REAL AND THAT IS THE ENTIRE POINT. Chapter 2 used to walk the visitor through a
// scripted three-story example laid out at build time. A synthetic forest is a claim about a
// product; the real one is evidence of it — the argument the site is making is "this system built
// the site you are looking at", and a made-up map throws it away. The data comes from the same
// stamped snapshot `/forest/` renders (`src/data/forest-snapshot.json`), published by a job.
//
// ⚠ THE SVG IS BUILT AT BUILD TIME AND THIS MODULE ONLY FRAMES IT. `index.astro` calls `forestSvg`
// in its frontmatter, so the whole map is inert markup by the time a browser sees it: no scene
// building, no trail routing, and — the reason it matters — no `zod`, no `act2-director` and no
// `act2-walkthrough` in the client bundle. What ships here is a `viewBox` and two gestures.
//
// ⚠ ZERO WebGL. Same fence as `inflection.ts`, which this replaces the destination of: pure SVG/DOM,
// no React, no three.js. The ~1.2 MB R3F island is not on this path and must not return to it.
//
// THE FRAMING IS NOT THIS MODULE'S DECISION. It comes from `restingFrame` in the shared render core
// (ADR-0471) — the same rule the studio app's map opens on, synced here by `pnpm sync:web-engine`.
// That is deliberate: the app and the site showing the same forest at two different compositions
// would make the site's picture a marketing choice rather than a reading of the system. If the
// framing here looks wrong, the fix is in the core, not in this file.
// ---------------------------------------------------------------------------

import { restingFrame } from '../lib/forest-world';

/** A `viewBox` rect, in the map's own world units. */
export interface ViewBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** What the build-time render hands the browser: the laid-out world's extent, and every island's
 *  diameter, which is what the composition is pinned to. Both are emitted by `forestSvg` onto the
 *  `<svg>` element rather than re-derived here — re-deriving would mean shipping the whole layout
 *  engine to the client to recompute numbers the build already knew. */
export interface ForestFramePayload {
  readonly width: number;
  readonly height: number;
  readonly islandDiameters: readonly number[];
}

/** How far past the world's own edges a reader may pan, as a fraction of the visible frame. A
 *  little overscroll keeps an edge island from being pinned flush against the frame border; too
 *  much and the reader can lose the forest off-screen entirely and not know which way to come
 *  back. */
const OVERSCROLL = 0.25;

/** The tightest and loosest the reader may zoom, relative to the RESTING scale. The loose end is
 *  deliberately generous: the resting view is a deliberate crop, and a crop is only honest if the
 *  rest is reachable, so zooming out must always be able to reach the whole forest and then some.
 *  `clampZoom` enforces that reachability rather than trusting these numbers. */
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 6;

/**
 * The DESIGNED resting viewBox — what the visitor arrives on.
 *
 * Bottom-anchored and horizontally centred, matching the studio map's own placement. Because the
 * forest is ranked bottom-up, anchoring the bottom at a scale tighter than the fit is what puts the
 * foundation on screen and runs the canopy off the top: the crop IS the composition, and panning up
 * is the gesture it exists to provoke.
 */
export function restingViewBox(
  payload: ForestFramePayload,
  frameW: number,
  frameH: number,
  bottomInsetPx = 0,
): ViewBox {
  // ⚠ THE COMPOSITION IS MEASURED AGAINST THE FRAME MINUS ITS CHROME, and the world is anchored
  // ABOVE that chrome rather than under it. The snapshot stamp is docked across the bottom of this
  // surface, and the frame is bottom-anchored, so the two land on top of each other: without this
  // the foundation row — the rank the arrival exists to open on — is exactly what the stamp covers.
  // An island behind the stamp is not on screen, so sizing against the raw frame would also deliver
  // a smaller island than the composition states. Same reasoning as `restingWorld`'s padding in the
  // studio, for the same reason: docked chrome covers the frame whatever the scale is.
  const inset = Math.max(0, Math.min(bottomInsetPx, frameH * 0.4));
  const usableH = Math.max(1, frameH - inset);
  const { scale } = restingFrame({
    islandDiameters: payload.islandDiameters,
    contentWidth: payload.width,
    contentHeight: payload.height,
    frameWidth: frameW,
    frameHeight: usableH,
  });
  // The viewBox still spans the WHOLE frame — the SVG fills it — but the world's bottom edge is
  // placed at the top of the chrome rather than at the frame's bottom.
  const w = frameW / scale;
  const h = frameH / scale;
  return {
    x: (payload.width - w) / 2,
    y: payload.height - usableH / scale,
    w,
    h,
  };
}

/** The viewBox width at which the WHOLE world is visible in this frame — the fitted view, kept only
 *  as the thing the reader must always be able to zoom back out to. */
export function wholeWorldWidth(payload: ForestFramePayload, frameW: number, frameH: number): number {
  const scale = Math.min(frameW / payload.width, frameH / payload.height);
  return frameW / Math.max(scale, Number.EPSILON);
}

/**
 * Clamp a proposed viewBox WIDTH into the reader's allowed zoom range.
 *
 * ⚠ THE ZOOM-OUT LIMIT IS THE WHOLE WORLD OR LOOSER, NEVER MERELY A MULTIPLE OF THE RESTING VIEW.
 * `MIN_ZOOM * resting` is a ratio and says nothing about whether the forest fits inside it; on a
 * corpus cropped harder than `1 / MIN_ZOOM` it would stop short of the whole forest and the reader
 * could never see what the crop promised them. Taking the looser of the two makes the guarantee
 * about the WORLD rather than about a constant.
 */
export function clampZoom(
  proposedW: number,
  restingW: number,
  wholeW: number,
): number {
  const loosest = Math.max(restingW / MIN_ZOOM, wholeW);
  const tightest = restingW / MAX_ZOOM;
  return Math.min(loosest, Math.max(tightest, proposedW));
}

/**
 * Clamp a viewBox so the reader keeps hold of the forest.
 *
 * Panning is bounded to the world plus a fraction of a frame of overscroll on each side. When the
 * view is WIDER than the world on an axis — which happens as soon as anyone zooms out past the fit
 * — the world is centred on that axis instead, because there is nothing to pan to and letting it
 * drift produces a screen with the forest sliding off one edge for no reason.
 */
export function clampViewBox(box: ViewBox, payload: ForestFramePayload): ViewBox {
  const axis = (pos: number, size: number, world: number): number => {
    if (size >= world) return (world - size) / 2;
    const slack = size * OVERSCROLL;
    return Math.min(world - size + slack, Math.max(-slack, pos));
  };
  return {
    ...box,
    x: axis(box.x, box.w, payload.width),
    y: axis(box.y, box.h, payload.height),
  };
}

/** Zoom about a point, keeping the world point under that point fixed — the zoom-to-cursor
 *  invariant. `fx`/`fy` are the pointer's position within the frame, 0..1. */
export function zoomAbout(box: ViewBox, nextW: number, fx: number, fy: number): ViewBox {
  const k = nextW / box.w;
  const nextH = box.h * k;
  return {
    x: box.x + fx * box.w * (1 - k),
    y: box.y + fy * box.h * (1 - k),
    w: nextW,
    h: nextH,
  };
}

export function formatViewBox(box: ViewBox): string {
  const r = (n: number): string => (Math.round(n * 100) / 100).toString();
  return `${r(box.x)} ${r(box.y)} ${r(box.w)} ${r(box.h)}`;
}

/** A rectangle in the map's own world units — what `getBBox()` hands back for one island group. */
export interface WorldRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** How much of the frame's SHORTER side one focused island should span. Small enough that the
 *  island keeps its neighbours around it — the point of flying to an island is to show it IN the
 *  forest, and an island filling the screen is just a picture of an island. */
const FOCUS_FILL = 0.26;

/**
 * Where in the frame a focused island is placed, as fractions of the view.
 *
 * ⚠ NOT CENTRED, AND THAT IS THE WHOLE REASON THIS IS A PARAMETER. TELL's prose sits in a column
 * down the left of the same frame, so an island placed at dead centre is read at the same moment it
 * is half covered by the sentence pointing at it. Biasing right and slightly low puts it in the
 * clear against the copy that is actually on screen when a focus happens.
 */
const FOCUS_ANCHOR = { fx: 0.64, fy: 0.56 } as const;

/**
 * The viewBox that puts one island on screen at a readable size, in the clear of the prose column.
 *
 * Pure, so the framing decision is testable without a browser: the DOM's only job is to hand over
 * the island's rectangle and the frame's aspect. The result is still run through `clampZoom` and
 * `clampViewBox` by the caller, so a focus can never take the reader somewhere their own gestures
 * could not have reached.
 */
export function focusViewBox(island: WorldRect, frameAspect: number): ViewBox {
  const span = Math.max(island.w, island.h, Number.EPSILON);
  const short = span / FOCUS_FILL;
  const w = frameAspect >= 1 ? short * frameAspect : short;
  const h = frameAspect >= 1 ? short : short / Math.max(frameAspect, Number.EPSILON);
  const cx = island.x + island.w / 2;
  const cy = island.y + island.h / 2;
  return { x: cx - FOCUS_ANCHOR.fx * w, y: cy - FOCUS_ANCHOR.fy * h, w, h };
}

/**
 * One island's rectangle in the map's WORLD coordinates — the space the `viewBox` is expressed in.
 *
 * ⚠ `getBBox()` IS NOT ENOUGH AND THE ERROR IS SILENT. It reports the element's own user space, and
 * `sceneToSvg` wraps the whole laid-out scene in a `<g transform="translate(…)">` to centre it, so
 * an island's raw bbox comes back offset by the scene translation — measured here as
 * `translate(1782.5 3876.8)`, which put `website-experience` at y −702 in a world that starts at 0.
 * A focus computed from that lands OUTSIDE the world, gets pinned by `clampViewBox` to the
 * overscroll corner, and produces a perfectly smooth camera move to the wrong place. Nothing
 * throws, nothing logs, and the only symptom is a sentence pointing at empty sea.
 *
 * `getScreenCTM()` on the root `<svg>` maps its user units (i.e. `viewBox` space) to the screen, so
 * composing the island's screen matrix with the root's inverse gives island-space → world-space
 * whatever ancestors sit between them. Both corners are transformed and re-normalised because the
 * matrix is not required to be a pure translation.
 *
 * Returns null when the browser cannot answer (a detached or `display:none` subtree has no CTM), so
 * the caller declines the move rather than flying somewhere arbitrary.
 */
export function islandWorldRect(
  root: SVGSVGElement,
  isle: SVGGraphicsElement,
): WorldRect | null {
  const rootCtm = root.getScreenCTM();
  const isleCtm = isle.getScreenCTM();
  if (rootCtm === null || isleCtm === null) return null;
  const toWorld = rootCtm.inverse().multiply(isleCtm);
  const bb = isle.getBBox();
  if (bb.width <= 0 || bb.height <= 0) return null;
  const corner = (x: number, y: number): { x: number; y: number } => {
    const p = root.createSVGPoint();
    p.x = x;
    p.y = y;
    const q = p.matrixTransform(toWorld);
    return { x: q.x, y: q.y };
  };
  const a = corner(bb.x, bb.y);
  const b = corner(bb.x + bb.width, bb.y + bb.height);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

/** Ease-in-out, so a camera move starts and stops the way a hand would rather than snapping. */
export function easeInOut(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2;
}

/** Interpolate between two viewBoxes at eased progress `t`. */
export function lerpViewBox(from: ViewBox, to: ViewBox, t: number): ViewBox {
  const e = easeInOut(t);
  const mix = (a: number, b: number): number => a + (b - a) * e;
  return { x: mix(from.x, to.x), y: mix(from.y, to.y), w: mix(from.w, to.w), h: mix(from.h, to.h) };
}

/** Read the build-time payload off the rendered `<svg>`. Returns null rather than throwing so a
 *  malformed or absent payload leaves the map exactly as the build rendered it — a whole-world
 *  static picture, which is a worse composition but never a blank screen. */
export function readFramePayload(svg: Element): ForestFramePayload | null {
  const raw = svg.getAttribute('data-forest-frame');
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { width, height, islandDiameters } = parsed as Record<string, unknown>;
    if (typeof width !== 'number' || typeof height !== 'number') return null;
    if (!Array.isArray(islandDiameters)) return null;
    const diameters = islandDiameters.filter((d): d is number => typeof d === 'number');
    if (diameters.length === 0 || width <= 0 || height <= 0) return null;
    return { width, height, islandDiameters: diameters };
  } catch {
    return null;
  }
}

/**
 * What the arrival lets a later movement do to the view it settled.
 *
 * ⚠ THESE THREE EXIST FOR TELL AND ARE DELIBERATELY NOT A CAMERA API. There is no `panTo`, no
 * `setZoom` and no way to reach an arbitrary framing, because the composition is a decision made in
 * the shared render core (ADR-0471) and a surface that could put the map anywhere would quietly
 * become the place that decision gets remade. What a caller may say is "show me this island" and
 * "put it back" — and `onReaderTakeOver` is the third because any of it must yield the instant the
 * reader touches the map.
 */
export interface ArrivalHandle {
  unmount(): void;
  /**
   * Fly to one island by its story id and hold there. Returns false — having changed nothing — when
   * the island is not on this map, so a caller pointing at a story that has left the corpus can
   * drop the beat instead of flying to an empty patch of sea.
   */
  focusIsland(id: string): boolean;
  /** Fly back to the composition GROW settled on. A no-op once the reader has taken the view over. */
  resetView(): void;
  /** Register a callback for the first READER pan or zoom. A programmatic focus never fires it. */
  onReaderTakeOver(cb: () => void): void;
}

/** How much of the frame's bottom the snapshot stamp occupies, in CSS px, measured off the element
 *  itself. Zero when there is no stamp — this surface must still frame correctly without one. */
function stampInset(container: HTMLElement): number {
  const layer = container.closest('#storm-land') ?? container;
  const stamp = layer.querySelector('.storm-land-stamp');
  if (!stamp) return 0;
  const rect = stamp.getBoundingClientRect();
  const frame = container.getBoundingClientRect();
  if (rect.height <= 0 || frame.height <= 0) return 0;
  // From the stamp's TOP to the frame's bottom, so its own offset from the edge is included: what
  // matters is how much of the bottom of the frame is unusable, not how tall the stamp is.
  return Math.max(0, frame.bottom - rect.top);
}

/**
 * Frame the already-rendered forest at the designed resting view and let the visitor move around it.
 *
 * The SVG is expected to be in `container` already, put there by the build. If it is not, or its
 * payload is unreadable, this does nothing and says so by returning a handle whose `unmount` is a
 * no-op — the visitor keeps the static whole-world picture the build rendered.
 *
 * ⚠ IT TAKES NO `reducedMotion`, and that is not an oversight. Every other mount on this path does,
 * because every other mount ANIMATES. Arriving does not: the resting view is a composition that is
 * simply true when the map appears, there is no tween, no clock and nothing to settle. Accepting the
 * flag and ignoring it would imply this surface had motion it was choosing not to reduce.
 */
export function mountForestArrival(container: HTMLElement): ArrivalHandle {
  const inert: ArrivalHandle = {
    unmount(): void {},
    focusIsland(): boolean {
      return false;
    },
    resetView(): void {},
    onReaderTakeOver(): void {},
  };
  const svg = container.querySelector('svg.forest-arrival-svg');
  if (!svg) return inert;
  const payload = readFramePayload(svg);
  if (!payload) return inert;

  let box: ViewBox = { x: 0, y: 0, w: payload.width, h: payload.height };
  let restingW = payload.width;
  let wholeW = payload.width;

  const apply = (): void => {
    box = clampViewBox(box, payload);
    svg.setAttribute('viewBox', formatViewBox(box));
  };

  const settle = (): void => {
    const rect = svg.getBoundingClientRect();
    const frameW = rect.width || container.clientWidth;
    const frameH = rect.height || container.clientHeight;
    if (frameW <= 0 || frameH <= 0) return;
    // MEASURED, not assumed: the stamp's height depends on how many lines its text wraps to, which
    // depends on the viewport. A hard-coded inset would be right at one width and wrong at every
    // other, and would be wrong SILENTLY — the islands would simply sit under it.
    box = restingViewBox(payload, frameW, frameH, stampInset(container));
    restingW = box.w;
    wholeW = wholeWorldWidth(payload, frameW, frameH);
    apply();
  };

  // ── pan ──────────────────────────────────────────────────────────────────
  let dragging: number | null = null;
  let lastX = 0;
  let lastY = 0;

  const onPointerDown = (e: Event): void => {
    const pe = e as PointerEvent;
    if (pe.button !== 0) return;
    dragging = pe.pointerId;
    lastX = pe.clientX;
    lastY = pe.clientY;
    (svg as SVGElement).setPointerCapture?.(pe.pointerId);
    (svg as SVGElement).classList.add('is-grabbing');
  };

  const onPointerMove = (e: Event): void => {
    const pe = e as PointerEvent;
    if (dragging !== pe.pointerId) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return;
    // World units per CSS px, taken from the CURRENT viewBox, so a drag tracks the cursor at every
    // zoom rather than accelerating as the reader zooms out.
    const perPx = box.w / rect.width;
    box = { ...box, x: box.x - (pe.clientX - lastX) * perPx, y: box.y - (pe.clientY - lastY) * perPx };
    lastX = pe.clientX;
    lastY = pe.clientY;
    apply();
  };

  const endDrag = (e: Event): void => {
    const pe = e as PointerEvent;
    if (dragging !== pe.pointerId) return;
    dragging = null;
    (svg as SVGElement).classList.remove('is-grabbing');
  };

  // ── zoom ─────────────────────────────────────────────────────────────────
  const onWheel = (e: Event): void => {
    const we = e as WheelEvent;
    we.preventDefault();
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const factor = Math.exp(we.deltaY * 0.0015);
    const nextW = clampZoom(box.w * factor, restingW, wholeW);
    box = zoomAbout(box, nextW, (we.clientX - rect.left) / rect.width, (we.clientY - rect.top) / rect.height);
    apply();
  };

  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('wheel', onWheel, { passive: false });

  // Declared before the observer that reads it: once the reader has taken the view over it is
  // theirs, and a resize must not snatch it back.
  let readerHasMoved = false;

  let resizeObserver: ResizeObserver | null = null;
  try {
    // Re-settle on resize ONLY while the reader has not taken over. Once they have panned or
    // zoomed, the view is theirs and a resize must not snatch it back — `the-resting-view-is-
    // designed-not-fitted` explicitly does not apply to views a reader navigated to themselves.
    resizeObserver = new ResizeObserver(() => {
      if (!readerHasMoved) settle();
    });
    resizeObserver.observe(container);
  } catch {
    resizeObserver = null;
  }

  // ── the guided camera (TELL's `focusIsland` / `resetView`) ───────────────
  //
  // ⚠ A GUIDED MOVE IS NOT A READER MOVE, and keeping the two apart is the whole subtlety here. The
  // tween writes `box` directly and never touches `readerHasMoved`, so flying to an island does not
  // count as the reader taking the view over; but ANY reader gesture cancels an in-flight tween, so
  // the two can never fight over the same viewBox. Push yields to pull, every time.
  const TWEEN_MS = 1050;
  let tween: number | null = null;
  const takeOverListeners: Array<() => void> = [];

  const cancelTween = (): void => {
    if (tween !== null) {
      cancelAnimationFrame(tween);
      tween = null;
    }
  };

  const flyTo = (target: ViewBox): void => {
    cancelTween();
    const from: ViewBox = { ...box };
    const t0 = performance.now();
    const frame = (): void => {
      const t = Math.min(1, (performance.now() - t0) / TWEEN_MS);
      box = lerpViewBox(from, target, t);
      apply();
      tween = t < 1 ? requestAnimationFrame(frame) : null;
    };
    tween = requestAnimationFrame(frame);
  };

  const markMoved = (): void => {
    // Order matters: cancel first, so a listener that reads the view sees the frame the reader
    // grabbed rather than one the tween is still moving out from under them.
    cancelTween();
    if (readerHasMoved) return;
    readerHasMoved = true;
    for (const cb of takeOverListeners.splice(0)) cb();
  };
  svg.addEventListener('pointerdown', markMoved);
  svg.addEventListener('wheel', markMoved, { passive: true });

  settle();
  const restingBox: ViewBox = { ...box };

  return {
    unmount(): void {
      cancelTween();
      takeOverListeners.length = 0;
      svg.removeEventListener('pointerdown', onPointerDown);
      svg.removeEventListener('pointermove', onPointerMove);
      svg.removeEventListener('pointerup', endDrag);
      svg.removeEventListener('pointercancel', endDrag);
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('pointerdown', markMoved);
      svg.removeEventListener('wheel', markMoved);
      resizeObserver?.disconnect();
    },

    focusIsland(id: string): boolean {
      if (readerHasMoved) return false;
      const isle = svg.querySelector(`.tw-isle[data-id="${CSS.escape(id)}"]`);
      if (isle === null) return false;
      const island = islandWorldRect(svg as SVGSVGElement, isle as SVGGraphicsElement);
      if (island === null) return false;
      const frame = svg.getBoundingClientRect();
      if (frame.width <= 0 || frame.height <= 0) return false;
      const target = focusViewBox(island, frame.width / frame.height);
      // `clampZoom` may loosen the framing (a tiny island would otherwise blow past MAX_ZOOM);
      // re-anchoring about the same point keeps the island where the prose expects it either way.
      const w = clampZoom(target.w, restingW, wholeW);
      flyTo(clampViewBox(zoomAbout(target, w, FOCUS_ANCHOR.fx, FOCUS_ANCHOR.fy), payload));
      return true;
    },

    resetView(): void {
      if (readerHasMoved) return;
      // Already there (the common case — most beats change no lens): don't spend a tween on it.
      if (Math.abs(box.x - restingBox.x) < 0.5 && Math.abs(box.w - restingBox.w) < 0.5) {
        if (Math.abs(box.y - restingBox.y) < 0.5) return;
      }
      flyTo(restingBox);
    },

    onReaderTakeOver(cb: () => void): void {
      if (readerHasMoved) {
        cb();
        return;
      }
      takeOverListeners.push(cb);
    },
  };
}
