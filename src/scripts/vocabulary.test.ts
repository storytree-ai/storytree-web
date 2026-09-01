// The vocabulary fence over every prose surface in chapter 2 (vocabulary.ts).
//
// ⚠ WHAT THIS SUITE IS ACTUALLY FOR. ADR-0494 D5 is a rule about WORDS, and a rule about words that
// lives only in a comment survives exactly as long as the person who wrote it. The failure it guards
// is not "the copy is wrong today" — it is the copy drifting back one noun at a time, which nobody
// notices because each sentence reads fine on its own. The visitor meets TELL and ROAM within
// seconds of each other, so a page that calls the same shape a `microservice` in the prose and a
// `story` in the panel is worse than one that used our noun throughout.
//
// ⚠ THE FENCE IS ON THE PROSE AND STOPS AT THE MAP. Island and component LABELS are our real,
// untranslated corpus names and are never scanned here — ADR-0453 D3's mechanism is a stranger
// projecting their own system onto a shape they cannot read, and a test that "fixed" a label would
// invert that decision while looking like the same job. Everything scanned below is a string the
// SITE wrote; nothing that came out of the snapshot is.
//
// ⚠ AND IT IS A WORD LIST, WHICH IS ALL A CHECK CAN BE. It sees the noun arrive; it cannot tell
// whether the sentence around it is written for the reader. That half is a person's judgement and no
// rung replaces it.
//
// ⚠ `bun test` TRANSPILES AND DOES NOT TYPECHECK. `npm run typecheck` covers this file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { INTERNAL_NOUNS, findInternalNouns, speaksReaderVocabulary } from './vocabulary';
import { LINEAGE_LOWER, LINEAGE_UPPER } from './act2-lineage-diagram';
import { SELF_CLAUSE, SELF_STORY_ID, TELL_SCRIPT, renderLine, type ForestFacts } from './act2-tell';
import { ASK_CTA, ASK_LINE } from './act2-ask';
import {
  LIFECYCLE_READING,
  ROAM_DAG_FIT_LABEL,
  ROAM_KIND_WORD,
  ROAM_NOTES,
  STATUS_READING,
  adrOverflow,
  adrTally,
  arcTally,
  capabilityGraphLabel,
  capabilityTally,
  decisionTally,
  incrementTally,
  uatTally,
  type RoamStory,
} from './act2-roam';
import { legendProse } from './forest-legend';
import {
  arrivalLabel,
  assertSnapshot,
  nameplateTally,
  provenTally,
  renderStamp,
} from './forest-snapshot-map';
import snapshotJson from '../data/forest-snapshot.json';

/** One labelled string, so a failure names the surface as well as the sentence. */
interface Prose {
  readonly where: string;
  readonly text: string;
}

/** Any corpus at all — the fence is about words, and no assertion here depends on a count. */
const FACTS: ForestFacts = {
  stories: 35,
  proven: 21,
  capabilities: 215,
  selfIsland: SELF_STORY_ID,
  selfIsGreen: false,
  busiestIsland: 'studio',
};

/**
 * A story fixture whose counts force every PLURAL branch of the tally builders.
 *
 * ⚠ THE TALLIES ARE BUILT, NOT WRITTEN, WHICH IS WHY THEY ARE CALLED HERE RATHER THAN READ. A noun
 * assembled at render time (`${n} capabilities`) is invisible to any scan of the copy constants, and
 * it is the string in the most-clicked row on the panel. Both the singular and plural branches are
 * exercised, because they carry two different words.
 */
function storyFixture(caps: number, arcs: number): RoamStory {
  return {
    id: 'fixture',
    title: 'Fixture',
    status: 'healthy',
    capabilities: Array.from({ length: caps }, (_, i) => ({
      id: `c${i}`,
      title: `c${i}`,
      status: 'healthy' as const,
      dependsOn: [],
    })),
    uat: [],
    decisions: [],
    arcs: Array.from({ length: arcs }, (_, i) => `a${i}`),
  };
}

/** A story carrying `provable` acceptance steps and `unprovable` ones — the three branches of
 *  `uatTally`, which are three different sentences and therefore three chances to leak a noun. */
