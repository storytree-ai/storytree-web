// ROAM's payload, its status vocabulary and its copy (act2-roam.ts).
//
// ⚠ WHAT THIS SUITE IS ACTUALLY FOR. ROAM is the movement where the visitor asks the map questions
// and the map answers in words. So the interesting failure is never "the panel did not open" — it
// is "the panel said something the map does not support". Every test below is aimed at that class:
//
//   1. a number written into the copy, which goes stale the first time the snapshot job runs;
//   2. a status the panel READS differently from the way the island is PAINTED;
//   3. a sentence in the present tense about a system, over a picture that is a dated export;
//   4. a status the exporter can produce and this module has no reading for — which surfaces as
//      "unknown" on an island that is plainly coloured;
//   5. prose that arrives on a clock, which would make this a second TELL;
//   6. an ADR citation that no longer holds up.
//
// ⚠ THE CONTROLS ARE READ IN THE SAME RUN, NEVER TYPED IN HERE. Where a test needs to know that the
// panel tracked the data, it runs the SAME code over TWO different corpora and compares them, or
// reads the REAL snapshot and compares against the counts that snapshot declares about itself.
// Where a test needs to know this module's vocabulary matches the exporter's, it reads the
// exporter's own source rather than a hand-copied list — an expectation derived from a duplicate of
// its own subject cannot fail, and this project has caught ten instruments that could not.
//
// ⚠ `bun test` TRANSPILES AND DOES NOT TYPECHECK. `npm run typecheck` covers this file; run it
// before believing anything below.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ADR_LIST_CAP,
  LIFECYCLE_READING,
  ROAM_ARC_EMPTY,
  ROAM_ARC_NOTE,
  ROAM_CAPABILITY_NOTE,
  ROAM_COLOUR_NOTE,
  ROAM_FLOOR_NOTE,
  ROAM_NOTES,
  ROAM_STORY_NOTE,
  ROAM_TRAIL_NOTE,
  STATUS_READING,
  adrOverflow,
  adrTally,
  arcTally,
  capabilityTally,
  incrementTally,
  lifecycleReading,
  edgeSentence,
  parseRoamPayload,
  parseTrailEdges,
  provenCount,
  toRoamStatus,
  trailHeading,
  edgeName,
  NAME_MAX,
  shortStoryTitle,
  trailNote,
  trailOverflow,
  TRAIL_LIST_CAP,
  type RoamNote,
  type RoamStatus,
  type RoamStory,
} from './act2-roam';
import { assertSnapshot, roamPayload, toSceneStatus } from './forest-snapshot-map';
import snapshotJson from '../data/forest-snapshot.json';

const SOURCE = readFileSync(new URL('./act2-roam.ts', import.meta.url), 'utf8');

/** The REAL published forest. Read here rather than described, so every assertion below that talks
 *  about "the corpus" is talking about the one that is on the live site. */
const SNAP = assertSnapshot(snapshotJson);

const story = (
  id: string,
  status: RoamStatus,
  caps: readonly [string, RoamStatus][],
): RoamStory => ({
  id,
  title: `story ${id}`,
  status,
  capabilities: caps.map(([capId, capStatus]) => ({
    id: capId,
    title: `cap ${capId}`,
    status: capStatus,
  })),
  arcs: [],
});

// ── the copy says nothing it has not read ───────────────────────────────────

test('no number is written into ROAM copy — every count is counted at render time', () => {
  for (const note of ROAM_NOTES) {
    for (const line of note.lines) {
      assert.equal(
        /\d/.test(line),
        false,
        `${note.id}: "${line}" carries a digit. The forest is republished by a job, so a number ` +
          `in the copy becomes false the first time it runs.`,
      );
    }
  }
  for (const [status, reading] of Object.entries(STATUS_READING)) {
    assert.equal(/\d/.test(reading.sentence), false, `${status}'s reading carries a digit`);
    assert.equal(/\d/.test(reading.word), false, `${status}'s word carries a digit`);
  }
});

test('TEETH: a note that hard-codes a number IS caught — the check above is not vacuous', () => {
  const rigged: RoamNote = { id: 'rigged', lines: ['An island is one of 35 stories.'] };
  const digits = rigged.lines.filter((l) => /\d/.test(l));
  assert.equal(digits.length, 1, 'the digit check must see a number written into copy');
});

