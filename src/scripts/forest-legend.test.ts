// The key to the map (forest-legend.ts).
//
// ⚠ WHAT THIS SUITE IS ACTUALLY FOR. The failure it guards is not "the key reads badly today" — it
// is the key and the MAP drifting apart, which nobody notices because each of them reads fine on its
// own. A colour painted on an island with no row in the key is the defect that put this increment on
// the arc in the first place; a row in the key for a colour that is nowhere on the screen is the
// same defect wearing the other face. Both are asserted below against the fold that paints the
// islands, never against a list typed into this file.
//
// ⚠ `bun test` TRANSPILES AND DOES NOT TYPECHECK. `npm run typecheck` covers this file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  LEGEND_COLOUR_TERM,
  LEGEND_ISLAND_ROW,
  LEGEND_SHAPE_ROWS,
  LEGEND_STATUS_ORDER,
  LEGEND_TITLE,
  legendProse,
  legendSwatches,
} from './forest-legend';
import { STATUS_READING } from './act2-roam';
import { assertSnapshot, forestSceneInput, toSceneStatus } from './forest-snapshot-map';
import snapshotJson from '../data/forest-snapshot.json';

/** The REAL published forest, so every assertion about "the map" is about the one that is live. */
const SNAP = assertSnapshot(snapshotJson);

// ── the key covers every colour the exporter can paint ──────────────────────