function uatFixture(provable: number, unprovable: number): RoamStory {
  const leg = (i: number, signable: boolean) => ({
    title: `step ${i}`,
    state: 'proven' as const,
    witness: 'machine' as const,
    signable,
  });
  return {
    ...storyFixture(0, 0),
    uat: [
      ...Array.from({ length: provable }, (_, i) => leg(i, true)),
      ...Array.from({ length: unprovable }, (_, i) => leg(provable + i, false)),
    ],
  };
}

/** A story naming `n` decisions — the singular, the plural and the honest empty. */
function decisionFixture(n: number): RoamStory {
  return { ...storyFixture(0, 0), decisions: Array.from({ length: n }, (_, i) => i) };
}

function arcFixture(closed: number, open: number, adrs: number) {
  return {
    id: 'a',
    title: 'An initiative',
    lifecycle: 'closed',
    incrementsClosed: closed,
    incrementsOpen: open,
    // Decision NUMBERS since schema 3 — the records live once, in the payload's own registry.
    adrs: Array.from({ length: adrs }, (_, i) => i),
  };
}

/** Every string chapter 2 can put in front of a visitor, from both movements and the page itself. */
function visitorProse(): Prose[] {
  const out: Prose[] = [];

  // ⚠ RENDERED, NOT RAW. A TELL line is a template and `{stories}` is a PLACEHOLDER NAME — an
  // internal handle the visitor never sees, exactly like a note's `id`. Scanning the template flags
  // it and scanning the rendered line does not, and the rendered line is what the page shows: the
  // token substitutes to `35`. (Found by this suite reporting `{stories} of them.` on its first run,
  // which is the fence working on the wrong input rather than the copy being wrong.)
  for (const beat of TELL_SCRIPT) {
    beat.lines.forEach((line, i) =>
      out.push({ where: `TELL ${beat.id}[${i}]`, text: renderLine(line, FACTS) }),
    );
  }
  for (const [branch, text] of Object.entries(SELF_CLAUSE)) {
    out.push({ where: `TELL self clause (${branch})`, text });
  }
  // ⚠ THE FIGURE'S LABELS ARE PROSE TOO, AND A WORD LIST THAT STOPS AT THE SENTENCES IS THE BLIND
  // SPOT THIS SUITE ALREADY PAID FOR ONCE. `renderStamp` built a string this fence never scanned
  // and shipped "stories" under the map while the prose said "microservice" ten seconds later —
  // found by reading the live site, not the build. Two words inside an SVG box are exactly the
  // shape that escapes again.
  out.push({ where: 'TELL lineage figure (upper box)', text: LINEAGE_UPPER });
  out.push({ where: 'TELL lineage figure (lower box)', text: LINEAGE_LOWER });

  // ⚠ THE CAPABILITY GRAPH'S OWN DESCRIPTION IS THE SAME SHAPE AGAIN — a sentence built inside a
  // render function and set on an SVG attribute, which is invisible to a fence that stops at the
  // sentences. Scanned at three sizes because the singular, plural and empty readings are three
  // different sentences, and only one of them is exercised by any given island.
  for (const [nodes, edges] of [
    [0, 0],
    [1, 0],
    [26, 37],
  ] as const) {
    out.push({
      where: `ROAM capability graph label(${nodes},${edges})`,
      text: capabilityGraphLabel(nodes, edges),
    });
  }
  out.push({ where: 'ROAM capability graph fit control', text: ROAM_DAG_FIT_LABEL });

  for (const note of ROAM_NOTES) {
    note.lines.forEach((text, i) => out.push({ where: `ROAM note ${note.id}[${i}]`, text }));
  }
  for (const [status, reading] of Object.entries(STATUS_READING)) {
    out.push({ where: `ROAM status ${status} (word)`, text: reading.word });
    out.push({ where: `ROAM status ${status}`, text: reading.sentence });
  }
  for (const [state, reading] of Object.entries(LIFECYCLE_READING)) {
    out.push({ where: `ROAM lifecycle ${state} (word)`, text: reading.word });
    out.push({ where: `ROAM lifecycle ${state}`, text: reading.sentence });
  }
  for (const [kind, word] of Object.entries(ROAM_KIND_WORD)) {
    out.push({ where: `ROAM kind word (${kind})`, text: word });
  }
  // The built strings — singular, plural and empty, which are three different sentences.
  for (const n of [0, 1, 6]) {
    out.push({ where: `ROAM capabilityTally(${n})`, text: capabilityTally(storyFixture(n, 0)) });
    out.push({ where: `ROAM arcTally(${n})`, text: arcTally(storyFixture(0, n)) });
    out.push({ where: `ROAM incrementTally(${n})`, text: incrementTally(arcFixture(n, 0, 0)) });
    const tally = adrTally(n);
    if (tally !== null) out.push({ where: `ROAM adrTally(${n})`, text: tally });
    const more = adrOverflow(n);
    if (more !== null) out.push({ where: `ROAM adrOverflow(${n})`, text: more });
    // The two rows this tier added, in the same three shapes and for the same reason.
    out.push({ where: `ROAM uatTally(${n})`, text: uatTally(uatFixture(n, 0)) });
    out.push({ where: `ROAM uatTally(${n}, all unprovable)`, text: uatTally(uatFixture(0, n)) });
    out.push({ where: `ROAM decisionTally(${n})`, text: decisionTally(decisionFixture(n)) });
  }

  // ASK's ending — the last prose a visitor meets, and the one most likely to be written by
  // somebody thinking about conversion rather than about this fence.
  out.push({ where: 'ASK line', text: ASK_LINE });
  out.push({ where: 'ASK cta', text: ASK_CTA });

  // THE MAP'S OWN BUILT STRINGS — the fifth surface, and the one this fence originally missed. They
  // are generated in `forest-snapshot-map.ts` rather than written anywhere, so no scan of copy
  // constants could see them. The STAMP is the FIRST prose a visitor reads and sat under the map
  // saying "stories" while TELL said "microservice" ten seconds later. The other three went the same
  // way and were found the same way, by reading the built page: every island's NAMEPLATE said
  // "9 capabilities", its hover TITLE said "of 9 capabilities proven", and the map's accessible
  // DESCRIPTION said "35 story islands" — a day after every copy constant had been rewritten. They
  // are named exports now for exactly that reason: a word a test cannot import is a word this fence
  // does not cover. Rendered against the REAL published snapshot, because that is the string the
  // live site serves, and both plural branches are exercised because they carry two different words.
  //
  // ⚠ AN ISLAND'S TITLE IS DELIBERATELY NOT HERE. It is `${story.title} — ${provenTally(…)}`, and
  // the title half is our real corpus name, which the fence must never read (ADR-0453 D3). Only the
  // built half is exported, which is why only the built half can be scanned.
  const snap = assertSnapshot(snapshotJson);
  out.push({ where: 'MAP stamp', text: renderStamp(snap) });
  out.push({ where: 'MAP arrival label', text: arrivalLabel(snap) });
  for (const n of [0, 1, 6]) {
    out.push({ where: `MAP nameplateTally(${n})`, text: nameplateTally(n) });
    out.push({ where: `MAP provenTally(${n})`, text: provenTally(n, n + 1) });
  }

  // The KEY, which is the one surface on this page a visitor reads without asking for it and
  // without clicking anything — so a noun that slipped in here would be met by everyone. Its strings
  // are enumerated by the module itself rather than listed here, which is what keeps this covered
  // when a row is added later. The status WORDS in it are `STATUS_READING`'s, already scanned above;
  // they come through again because the key renders them and the double cost is nil.
  for (const text of legendProse()) {
    out.push({ where: `KEY ${text.slice(0, 24)}`, text });
  }

  // The page's own two act-2 strings. Read out of the source the same way `act2-tell.test.ts` reads
  // the stylesheet — they are markup this module cannot import, and leaving them unscanned would
  // mean the label a screen reader announces was the one place our nouns could survive.
  const page = readFileSync(new URL('../pages/index.astro', import.meta.url), 'utf8');
  const label = /aria-label="([^"]*forest[^"]*)"/.exec(page);
  assert.ok(label !== null, 'could not find the forest aria-label in index.astro');
  out.push({ where: 'index.astro forest aria-label', text: label[1] ?? '' });
  const fallback = /<p class="fallback__note">([\s\S]*?)<\/p>/.exec(page);
  assert.ok(fallback !== null, 'could not find the no-script fallback note in index.astro');
  out.push({ where: 'index.astro fallback note', text: fallback[1] ?? '' });

  return out;
}

