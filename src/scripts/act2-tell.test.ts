// TELL's script and its state machine (act2-tell.ts).
//
// ⚠ WHAT THIS SUITE IS ACTUALLY FOR. TELL is the one movement where the site SPEAKS, and the whole
// page rests on the forest being a genuine reading rather than a description. So the interesting
// failure here is not "the overlay did not render" — it is "the overlay said something true on the
// day it was written and kept saying it afterwards". Every test below is aimed at that class:
//
//   1. a count hard-coded into the copy, which goes stale the first time the snapshot job runs;
//   2. a status asserted rather than read, which inverts the day someone signs that story off;
//   3. a beat pointing at an island that has left the corpus;
//   4. an ADR citation that no longer holds up.
//
// ⚠ EVERY ASSERTION IS READ OFF A CONTROL IN THE SAME RUN. Where a test needs to know that copy
// tracked the data, it renders the SAME script against TWO different corpora and compares the two
// — never against a number typed into this file, which is the confound this project keeps hitting
// (an expectation derived from its own subject cannot fail). Where that is not possible the test
// says so.
//
// ⚠ `bun test` TRANSPILES AND DOES NOT TYPECHECK. `npm run typecheck` covers this file; run it
// before believing anything below.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MS_FIGURE_REVEAL,
  MS_LEAD_IN,
  MS_READ_FLOOR,
  MS_BLOCK_ACQUIRE,
  MS_LINE_ACQUIRE,
  CPS,
  legibleMs,
  deliveredCps,
  beatSlicesMs,
  SELF_CLAUSE,
  SELF_STORY_ID,
  TELL_SCRIPT,
  beatDwellMs,
  beatStarts,
  lineDwellMs,
  parseForestCounts,
  renderLine,
  resolveScript,
  stateAt,
  totalDurationMs,
  type ForestFacts,
  type TellBeat,
} from './act2-tell';

/** The corpus as published on 2026-08-28 — the numbers the live page is quoting today. */
const TODAY: ForestFacts = {
  stories: 35,
  proven: 21,
  capabilities: 215,
  selfIsland: SELF_STORY_ID,
  selfIsGreen: false,
};

/** A DIFFERENT corpus. Not a smaller version of the same one — every count differs, so a line that
 *  quotes any of them must come out different. This is the control the staleness tests read from. */
const LATER: ForestFacts = {
  stories: 41,
  proven: 27,
  capabilities: 260,
  selfIsland: SELF_STORY_ID,
  selfIsGreen: false,
};

function renderAll(facts: ForestFacts, script: readonly TellBeat[] = TELL_SCRIPT): string[] {
  const resolved = resolveScript(script, facts);
  return resolved.flatMap((_, i) => stateAt(i, resolved, facts).lines);
}

// ── 1. the copy cannot carry a stale number ─────────────────────────────────

test('every count in the copy moves when the corpus moves — no number is written down', () => {
  const now = renderAll(TODAY);
  const later = renderAll(LATER);
  assert.equal(now.length, later.length, 'the two corpora produced different beat shapes');

  // The lines that differ between the two renders are exactly the count-bearing ones. If someone
  // replaces `{proven}` with the literal "21", that line stops differing and this goes red.
  const moved = now.filter((line, i) => line !== later[i]);
  assert.ok(moved.length >= 2, `only ${moved.length} line(s) tracked the corpus: ${moved.join(' | ')}`);

  // And no line may contain a count that belongs to the OTHER corpus — the shape a copy-paste
  // between the two would leave behind.
  for (const line of now) {
    for (const stale of [String(LATER.stories), String(LATER.proven), String(LATER.capabilities)]) {
      assert.ok(!line.includes(stale), `today's copy quotes a number from another corpus: "${line}"`);
    }
  }
});

