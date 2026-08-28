// forest-growth.ts — the forest's arrival.
//
// ⚠ WHAT THIS SUITE IS FOR. Two of the three things that can go wrong here are INVISIBLE to anyone
// running a browser with JavaScript on, which is everyone who reviews this:
//
//   1. the parked state escaping its `is-growing` scope, which hides the whole map from a visitor
//      whose script never runs while looking perfect to everybody else;
//   2. an island dropped from the schedule, which leaves part of the forest permanently invisible
//      on a page whose pitch is that the map is complete.
//
// The third — the reveal running long enough to read as a live feed rather than a picture
// assembling — is the honesty fence in the module header.
//
// ⚠ `bun test` TRANSPILES AND DOES NOT TYPECHECK. `npm run typecheck` covers this file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  GROWING_CLASS,
  ISLAND_LAYERS,
  LAND_LAYERS,
  NESTED_LAYERS,
  MS_GROWTH_FLORA_OFFSET,
  GROWTH_WAVES,
  MS_GROWTH_ISLAND,
  MS_GROWTH_LEAD_IN,
  MS_GROWTH_TRAILS,
  MS_GROWTH_WAVE,
  growthTotalMs,
  islandDelayMs,
  trailsDelayMs,
  waveOf,
} from './forest-growth';

const page = (): string => readFileSync(new URL('../pages/index.astro', import.meta.url), 'utf8');

// ── the layers an island is actually made of ────────────────────────────────

test('TEETH: every per-island layer the ENGINE emits is animated — none is left painting', () => {
  // ⚠ THE BUG THIS EXISTS FOR SHIPPED IN THIS MODULE'S FIRST DRAFT. The obvious selector is
  // `.tw-isle`, and `tw-isle` is the COASTLINE ALONE — the engine paints an island across three
  // sibling top-level layers so the whole forest stacks correctly. Animating one of the three
  // hides a shore and leaves the island exactly where it was, and NOTHING THROWS: the page looks
  // like it has no growth, which is the report that started this increment.
  //
  // ⚠ AND THE EXPECTATION IS DERIVED FROM THE EMITTER, NOT FROM A LIST TYPED HERE. A hand-copied
  // list would have been copied from the same wrong belief as the code (the first draft's own
  // probe counted `.tw-isle` too, and agreed with it). This reads `worldSvg.ts` — the function
  // that writes these groups — and asks which classes it stamps a `data-id` onto, because
  // `data-id` is exactly the marker that says "this group belongs to one story".
  const emitter = readFileSync(new URL('../lib/worldSvg.ts', import.meta.url), 'utf8');
  const emitted = new Set<string>();
  for (const m of emitter.matchAll(/<g class="(tw-[a-z-]+)[^"]*"[^`]*?data-id=/g)) {
    if (m[1] !== undefined) emitted.add(m[1]);
  }
  assert.ok(emitted.size >= 3, `only found ${emitted.size} per-island layers in worldSvg.ts — the extractor has gone blind`);
  // Covered = animated directly, or a descendant of something animated and named as such. The
  // second set is what stops this test being satisfiable by animating everything blindly: an
  // exclusion has to be written down with its reason before it counts.
  const covered = new Set<string>([...ISLAND_LAYERS, ...NESTED_LAYERS]);
  const missed = [...emitted].filter((c) => !covered.has(c));
  assert.deepEqual(
    missed,
    [],
    `worldSvg.ts emits per-island layer(s) the growth never touches: ${missed.join(', ')}. ` +
      'They will keep painting while their siblings arrive.',
  );
});

test('TEETH: every animated layer has a rule in the stylesheet — a listed layer that is not styled does nothing', () => {
  // The other half. `ISLAND_LAYERS` naming a class buys nothing if index.astro has no rule for it:
  // the module would stamp a delay onto an element no animation reads, and the layer would stay
  // painted. Both halves have to be checked or the pair can drift into agreeing about nothing.
  const css = page();
  for (const layer of ISLAND_LAYERS) {
    assert.ok(
      new RegExp(`\\.forest-arrival-svg\\.${GROWING_CLASS} \\.${layer}\\b`).test(css),
      `${layer} is in ISLAND_LAYERS but index.astro has no growth rule for it`,
    );
  }
});