// ── the fence ───────────────────────────────────────────────────────────────

test('no visitor-facing sentence in chapter 2 uses one of our internal nouns (ADR-0494 D5)', () => {
  const offenders = visitorProse()
    .map((p) => ({ ...p, nouns: findInternalNouns(p.text) }))
    .filter((p) => p.nouns.length > 0)
    .map(
      (p) =>
        `${p.where}: "${p.text.trim()}" — says ${p.nouns.map((n) => `"${n}" (say "${INTERNAL_NOUNS[n]}")`).join(', ')}`,
    );
  assert.deepEqual(offenders, [], `internal nouns reached visitor-facing prose:\n  ${offenders.join('\n  ')}`);
});

test('the surface is scanned WIDE — a fence over three sentences would pass vacuously', () => {
  // The failure this pins: someone narrows `visitorProse()` to TELL alone, the suite stays green,
  // and the panel drifts back to our nouns unobserved. The count is deliberately well under the
  // real one so it fails on a COLLAPSE rather than on someone adding or removing a beat.
  const prose = visitorProse();
  assert.ok(prose.length >= 40, `only ${prose.length} strings are being scanned`);
  const surfaces = new Set(prose.map((p) => p.where.split(' ')[0]));
  assert.deepEqual([...surfaces].sort(), ['ASK', 'KEY', 'MAP', 'ROAM', 'TELL', 'index.astro']);
});