test('TEETH: a beat that hard-codes its number is caught — the check above is not vacuous', () => {
  // The same suite run against a script where `{proven}` was replaced by the literal it renders to
  // today. This is the exact edit the rule exists to prevent, and it must fail.
  const hardCoded: readonly TellBeat[] = TELL_SCRIPT.map((beat) =>
    beat.id === 'proven'
      ? { ...beat, lines: beat.lines.map((l) => l.replace('{proven}', String(TODAY.proven))) }
      : beat,
  );
  const now = renderAll(TODAY, hardCoded);
  const later = renderAll(LATER, hardCoded);
  const moved = now.filter((line, i) => line !== later[i]);
  const provenLine = now.find((l) => l.includes(String(TODAY.proven)));
  assert.ok(provenLine !== undefined, 'fixture did not produce the line under test');
  assert.ok(
    !moved.includes(provenLine),
    'the hard-coded line still moved with the corpus — the fixture is wrong, not the rule',
  );
  // …and it renders IDENTICALLY against a corpus where the real answer is 27. That is the bug.
  assert.ok(
    later.includes(provenLine),
    'the deliberately-broken script did not reproduce the staleness this suite guards against',
  );
});

test('an unknown placeholder is left visible rather than silently dropped', () => {
  // A typo'd token must reach the page as `{provn}` — loud and obviously wrong — rather than
  // rendering as an empty gap that reads like intentional copy.
  assert.equal(renderLine('{provn} are green.', TODAY), '{provn} are green.');
});

// ── 2. the self beat is read, not asserted ──────────────────────────────────

test('the self beat says the site is not green ONLY while the site is not green', () => {
  const notGreen = stateAt(
    resolveScript(TELL_SCRIPT, TODAY).findIndex((b) => b.id === 'self'),
    resolveScript(TELL_SCRIPT, TODAY),
    TODAY,
  );
  assert.ok(
    notGreen.lines.some((l) => l === SELF_CLAUSE.notGreen),
    'the not-green branch did not render against a not-green corpus',
  );

  // The day someone signs this story off, the boast must invert on its own. Same script, one bit
  // of the corpus changed.
  const green: ForestFacts = { ...TODAY, selfIsGreen: true };
  const script = resolveScript(TELL_SCRIPT, green);
  const state = stateAt(
    script.findIndex((b) => b.id === 'self'),
    script,
    green,
  );
  assert.ok(
    state.lines.some((l) => l === SELF_CLAUSE.green),
    'the site going green did not change what the page says about it',
  );
  assert.ok(
    !state.lines.some((l) => l === SELF_CLAUSE.notGreen),
    'the page would claim it is not green while the map showed green',
  );
});

test('BOTH self clauses are real sentences — neither branch is a stub nobody read', () => {
  // A branch that only runs when a status changes is exactly the branch that ships broken. Assert
  // the unreached one is at least as substantial as the one on the page today.
  for (const clause of [SELF_CLAUSE.green, SELF_CLAUSE.notGreen]) {
    assert.ok(clause.trim().length > 30, `a self clause is a stub: "${clause}"`);
    assert.ok(clause.trim().endsWith('.'), `a self clause is not a finished sentence: "${clause}"`);
  }
  assert.notEqual(SELF_CLAUSE.green, SELF_CLAUSE.notGreen);
});

// ── 3. a beat never points at nothing ───────────────────────────────────────

test('the self beat is DROPPED when its island has left the corpus, not shown pointing at sea', () => {
  const orphaned: ForestFacts = { ...TODAY, selfIsland: null };
  const script = resolveScript(TELL_SCRIPT, orphaned);
  assert.ok(
    !script.some((b) => b.id === 'self'),
    'the self beat survived a corpus with no island to point at',
  );
  // …and the rest of the sequence is untouched: dropping a beat must not renumber or lose others.
  assert.equal(script.length, TELL_SCRIPT.length - 1);
  const kept = script.map((b) => b.id);
  const expected = TELL_SCRIPT.filter((b) => b.id !== 'self').map((b) => b.id);
    assert.deepEqual(kept, expected);
});

