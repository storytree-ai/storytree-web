// ---------------------------------------------------------------------------
// inflection — the transform-to-chapter-2 handoff (ADR-0134 §2, ADR-0145, ADR-0148 §5, reshaped by
// ADR-0165). This is the destination the first act's "show me the better way" transform lands the
// visitor in — one path.
//
// Reached EXCLUSIVELY via dynamic import() from the storm engine at the transform click
// (act1-storm's `import('./inflection')`). This module's own STATIC closure is pure SVG/DOM: no
// React, no three.js, no @react-three. Since ADR-0608 D4 the real 3D land mounts under the map, and
// it arrives through a SECOND dynamic import (`./forest-land-mount`), so the WebGL chunk is fetched
// only once a forest lands. The parent's `check:web-experience-closure` walks the STATIC closure
// from index.astro and both seams are DYNAMIC imports, so they stay outside that closure.
//
// ⚠ THAT DYNAMIC SEAM IS ALSO WHY TELL MOUNTS HERE RATHER THAN FROM A `<script>` ON THE PAGE. A new
// `<script>` block in `index.astro` is a CLIENT SEED: the closure rung would walk the whole static
// import graph under it, and the first thing a prose overlay wants to reach for is the map module
// that reaches `act2-walkthrough` → `forest-world-r3f/act2-director`. Mounting from behind the
// existing dynamic import keeps chapter 2 entirely outside the guarded closure, which is where the
// rung's authors put the seam on purpose.
//
// THE FLOW, as of `website-refresh-arc-click-to-explain` (ROAM), on top of `…-pitch-overlays`
// (TELL) and `…-arrival` (GROW, ADR-0453 D11): the transform's collapse finishes on quiet ground;
// the ground turns out to be storytree's OWN forest, already in the DOM, serialised by
// `index.astro` at build time from the same stamped snapshot `/forest/` renders. `forest-arrival`
// frames it at the designed resting view (ADR-0471) and hands the visitor pan and zoom;
// `act2-tell` speaks over it, on a timing this repo owns, and gets out of the way; and `act2-roam`
// answers clicks on the map for as long as the visitor stays — quietly, on their clock rather than
// ours.
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
import { mountRoam, type RoamHandle } from './act2-roam';
import { mountTell, type TellHandle } from './act2-tell';
import { mountAsk, type AskHandle } from './act2-ask';
import { LAND_MESSAGES } from './forest-land-layer';
import type { LandMountHandle } from './forest-land-mount';
import { clearUnder } from './prose-clearing';

/** The land's chunk never arrived: say so in the host, where the mount would have said it. */
function sayLandFailed(host: HTMLElement): void {
  const status = document.createElement('p');
  status.className = 'forest-land-status';
  status.setAttribute('role', 'status');
  status.textContent = LAND_MESSAGES.failed;
  host.dataset.landState = 'failed';
  host.appendChild(status);
}

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
 * framed at its designed resting view, the 3D land under it (lazily), and TELL's prose over it.
 * The collapse choreography has already played; this is where it lands.
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
  const growthStartedAt = performance.now();
  const growth: GrowthHandle | null = map !== null ? mountForestGrowth(map, reducedMotion) : null;

  // THE 3D LAND, UNDER THE MAP (ADR-0608 D4). Behind its own dynamic import — three.js and R3F
  // stay out of this module's closure and out of any reader's download until a forest mounts —
  // and handed the growth plan just derived, at the moment it started, so the land arrives with
  // the islands rather than on a clock of its own. Reduced motion has no plan: the land is simply
  // there. A chunk that fails to load is SAID, never a silent blank (D5).
  let land: LandMountHandle | null = null;
  let landGone = false;
  if (map instanceof SVGSVGElement) {
    const plan = growth?.plan ?? null;
    import('./forest-land-mount')
      .then((mod) => {
        if (landGone) return;
        land = mod.mountForestLandLayer({
          host: container,
          svg: map,
          growth: plan === null ? null : { plan, startedAt: growthStartedAt },
        });
      })
      .catch((err: unknown) => {
        console.error('forest-land:', err);
        if (!landGone) sayLandFailed(container);
      });
  }

  // TELL speaks over that forest. Both of its inputs come from the map itself — the counts it
  // quotes and the status of the island it points at — so if the map is missing or unreadable,
  // `mountTell` returns an inert handle and the visitor simply gets the forest, silently and
  // correctly. A prose overlay is an enhancement on top of an enhancement; neither is a prerequisite
  // for the other.
  // ASK is the site's ENDING, and it is mounted BEFORE TELL so TELL can reveal it. It renders
  // nothing until then: a hidden layer with a link that is out of the tab order, so it cannot be
  // reached from behind the prose. Nothing about it is on the timed sequence's clock — it costs the
  // reading budget zero characters, which is the whole reason it lives out here rather than as an
  // eleventh beat (the owner has an open question about the sequence's LENGTH).
  const ask: AskHandle | null = host instanceof HTMLElement ? mountAsk({ host }) : null;

  // NOTHING ON THE MAP SITS UNDER THE FURNITURE (`prose-clearing.ts`). The key, the stamp and the
  // ending are drawn over the map for as long as it is on screen, and TELL's close-up beats and any
  // pan can bring an island under them — so the map is cleared under each of them, measured live.
  // TELL clears under its own prose the same way, and the mask is the union of both.
  const liftFurniture =
    host instanceof HTMLElement
      ? clearUnder(container, [...host.querySelectorAll('.storm-land-footer > *')])
      : null;

  const tell: TellHandle | null =
    host instanceof HTMLElement && map !== null
      ? mountTell({ host, map, stage: arrival, reducedMotion, onDone: () => ask?.reveal() })
      : null;

  // ⚠ AND IF TELL NEVER MOUNTS, THE ENDING STILL HAS TO ARRIVE. `mountTell` returns an inert handle
  // when the map is missing or its payload unreadable — the visitor then simply gets the forest,
  // silently and correctly — and in that branch nothing would ever call `onDone`. The site's one
  // outbound link is not an enhancement on top of an enhancement; it is the ending.
  if (tell === null) ask?.reveal();

  // ROAM is live from the FIRST FRAME, not after TELL. It adds nothing to the timed sequence — no
  // beat, no delay, no clock — because everything it says is pulled by a click and nothing it says
  // is scheduled. Mounting it after TELL would mean a visitor who reached for the map during the
  // prose (which already stops the prose) then found their clicks doing nothing for another minute,
  // which is the sequence holding on to them by another route.
  const roam: RoamHandle | null =
    host instanceof HTMLElement && map !== null ? mountRoam({ host, map }) : null;

  return {
    unmount(): void {
      liftFurniture?.();
      roam?.unmount();
      ask?.unmount();
      tell?.unmount();
      // Before the map framing goes, so a mid-growth skip leaves every island revealed rather than
      // parked at scale 0.62 under a class nothing will now remove.
      growth?.unmount();
      landGone = true;
      land?.unmount();
      arrival.unmount();
    },
  };
}