test('the trees are not scaled — a fixed origin would slide them off their own ground', () => {
  // Measured on the live snapshot, the disc's centre sits between 28.7% and 50.4% of the way down
  // the `tw-terr` bounding box depending on how tall the island's trees are and how long its name
  // plate is. There is no fixed percentage that is right for every island, so the flora is moved
  // and faded rather than scaled. This pins the decision so "make them all scale, it's simpler"
  // has to argue with the measurement.
  const css = page();
  const terr = /\.forest-arrival-svg\.is-growing \.tw-terr \{([^}]*)\}/.exec(css);
  assert.ok(terr !== null, 'no growth rule for the flora layer');
  assert.ok(!/transform-box|scale\(/.test(terr[1] ?? ''), 'the flora layer is being scaled about a fixed origin');
  for (const land of LAND_LAYERS) {
    assert.ok(
      new RegExp(`\\.${land},?[\\s\\S]{0,120}?transform-box:\\s*fill-box`).test(css),
      `${land} should scale about its own fill-box centre`,
    );
  }
  // The offset must also be IN the stylesheet, and agree — the module's constant is what the
  // schedule and the ceiling are computed from, the CSS is what actually runs.
  const off = /calc\(var\(--grow-delay,\s*0ms\)\s*\+\s*(\d+)ms\)/.exec(css);
  assert.ok(off !== null, 'the flora rule does not offset itself from its island at all');
  assert.equal(Number(off[1]), MS_GROWTH_FLORA_OFFSET, 'the CSS flora offset and the module constant disagree');
  // Enough that the land is essentially settled before an unscaled tree becomes readable on it.
  assert.ok(
    MS_GROWTH_FLORA_OFFSET >= MS_GROWTH_ISLAND * 0.4,
    `the trees start ${MS_GROWTH_FLORA_OFFSET}ms in while the land takes ${MS_GROWTH_ISLAND}ms — a full-size tree on a part-grown disc`,
  );
});

// ── the schedule ────────────────────────────────────────────────────────────

test('TEETH: every island gets a wave — none is dropped from the schedule', () => {
  // The failure: an off-by-one or a `waves` larger than `count` leaves an island with no delay, or
  // with one past the moment the armed class is removed. Either way that island never appears, and
  // nothing on the page says so. Checked across corpus sizes because today's 35 is not a promise.
  for (const count of [1, 2, 3, 7, 8, 35, 36, 200]) {
    const waves = new Set<number>();
    for (let i = 0; i < count; i += 1) {
      const w = waveOf(i, count);
      assert.ok(Number.isInteger(w) && w >= 0 && w < GROWTH_WAVES, `island ${i}/${count} got wave ${w}`);
      assert.ok(
        islandDelayMs(i, count) + MS_GROWTH_ISLAND <= growthTotalMs(count),
        `island ${i}/${count} finishes after the arrival is declared over`,
      );
      waves.add(w);
    }
    assert.ok(waves.size <= GROWTH_WAVES);
    assert.equal(waveOf(0, count), 0, 'the foundation row is not in the first wave');
  }
});

test('the order is foundations first — a later island never arrives before an earlier one', () => {
  // The islands are in the build's own placement order, which is dependency rank from the bottom
  // up. The reveal has to preserve that or it stops being a true statement about the forest.
  const count = 35;
  for (let i = 1; i < count; i += 1) {
    assert.ok(
      islandDelayMs(i, count) >= islandDelayMs(i - 1, count),
      `island ${i} grows before island ${i - 1} — the dependency order is not preserved`,
    );
  }
  assert.ok(
    islandDelayMs(count - 1, count) > islandDelayMs(0, count),
    'every island arrives at once — there is no growth, only a fade',
  );
});

test('the trails follow the islands they connect — an edge never precedes both its ends', () => {
  const count = 35;
  assert.ok(
    trailsDelayMs(count) >= islandDelayMs(count - 1, count) + MS_GROWTH_ISLAND,
    'the trails phase in while islands are still arriving',
  );
});

test('TEETH: the arrival is BOUNDED and stays a reveal, not a live feed', () => {
  // ⚠ THE HONESTY FENCE, AS A NUMBER. The map is a snapshot stamped with a date, and the page's
  // whole pitch is that its signals are real. A reveal that runs long enough to be mistaken for a
  // forest still filling in breaks exactly that claim — the same reason wisps were excluded from
  // the snapshot. The ceiling is what stops "make it more visible" walking the total upward one
  // reasonable step at a time.
  //
  // It also has to hold as the corpus GROWS, which is why this is per-count: the retired walk's
  // per-island 0.22s law was fine over three stories and takes 7.5s over today's 35.
  for (const count of [3, 35, 200, 2000]) {
    const total = growthTotalMs(count);
    assert.ok(total <= 4000, `${count} islands take ${total}ms to arrive — that is a wait, not an arrival`);
    assert.ok(total > MS_GROWTH_LEAD_IN, `${count} islands: the growth has no duration at all`);
  }
  // Waves, not per-island: the total must not scale with the corpus.
  assert.equal(growthTotalMs(35), growthTotalMs(2000), 'the arrival gets longer as the corpus grows');
});