test('every lens a beat asks for is one the runtime can honour', () => {
  const known = new Set(['none', 'islands', 'proven', 'trails', 'self']);
  for (const beat of TELL_SCRIPT) {
    assert.ok(known.has(beat.lens), `beat "${beat.id}" asks for an unknown lens: ${beat.lens}`);
  }
  // Exactly one beat may move the camera. More than one and the sequence becomes a tour of the
  // forest, which is ROAM's job and not TELL's.
  const selfBeats = TELL_SCRIPT.filter((b) => b.lens === 'self');
  assert.equal(selfBeats.length, 1);
});

// ── 4. the grounded claims are grounded ─────────────────────────────────────

test('every grounding is a well-formed ADR reference the parent gate can validate', () => {
  // `check:web-grounding` reads these against the LIVE decision log and reds on a number that does
  // not exist or a decision since superseded. That is the check with teeth; this one only makes
  // sure the string reaches it in a shape it can parse rather than being skipped as unrecognised.
  let grounded = 0;
  for (const beat of TELL_SCRIPT) {
    for (const id of beat.grounds ?? []) {
      assert.match(id, /^ADR-\d{3,4}$/, `beat "${beat.id}" cites "${id}", which the gate cannot read`);
      grounded += 1;
    }
  }
  assert.ok(grounded >= 3, `only ${grounded} claim(s) carry grounding`);
});

test('the beats that assert something about the product carry grounding', () => {
  // The judgement of WHICH claims need backing is a person's. What is mechanical is that the two
  // load-bearing ones — what green means, and that the map is real — never lose theirs in an edit.
  for (const id of ['proven', 'loop', 'self', 'turn']) {
    const beat = TELL_SCRIPT.find((b) => b.id === id);
    assert.ok(beat !== undefined, `beat "${id}" has gone`);
    assert.ok((beat.grounds ?? []).length > 0, `beat "${id}" asserts a product claim with no grounding`);
  }
});

// ── the machine: a beat's state is a pure function of its index ─────────────

test('replaying to a beat lands byte-identical however it was reached', () => {
  // The one property inherited from the retired orchestrator, and the reason it was worth
  // inheriting: there is no incremental diff to get wrong.
  const script = resolveScript(TELL_SCRIPT, TODAY);
  for (let i = 0; i < script.length; i += 1) {
    const forwards = stateAt(i, script, TODAY);
    const backwards = stateAt(i, script, TODAY);
    assert.deepEqual(forwards, backwards);
  }
  // Reaching beat 3 after walking 0..9 is the same state as reaching it directly — trivially true
  // for a pure function, which is exactly the claim.
  const direct = stateAt(3, script, TODAY);
  for (let i = 0; i < script.length; i += 1) stateAt(i, script, TODAY);
  assert.deepEqual(stateAt(3, script, TODAY), direct);
});

test('an out-of-range index clamps rather than throwing — a late timer must not take the page down', () => {
  const script = resolveScript(TELL_SCRIPT, TODAY);
  assert.equal(stateAt(-4, script, TODAY).index, 0);
  assert.equal(stateAt(999, script, TODAY).index, script.length - 1);
  assert.deepEqual(stateAt(0, [], TODAY).lines, []);
});

// ── the timing we own ───────────────────────────────────────────────────────

test('a beat holds long enough to read, and a longer line holds longer', () => {
  const short = lineDwellMs('This is storytree.');
  const long = lineDwellMs(
    'Which leaves two options, both bad: read every line yourself, or trust it and hope.',
  );
  assert.ok(long > short, 'a nine-times-longer line did not get more time');
  assert.ok(
    short >= MS_BLOCK_ACQUIRE + MS_READ_FLOOR,
    'a short line fell under acquisition plus the reading floor',
  );
});

