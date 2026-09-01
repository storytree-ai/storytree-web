// ---------------------------------------------------------------------------
// THE KEY — what each part of an island is a signal for.
//
// ADR-0299 D3 scoped the public view to "the forest map and the legend", and kept the legend on
// purpose: *"The legend is kept because it is functional, not decorative."* Half of that scope has
// been shipping. The owner walked the built site on 2026-09-01: *"theres no legend atm, so a user
// can't tell whats each bit on the island is a signal for."* The page spends its whole argument
// asserting that its signals are real; a signal nobody can decode asserts that claim without
// honouring it.
//
// ⚠ THIS IS NOT A RESTORE, AND THE VERB MATTERS. A legend WAS built (web `ff70222`, ADR-0147/0150)
// and it went out attached to its host: it lived inside `act2-walkthrough`'s voice panel, shown
// only at the final beat of the scripted walk, and `042f706` unmounted that walk on 2026-08-28 when
// the real forest arrived. Nothing removed it deliberately, so there is no removal reasoning to
// honour — but there is nothing to bring back either. That key described a FICTIONAL three-island
// forest with three statuses. This map paints six and carries three more signals besides colour.
// What is owed is a key to the map that exists.
//
// ── THE FOUR SIGNALS, MEASURED OFF THE MAP RATHER THAN IMAGINED ─────────────────────────────────
//
// Read against `forestSceneInput` and `placeStories` in `forest-snapshot-map.ts`, because a key
// that explains a signal the picture does not carry is worse than no key:
//
//   1. COLOUR   — the island's status, folded by `toSceneStatus` and worn as its `st-*` class.
//   2. SIZE     — `estRadius(quotaOf(story))`: a bigger island holds more components.
//   3. POSITION — `placeStories` stacks rows by dependency RANK, foundations at the bottom and
//                 whatever rests on them fanning up. The least guessable signal on the map.
//   4. TRAILS   — a depends-on, routed from the thing that is needed to the thing that needs it.
//
// Terrain, props and wisps are NOT drawn on this surface (`plants: []`, `wisps: []`, ADR-0453 D5),
// so a row about them would explain a picture that is not on the screen — the same rule ROAM keeps.
//
// ── THE STATUS VOCABULARY SHIPS WHOLE; THE DATA PICKS WHICH ROWS RENDER ─────────────────────────
//
// ⚠ AND THE WORD IS NOT WRITTEN HERE — IT IS `STATUS_READING`'s. The panel a visitor opens by
// clicking an island already had to answer "what does this colour mean", with its reasoning
// attached. Two independently authored answers to one question is exactly how a page ends up
// calling the same green two different things, so this module IMPORTS that vocabulary rather than
// agreeing with it. They cannot disagree, rather than happening not to today.
//
// ⚠ EVERY BRANCH IS COVERED AND THE SNAPSHOT CHOOSES. `LEGEND_STATUS_ORDER` carries the whole union
// `toSceneStatus` can produce, including `unhealthy`, which has never occurred in this corpus and
// says "failing" anyway. But only the statuses actually PAINTED on the map get a row, because a key
// entry for a colour that is nowhere on the screen is the terrain-and-props error wearing a
// different hat. `legendSwatches` reads the same fold that painted the islands — one value, two
// consumers — so a colour on the map without a row in the key is not a state this can reach.
//
// ⚠ IT IS DATA, NOT MARKUP. The page renders this at BUILD time, the way `renderStamp` is rendered:
// no client JS, no clock, no affordance to press, and the key is present even when the script never
// runs. That is also what keeps it importable, so `forest-legend.test.ts` can hold it to the
// exporter's own union and `vocabulary.test.ts` can hold every string in it to the reader's
// language (ADR-0494 D5) — a fence that cannot import a string is a fence that does not cover it.
//
// ⚠ AND IT IS A KEY, NOT A GLOSSARY. ADR-0453 D3 forbids making the map's own NAMES legible: island
// and component labels stay our real, untranslated corpus names, because a stranger projecting
// their own system onto a shape they cannot read is the whole mechanism. Saying what a COLOUR means
// is the opposite act — it makes the signal readable while leaving the substrate illegible. D3's
// in-place clarification and ADR-0494 D5 record that split; nothing below names a single island.
// ---------------------------------------------------------------------------

import { STATUS_READING } from './act2-roam';
import { toSceneStatus, type ForestSnapshot } from './forest-snapshot-map';
import type { SceneStatus } from '../lib/forest-world';

/** The card's own label. Three letters, so it reads as furniture rather than as another sentence. */
export const LEGEND_TITLE = 'key';

