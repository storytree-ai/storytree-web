// ---------------------------------------------------------------------------
// forest-growth — the forest ARRIVES by growing, from its foundations upward.
//
// Chapter 2's first movement is named GROW (`storytree library artifact grow-tell-roam-ask`), and
// its objective reads "the real forest grows and settles at the designed frame". The frame half
// landed on 2026-08-28; the growth half did not, and the owner reported exactly that after walking
// the live site: *"also didnt see any growth animation"*. This is the missing half.
//
// ── WHY THERE WAS NOTHING TO FIX, ONLY SOMETHING TO WIRE ────────────────────────────────────────
//
// The growth machinery already existed and had NO CALLER. `@keyframes act2-grow` in index.astro
// (scale 0.55 → 1, staggered by a `--ei` custom property) was applied by `act2-walkthrough.ts`,
// whose `mountWalkthrough` is called from nowhere in the repo — it drove the retired scripted walk
// over a FICTIONAL three-story corpus, and it cannot draw arbitrary data: it hard-codes its own
// script. So the CSS was live and the DOM it matched was never created.
//
// The live path meanwhile said out loud that it does not animate — `forest-arrival.ts`: *"the
// resting view is a composition that is simply true when the map appears, there is no tween, no
// clock and nothing to settle"*. That is right about the CAMERA and was taken to cover the forest
// too. This module adds the forest's own arrival and leaves the camera exactly as it was.
//
// ── ⚠ THE HONESTY FENCE, WHICH IS THE WHOLE DESIGN CONSTRAINT ───────────────────────────────────
//
// The map is a SNAPSHOT, stamped "as of 28 August 2026", and the page's entire pitch is that its
// signals are real. An animation implying the forest is growing NOW — islands arriving over time
// as though stories were being created while you watch, or activity implying live sessions — would
// break precisely the claim the page makes about itself. It is the same reason wisps were
// deliberately excluded from the snapshot (`forest-snapshot-map.ts`'s header).
//
// So: growth as a REVEAL of a stated-moment picture is honest. Growth as a LIVE FEED is not. Three
// properties keep this on the honest side, and `forest-growth.test.ts` holds all three:
//
//   1. **IT IS BOUNDED AND IT IS OVER.** Every island is revealed inside `growthTotalMs`, ~2.7 s,
//      and nothing arrives afterwards. A visitor who looks away and back sees a settled map.
//   2. **IT RUNS ONCE.** No loop, no repeat, no idle re-trigger.
//   3. **IT ADDS AND REMOVES NOTHING.** Every island is already in the DOM, serialised at build
//      time. This module only changes how already-present elements are DISPLAYED — the same fence
//      TELL's lenses keep.
//
// ── ⚠ THE NO-SCRIPT GUARANTEE, AND WHY THE PARKED STATE IS APPLIED FROM HERE ────────────────────
//
// `website-refresh-arc-arrival` bought a property worth keeping: the served markup carries the
// WHOLE forest, so *a visitor whose script never runs still gets the entire map as a static, dated
// picture — the crop is an enhancement, never a prerequisite*. Growth must not quietly spend that.
//
// So the hidden state is NEVER in the base stylesheet. This module adds `is-growing` to the svg,
// and every growth rule in index.astro is scoped under it. Script did not run → no class → the
// full forest, exactly as before. `forest-growth.test.ts` reads the stylesheet and reds if a
// growth rule ever escapes that scope, because the failure is invisible: the page would look
// perfect in every browser that runs JavaScript.
//
// ── THE ORDER, AND WHY IT IS FREE ───────────────────────────────────────────────────────────────
//
// The islands grow FROM THE FOUNDATION ROW UPWARD, in dependency order. That is not a decoration:
// it is the one true thing about how software actually gets built, it is the direction the visitor
// is being invited to drag, and it is a REVEAL of structure the picture already contains rather
// than a story told over it.
//
// It also costs nothing to know. `placeStories` emits islands row by row from rank 0 up, and
// `forestSceneInput` walks that array in order, so **the DOM order already IS dependency rank,
// foundation first**. Verified against the built page on 2026-08-29: the first five islands have
// zero declared dependencies, the last eight have between two and eight. No graph is shipped to
// the client and no geometry is read at runtime.
//
// ── ⚠ AN ISLAND IS THREE SIBLING GROUPS, NOT ONE. THE FIRST VERSION OF THIS MISSED THAT ─────────
//
// The obvious selector is `.tw-isle`, and it is WRONG: `tw-isle` is the COASTLINE ALONE. The
// engine paints an island across three top-level layers, so that its stacking is correct across
// the whole forest — every island's shore under every island's land under every island's trees:
//
//     <g class="tw-coast-layer">  <g class="tw-isle"   data-id="cli"> … the shore path
//     <g class="tw-land">         <g class="tw-ground" data-id="cli"> … the disc and its tiles
//     <g class="tw-flora-layer">  <g class="tw-terr"   data-id="cli"> … trees, crown, name plate
//
// Hiding `.tw-isle` therefore hides a coastline and leaves the visible island exactly where it
// was. The first draft did that and its own instrument agreed with it, because the instrument
// counted `.tw-isle` too — an expectation derived from the same mistake as its subject. It was
// caught by a browser screenshot showing the whole forest while the probe reported every island at
// opacity 0. `forest-growth.test.ts` now derives the layer list from the ENGINE'S OWN EMITTER
// rather than from this comment, so a fourth layer reds the gate instead of half-animating.
//
// ── ⚠ THE LAND SCALES; THE TREES DO NOT. THAT IS MEASURED, NOT A STYLE CHOICE ───────────────────
//
// `tw-isle` and `tw-ground` are the same disc — their bounding-box centres agree within three user
// units, so `transform-box: fill-box` with a 50%/50% origin scales both about the island's real
// centre. `tw-terr` is NOT: it wraps the trees AND the name plate hanging below, so where the disc
// sits inside its box varies with the island's height. Measured across four islands on the live
// snapshot, the disc centre lands between 28.7% and 50.4% of the terr box vertically. A fixed
// percentage origin would slide the trees off their own ground by tens of user units, differently
// per island — visible, and worse on exactly the tall islands the eye goes to.
//
// So the flora gets OPACITY AND A SMALL RISE instead, which are bounding-box independent and
// therefore exact for every island. It also reads better: the land arrives, then the trees come up
// on it a beat later, which is the order the thing actually happens in.
// ---------------------------------------------------------------------------