test('TEETH: NO LINE IS DELIVERED FASTER THAN THE CEILING — the owner could not read it', () => {
  // ⚠ THIS IS THE TEST THE 2026-08-29 DEFECT NEEDED AND DID NOT HAVE. The owner walked the live
  // site and reported "couldnt read it". Every timing test above passed at the time, because they
  // all asked about DWELL — and the defect was that acquisition (the CSS fade) was inside the
  // dwell rather than on top of it, so a line nominally allotted 1150ms was READABLE for 430.
  //
  // The ceiling is stated in characters per second because that is the unit the subtitle standards
  // use, and this is the subtitle problem: text over a picture the viewer also has to watch.
  // Netflix's Timed Text Style Guide caps adult programming at 17 cps. This copy is silent,
  // propositional and deliberately over a map, so it sits under that.
  //
  // FALSIFIABILITY, MEASURED RATHER THAN CLAIMED. Against the pre-fix constants
  // (MS_PER_WORD = 252, MS_LINE_FLOOR = 1150, a 0.7s block fade charged to the budget) this test
  // reds on four lines at 37.2, 38.9, 46.3 and 53.7 cps — two to three times the ceiling. The
  // record is in docs/research/tell-pace-2026-08-29/.
  const script = resolveScript(TELL_SCRIPT, TODAY);
  const offenders: string[] = [];
  for (let i = 0; i < script.length; i += 1) {
    const state = stateAt(i, script, TODAY);
    state.lines.forEach((line, j) => {
      const cps = deliveredCps(state.lines, j, state.figure);
      if (cps > CPS + 0.5) {
        offenders.push(
          `${state.id}[${j}] "${line}" — ${cps.toFixed(1)} cps over ${legibleMs(state.lines, j, state.figure)}ms`,
        );
      }
    });
  }
  assert.deepEqual(offenders, [], `lines delivered faster than ${CPS} cps:\n  ${offenders.join('\n  ')}`);
});

test('TEETH: every line is legible for at least the reading floor, fade excluded', () => {
  // The companion to the ceiling. A long line can satisfy the cps ceiling while a SHORT one is
  // flashed — "It is yours now." was on screen opaque for 430ms — so the floor is asserted on the
  // legible window directly, never on the allotted dwell.
  const script = resolveScript(TELL_SCRIPT, TODAY);
  for (let i = 0; i < script.length; i += 1) {
    const state = stateAt(i, script, TODAY);
    state.lines.forEach((_, j) => {
      const legible = legibleMs(state.lines, j, state.figure);
      assert.ok(
        legible >= MS_READ_FLOOR,
        `${state.id}[${j}] is legible for ${legible}ms, under the ${MS_READ_FLOOR}ms floor`,
      );
    });
  }
});

test('TEETH: the acquisition constants track the stylesheet they were transcribed from', () => {
  // ⚠ THE ONE JOINT NOTHING ELSE HOLDS. `MS_BLOCK_ACQUIRE` / `MS_LINE_ACQUIRE` are the .tell-block
  // and .tell-line transition durations copied into TypeScript, because the CSS lives in an .astro
  // file this module cannot import. Slowing a fade in index.astro without touching this file would
  // silently re-create the original defect — the budget would keep paying for a fade shorter than
  // the one actually running — and every other test here would stay green. So this one reads the
  // stylesheet.
  const page = readFileSync(new URL('../pages/index.astro', import.meta.url), 'utf8');
  const grab = (selector: string): number => {
    const block = new RegExp(`\\.${selector}\\s*\\{[^}]*?transition:\\s*opacity\\s+([0-9.]+)s`, 's');
    const m = block.exec(page);
    assert.ok(m !== null, `could not find a .${selector} opacity transition in index.astro`);
    return Math.round(Number(m[1]) * 1000);
  };
  const blockFade = grab('tell-block');
  const lineFade = grab('tell-line');
  // The block constant also carries applyBeat's one-frame `is-on` deferral, so it is the fade plus
  // a small, bounded scheduling cost — never less than the fade.
  assert.ok(
    MS_BLOCK_ACQUIRE >= blockFade && MS_BLOCK_ACQUIRE <= blockFade + 60,
    `.tell-block fades over ${blockFade}ms but the budget charges ${MS_BLOCK_ACQUIRE}ms`,
  );
  assert.equal(
    MS_LINE_ACQUIRE,
    lineFade,
    `.tell-line fades over ${lineFade}ms but the budget charges ${MS_LINE_ACQUIRE}ms`,
  );
});

