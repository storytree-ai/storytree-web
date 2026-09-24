// ---------------------------------------------------------------------------
// forest-land-layer — the PURE half of the public 3D land (ADR-0608 D4): where the land's camera
// must sit so it lands under the SVG map to the pixel, what the land shows at a given moment of the
// existing growth, and whether this browser can draw it at all.
//
// ⚠ NOTHING HERE OWNS A LAYOUT, A CAMERA OR A CLOCK. The land draws the SAME drawing the SVG draws
// (`publicForestDrawing`, served as `/forest-land.json`), is registered to the camera the SVG is
// ALREADY presenting (its `viewBox`, which `forest-arrival` owns), and follows the growth plan
// `forest-growth` ALREADY derived, read at wall-clock time. If the land and the map disagree, the
// fault is upstream of both — never a reason to add a second anything here.
//
// ⚠ NO React, no three.js. This module is imported by the mount AND by tests, and by nothing that
// sits in the Act 1 static closure.
// ---------------------------------------------------------------------------

import type { GrowthPlan } from './forest-growth';

/** The land camera's declared elevation — the one both layers are drawn at (ADR-0593). Duplicated
 *  as a literal rather than imported so this pure module pulls no render code into a test or a
 *  chunk; `forest-land-layer.test.ts` holds it to the core's `LAND_CAMERA_ELEVATION_DEG`. */
export const LAND_ELEVATION_DEG = 50;

/** A `viewBox` rect, in the map's own drawing units. */
export interface LandViewBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The SVG element's delivered box, in CSS px. */
export interface LandFrame {
  readonly width: number;
  readonly height: number;
}

/** Where the registered canvas looks: CSS px per drawing unit, and the ground point at the frame
 *  centre — exactly `RegisteredUnderlay`'s shape. */
export interface LandRegistration {
  readonly zoom: number;
  readonly target: { readonly x: number; readonly z: number };
}

/**
 * THE SVG'S OWN CAMERA, AS THE CANVAS'S. A `viewBox` under `preserveAspectRatio="xMidYMid <mode>"`
 * maps drawing units to the element's px by one uniform scale and a centring offset; the canvas is
 * handed that same scale, and the ground point that lands at the frame centre. The depth axis is
 * divided by sin(elevation) because the drawing is the ground seen at that elevation — the same
 * arithmetic the studio's registration uses (`apps/studio/src/lib/canvasRegistration.ts`).
 *
 * Returns `null` for a box or frame with no size — there is nothing to register against, and a
 * zero-sized first pass must not mount a canvas against a frame that does not exist.
 */
export function landRegistration(
  box: LandViewBox,
  frame: LandFrame,
  mode: 'meet' | 'slice',
  elevationDeg: number = LAND_ELEVATION_DEG,
): LandRegistration | null {
  if (!(box.w > 0) || !(box.h > 0) || !(frame.width > 0) || !(frame.height > 0)) return null;
  const sx = frame.width / box.w;
  const sy = frame.height / box.h;
  const scale = mode === 'slice' ? Math.max(sx, sy) : Math.min(sx, sy);
  const tx = (frame.width - box.w * scale) / 2 - box.x * scale;
  const ty = (frame.height - box.h * scale) / 2 - box.y * scale;
  const sinE = Math.sin((elevationDeg * Math.PI) / 180);
  return {
    zoom: scale,
    target: {
      x: (frame.width / 2 - tx) / scale,
      z: (frame.height / 2 - ty) / (scale * sinE),
    },
  };
}

/** Read an `<svg>`'s `viewBox` attribute; `null` when it is missing or unreadable. */
export function parseViewBox(raw: string | null): LandViewBox | null {
  if (raw === null) return null;
  const parts = raw.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x, y, w, h] = parts as [number, number, number, number];
  return { x, y, w, h };
}

/** The aspect mode an `<svg>` delivers: `slice` only when it says so; SVG's own default is `meet`. */
export function aspectMode(raw: string | null): 'meet' | 'slice' {
  return raw !== null && /\bslice\b/.test(raw) ? 'slice' : 'meet';
}

/** The canvas's growth input — `ForestRegrowCursor`'s shape, restated so this module stays pure. */
export interface LandGrowthCursor {
  readonly progress: number;
  readonly settled: boolean;
  readonly absentStoryIds: ReadonlySet<string>;
  readonly growing: readonly { readonly storyId: string; readonly progress: number }[];
  readonly hiddenSegmentIds: ReadonlySet<string>;
  readonly drawingSegments: readonly { readonly id: string; readonly drawn: number; readonly fromEnd: boolean }[];
}

/**
 * THE EXISTING GROWTH, READ AT ONE MOMENT. `forest-growth` stamps each island and pathway segment
 * with a start and an end on the page's own animation clock; this is the same plan asked "where is
 * everything at `elapsedMs`?", so the land arrives with the islands and roads the map draws rather
 * than on a schedule of its own.
 *
 * An island is ABSENT before its window, GROWING inside it, and simply present after; a segment is
 * hidden before its window and drawn a fraction of the way through it. Past `totalMs` the cursor is
 * SETTLED, which is the canvas's signal to stop animating and go quiet.
 */
export function landGrowthAt(plan: GrowthPlan, elapsedMs: number): LandGrowthCursor {
  const t = Math.max(0, elapsedMs);
  const absent = new Set<string>();
  const growing: { storyId: string; progress: number }[] = [];
  for (const island of plan.islands.values()) {
    if (t < island.startMs) absent.add(island.storyId);
    else if (t < island.endMs) {
      growing.push({ storyId: island.storyId, progress: (t - island.startMs) / (island.endMs - island.startMs) });
    }
  }
  const hidden = new Set<string>();
  const drawing: { id: string; drawn: number; fromEnd: boolean }[] = [];
  for (const seg of plan.segments.values()) {
    if (t < seg.startMs) hidden.add(seg.id);
    else if (t < seg.endMs) {
      drawing.push({ id: seg.id, drawn: (t - seg.startMs) / (seg.endMs - seg.startMs), fromEnd: seg.fromEnd });
    }
  }
  const settled = t >= plan.totalMs;
  return {
    progress: plan.totalMs > 0 ? Math.min(1, t / plan.totalMs) : 1,
    settled,
    absentStoryIds: absent,
    growing,
    hiddenSegmentIds: hidden,
    drawingSegments: drawing,
  };
}

/**
 * DOES THIS BROWSER HAVE THE STACK THE LAND NEEDS? The land is drawn with WebGL 2; a browser that
 * cannot open a WebGL 2 context gets a message saying so (ADR-0608 D5), never a second map. Takes
 * the document so a test can hand in a fake one.
 */
export function landStackMissing(doc: Pick<Document, 'createElement'>): boolean {
  try {
    const canvas = doc.createElement('canvas');
    return canvas.getContext('webgl2') === null;
  } catch {
    return true;
  }
}

/** The copy each non-drawn state shows. Visible, in the host, and read by assistive tech — never
 *  tucked inside the canvas wrapper, which is hidden from it. */
export const LAND_MESSAGES = {
  loading: 'Drawing the forest…',
  unsupported:
    'This map needs a browser with WebGL 2 — a current version of Chrome, Edge, Firefox or Safari. ' +
    'Your browser does not support it, so the forest cannot be drawn here.',
  failed: 'The forest could not be drawn in this browser. Reloading the page may help.',
} as const;

export type LandState = 'loading' | 'drawn' | 'unsupported' | 'failed';