test('TEETH: the fence catches each internal noun — it is not vacuous', () => {
  // Every noun on the list, in a sentence that would read perfectly on the page. If a boundary or a
  // plural were wrong, the rule would be silently half-applied and the suite would still be green.
  for (const [noun, replacement] of Object.entries(INTERNAL_NOUNS)) {
    const sentence = `Every island is one ${noun} you can open.`;
    assert.deepEqual(
      findInternalNouns(sentence),
      [noun],
      `the fence did not catch "${noun}" (which should read "${replacement}")`,
    );
    assert.equal(speaksReaderVocabulary(sentence), false);
  }
});

test('TEETH: the exact line this increment replaced is refused', () => {
  // The shipped copy, verbatim, on 2026-09-01 before ADR-0494 D5. Re-typing it must red.
  assert.deepEqual(
    findInternalNouns('Every island is one story — one thing the system does.'),
    ['story'],
  );
  assert.deepEqual(
    findInternalNouns('A capability is one organ of that story, proven on its own.'),
    ['capability', 'story'],
    'the finder did not report both nouns in reading order',
  );
});

test('the product name is never flagged — a substring scan would have failed on its first run', () => {
  // `storytree` contains `story`, and it is the one word on this page that must survive. This is
  // the property the word boundaries buy, asserted rather than assumed.
  assert.deepEqual(findInternalNouns('This is storytree.'), []);
  assert.deepEqual(findInternalNouns("storytree's own records, drawn from storytree."), []);
  // …and the boundary holds on the other side too: `search` must not read as `arc`.
  assert.deepEqual(findInternalNouns('You can search it, and every arch holds.'), []);
});

test('the reader HAS been given their own vocabulary, not merely spared ours', () => {
  // ⚠ THE HALF A BAN CANNOT EXPRESS. Deleting `story` from every sentence satisfies the fence above
  // completely and leaves the visitor with no name for the thing at all, which is a worse page than
  // the one that used our noun. So the three words ADR-0494 D5 names are asserted PRESENT: an island
  // is a microservice, an edge is a depends-on. (`DAG` arrives with the edges beat and is not
  // required here — asserting it now would be a test written against work that has not landed.)
  const all = visitorProse()
    .map((p) => p.text)
    .join(' ')
    .toLowerCase();
  for (const word of ['microservice', 'depends-on']) {
    assert.ok(all.includes(word), `the copy never says "${word}" — the swap removed a noun without supplying one`);
  }
});
