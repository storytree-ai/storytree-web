// ---------------------------------------------------------------------------
// forest-land-mount — the public 3D land, mounted UNDER a forest map's SVG (ADR-0608 D4).
//
// Both public forests — the entry forest chapter 2 lands on, and the `/forest/` poster — draw the
// same published snapshot as one drawing (`publicForestDrawing`). The SVG keeps every mark a reader
// acts through: nameplates, click targets, ROAM, the stamp. Under it, this mounts the real land:
// the same drawing, streamed through `landStreamFromDrawing` at build time and served as
// `/forest-land.json`, drawn by the shared `ForestWorldCanvas` registered to the camera the SVG is
// already presenting.
//
// ⚠ IT IS REACHED ONLY THROUGH A DYNAMIC import(). three.js, R3F and the kit are ~1.2 MB; nothing
// in the Act 1 static closure may reach them (`check:web-experience-closure`), and a reader who
// never lands on a forest never downloads them.
//
// ⚠ THE STATES ARE VISIBLE AND SPOKEN, NEVER A SECOND MAP (ADR-0608 D5). While the land loads, a
// short status line says so; if this browser lacks WebGL 2, or the land fails, a message says what
// is wrong and what is needed. Those messages live in the HOST (role="status"), not inside the
// canvas wrapper, which is aria-hidden. No fallback picture is built for them.
//
// ⚠ THE LAND OWNS NO CAMERA AND NO CLOCK. It re-reads the SVG's `viewBox` whenever the host's
// framing moves it, and it reads the host's existing growth plan at wall-clock time. When the
// growth has settled, or the page is hidden, it stops asking for frames.
// ---------------------------------------------------------------------------

import { Component, Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { forestRegrowPresentation, type ForestRegrowCursor } from '../lib/forest-world-r3f/ForestWorldCanvas.regrow';
import type { Descriptor3D } from '../lib/forest-world-r3f/world-to-3d';
import type { GrowthPlan } from './forest-growth';
import {
  LAND_MESSAGES,
  aspectMode,
  landGrowthAt,
  landRegistration,
  landStackMissing,
  parseViewBox,
  type LandRegistration,
  type LandState,
} from './forest-land-layer';

const ForestWorldCanvas = lazy(async () => {
  const mod = await import('../lib/forest-world-r3f/ForestWorldCanvas');
  return { default: mod.ForestWorldCanvas };
});

/** Where the land is served from — one static file, built from the same drawing as the SVG. */
export const LAND_URL = '/forest-land.json';

const NO_HIDDEN: ReadonlySet<string> = new Set();

export interface LandMountOptions {
  /** The element that holds the map; the land layer and its status line are placed inside it. */
  readonly host: HTMLElement;
  /** The map whose drawing and camera the land follows. */
  readonly svg: SVGSVGElement;
  /** The host's growth plan and the wall-clock moment it started; absent ⇒ the forest is settled. */
  readonly growth?: { readonly plan: GrowthPlan; readonly startedAt: number } | null;
}

export interface LandMountHandle {
  unmount(): void;
}

/** The land's camera, read off the SVG as it is presented right now. */
function readRegistration(svg: SVGSVGElement): LandRegistration | null {
  const box = parseViewBox(svg.getAttribute('viewBox'));
  const rect = svg.getBoundingClientRect();
  if (box === null) return null;
  return landRegistration(box, { width: rect.width, height: rect.height }, aspectMode(svg.getAttribute('preserveAspectRatio')));
}

/** The app-owned growth, as the canvas reads it — advanced by animation frames only while growing
 *  and visible, and `null` once settled so the canvas goes quiet. */
function useGrowthCursor(growth: LandMountOptions['growth']): ForestRegrowCursor | null {
  const [cursor, setCursor] = useState<ForestRegrowCursor | null>(() =>
    growth ? landGrowthAt(growth.plan, performance.now() - growth.startedAt) : null,
  );
  useEffect(() => {
    if (!growth) return;
    let frame: number | null = null;
    const tick = (): void => {
      frame = null;
      const next = landGrowthAt(growth.plan, performance.now() - growth.startedAt);
      setCursor(next.settled ? null : next);
      if (!next.settled && document.visibilityState === 'visible') frame = requestAnimationFrame(tick);
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible' && frame === null) tick();
    };
    tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [growth]);
  return cursor;
}

/** The SVG's presented camera, kept current through resizes and every `viewBox` change. */
function useRegistration(svg: SVGSVGElement): LandRegistration | null {
  const [registration, setRegistration] = useState<LandRegistration | null>(() => readRegistration(svg));
  useEffect(() => {
    const read = (): void => setRegistration(readRegistration(svg));
    read();
    const mo = new MutationObserver(read);
    mo.observe(svg, { attributes: true, attributeFilter: ['viewBox', 'preserveAspectRatio'] });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    ro?.observe(svg);
    return () => {
      mo.disconnect();
      ro?.disconnect();
    };
  }, [svg]);
  return registration;
}

function useVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const on = (): void => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}

function Land({
  layer,
  svg,
  descriptors,
  growth,
  onDrawn,
}: {
  layer: HTMLElement;
  svg: SVGSVGElement;
  descriptors: readonly Descriptor3D[];
  growth: LandMountOptions['growth'];
  onDrawn: () => void;
}): React.JSX.Element | null {
  const registration = useRegistration(svg);
  const cursor = useGrowthCursor(growth);
  const regrow = useMemo(() => forestRegrowPresentation(cursor), [cursor]);
  // The growth the canvas is being handed, readable off the layer (`data-growth`): islands still
  // absent / roads still hidden / roads drawing, or `settled`. The only observable this adds.
  useEffect(() => {
    layer.dataset.growth = cursor === null
      ? 'settled'
      : `${cursor.absentStoryIds.size}/${cursor.hiddenSegmentIds.size}/${cursor.drawingSegments.length}`;
  }, [layer, cursor]);
  const visible = useVisible();
  if (registration === null) return null;
  return (
    <Suspense fallback={null}>
      <ForestWorldCanvas
        descriptors={descriptors}
        hiddenStatuses={NO_HIDDEN}
        registered={{ zoom: registration.zoom, target: registration.target, props: true }}
        regrow={regrow}
        active={visible}
      />
      <Mounted onMount={onDrawn} />
    </Suspense>
  );
}

/** Fires once its Suspense boundary has resolved — i.e. once the canvas chunk is in and mounted. */
function Mounted({ onMount }: { onMount: () => void }): null {
  useEffect(() => onMount(), [onMount]);
  return null;
}

/** A canvas that throws (a WebGL context the probe allowed but the driver refused) reports it as
 *  the FAILED state instead of unmounting the page's React root silently. */
class LandBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: unknown): void {
    console.error('forest-land:', error);
    this.props.onError();
  }
  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/** Place the land layer exactly over the SVG's box inside the host. */
