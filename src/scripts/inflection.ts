// ---------------------------------------------------------------------------
// inflection — the transform-to-chapter-2 handoff (ADR-0134 §2, ADR-0145, ADR-0148 §5, reshaped by
// ADR-0165). This is the destination the first act's "show me the better way" transform lands the
// visitor in — one path, ZERO WebGL.
//
// Reached EXCLUSIVELY via dynamic import() from the storm engine at the transform click
// (act1-storm's `import('./inflection')`). Since ADR-0148 this module — and everything it reaches —
// is pure SVG/DOM: no React, no three.js, no @react-three, no WebGL context. The parent's
// `check:web-experience-closure` walks the STATIC closure from index.astro and this seam is only
// ever a DYNAMIC import, so it stays outside that closure regardless.
//
// ⚠ THAT DYNAMIC SEAM IS ALSO WHY TELL MOUNTS HERE RATHER THAN FROM A `<script>` ON THE PAGE. A new
// `<script>` block in `index.astro` is a CLIENT SEED: the closure rung would walk the whole static
// import graph under it, and the first thing a prose overlay wants to reach for is the map module
// that reaches `act2-walkthrough` → `forest-world-r3f/act2-director`. Mounting from behind the
// existing dynamic import keeps chapter 2 entirely outside the guarded closure, which is where the
// rung's authors put the seam on purpose.
//
// THE FLOW, as of `website-refresh-arc-pitch-overlays` (TELL), on top of `…-arrival` (GROW,
// ADR-0453 D11): the transform's collapse finishes on quiet ground; the ground turns out to be
// storytree's OWN forest, already in the DOM, serialised by `index.astro` at build time from the
// same stamped snapshot `/forest/` renders. `forest-arrival` frames it at the designed resting view
// (ADR-0471) and hands the visitor pan and zoom — and then `act2-tell` speaks over it, on a timing
// this repo owns, and gets out of the way.
//
// ⚠ THE NARRATOR IS GONE — DELETED, NOT UNMOUNTED. `act2-orchestrator` (the chat dock),
// `act2-guide` (its scripted dialogue) and the chrome that only ever served it (`act2-diagram`,
// `act2-minimap`, `act2-studio`) were removed by TELL. The owner rejected the VOICE, not the
// machine — "a Next button in a costume", 2026-08-22 — so the machine's one load-bearing property
// (a beat's state is a pure function of its index, and replay is byte-identical) is rebuilt inside
// `act2-tell.ts` in a module with no chat DOM. Re-mounting the original would have resurrected the
// costume to reach the property; see `act2-tell.ts`'s header for the full accounting.
//
// ⚠ WHAT DELIBERATELY DID NOT GO: `act2-walkthrough`. It is the scripted three-story WALK, not the
// narrator, and it was unmounted for its own separate reason (the forest it grew was fictional).
// Its disc geometry is still LIVE — `forest-snapshot-map` imports `buildDisc`/`escXml` from it to
// draw the real forest that ships today — so retiring it means first lifting that geometry into its
// own module, which is the edit `index.astro`'s own comment describes and is its own piece of work.
// Deleting it here to make one PR tidy would have taken the shipped map with it.
//
// The exported contract is UNCHANGED so the storm engine needs no edit:
// mountForestLand(container) → { unmount }. The disarm path (skip / Escape) chains unmount(), so a
// mid-sequence exit tears chapter 2 down — prose overlay and map framing alike.
// ---------------------------------------------------------------------------

import { mountForestArrival, type ArrivalHandle } from './forest-arrival';
import { mountForestGrowth, type GrowthHandle } from './forest-growth';
import { mountTell, type TellHandle } from './act2-tell';

/** The exported handle the storm engine holds — name kept for the unchanged
 *  contract (act1-storm calls `mod.mountForestLand(landCanvasEl)`). */
export interface InflectionHandle {
  /** Tear chapter 2 down — the disarm path chains this into its halt. */
  unmount(): void;
}

/** Does the visitor want less motion? Read here rather than passed in, because this module is the
 *  boundary where chapter 2 begins and every mount below it needs the same answer. Defaults to
 *  "motion is fine" when the query cannot be made, matching the storm's own arming rule. */
function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Mount chapter 2 into `container` (the first act's #storm-land-canvas mount): the real forest
 * framed at its designed resting view, and TELL's prose over it. No WebGL, no R3F — the collapse
 * choreography has already played; this is where it lands.
 *
 * `container` is the land canvas; the overlay mounts onto the #storm-land layer (its closest
 * ancestor) so it shares the land's fade-up and disarm path.
 */
export function mountForestLand(container: HTMLElement): InflectionHandle {
  // The real forest is ALREADY IN THE DOM — `index.astro` serialised it at build time into
  // `#storm-land-canvas`. Nothing is fetched or built here; this frames it at the designed resting
  // view (ADR-0471) and lets the visitor move around it. `forest-growth` then reveals it — the
  // islands are already present and are only DISPLAYED differently, which is the same fence TELL's
  // lenses keep and the reason the reveal cannot imply a live feed.
  const arrival: ArrivalHandle = mountForestArrival(container);

  const host = container.closest('#storm-land');
  const map = container.querySelector('svg.forest-arrival-svg');
  const reducedMotion = prefersReducedMotion();

  // ⚠ GROWTH IS ARMED BEFORE TELL AND AFTER FRAMING, AND THAT ORDER IS LOAD-BEARING. The islands
  // must be parked on the frame the visitor will actually see (framing first), and the first thing
  // TELL says has to land on a forest that is arriving rather than one still waiting to (growth
  // first). `MS_LEAD_IN` is timed to overlap the last waves on purpose — the name over a forest
  // still assembling is the opening; queueing the two would be two events where there is one.
  const growth: GrowthHandle | null = map !== null ? mountForestGrowth(map, reducedMotion) : null;

  // TELL speaks over that forest. Both of its inputs come from the map itself — the counts it
  // quotes and the status of the island it points at — so if the map is missing or unreadable,
  // `mountTell` returns an inert handle and the visitor simply gets the forest, silently and
  // correctly. A prose overlay is an enhancement on top of an enhancement; neither is a prerequisite
  // for the other.
  const tell: TellHandle | null =
    host instanceof HTMLElement && map !== null
      ? mountTell({ host, map, stage: arrival, reducedMotion })
      : null;

  return {
    unmount(): void {
      tell?.unmount();
      // Before the map framing goes, so a mid-growth skip leaves every island revealed rather than
      // parked at scale 0.62 under a class nothing will now remove.
      growth?.unmount();
      arrival.unmount();
    },
  };
}
