// ---------------------------------------------------------------------------
// inflection — the transform-to-2.5D-tutorial handoff (ADR-0134 §2, ADR-0145,
// ADR-0148 §5, reshaped by ADR-0165). This is the destination the first act's
// "show me the better way" transform lands the visitor in — one path, all in on
// the tutorial, ZERO WebGL.
//
// Reached EXCLUSIVELY via dynamic import() from the storm engine at the
// transform click (act1-storm's `import('./inflection')`). Since ADR-0148 this
// module — and everything it reaches — is pure SVG/DOM: no React, no three.js,
// no @react-three, no WebGL context. (The synced forest-world-r3f package still
// ships in web/src/lib for check:web-engine, but this module never imports its
// WebGL surfaces — only act2-director's pure zod state machine, via the
// walkthrough.) The parent's check:web-experience walks the STATIC closure from
// index.astro and this seam is only ever a DYNAMIC import, so it stays outside
// that closure regardless.
//
// THE FLOW, as of `website-refresh-arc-arrival` (GROW, ADR-0453 D11): the transform's collapse
// finishes on quiet ground, and the ground turns out to be storytree's OWN forest — already in the
// DOM, serialised by `index.astro` at build time from the same stamped snapshot `/forest/` renders.
// This module frames it at the designed resting view (ADR-0471) and hands the visitor pan and zoom.
// That is the whole of the arrival, and it is deliberately the whole of chapter 2 for now.
//
// ⚠ WHAT WENT, AND WHAT DID NOT. The scripted three-story walk (`act2-walkthrough`) and the
// terminal-agent guide (`act2-orchestrator`) are no longer mounted. Two separate reasons, and only
// one of them is "we are replacing this":
//
//   - THE FOREST WAS FICTIONAL. `act2-walkthrough` grows a demo dataset laid out at build time. A
//     synthetic forest is a claim about a product; the real one is evidence of it, and the site's
//     entire argument is that this system built it.
//   - THE NARRATOR IS A NEXT BUTTON IN A COSTUME — the owner's call, 2026-08-22: it offers exactly
//     one reply chip per step, paying the full cost of looking like a conversation for none of the
//     freedom of one.
//
// ⚠ BOTH MODULES ARE LEFT IN THE TREE ON PURPOSE, unmounted rather than deleted. `act2-orchestrator`
// is a good declarative state machine and only its VOICE is rejected (`keep the machine, retire the
// presenter`); retiring the narrator properly, and deciding what of the sequencer survives, is
// TELL's job (`website-refresh-arc-pitch-overlays`), not this increment's. Deleting them here would
// make that decision by accident.
//
// The exported contract is UNCHANGED so the storm engine needs no edit:
// mountForestLand(container) → { unmount }. The disarm path (skip / Escape /
// the closing CTA) chains unmount(), so a mid-walk exit tears the whole
// tutorial down — guide (chat + diagram + mini-map) and walk alike. Everything
// here is a pure function of fixed data: the same land, the same script, on
// every load.
// ---------------------------------------------------------------------------

import { mountForestArrival, type ArrivalHandle } from './forest-arrival';

/** The exported handle the storm engine holds — name kept for the unchanged
 *  contract (act1-storm calls `mod.mountForestLand(landCanvasEl)`). */
export interface InflectionHandle {
  /** Tear the tutorial (guide + walk) down — the disarm path chains this into
   *  its halt. */
  unmount(): void;
}

/**
 * Mount the 2.5D guided tutorial into `container` (the first act's
 * #storm-land-canvas mount): the walk on the real 2.5D map underneath, the
 * guide (chat + growing diagram + mini-map) over it. No WebGL, no R3F — the
 * collapse choreography has already played; this is where it lands.
 *
 * `container` is the land canvas; everything mounts onto the #storm-land layer
 * (its closest ancestor) so it shares the land's fade-up and disarm path.
 */
export function mountForestLand(container: HTMLElement): InflectionHandle {
  // The real forest is ALREADY IN THE DOM — `index.astro` serialised it at build time into
  // `#storm-land-canvas`. Nothing is fetched, built or grown here; this only frames it at the
  // designed resting view (ADR-0471) and lets the visitor move around it.
  const arrival: ArrivalHandle = mountForestArrival(container);

  return {
    unmount(): void {
      arrival.unmount();
    },
  };
}