function placeLayer(layer: HTMLElement, host: HTMLElement, svg: SVGSVGElement): void {
  const h = host.getBoundingClientRect();
  const s = svg.getBoundingClientRect();
  layer.style.left = `${s.left - h.left + host.scrollLeft}px`;
  layer.style.top = `${s.top - h.top + host.scrollTop}px`;
  layer.style.width = `${s.width}px`;
  layer.style.height = `${s.height}px`;
}

/**
 * Mount the land under `svg`. Resolves nothing and throws nothing: every outcome is a visible
 * state on the host (`data-land-state`), because a land that cannot draw must never take the map
 * down with it.
 */
export function mountForestLandLayer({ host, svg, growth = null }: LandMountOptions): LandMountHandle {
  const status = document.createElement('p');
  status.className = 'forest-land-status';
  status.setAttribute('role', 'status');
  host.appendChild(status);

  const layer = document.createElement('div');
  layer.className = 'forest-land-layer';
  layer.setAttribute('aria-hidden', 'true');
  host.insertBefore(layer, host.firstChild);

  let root: Root | null = null;
  let done = false;
  const setState = (state: LandState): void => {
    if (done) return;
    host.dataset.landState = state;
    host.classList.toggle('has-land', state === 'drawn');
    status.textContent = state === 'drawn' ? '' : LAND_MESSAGES[state];
    status.hidden = state === 'drawn';
  };

  const place = (): void => placeLayer(layer, host, svg);
  place();
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
  ro?.observe(host);
  ro?.observe(svg);

  if (landStackMissing(document)) {
    setState('unsupported');
  } else {
    setState('loading');
    fetch(LAND_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`${LAND_URL} answered ${res.status}`);
        return res.json() as Promise<Descriptor3D[]>;
      })
      .then((descriptors) => {
        if (done) return;
        root = createRoot(layer);
        root.render(
          <LandBoundary onError={() => setState('failed')}>
            <Land layer={layer} svg={svg} descriptors={descriptors} growth={growth} onDrawn={() => setState('drawn')} />
          </LandBoundary>,
        );
      })
      .catch((err: unknown) => {
        console.error('forest-land:', err);
        setState('failed');
      });
  }

  return {
    unmount(): void {
      if (done) return;
      done = true;
      ro?.disconnect();
      root?.unmount();
      layer.remove();
      status.remove();
      host.classList.remove('has-land');
      delete host.dataset.landState;
    },
  };
}