test('the growth finishes around the first thing TELL says, not long after it', () => {
  // Timed overlap, asserted rather than left to drift: the name beat lands while the last waves are
  // still arriving. If MS_LEAD_IN is retuned without looking here, the site either says its name to
  // an empty board or waits in silence for a settled one.
  const src = readFileSync(new URL('./act2-tell.ts', import.meta.url), 'utf8');
  const m = /export const MS_LEAD_IN = (\d+);/.exec(src);
  assert.ok(m !== null, 'could not read MS_LEAD_IN out of act2-tell.ts');
  const leadIn = Number(m[1]);
  const total = growthTotalMs(35);
  assert.ok(leadIn < total, `TELL starts at ${leadIn}ms, after the whole arrival ends at ${total}ms`);
  assert.ok(leadIn > MS_GROWTH_LEAD_IN, `TELL starts at ${leadIn}ms, before the first island arrives`);
});

// ── the no-script guarantee ─────────────────────────────────────────────────

test('TEETH: the parked state never escapes the armed class — no-script keeps the whole map', () => {
  // ⚠ THE FAILURE THIS EXISTS FOR IS INVISIBLE IN A BROWSER. `…-arc-arrival` bought the property
  // that a visitor whose script never runs still gets the entire forest as a static, dated picture.
  // Hoisting `opacity: 0` or the growth animation out of `.is-growing` — the obvious "simplify the
  // selector" edit — hides the map from precisely the people who cannot report it, while every
  // scripted browser looks perfect.
  const css = page();
  // Selector lists span lines (several layers share one rule), so the selector half of the match
  // deliberately allows newlines — an earlier line-bound version silently matched nothing and
  // reported a confident pass, which is the same blindness this file is here to prevent.
  const rules = [...css.matchAll(/([^{}]*\.tw-(?:isle|ground|terr|trails)\b[^{}]*)\{([^}]*)\}/g)];
  const growthRules = rules.filter(([, , body]) =>
    // A FULL hide (`opacity: 0`), not a dim — TELL's lenses legitimately set 0.62 on the same
    // selectors, and matching those would make this test fail for a reason it is not about.
    /animation:\s*act2-forest-|opacity:\s*0\s*(?:;|$)/.test(body ?? ''),
  );
  assert.ok(growthRules.length >= 2, 'the growth rules are not in index.astro at all');
  for (const [, selector, body] of growthRules) {
    assert.ok(
      (selector ?? '').includes(`.${GROWING_CLASS}`),
      `a growth rule is not scoped to .${GROWING_CLASS} — a no-script visitor loses the map:\n  ${selector?.trim()} {${body?.trim()}}`,
    );
  }
});

test('the growth keyframes and the schedule constants agree with each other', () => {
  // The durations live in two places by necessity — the CSS cannot be imported here. This is the
  // same joint act2-tell.test.ts holds for the prose fade, and it fails the same way: silently.
  const css = page();
  const isle = /animation:\s*act2-forest-grow\s+(\d+)ms/.exec(css);
  const trails = /animation:\s*act2-forest-trails\s+(\d+)ms/.exec(css);
  assert.ok(isle !== null, 'could not find the island growth animation in index.astro');
  assert.ok(trails !== null, 'could not find the trail reveal animation in index.astro');
  assert.equal(Number(isle[1]), MS_GROWTH_ISLAND, 'the island animation and MS_GROWTH_ISLAND disagree');
  assert.equal(Number(trails[1]), MS_GROWTH_TRAILS, 'the trail animation and MS_GROWTH_TRAILS disagree');
  assert.ok(css.includes('--grow-delay'), 'the CSS never reads the per-island delay the module stamps');
  assert.ok(MS_GROWTH_WAVE > 0, 'the waves land simultaneously');
});

test('reduced motion turns the arrival off in the stylesheet as well as in the module', () => {
  // `mountForestGrowth` arms nothing under reduced motion, so this is belt and braces — but the
  // stylesheet must not be the ONLY thing between a reduced-motion visitor and an animation, nor
  // the only thing that is not.
  const css = page();
  const block = /@media \(prefers-reduced-motion: reduce\)([\s\S]*?)\n  \}/.exec(css);
  assert.ok(block !== null, 'index.astro has no reduced-motion block');
  assert.ok(
    /is-growing[\s\S]*?animation:\s*none/.test(css),
    'reduced motion does not disable the forest growth animation',
  );
});