test('the last line of a beat is credited the tail and the gap, not charged them twice', () => {
  // Nothing replaces the column until the NEXT beat starts, so the last line keeps
  // MS_LINE_TAIL + MS_BEAT_GAP of fully-opaque time after its own slice ends. Budgeting its slice
  // as if that time did not exist would add ~9s of dead air across ten beats for no legibility.
  const lines = ['Short one.', 'A rather longer second line that needs a real reading budget.'];
  const slices = beatSlicesMs(lines);
  assert.ok(slices.length === 2);
  assert.ok(
    slices[1]! < MS_LINE_ACQUIRE + (lines[1]!.length * 1000) / CPS,
    'the last line was charged its full reading budget as well as keeping the tail and gap',
  );
  assert.ok(
    legibleMs(lines, 1) >= (lines[1]!.length * 1000) / CPS - 1,
    'the last line ends up with less legible time than its reading budget',
  );
});

test('TEETH: lengthening a line lengthens its beat — the cadence is derived, not hand-set', () => {
  // The failure this catches: someone replaces the derived dwell with a per-beat constant, and the
  // next person to edit the copy leaves a sentence on screen for less time than it takes to read.
  const beat = TELL_SCRIPT.find((b) => b.id === 'trails');
  assert.ok(beat !== undefined);
  const asWritten = beatDwellMs(beat.lines);
  const doubled = beatDwellMs(beat.lines.map((l) => `${l} ${l}`));
  assert.ok(doubled > asWritten, 'doubling a beat’s words did not lengthen its dwell');
});

test('a beat carrying a figure holds long enough for the figure, not just its sentence', () => {
  // The measured defect: improving the loop beat's line from 15 words to 5 dropped its dwell to
  // 2.16s while its diagram needs 1.52s just to assemble — the beat got FASTER because the copy got
  // BETTER, and the reader met the finished picture for about half a second. A dwell derived from
  // prose alone cannot see a drawing.
  const beat = TELL_SCRIPT.find((b) => b.figure !== 'none');
  assert.ok(beat !== undefined);
  const proseOnly = beatDwellMs(beat.lines);
  const withFigure = beatDwellMs(beat.lines, beat.figure);
  assert.ok(
    withFigure > MS_FIGURE_REVEAL,
    `the figure beat holds ${withFigure}ms but takes ${MS_FIGURE_REVEAL}ms to draw itself`,
  );
  assert.ok(withFigure > proseOnly, 'the figure did not lengthen its own beat at all');
  // …and shortening the copy further must NOT shorten the beat below that floor.
  assert.equal(beatDwellMs(['Two words.'], beat.figure), withFigure);
});

test('the schedule is strictly increasing and ends with the sequence', () => {
  const script = resolveScript(TELL_SCRIPT, TODAY);
  const starts = beatStarts(script, TODAY);
  assert.equal(starts.length, script.length + 1, 'the tail entry (the fade-out cue) is missing');
  for (let i = 1; i < starts.length; i += 1) {
    assert.ok(starts[i]! > starts[i - 1]!, `beat ${i} does not start after beat ${i - 1}`);
  }
});

test('nothing is said until the land is visible — the lead-in is not zero', () => {
  // The measured defect this pins: `mountForestLand` runs when the land layer is UNHIDDEN, and
  // chapter 1 then fades it up from near-black over ~1.9s. A schedule starting at 0 spends the
  // site's opening sentence on a dark screen. The floor is deliberately below the measured fade so
  // this fails on a REGRESSION TO ZERO rather than on someone retuning the number by 200ms.
  const starts = beatStarts(resolveScript(TELL_SCRIPT, TODAY), TODAY);
  assert.equal(starts[0], MS_LEAD_IN);
  assert.ok(MS_LEAD_IN >= 1500, `the lead-in is ${MS_LEAD_IN}ms — the name would play into a fade`);
});