test('the tally is COUNTED from the payload, and moves when the corpus moves', () => {
  const small = story('a', 'healthy', [['c1', 'healthy'], ['c2', 'proposed']]);
  const large = story('b', 'proposed', [
    ['c1', 'healthy'],
    ['c2', 'healthy'],
    ['c3', 'healthy'],
    ['c4', 'proposed'],
  ]);
  assert.notEqual(
    capabilityTally(small),
    capabilityTally(large),
    'two different stories must not produce the same tally',
  );
  assert.equal(provenCount(small), 1);
  assert.equal(provenCount(large), 3);
  // The singular is real prose, not "1 capabilitys".
  assert.match(capabilityTally(story('c', 'healthy', [['c1', 'healthy']])), /^1 capability,/);
  // And a story with nothing recorded says so rather than claiming zero of zero proven.
  assert.equal(capabilityTally(story('d', 'proposed', [])), 'no capabilities recorded');
});

// ── the panel reads the value that painted the island ───────────────────────

test('every status the EXPORTER can produce has a reading here — read from its own source', () => {
  // ⚠ THE LIST IS EXTRACTED FROM `toSceneStatus`'s SOURCE, not copied into this file. That function
  // is what turns the snapshot's status string into the island's `st-*` class; if someone adds a
  // status there and not here, every island carrying it would be PAINTED and then described as
  // "unknown" — a disagreement between the picture and the panel, which is the one thing this
  // module claims cannot happen. A hand-copied list would agree with itself forever.
  const mapSource = readFileSync(new URL('./forest-snapshot-map.ts', import.meta.url), 'utf8');
  const fn = mapSource.slice(mapSource.indexOf('export function toSceneStatus'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  const cases = [...body.matchAll(/case '([a-z]+)':/g)].map((m) => m[1] as string);
  assert.ok(cases.length >= 5, `expected the exporter's status cases, found ${cases.length}`);
  for (const status of cases) {
    const folded = toSceneStatus(status);
    assert.ok(
      Object.prototype.hasOwnProperty.call(STATUS_READING, folded),
      `the exporter can paint an island '${folded}' and ROAM has no reading for it`,
    );
    assert.equal(toRoamStatus(folded), folded, `'${folded}' must survive ROAM's own narrowing`);
  }
  // And the honest default: a status from a FUTURE exporter reads as "we do not know", never as one
  // of the colours we happen to have.
  assert.equal(toRoamStatus('a-status-invented-later'), 'unknown');
  assert.equal(toSceneStatus('a-status-invented-later'), 'unknown');
});

test('only a PROVEN story is described as proven — the panel cannot flatter an island', () => {
  for (const [status, reading] of Object.entries(STATUS_READING) as [RoamStatus, { word: string }][]) {
    const claimsProven = reading.word === 'proven';
    assert.equal(
      claimsProven,
      status === 'healthy',
      `'${status}' reads as "${reading.word}" — only 'healthy' may read as bare "proven"`,
    );
  }
});

test('a FAILING island is said to be failing — the map is not a brochure', () => {
  // The single most load-bearing sentence in this vocabulary, and the one that never fires today:
  // `unhealthy` has not occurred in this corpus because the gate refuses red work from reaching
  // trunk. It ships anyway, and it must not be softened into something that could be mistaken for
  // "still being worked on".
  assert.equal(STATUS_READING.unhealthy.word, 'failing');
  assert.match(STATUS_READING.unhealthy.sentence, /failing/);
  assert.doesNotMatch(STATUS_READING.unhealthy.sentence, /not yet|in progress|being (built|worked)/i);
});

test('BOTH sides of the proven/not-proven fork are real sentences nobody stubbed', () => {
  for (const [status, reading] of Object.entries(STATUS_READING)) {
    assert.ok(reading.word.length > 2, `${status}: the word is a stub`);
    assert.ok(reading.sentence.length > 30, `${status}: the sentence is a stub`);
    assert.match(reading.sentence, /\.$/, `${status}: the sentence does not end`);
  }
});

test("the REAL corpus exercises the not-proven branch — the honesty is live, not theoretical", () => {
  const payload = roamPayload(SNAP);
  const words = payload.stories.map((s) => STATUS_READING[s.status].word);
  assert.ok(
    words.some((w) => w !== 'proven'),
    'every island in the published forest reads as proven — either the corpus changed or the ' +
      'reading has stopped discriminating',
  );
  assert.ok(words.some((w) => w === 'proven'), 'no island reads as proven');
  // And the island that IS this website is described by the same rule as every other one: whatever
  // its status says, and nothing kinder.
  const self = payload.stories.find((s) => s.id === 'website-experience');
  if (self !== undefined) {
    assert.equal(
      STATUS_READING[self.status].word === 'proven',
      self.status === 'healthy',
      'the site describes itself by the same rule it describes everything else by',
    );
  }
});

// ── it is a dated picture, never a live feed ────────────────────────────────

test('nothing ROAM says claims the system is doing something RIGHT NOW', () => {
  // The forest is a snapshot stamped with the day it was taken. A sentence in the live present
  // turns that dated export into a false live reading — the same reason session wisps were kept out
  // of it. This is the mechanical half of that rule; the judgement half is still a person's.
  const LIVE = /\b(right now|currently|at the moment|is being|are being|live)\b/i;
  const everyLine = [
    ...ROAM_NOTES.flatMap((n) => n.lines),
    ...Object.values(STATUS_READING).map((r) => r.sentence),
    ...Object.values(LIFECYCLE_READING).map((r) => r.sentence),
  ];
  for (const line of everyLine) {
    assert.doesNotMatch(line, LIVE, `"${line}" reads as a live feed over a dated snapshot`);
  }
  assert.ok(everyLine.length >= 8, 'the scan found suspiciously few lines to check');
});

test("TEETH: the live-feed scan DOES catch a present-tense claim", () => {
  const LIVE = /\b(right now|currently|at the moment|is being|are being|live)\b/i;
  assert.match('This one is being built right now.', LIVE);
  assert.match('Three of these are currently in flight.', LIVE);
});

test('the one in-flight status is phrased as a reading of the picture, not of today', () => {
  assert.match(STATUS_READING.building.sentence, /was|when this picture was taken/i);
});

// ── one or two sentences, and no clock ──────────────────────────────────────

test('every note is one or two sentences — the visitor is clicking, not reading', () => {
  for (const note of ROAM_NOTES) {
    assert.ok(note.lines.length >= 1 && note.lines.length <= 2, `${note.id}: ${note.lines.length} lines`);
    for (const line of note.lines) {
      assert.ok(line.length <= 110, `${note.id}: "${line}" is ${line.length} chars — too long to click past`);
      assert.match(line, /\.$/, `${note.id}: "${line}" does not end`);
    }
  }
});

test('NOTHING IN ROAM IS ON A CLOCK — this is what "we are quiet" means mechanically', () => {
  // ⚠ THIS IS THE LOAD-BEARING TEST IN THE FILE. "TELL is the only movement that speaks" forbids
  // volunteering sentences on our own timing. A `setTimeout` in this module is how that fence gets
  // crossed by accident — a panel that auto-advances, an explanation that fades in after a beat, a
  // hint that appears if the visitor hesitates. All three would read as polish and all three would
  // make this a second TELL. The reader's click is the only clock here.
  //
  // It also settles the reading-pace standard for this movement without re-deriving it: the pace
  // rule caps how fast text is DELIVERED, and text that is never taken away is never delivered
  // fast. That holds only while nothing here schedules a removal.
  for (const timer of ['setTimeout', 'setInterval', 'requestAnimationFrame', 'performance.now']) {
    // The word may appear inside a comment explaining this very rule, so the check is against the
    // comment-stripped source.
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.equal(
      code.includes(timer),
      false,
      `act2-roam.ts calls ${timer} — ROAM has acquired a clock, and a clock is TELL's`,
    );
  }
});

test('TEETH: the no-clock scan reads the real source and would see a timer', () => {
  const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(code.length > 2000, 'the comment-stripped source is suspiciously small — the scan may be reading nothing');
  assert.ok(code.includes('mountRoam'), 'the scan is not reading the module it claims to');
  assert.equal(`${code}\nsetTimeout(x, 1)`.includes('setTimeout'), true);
});

// ── grounding the parent gate will resolve ──────────────────────────────────

test('every grounding is a well-formed ADR reference the parent gate can validate', () => {
  const seen: string[] = [];
  for (const note of ROAM_NOTES) {
    for (const id of note.grounds ?? []) {
      assert.match(id, /^ADR-\d{3,4}$/, `${note.id} cites "${id}", which check:web-grounding cannot resolve`);
      seen.push(id);
    }
  }
  assert.ok(seen.length >= 4, `only ${seen.length} grounded claims — the notes have lost their citations`);
});

test('every note that asserts something about the PRODUCT carries grounding', () => {
  // What a story is, what a capability is, what the colour means, what a trail is, and where the
  // public map stops are all claims about storytree rather than about this page. Each rests on a
  // decision, and the parent gate reds if that decision has been superseded.
  for (const note of [
    ROAM_STORY_NOTE,
    ROAM_COLOUR_NOTE,
    ROAM_CAPABILITY_NOTE,
    ROAM_TRAIL_NOTE,
    ROAM_FLOOR_NOTE,
  ]) {
    assert.ok((note.grounds ?? []).length > 0, `${note.id} asserts a product claim with no grounding`);
  }
});

test('the floor is a door, not a wall — it names what opens it', () => {
  const text = ROAM_FLOOR_NOTE.lines.join(' ');
  assert.match(text, /app/i, 'the floor must say where this goes, never merely that it stops');
  // And it does not promise a download. There is no product to hand anyone yet; the site's own
  // ending is where that is said.
  assert.doesNotMatch(text, /download|install|sign up|get started/i);
});

// ── the payload ─────────────────────────────────────────────────────────────

test('the real snapshot round-trips through the payload without losing anything', () => {
  // The control is the snapshot's own declared counts, read in the same run. If `roamPayload` or
  // the parser silently dropped a story or a capability, these would disagree.
  const wire = JSON.stringify(roamPayload(SNAP));
  const parsed = parseRoamPayload(wire);
  assert.notEqual(parsed, null, 'the payload the build emits must be parseable by the runtime');
  assert.equal(parsed?.stories.length, SNAP.storyCount);
  const caps = (parsed?.stories ?? []).reduce((n, s) => n + s.capabilities.length, 0);
  assert.equal(caps, SNAP.capabilityCount);
  const proven = (parsed?.stories ?? []).filter((s) => s.status === 'healthy').length;
  assert.equal(proven, SNAP.provenStoryCount, 'the panel and the stamp must count the same greens');
});

test('a payload that cannot be trusted is refused, never defaulted', () => {
  assert.equal(parseRoamPayload(null), null);
  assert.equal(parseRoamPayload('not json'), null);
  assert.equal(parseRoamPayload('null'), null);
  assert.equal(parseRoamPayload('{"asOf":"1 January 2026"}'), null, 'no stories');
  assert.equal(parseRoamPayload('{"asOf":"1 January 2026","stories":[]}'), null, 'empty forest');
  assert.equal(parseRoamPayload('{"stories":[{"id":"a","title":"A","capabilities":[]}]}'), null, 'no date');
  assert.equal(parseRoamPayload('{"asOf":"x","stories":[{"title":"A"}]}'), null, 'story with no id');
});

test('the snapshot date survives to the panel — the stamp is not optional chrome', () => {
  const parsed = parseRoamPayload(JSON.stringify(roamPayload(SNAP)));
  assert.ok((parsed?.asOf ?? '').length > 0);
  assert.match(parsed?.asOf ?? '', /\d{4}/, 'the date must carry a year');
});

// ── trails ──────────────────────────────────────────────────────────────────

test('a merged trunk reports every dependency it carries, not a favourite', () => {
  const edges = parseTrailEdges('a->b, a->c ,a->d,a->b');
  assert.equal(edges.length, 3, 'the duplicate must collapse and the three distinct edges survive');
  assert.deepEqual(
    edges.map((e) => `${e.from}/${e.to}`),
    ['a/b', 'a/c', 'a/d'],
  );
  assert.equal(trailHeading(edges), '3 dependencies run along this trail');
  assert.equal(trailHeading(edges.slice(0, 1)), 'One dependency runs along this trail');
});

test('malformed edge metadata is dropped rather than rendered as a half sentence', () => {
  assert.deepEqual(parseTrailEdges(null), []);
  assert.deepEqual(parseTrailEdges(''), []);
  assert.deepEqual(parseTrailEdges('->b'), [], 'no source');
  assert.deepEqual(parseTrailEdges('a->'), [], 'no target');
  assert.deepEqual(parseTrailEdges('ab'), [], 'no arrow');
});

test('a dependency reads in the direction the arrow points, in the stories own titles', () => {
  const titles = new Map([
    ['proof-protocol', 'The proof-protocol'],
    ['studio', 'The studio'],
  ]);
  const titleOf = (id: string): string => titles.get(id) ?? id;
  assert.equal(
    edgeSentence({ from: 'proof-protocol', to: 'studio' }, titleOf),
    'The studio needs The proof-protocol.',
  );
  // A story missing from the payload degrades to its id rather than to a blank sentence.
  assert.equal(edgeSentence({ from: 'gone', to: 'studio' }, titleOf), 'The studio needs gone.');
});

test('the trail metadata on the REAL map parses into real dependencies', () => {
  // A control in the same run: the edges the site actually ships, not a string invented here. Every
  // parsed edge must name two stories that exist in the published forest, or the panel would print
  // a sentence about an island nobody can click.
  const ids = new Set(SNAP.stories.map((s) => s.id));
  const sample = SNAP.stories
    .flatMap((s) => s.dependsOn.map((d) => `${d}->${s.id}`))
    .slice(0, 40)
    .join(',');
  const edges = parseTrailEdges(sample);
  assert.ok(edges.length > 0, 'the published forest has no dependency edges at all');
  for (const edge of edges) {
    assert.ok(ids.has(edge.from), `${edge.from} is not a story on this map`);
    assert.ok(ids.has(edge.to), `${edge.to} is not a story on this map`);
  }
});

test('a merged trunk is CAPPED and says how much it left out — a panel is not a document', () => {
  // Measured on the shipped map: the busiest segment carries 33 dependencies from 11 sources, and
  // 43 of 118 segments carry more than six. Printing them all would turn one click into a wall of
  // long sentences, which is not what ROAM is. The heading still carries the true total, and the
  // tail says plainly how many are not on screen.
  const many = Array.from({ length: 33 }, (_, i) => ({ from: 'hub', to: `dep${i}` }));
  assert.equal(trailHeading(many), '33 dependencies run along this trail');
  assert.equal(trailOverflow(many), `…and ${33 - TRAIL_LIST_CAP} more along the same stretch.`);
  assert.ok(TRAIL_LIST_CAP < 33, 'the cap must actually cap');
  // Nothing is hidden when nothing was left out — no "…and 0 more".
  assert.equal(trailOverflow(many.slice(0, TRAIL_LIST_CAP)), null);
  assert.equal(trailOverflow([{ from: 'a', to: 'b' }]), null);
});

test('only a MERGED trunk gets the extra sentence — a plain trail raises no question', () => {
  const one = trailNote([{ from: 'a', to: 'b' }]);
  const many = trailNote([{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }]);
  assert.equal(one.lines.length, 1);
  assert.equal(many.lines.length, 2, 'a trunk must explain why one line means several dependencies');
  assert.ok(many.lines.length <= 2, 'still one or two sentences');
  assert.deepEqual(one.grounds, many.grounds, 'the grounding must survive the extra line');
  assert.equal(trailNote([]).lines.length, 1);
});

test('a dependency sentence is SHORT — measured against the corpus, not asserted', () => {
  // The control is the real 35 titles, both ways, in the same run. The claim is not "short titles
  // are nicer"; it is that reading whole titles on both sides of a dependency produces sentences a
  // visitor will not read. If the corpus's titles ever stop carrying a name-then-description shape,
  // this stops being true and this test is what says so.
  const titles = SNAP.stories.map((s) => s.title);
  const full = Math.max(...titles.map((x) => x.length));
  const short = Math.max(...titles.map((x) => shortStoryTitle(x).length));
  assert.ok(short < full, `shortening did nothing: ${short} vs ${full}`);
  const meanFull = titles.reduce((n, x) => n + x.length, 0) / titles.length;
  const meanShort = titles.reduce((n, x) => n + shortStoryTitle(x).length, 0) / titles.length;
  assert.ok(meanShort * 1.6 < meanFull, `mean ${meanShort.toFixed(0)} vs ${meanFull.toFixed(0)} — barely shorter`);

  // And the worst sentence a trail panel can print, over the REAL corpus.
  const titleOf = (id: string): string => SNAP.stories.find((s) => s.id === id)?.title ?? id;
  const worst = Math.max(
    ...SNAP.stories.flatMap((s) =>
      s.dependsOn.map((d) => edgeSentence({ from: d, to: s.id }, titleOf).length),
    ),
  );
  assert.ok(worst <= 190, `the longest dependency sentence on this map is ${worst} characters`);
});

test('a title with no separator is returned whole, never cut mid-word', () => {
  assert.equal(shortStoryTitle('The studio'), 'The studio');
  assert.equal(shortStoryTitle('The CLI — one agent-facing command surface'), 'The CLI');
  assert.equal(shortStoryTitle('CI/CD: the one enforced pipeline'), 'CI/CD');
  // A leading separator is not a separator — it would produce an empty name.
  assert.equal(shortStoryTitle('— odd'), '— odd');
});

test('a story with no NAME in its title is called by the label the map shows — its id', () => {
  const titleOf = (id: string): string => SNAP.stories.find((s) => s.id === id)?.title ?? id;
  // The control: how many of the REAL 35 fall back, and that the fallback is always the id rather
  // than a cut-off phrase. A truncation would invent a name nothing on the page shows.
  const fellBack = SNAP.stories.filter((s) => edgeName(s.id, titleOf) === s.id && shortStoryTitle(s.title) !== s.id);
  assert.ok(fellBack.length > 0, 'no story falls back — the rule is doing nothing on this corpus');
  assert.ok(fellBack.length < SNAP.stories.length / 2, `${fellBack.length} of ${SNAP.stories.length} fall back — the threshold is too tight`);
  for (const s of SNAP.stories) {
    const name = edgeName(s.id, titleOf);
    assert.ok(name.length <= Math.max(NAME_MAX, s.id.length), `"${name}" is too long to read as a relation`);
    // Never a truncation: whatever is printed is either the id or a whole prefix of the title.
    assert.ok(name === s.id || s.title.startsWith(name), `"${name}" is neither the id nor a whole name`);
  }
});

// ── target 5 · the arc drawer ───────────────────────────────────────────────
//
// The tier one level ABOVE the code, and the one where the protection is different in kind. The
// forest is safe to publish because it is illegible on purpose (ADR-0453 D3): a stranger reads
// `cli` and learns nothing. Arc titles are readable English about strategy, so that argument does
// not carry up here — what keeps this tier publishable is that the BODIES never leave the exporter.
// Every test below is aimed at that, or at the count/tense classes the rest of the suite covers.

test('⚠ THE PUBLISHED ARC TIER CARRIES NO PROSE — the fence, against the REAL snapshot', () => {
  // The exporter's own suite holds the same line one repo up with sentinel strings. This is the
  // website's half, and it is worth having separately: it asserts against the file that is actually
  // shipped, so a snapshot published by a FUTURE exporter that leaked a body would red here even
  // though nothing in this repo changed.
  const ALLOWED = new Set(['id', 'title', 'lifecycle', 'incrementsClosed', 'incrementsOpen', 'adrs']);
  const ADR_ALLOWED = new Set(['number', 'status', 'title']);
  assert.ok(SNAP.arcs.length > 0, 'the published snapshot carries no arc tier at all');
  for (const arc of SNAP.arcs) {
    for (const key of Object.keys(arc)) {
      assert.ok(ALLOWED.has(key), `the published arc "${arc.id}" carries "${key}", which is below the floor`);
    }
    for (const adr of arc.adrs) {
      for (const key of Object.keys(adr)) {
        assert.ok(ADR_ALLOWED.has(key), `a decision on "${arc.id}" carries "${key}"`);
      }
    }
  }
  // …and the same again through the fold the browser actually receives, because that is the copy a
  // panel reads. A field could be dropped from the file and re-derived here.
  const wire = JSON.parse(JSON.stringify(roamPayload(SNAP))) as { arcs: Record<string, unknown>[] };
  for (const arc of wire.arcs) {
    for (const key of Object.keys(arc)) assert.ok(ALLOWED.has(key), `the wire arc carries "${key}"`);
  }
});

test('⚠ roamPayload NARROWS — an arc arriving WITH a body does not reach the browser', () => {
  // THE CASE TODAY'S DATA CANNOT TEST. The published snapshot carries no arc prose, so a fold that
  // spread the whole arc would look identical to one that names its fields — and a fence that only
  // ever sees the good input is not a fence. This feeds the fold an arc that DOES carry the bodies
  // (the shape a future exporter leak would produce) and asserts none of it survives the narrowing.
  const poisoned = {
    ...SNAP,
    arcs: [
      {
        ...SNAP.arcs[0],
        intent: 'SENTINEL-intent',
        endState: 'SENTINEL-endState',
        description: 'SENTINEL-description',
        questions: [{ stakes: 'SENTINEL-stakes' }],
        increments: [{ objective: 'SENTINEL-objective' }],
      },
    ],
  };
  const wire = JSON.stringify(roamPayload(poisoned as never));
  for (const sentinel of [
    'SENTINEL-intent',
    'SENTINEL-endState',
    'SENTINEL-description',
    'SENTINEL-stakes',
    'SENTINEL-objective',
  ]) {
    assert.ok(!wire.includes(sentinel), `the fold forwarded ${sentinel} to the browser`);
  }
  // The control: the poisoned arc DID carry them, so a green above means the fold dropped them
  // rather than that the test built an arc with nothing in it.
  assert.ok(JSON.stringify(poisoned.arcs[0]).includes('SENTINEL-intent'), 'the fixture is not poisoned');
});

test('TEETH: the prose fence would CATCH a leaked body — the check above is not vacuous', () => {
  const ALLOWED = new Set(['id', 'title', 'lifecycle', 'incrementsClosed', 'incrementsOpen', 'adrs']);
  const leaked = { ...SNAP.arcs[0], intent: 'the strategy layer, which does not ship' };
  assert.ok(Object.keys(leaked).some((k) => !ALLOWED.has(k)), 'the fence cannot see an added field');
});

test('every arc a story names RESOLVES — the drawer never opens on a dangling id', () => {
  const known = new Set(SNAP.arcs.map((a) => a.id));
  let edges = 0;
  for (const story of SNAP.stories) {
    for (const edge of story.arcs) {
      edges += 1;
      assert.ok(known.has(edge.id), `story "${story.id}" names arc "${edge.id}", which is not published`);
    }
  }
  assert.ok(edges > 0, 'no story reaches an arc — the drawer has nothing to open on the real corpus');
  // And nothing is published that no story can reach: an arc with no way in is dead weight on a
  // file that is inlined into the page.
  const reached = new Set(SNAP.stories.flatMap((s) => s.arcs.map((a) => a.id)));
  for (const arc of SNAP.arcs) assert.ok(reached.has(arc.id), `arc "${arc.id}" is reachable from no island`);
});

test('the EMPTY state is exercised by the real corpus, not merely written for', () => {
  // Measured on the published snapshot: a minority of islands are reached by no arc. If that ever
  // became zero the empty branch would be untested prose, and if it became most of them the drawer
  // would be a row that usually says nothing — either way this is the number to look at.
  const empty = SNAP.stories.filter((s) => s.arcs.length === 0);
  assert.ok(empty.length > 0, 'no island exercises the empty state — the branch is dead prose');
  assert.ok(
    empty.length < SNAP.stories.length / 2,
    `${empty.length} of ${SNAP.stories.length} islands reach no arc — the drawer is mostly empty`,
  );
  assert.equal(arcTally({ ...story('x', 'proposed', []), arcs: [] }), 'no initiative on record');
});

test('every lifecycle the REAL corpus carries has a reading — none falls through to unknown', () => {
  const seen = new Set(SNAP.arcs.map((a) => a.lifecycle));
  assert.ok(seen.size > 0, 'the snapshot published no lifecycle at all');
  for (const lifecycle of seen) {
    assert.notEqual(
      lifecycleReading(lifecycle).word,
      'unknown',
      `the exporter published lifecycle "${lifecycle}" and the drawer has no reading for it`,
    );
  }
  // Every branch is a real sentence somebody wrote, including the ones this corpus does not yet
  // reach — the same rule the status vocabulary follows, for the same reason.
  for (const [key, reading] of Object.entries(LIFECYCLE_READING)) {
    assert.ok(reading.word.length > 0 && reading.sentence.length > 10, `${key} is stubbed`);
    assert.match(reading.sentence, /\.$/, `${key}'s reading is not a sentence`);
  }
  // …and a lifecycle from a future exporter reads as "we do not know", never as one we happen to have.
  assert.equal(lifecycleReading('a-lifecycle-invented-later').word, 'unknown');
});

test('an OPEN arc is described in the picture’s tense, not the system’s', () => {
  // 18 of the 19 arcs on this snapshot are closed, so the open branch is the one a careless edit
  // would phrase as live. Both open branches must anchor to the moment the picture was taken.
  for (const key of ['active', 'parked']) {
    assert.match(
      LIFECYCLE_READING[key]!.sentence,
      /when this picture was taken/,
      `"${key}" describes the system now rather than the snapshot`,
    );
  }
});

test('the arc shape is COUNTED from the payload, and moves when the arc moves', () => {
  const base = { id: 'a', title: 'A', lifecycle: 'closed', adrs: [] };
  assert.equal(incrementTally({ ...base, incrementsClosed: 0, incrementsOpen: 0 }), 'no steps recorded');
  assert.equal(incrementTally({ ...base, incrementsClosed: 1, incrementsOpen: 0 }), '1 step, closed');
  assert.equal(incrementTally({ ...base, incrementsClosed: 7, incrementsOpen: 0 }), '7 steps, all closed');
  assert.equal(incrementTally({ ...base, incrementsClosed: 0, incrementsOpen: 1 }), '1 step, still open');
  assert.equal(incrementTally({ ...base, incrementsClosed: 12, incrementsOpen: 3 }), '12 closed, 3 still open');
  // The control: the REAL corpus produces more than one answer, so the function is reading data
  // rather than returning a constant that happens to look right.
  const distinct = new Set(SNAP.arcs.map((a) => incrementTally(a as never)));
  assert.ok(distinct.size > 1, 'every published arc tallies the same — the count is not being read');
});

test('a long decision list is CAPPED and says how much it left out', () => {
  const adrs = Array.from({ length: ADR_LIST_CAP + 4 }, (_, i) => ({
    number: 100 + i,
    status: 'accepted',
    title: `decision ${i}`,
  }));
  assert.equal(adrOverflow(adrs), '…and 4 more.');
  assert.equal(adrOverflow(adrs.slice(0, ADR_LIST_CAP)), null, 'a full-but-not-over list says nothing');
  assert.equal(adrOverflow([]), null);
  assert.equal(adrTally([]), null, 'an arc with no decisions gets no heading at all');
  assert.equal(adrTally(adrs.slice(0, 1)), '1 decision behind it');
  assert.equal(adrTally(adrs), `${adrs.length} decisions behind it`);
  // The control: the real corpus actually overflows, so the cap is doing something.
  assert.ok(
    SNAP.arcs.some((a) => a.adrs.length > ADR_LIST_CAP),
    'no published arc exceeds the cap — the truncation branch is untested against real data',
  );
});

test('the arc tier survives the round trip to the browser', () => {
  const parsed = parseRoamPayload(JSON.stringify(roamPayload(SNAP)));
  assert.notEqual(parsed, null);
  assert.equal(parsed?.arcs.length, SNAP.arcs.length, 'an arc was dropped between the build and the panel');
  const reached = new Set((parsed?.arcs ?? []).map((a) => a.id));
  for (const s of parsed?.stories ?? []) {
    for (const id of s.arcs) assert.ok(reached.has(id), `"${id}" survived on a story but not as a record`);
  }
});

test('a MALFORMED arc record is dropped, and its absence never kills the forest', () => {
  // The asymmetry is the decision: a missing arc tier is a snapshot taken before the layer existed
  // and the drawer simply has nothing to open; a record present but unreadable would render a panel
  // of `undefined`, so it goes. Neither may take the map down with it.
  const noArcs = parseRoamPayload('{"asOf":"1 January 2026","stories":[{"id":"a","title":"A","capabilities":[]}]}');
  assert.notEqual(noArcs, null, 'a snapshot with no arc tier must still render its forest');
  assert.deepEqual(noArcs?.arcs, []);
  assert.deepEqual(noArcs?.stories[0]?.arcs, []);

  const junk = parseRoamPayload(
    '{"asOf":"1 January 2026","stories":[{"id":"a","title":"A","capabilities":[],"arcs":["ok",7]}],' +
      '"arcs":[{"id":"ok","title":"OK"},{"title":"no id"},null,7]}',
  );
  assert.notEqual(junk, null);
  assert.deepEqual(junk?.stories[0]?.arcs, ['ok'], 'a non-string arc id must not reach the panel');
  assert.equal(junk?.arcs.length, 1, 'only the readable record survives');
  // and the missing fields read as an honest zero rather than `undefined` in a sentence
  assert.equal(junk?.arcs[0]?.lifecycle, 'unknown');
  assert.equal(incrementTally(junk!.arcs[0]!), 'no steps recorded');
});

test('the drawer’s own notes carry the same grounding and length bars as the other four', () => {
  // They are already in ROAM_NOTES, so the suite-wide scans cover them — this asserts the wiring,
  // because a note left OUT of that list would silently escape every one of those checks.
  assert.ok(ROAM_NOTES.includes(ROAM_ARC_NOTE), 'the arc note is outside the scanned set');
  assert.ok(ROAM_NOTES.includes(ROAM_ARC_EMPTY), 'the empty-state note is outside the scanned set');
  assert.deepEqual(ROAM_ARC_NOTE.grounds, ['ADR-0183'], 'the arc note must cite the decision behind arcs');
  // The empty state asserts nothing about the product — it reports that a record is empty — so it
  // carries no grounding, and that is deliberate rather than an omission.
  assert.equal(ROAM_ARC_EMPTY.grounds, undefined);
  assert.doesNotMatch(ROAM_ARC_EMPTY.lines.join(' '), /because|predates|older/i, 'the empty state must not invent a cause');
});