/** The class the svg wears while (and only while) growth is armed. Every growth rule in
 *  index.astro is scoped under it — see the no-script guarantee above. */
export const GROWING_CLASS = 'is-growing';

/**
 * Every per-island layer the engine emits, by class.
 *
 * ⚠ THIS LIST IS THE ONE THING MOST LIKELY TO GO SILENTLY STALE, because a missing layer does not
 * throw — it just keeps painting while its siblings arrive, and the result looks like a rendering
 * glitch rather than a wiring bug. `forest-growth.test.ts` derives the same list from
 * `lib/forest-world/worldSvg.ts` (the emitter that writes these groups) and reds if the two
 * disagree, so adding a layer to the engine reds this repo rather than half-animating it.
 */
export const ISLAND_LAYERS = ['tw-isle', 'tw-ground', 'tw-terr'] as const;
/** The layers that carry the island's LAND, and are therefore safe to scale about a 50%/50%
 *  fill-box origin (their bounding boxes are the same disc). */
export const LAND_LAYERS = ['tw-isle', 'tw-ground'] as const;

/**
 * Groups the engine stamps `data-id` onto that this module deliberately does NOT animate, with the
 * reason — so the coverage test can tell "considered and excluded" from "never noticed".
 *
 * `tw-flora` is a CAPABILITY inside a territory ("a capability as garden flora"), so its `data-id`
 * is a capability id rather than a story id, and it is a CHILD of `tw-terr`. Animating it as well
 * would multiply two opacity curves and darken every island through the middle of its own arrival,
 * to achieve exactly what its ancestor already does.
 */
export const NESTED_LAYERS = ['tw-flora'] as const;

/**
 * How many WAVES the islands are dealt into, rather than one step per island.
 *
 * ⚠ A PER-ISLAND STAGGER DOES NOT SURVIVE THE REAL CORPUS. The retired walkthrough staggered by
 * `calc(var(--ei) * 0.22s)` over a THREE-story forest — 0.44 s end to end. The same law over
 * today's 35 islands runs 7.5 s before the last one appears, which stops being an arrival and
 * becomes a wait. Waves keep the total fixed as the corpus grows: a forest of 200 stories deals
 * into the same seven waves and arrives in the same 2.7 s.
 */
export const GROWTH_WAVES = 7;
/** When the first wave lands, measured from mount. The land layer is cross-fading up from the
 *  storm underneath, so the board is legible before the first island arrives on it. */
export const MS_GROWTH_LEAD_IN = 820;
/** Between one wave and the next. */
export const MS_GROWTH_WAVE = 190;
/** How long one island takes to reach full size. Matches `@keyframes act2-forest-grow`. */
export const MS_GROWTH_ISLAND = 620;
/**
 * How far behind its own land an island's trees come up.
 *
 * ⚠ NOT A FEEL NUMBER — it is what stops a full-size tree standing on a two-thirds-size disc.
 * The land scales and the flora does not (see the header), so while both are running the tree is
 * drawn at final size over ground that has not finished arriving. At 170ms that overlap was
 * visible: measured in slow motion, the trees reached readable opacity while the disc was still
 * around 0.7 scale and overhung its own coastline. At 300ms the land is past 0.88 before the
 * trees are visible at all, and past 1.0 before they are half opaque.
 */