test('every status the EXPORTER can paint has a row in the key — read from its own source', () => {
  // ⚠ THE LIST IS EXTRACTED FROM `toSceneStatus`'s SOURCE, not copied into this file — the same
  // shape `act2-roam.test.ts` uses, and for the same reason. That function is what turns the
  // snapshot's status string into the island's `st-*` class. A status added there and not here
  // would be PAINTED on the map with nothing in the key to decode it, which is the exact defect
  // this whole increment exists to close. A hand-copied list would agree with itself forever.
  const mapSource = readFileSync(new URL('./forest-snapshot-map.ts', import.meta.url), 'utf8');
  const fn = mapSource.slice(mapSource.indexOf('export function toSceneStatus'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  const cases = [...body.matchAll(/case '([a-z]+)':/g)].map((m) => m[1] as string);
  assert.ok(cases.length >= 5, `expected the exporter's status cases, found ${cases.length}`);

  const covered = new Set(LEGEND_STATUS_ORDER);
  for (const status of cases) {
    const folded = toSceneStatus(status);
    assert.ok(covered.has(folded), `the exporter can paint an island '${folded}' and the key has no row for it`);
  }
  // …and the honest default, which is a colour on the map like any other.
  assert.ok(covered.has(toSceneStatus('a-status-invented-later')), 'the key has no row for `unknown`');

  // BOTH DIRECTIONS. A row for a status the exporter cannot produce would put a colour in the key
  // that can never appear on the map — the terrain-and-props error, which is what keeps a legend
  // honest rather than merely complete.
  const producible = new Set([...cases.map(toSceneStatus), toSceneStatus(null)]);
  for (const status of LEGEND_STATUS_ORDER) {
    assert.ok(producible.has(status), `the key lists '${status}', which the exporter cannot paint`);
  }
});

test('the key says what the PANEL says — one vocabulary, not two that agree today', () => {
  // The word is imported from `STATUS_READING` rather than written in the legend module, so this
  // asserts a property that holds by construction. It is worth asserting anyway: the day someone
  // "simplifies" the legend by inlining its words, this is what says no.
  for (const status of LEGEND_STATUS_ORDER) {
    const reading = STATUS_READING[status];
    assert.ok(reading, `no ROAM reading for '${status}'`);
    const chip = legendSwatches({
      ...SNAP,
      stories: SNAP.stories.map((s) => ({ ...s, status })),
    }).at(0);
    assert.equal(chip?.status, status);
    assert.equal(chip?.word, reading.word, `the key and the panel disagree about '${status}'`);
  }
  // The branch that has never occurred here still ships, and it still says the unkind thing.
  assert.equal(STATUS_READING.unhealthy.word, 'failing');
  assert.ok(LEGEND_STATUS_ORDER.includes('unhealthy'));
});

// ── the key lists exactly what is on the screen ─────────────────────────────

test('the chips are exactly the colours the map paints — one fold, two consumers', () => {
  // ⚠ MEASURED OFF THE SCENE THE PAGE RENDERS, not off the snapshot's raw `status` field. The
  // territories carry the folded status the island wears; the key must list that set and no more.
  const painted = new Set(forestSceneInput(SNAP).territories.map((t) => t.status));
  const listed = legendSwatches(SNAP).map((s) => s.status);

  assert.deepEqual(
    [...listed].sort(),
    [...painted].sort(),
    'the key and the map disagree about which colours are on the screen',
  );
  // Reading order is the key's own, not the snapshot's iteration order, so the card does not
  // reshuffle itself every time the forest is republished.
  assert.deepEqual(listed, LEGEND_STATUS_ORDER.filter((s) => painted.has(s)));
  // Today's published corpus. Stated so a change in what the live map shows is visible in a diff
  // rather than silently absorbed.
  assert.deepEqual(listed, ['healthy', 'proposed']);
});

test('a colour that is not on the map gets no row — and an empty forest gets no chips', () => {
  const one = (status: string) => ({
    ...SNAP,
    stories: SNAP.stories.map((s) => ({ ...s, status })),
  });
  assert.deepEqual(legendSwatches(one('healthy')).map((s) => s.status), ['healthy']);
  assert.deepEqual(legendSwatches(one('building')).map((s) => s.status), ['building']);
  // A status the exporter has never emitted folds to `unknown`, and the key says so rather than
  // borrowing a colour it recognises.
  assert.deepEqual(legendSwatches(one('quarantined')).map((s) => s.status), ['unknown']);
  assert.deepEqual(legendSwatches({ ...SNAP, stories: [] }), []);
});

// ── it is a KEY, and it stays one ───────────────────────────────────────────

test('every row is a gloss, not a sentence — a key that grows paragraphs is a second narrator', () => {
  const rows = [LEGEND_ISLAND_ROW, ...LEGEND_SHAPE_ROWS];
  for (const row of rows) {
    assert.ok(row.term.length <= 12, `"${row.term}" is a heading, not a term`);
    assert.ok(
      row.text.split(/\s+/).length <= 10,
      `"${row.text}" is ${row.text.split(/\s+/).length} words — a key row is a gloss`,
    );
    // No terminal full stop: these are labels beside a term, not statements addressed to the reader.
    // ROAM's notes are sentences and end in one; the difference is what keeps the two surfaces from
    // reading as the same voice speaking twice.
    assert.doesNotMatch(row.text, /\.$/, `"${row.text}" ends in a full stop — a key row is not a sentence`);
  }
  assert.ok(rows.length + 1 <= 6, 'the card has grown past a key');
});

test('no number is written into the key — the forest is republished by a job', () => {
  for (const text of legendProse()) {
    assert.equal(/\d/.test(text), false, `"${text}" carries a digit, which the next republish can falsify`);
  }
});

test('the key names no island — ADR-0453 D3 fences the map’s own labels, and this is the surface that could break it', () => {
  // ⚠ THE ONE WAY A LEGEND INVERTS THE DECISION IT WAS BUILT UNDER. The map's names are our real,
  // deliberately illegible corpus ids, because a stranger projecting their own system onto a shape
  // they cannot read IS the mechanism (ADR-0453 D3, clarified by ADR-0494 D5). Saying what a colour
  // means is the opposite act and is what this card does. Translating an island's NAME would be a
  // glossary, and this asserts that no id or title from the snapshot has leaked into the copy.
  const copy = legendProse().join(' ').toLowerCase();
  for (const story of SNAP.stories) {
    assert.equal(copy.includes(story.id.toLowerCase()), false, `the key names the island '${story.id}'`);
  }
  assert.equal(copy.includes(LEGEND_TITLE.toLowerCase()), true);
  assert.ok(LEGEND_COLOUR_TERM.length > 0);
});

test('the page renders the key from THIS module — copy inlined into the template is copy no fence can see', () => {
  // ⚠ THE FAILURE THIS PINS IS THE CHEAP ONE. Someone edits a row, finds it awkward to reach through
  // an import, and types the new wording straight into `index.astro`. The page looks identical and
  // both fences here and in `vocabulary.test.ts` go quiet, because neither can import a string
  // literal sitting in markup. `act2-tell.test.ts` reads this same file for the same reason.
  const page = readFileSync(new URL('../pages/index.astro', import.meta.url), 'utf8');
  for (const symbol of [
    'forest-legend',
    'LEGEND_TITLE',
    'LEGEND_ISLAND_ROW',
    'LEGEND_COLOUR_TERM',
    'LEGEND_SHAPE_ROWS',
    'legendSwatches',
  ]) {
    assert.ok(page.includes(symbol), `index.astro no longer renders the key through \`${symbol}\``);
  }
  // …and it holds none of the copy itself. Comments are stripped first so the reasoning written
  // above the markup — which quotes the owner — is not read as a hard-coded row.
  const markup = page.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const row of [LEGEND_ISLAND_ROW, ...LEGEND_SHAPE_ROWS]) {
    assert.equal(markup.includes(row.text), false, `"${row.text}" is inlined in index.astro`);
  }
});

test('the four signals the map carries each have a row — and nothing it does not draw does', () => {
  const terms = [LEGEND_ISLAND_ROW.term, LEGEND_COLOUR_TERM, ...LEGEND_SHAPE_ROWS.map((r) => r.term)];
  assert.deepEqual(terms, ['island', 'colour', 'size', 'position', 'trail']);
  // The published snapshot draws no terrain, no props and no wisps (ADR-0453 D5), so a row about
  // them would explain a picture that is not on the screen — the rule ROAM keeps, kept here too.
  const scene = forestSceneInput(SNAP);
  assert.deepEqual(scene.territories.flatMap((t) => t.plants), []);
  assert.deepEqual(scene.territories.flatMap((t) => t.wisps ?? []), []);
  const copy = legendProse().join(' ').toLowerCase();
  for (const absent of ['terrain', 'wisp', 'flower', 'grass']) {
    assert.equal(copy.includes(absent), false, `the key explains "${absent}", which this map does not draw`);
  }
});