/** One row: the signal, and the shortest true thing that can be said about it. */
export interface LegendRow {
  readonly term: string;
  readonly text: string;
}

/**
 * The first row, and the only one that names the THING rather than a signal about it.
 *
 * ⚠ IT SAYS THE SAME WORD ROAM's PANEL SAYS. `ROAM_STORY_NOTE` is "An island is one microservice —
 * one thing this system does", and a visitor meets both surfaces within seconds. A key that
 * introduced a second noun for the same shape would be worse than one that said nothing.
 */
export const LEGEND_ISLAND_ROW: LegendRow = { term: 'island', text: 'one microservice' };

/** The term above the colour chips. The chips themselves carry the readings. */
export const LEGEND_COLOUR_TERM = 'colour';

/**
 * The three signals that are not colour — the ones a visitor has no chance of guessing.
 *
 * ⚠ SIZE AND POSITION ARE THE POINT OF THIS CARD. Colour at least LOOKS like it means something;
 * an island being bigger, or sitting higher up the picture, reads as composition until someone says
 * otherwise. Both are load-bearing readings of the corpus and neither was decodable before this.
 *
 * ⚠ POSITION CARRIES THE DIRECTION, SO THE TRAIL ROW DOES NOT HAVE TO. ROAM's own note spells a
 * trail out in full — "it runs from the thing that is needed to the thing that needs it" — because
 * a panel is answering a question. A key is not, and the picture cannot show that anyway: the
 * trails ship as plain strokes with no arrowheads. What DOES show which way round it goes is the
 * vertical axis, which is the row above. Splitting it that way keeps both rows a gloss.
 *
 * ⚠ PHRASED AS THE READER'S NOUNS THROUGHOUT (ADR-0494 D5): a capability is a COMPONENT, an edge is
 * a DEPENDS-ON. `vocabulary.test.ts` scans every string here.
 */
export const LEGEND_SHAPE_ROWS: readonly LegendRow[] = [
  { term: 'size', text: 'how many components it holds' },
  { term: 'position', text: 'it sits above what it depends on' },
  { term: 'trail', text: 'a depends-on, drawn island to island' },
];

/**
 * Every status the exporter can paint, in the order the key lists them.
 *
 * ⚠ THE WHOLE UNION, DELIBERATELY. `forest-legend.test.ts` extracts the cases out of
 * `toSceneStatus`'s own source and fails if this list has drifted from it in either direction, so
 * a status added upstream cannot arrive on the map with no reading behind it.
 *
 * The order is proven-first and unknown-last: it is a reading order for a person, not the union's
 * declaration order, and it puts the two readings this corpus actually contains at the top.
 */
export const LEGEND_STATUS_ORDER: readonly SceneStatus[] = [
  'healthy',
  'mapped',
  'proposed',
  'building',
  'unhealthy',
  'unknown',
];

/** One colour chip: the status that paints it, and what that colour says. */
export interface LegendSwatch {
  readonly status: SceneStatus;
  readonly word: string;
}

/**
 * The colour chips this snapshot earns — the statuses actually on the map, in reading order.
 *
 * ⚠ FOLDED THROUGH `toSceneStatus`, WHICH IS WHAT PAINTED THE ISLANDS. `forestSceneInput` calls the
 * same function on the same field to build each island's `st-*` class, so the set of colours on the
 * screen and the set of chips in the key are one computation read twice. A key that listed a colour
 * the map does not carry, or omitted one it does, is not a state this can reach.
 */
export function legendSwatches(snap: ForestSnapshot): LegendSwatch[] {
  const painted = new Set<SceneStatus>(snap.stories.map((s) => toSceneStatus(s.status)));
  return LEGEND_STATUS_ORDER.filter((status) => painted.has(status)).map((status) => ({
    status,
    word: STATUS_READING[status].word,
  }));
}

/**
 * Every string the key can put in front of a visitor.
 *
 * Exported for the fences rather than for the page: `vocabulary.test.ts` folds this into
 * `visitorProse()` so the key is held to the reader's language along with everything else, and
 * `forest-legend.test.ts` holds it to the length a KEY is allowed to be. A surface whose strings a
 * test cannot enumerate is a surface the fence passes over in silence.
 */
export function legendProse(): string[] {
  return [
    LEGEND_TITLE,
    LEGEND_ISLAND_ROW.term,
    LEGEND_ISLAND_ROW.text,
    LEGEND_COLOUR_TERM,
    ...LEGEND_SHAPE_ROWS.flatMap((row) => [row.term, row.text]),
    ...LEGEND_STATUS_ORDER.map((status) => STATUS_READING[status].word),
  ];
}