test('the figure is a pure function of the beat — it is removed, not merely added', () => {
  // The measured defect: the first draft only ever ADDED the loop diagram, so it hung under the
  // three beats after its own and the rendered state stopped being a function of the index — which
  // is the ONE property this module inherited from the retired sequencer. A single beat declares a
  // figure; every other beat declares 'none', and the runtime must honour both directions.
  const withFigure = TELL_SCRIPT.filter((b) => b.figure !== 'none');
  assert.equal(withFigure.length, 1, 'more than one beat draws — TELL is allowed exactly one figure');
  const loopAt = TELL_SCRIPT.findIndex((b) => b.figure !== 'none');
  assert.ok(loopAt < TELL_SCRIPT.length - 1, 'the figure beat is last, so removal is never exercised');
  const script = resolveScript(TELL_SCRIPT, TODAY);
  assert.equal(stateAt(loopAt, script, TODAY).figure, 'loop');
  assert.equal(
    stateAt(loopAt + 1, script, TODAY).figure,
    'none',
    'the beat after the figure does not ask for it to go',
  );
});

test('SHORT AND LIGHT is measured, not asserted (ADR-0453 D1)', () => {
  // "Short and light is the binding constraint, not a style note." A ceiling is the only way that
  // sentence can survive future edits, and the number is deliberately generous: this fails when
  // someone adds a paragraph, not when they add a word.
  //
  // ⚠ 2026-09-01, THE VOCABULARY REWRITE (ADR-0494 D5): 71.9s → 64.8s, 773 characters → 681, on the
  // SAME ten beats and the SAME 13 cps. Speaking the reader's language is what made it shorter, not
  // a pace change: `Every island is one story — one thing the system does.` needed a gloss because
  // `story` is our word, and `Every island is a microservice.` does not because `microservice` is
  // theirs. The rest came from one compression — the binary beat's second line now names "the
  // middle" and lets the NEXT beat show it rather than describing it twice.
  //
  // The 7.1s bought here is deliberately spent, not banked: it pays for the edges beat and the
  // ending parked alongside this increment on `website-refresh-arc`, so the sequence ends up at or
  // under where it started rather than growing. The owner has a live open question about the site's
  // length; a lane that adds two beats and reports a shorter total is the only honest way to answer
  // it. If a future edit needs room, CUT COPY — the ceiling is here to make the other move visible.
  //
  // ⚠ THE CEILING MOVED FROM 65s TO 85s ON 2026-08-29, AND THE COPY DID NOT GROW BY A WORD. The
  // pace repair raised the sequence from 54s to 72s on the SAME 779 characters, because the old
  // 54s was not a length — it was 779 characters delivered too fast to read. Roughly 135 words of
  // unfamiliar propositional copy takes about a minute at any honest rate; that is arithmetic, and
  // the only way to make this materially shorter is to say less. If the sequence should be
  // shorter, CUT COPY — do not buy it back by raising CPS, which is the change this ceiling exists
  // to make visible.
  const seconds = totalDurationMs(resolveScript(TELL_SCRIPT, TODAY), TODAY) / 1000;
  assert.ok(seconds < 85, `TELL runs ${seconds.toFixed(1)}s — it has grown into a lesson`);
  assert.ok(seconds > 20, `TELL runs ${seconds.toFixed(1)}s — too short to have said anything`);
});

// ── reading the map's own numbers ───────────────────────────────────────────

test('a counts payload that cannot be trusted is refused, never defaulted', () => {
  assert.equal(parseForestCounts(null), null);
  assert.equal(parseForestCounts('not json'), null);
  assert.equal(parseForestCounts('{"stories":35}'), null, 'a partial payload was accepted');
  assert.equal(parseForestCounts('{"stories":"35","proven":21,"capabilities":215}'), null);
  assert.equal(parseForestCounts('{"stories":-1,"proven":0,"capabilities":0}'), null);
  // The one internal contradiction cheap enough to catch here — and the one that would put a boast
  // on the page rather than a blank.
  assert.equal(
    parseForestCounts('{"stories":10,"proven":11,"capabilities":50}'),
    null,
    'more proven stories than stories was accepted',
  );
  assert.deepEqual(parseForestCounts('{"stories":35,"proven":21,"capabilities":215}'), {
    stories: 35,
    proven: 21,
    capabilities: 215,
  });
});