export const MS_GROWTH_FLORA_OFFSET = 300;
/** The trails follow the islands they connect — an edge cannot honestly precede both its ends. */
export const MS_GROWTH_TRAILS_AFTER = 140;
/** How long the trails take to phase in. Matches `@keyframes act2-forest-trails`. */
export const MS_GROWTH_TRAILS = 700;

/**
 * Which wave island `index` of `count` belongs to. Islands are in the build's own placement order,
 * so a low wave is a foundational story.
 *
 * ⚠ EVERY ISLAND GETS A WAVE. A schedule that dropped one would leave part of the forest invisible
 * for good, on a page whose pitch is that the map is complete — the exact failure that is
 * invisible to anyone who did not count. Held by `forest-growth.test.ts`.
 */
export function waveOf(index: number, count: number, waves = GROWTH_WAVES): number {
  if (count <= 0 || waves <= 0) return 0;
  const per = Math.ceil(count / waves);
  return Math.min(waves - 1, Math.floor(index / Math.max(1, per)));
}

/** When island `index` of `count` begins to grow, measured from mount. */
export function islandDelayMs(index: number, count: number, waves = GROWTH_WAVES): number {
  return MS_GROWTH_LEAD_IN + waveOf(index, count, waves) * MS_GROWTH_WAVE;
}

/** When the trails begin to phase in — after the last island has finished arriving. */
export function trailsDelayMs(count: number, waves = GROWTH_WAVES): number {
  return (
    islandDelayMs(Math.max(0, count - 1), count, waves) +
    MS_GROWTH_FLORA_OFFSET +
    MS_GROWTH_ISLAND +
    MS_GROWTH_TRAILS_AFTER
  );
}

/**
 * The moment the whole arrival is over and the map is a settled picture again.
 *
 * This is the number the honesty fence rests on: after it, nothing on this surface moves on its
 * own, and it must stay short enough that the reveal reads as a picture assembling rather than as
 * a forest still filling in.
 */
export function growthTotalMs(count: number, waves = GROWTH_WAVES): number {
  return trailsDelayMs(count, waves) + MS_GROWTH_TRAILS;
}

export interface GrowthHandle {
  /** Reveal everything immediately and drop the armed class. Idempotent, and safe to call from a
   *  teardown that races the schedule. */
  unmount(): void;
}

/**
 * Grow the already-rendered forest in, from its foundations upward.
 *
 * `map` is the `<svg class="forest-arrival-svg">` the build serialised. Under reduced motion this
 * arms NOTHING — it does not park the islands and then reveal them faster, because a staggered
 * reveal is itself a motion the visitor asked not to have. The map simply is.
 */
export function mountForestGrowth(map: Element, reducedMotion: boolean): GrowthHandle {
  if (reducedMotion) return { unmount(): void {} };

  // The ORDER comes from one layer (they are all emitted in the same placement order) and the
  // DELAY is then stamped on every layer of that island by id, so the three pieces of one island
  // can never arrive at different times.
  const order = Array.from(map.querySelectorAll('.tw-ground[data-id]'))
    .map((el) => el.getAttribute('data-id'))
    .filter((id): id is string => id !== null);
  const trails = map.querySelector('.tw-trails');
  if (order.length === 0) return { unmount(): void {} };

  const count = order.length;
  const touched: Element[] = [];
  order.forEach((id, i) => {
    const delay = `${islandDelayMs(i, count)}ms`;
    for (const layer of ISLAND_LAYERS) {
      const el = map.querySelector(`.${layer}[data-id="${CSS.escape(id)}"]`);
      if (el instanceof SVGElement || el instanceof HTMLElement) {
        el.style.setProperty('--grow-delay', delay);
        touched.push(el);
      }
    }
  });
  if (trails instanceof SVGElement || trails instanceof HTMLElement) {
    trails.style.setProperty('--grow-delay', `${trailsDelayMs(count)}ms`);
    touched.push(trails);
  }
  map.classList.add(GROWING_CLASS);

  // The class comes OFF once the last animation has run, so the growth rules stop applying to a
  // settled map. A lens TELL adds later must not find itself competing with an arrival that is
  // over — and an element still carrying an animation is an element whose opacity is not simply 1.
  const settle = window.setTimeout(() => {
    map.classList.remove(GROWING_CLASS);
  }, growthTotalMs(count) + 120);

  let done = false;
  return {
    unmount(): void {
      if (done) return;
      done = true;
      window.clearTimeout(settle);
      map.classList.remove(GROWING_CLASS);
      for (const el of touched) {
        if (el instanceof SVGElement || el instanceof HTMLElement) {
          el.style.removeProperty('--grow-delay');
        }
      }
    },
  };
}
