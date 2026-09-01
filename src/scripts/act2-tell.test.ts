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
  busiestIsland,
  LOCKED_CLASS,
  type ForestFacts,
  type TellBeat,
} from './act2-tell';
import { ROAM_TRAIL_NOTE, edgeSentence } from './act2-roam';

/** `index.astro`'s source — the stylesheet and the markup this module cannot import. Several tests
 *  below read it, so it is read through one helper rather than four copies of the same URL. */
const page = (): string => readFileSync(new URL('../pages/index.astro', import.meta.url), 'utf8');

/** The corpus as published on 2026-08-28 — the numbers the live page is quoting today. */
const TODAY: ForestFacts = {
  stories: 35,
  proven: 21,
  capabilities: 215,
  selfIsland: SELF_STORY_ID,
  selfIsGreen: false,
  busiestIsland: 'studio',
};

/** A DIFFERENT corpus. Not a smaller version of the same one — every count differs, so a line that
 *  quotes any of them must come out different. This is the control the staleness tests read from. */
const LATER: ForestFacts = {
  stories: 41,
  proven: 27,
  capabilities: 260,
  selfIsland: SELF_STORY_ID,
  selfIsGreen: false,
  busiestIsland: 'studio',
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
  // ⚠ EXACTLY TWO BEATS MAY MOVE THE CAMERA, NAMED RATHER THAN COUNTED. This asserted ONE until
  // ADR-0494 D6 — "we should also zoom in on the edges" — because a third flight really would turn
  // TELL into a tour of the forest, which is ROAM's job. Naming the two lenses is a tighter fence
  // than the count it replaced: a count of two is satisfied by any two beats, including a third
  // `self` beat someone added and a `trails` one they deleted.
  const moving = TELL_SCRIPT.filter((b) => b.lens === 'self' || b.lens === 'trails');
  assert.deepEqual(
    moving.map((b) => b.id),
    ['edges', 'self'],
    'the camera moves on a different set of beats than the two decided ones',
  );
  // …and each of them exactly once. Two `self` beats would fly to the same island twice.
  assert.equal(TELL_SCRIPT.filter((b) => b.lens === 'self').length, 1);
  assert.equal(TELL_SCRIPT.filter((b) => b.lens === 'trails').length, 1);
});

// ── the edges beat (ADR-0494 D6) ────────────────────────────────────────────

test('the edges beat names the relationship in the reader\'s vocabulary and says what they compose to', () => {
  const beat = TELL_SCRIPT.find((b) => b.id === 'edges');
  assert.ok(beat !== undefined, 'the edges beat has gone');
  const text = beat.lines.join(' ');
  assert.match(text, /\bdepends-on\b/, 'the beat never names the relationship');
  assert.match(text, /\bDAG\b/, 'the beat never says what the edges compose to');
  // It carries grounding, because "every trail is a depends-on" is a claim about what the picture
  // means rather than a turn of phrase.
  assert.ok((beat.grounds ?? []).length > 0, 'the edges beat asserts a product claim with no grounding');
});

test('TEETH: the edges beat states direction the same way the trail panel does', () => {
  // ⚠ READ OFF THE OTHER MODULE, NOT TYPED IN HERE. `roam-falsify.mjs` seeds a REVERSED DEPENDENCY
  // as one of its defects because that is a real, cheap mistake — and it is now assertable in three
  // places that must agree. The convention is `data-edges`' `from->to`: `from` is depended ON, `to`
  // depends on it, and the trail runs from the first to the second. An expectation typed into this
  // file could go stale in the same edit that flipped the panel, which is the confound this suite's
  // header exists to refuse.
  //
  // ⚠ AND THE PICTURE IS NOT ONE OF THE THREE. The map draws NO arrowheads — measured on the
  // published SVG: zero `<marker>` elements, zero arrow classes, `marker-end: none` on every trail
  // segment. So this test holds three SENTENCES to one convention; nothing here proves the reader
  // can see which way a given trail runs, and no test in this repo can, because the map does not
  // say. Whether it should is a look question for the owner, not something to assert into.
  const beat = TELL_SCRIPT.find((b) => b.id === 'edges');
  assert.ok(beat !== undefined);
  const said = beat.lines.join(' ');
  const neededAt = said.indexOf('is needed');
  const needsAt = said.indexOf('needs it');
  assert.ok(neededAt >= 0 && needsAt >= 0, `the edges beat does not state a direction at all: "${said}"`);
  assert.ok(neededAt < needsAt, `the edges beat runs the dependency backwards: "${said}"`);

  // The same order, in the panel a visitor reaches by clicking that trail: "X needs Y" puts the
  // DEPENDENT first, so the trail's own note must read from-needed to needs-it exactly as above.
  const panel = ROAM_TRAIL_NOTE.lines.join(' ');
  assert.ok(
    panel.indexOf('is needed') < panel.indexOf('needs it'),
    `the panel and the prose disagree about which way a trail runs: "${panel}"`,
  );
  // And the sentence builder agrees with both: the thing that NEEDS comes first in "X needs Y".
  assert.equal(edgeSentence({ from: 'needed', to: 'dependent' }, (id) => id), 'dependent needs needed.');
});

test('the busiest island is DEDUPED first — routed trails would inflate it 28x', () => {
  // ⚠ THE MEASURED TRAP, AND IT IS THE KIND THAT SURVIVES REVIEW. A logical dependency is stamped on
  // EVERY segment of its route, so counting raw mentions measures routing length rather than degree.
  // On the published map that is 2547 mentions of 90 distinct edges. Both readings name `studio`
  // today, which is exactly why the wrong one would have shipped.
  //
  // Here `a->b` is stamped on four segments and `c->d` on one. Undeduped, `a` and `b` score 4 each
  // and the answer is `a`; deduped, everything scores 1 and the tie-break gives `a` too — so the
  // fixture makes the counts VISIBLY different by giving `c` a second, distinct edge.
  const routed = ['a->b', 'a->b', 'a->b', 'a->b', 'c->d,c->e'];
  assert.equal(
    busiestIsland(routed),
    'c',
    'the busiest island was picked from repeated route segments rather than distinct dependencies',
  );
});

test('the busiest island is deterministic, and absent rather than invented', () => {
  // A tie must not make the camera fly somewhere different between two loads of the same page.
  assert.equal(busiestIsland(['a->b']), 'a');
  assert.equal(busiestIsland(['b->a']), 'a');
  assert.equal(busiestIsland([]), null);
  assert.equal(busiestIsland([null, '', 'nonsense', '->', 'x->']), null);
  // Degree counts both ends: a hub everything DEPENDS ON is as busy a junction as one that depends
  // on everything, and the camera is being pointed at a picture, not at a direction.
  assert.equal(busiestIsland(['hub->p,hub->q,r->s']), 'hub');
  assert.equal(busiestIsland(['p->hub,q->hub,r->s']), 'hub');
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
  const source = page();
  const grab = (selector: string): number => {
    const block = new RegExp(`\\.${selector}\\s*\\{[^}]*?transition:\\s*opacity\\s+([0-9.]+)s`, 's');
    const m = block.exec(source);
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
  const beat = TELL_SCRIPT.find((b) => b.id === 'edges');
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
  // ⚠ 2026-09-01, THE EDGES BEAT (ADR-0494 D6): 64.8s → 71.1s, 681 characters → 747. A beat was
  // ADDED and the sequence is still SHORTER than the 71.9s that was on the live site this morning —
  // which is the whole point of spending the vocabulary rewrite's saving rather than banking it.
  // Part of the 6.3s was paid back in the same edit: the turn beat said "storytree" twice in two
  // lines and now says it once. If the next thing to land here cannot be paid for the same way, put
  // the trade in front of the owner rather than quietly spending his open question about length.
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

// ── the controls lock ───────────────────────────────────────────────────────
//
// ⚠ WHAT THIS SECTION CAN AND CANNOT PROVE, STATED RATHER THAN LEFT TO INFERENCE. `bun test` has no
// DOM, so the lock's runtime behaviour — the class going on with the schedule and coming off in all
// three exits — is verified in a browser against the built site and recorded on the PR, not here.
// What IS mechanical here is the half that fails INVISIBLY: a lock rule escaping its runtime class
// (which breaks only for the people who cannot report it) and a second route to the behaviour the
// lock exists to remove.

test('TEETH: no lock rule escapes the runtime class — a no-script visitor keeps a live map', () => {
  // ⚠ THE SAME FAILURE `forest-growth.test.ts` GUARDS, ONE MOVEMENT LATER, AND IT IS INVISIBLE IN A
  // BROWSER. Hoisting `pointer-events: none` out of `.tell-locked` — the obvious "simplify the
  // selector" edit — gives a permanently dead map to precisely the visitors whose script never runs,
  // while every scripted browser looks perfect. They get the whole forest as a static dated picture
  // today, and that guarantee is load-bearing.
  const css = page().replace(/\/\*[\s\S]*?\*\//g, '');
  // Selector lists span lines, so the selector half deliberately allows newlines — a line-bound
  // version of this scan in the growth suite silently matched nothing and reported a confident pass.
  //
  // ⚠ SCOPED TO THE ARRIVAL MAP, AND THE FIRST DRAFT WAS NOT. Matching any `.tw-hit` rule caught
  // `.act2-stage .tw-hit { pointer-events: none }` — the RETIRED walkthrough's stage, which is
  // unmounted, unrelated to this lock, and correctly unscoped. A test that fails on innocent code is
  // one somebody widens the scope of rather than obeys, so the scan asks for rules that reach the
  // surface the lock actually covers: the arrival map, or something under `#storm-land`.
  const rules = [...css.matchAll(/([^{}]*\.(?:forest-arrival-svg|tw-hit|tw-isle)\b[^{}]*)\{([^}]*)\}/g)];
  const locking = rules.filter(
    ([, selector, body]) =>
      /pointer-events:\s*none/.test(body ?? '') &&
      /\.forest-arrival-svg|#storm-land/.test(selector ?? ''),
  );
  assert.ok(locking.length >= 1, 'the lock is not in index.astro at all');
  for (const [, selector, body] of locking) {
    assert.ok(
      (selector ?? '').includes(`.${LOCKED_CLASS}`),
      `a lock rule is not scoped to .${LOCKED_CLASS} — a no-script visitor loses the map:\n  ${selector?.trim()} {${body?.trim()}}`,
    );
  }
});

test('the skip control is styled, labelled and reachable — the lock\'s only exit is not decorative', () => {
  // A 70-second lock with an escape nobody can find is the same as no escape (the increment says so
  // in as many words). Three things have to hold together and each is cheap to lose in an edit: the
  // control is the one pointer-live thing on an otherwise inert overlay, it can take focus, and it
  // gets a highlight to point at when a locked gesture happens.
  const css = page().replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.tell-skip\s*\{[^}]*pointer-events:\s*auto/, 'the skip control is not clickable');
  assert.match(css, /\.tell-skip:focus-visible\s*\{/, 'the skip control has no focus ring');
  assert.match(css, /\.tell-skip\.is-wanted\s*\{/, 'the locked-gesture highlight has no rule');
  // And the module drives that highlight rather than declaring a class nothing adds.
  const mod = readFileSync(new URL('./act2-tell.ts', import.meta.url), 'utf8');
  assert.match(mod, /classList\.add\('is-wanted'\)/, 'nothing ever adds the highlight');
  assert.match(mod, /classList\.remove\('is-wanted'\)/, 'the highlight is never taken off again');
});

test('TEETH: a reader gesture can no longer end the sequence — the old route is GONE, not disabled', () => {
  // ⚠ THIS IS THE OWNER'S ACTUAL COMPLAINT, ASSERTED AT ITS SOURCE. "if i zoom in the prose
  // disappears" was not a bug in the lock's absence — it was a FEATURE: `mountTell` subscribed to
  // `onReaderTakeOver` and stopped. Locking the map hides that route without removing it, and a
  // route that is merely unreachable comes back the first time someone adjusts the lock. So the verb
  // is off the `TellStage` seam entirely and the module never names it. (`ArrivalHandle` keeps it —
  // it uses it for its own resize guard, which is a different question about a different surface.)
  const mod = readFileSync(new URL('./act2-tell.ts', import.meta.url), 'utf8');
  const code = mod.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    !/onReaderTakeOver/.test(code),
    'act2-tell can still be stopped by a reader gesture — the lock has a second door',
  );
  // The lock is applied on the timed path and removed on every exit. Counted rather than located:
  // one `add`, and at least the `finish` + `unmount` pair taking it off.
  assert.equal((code.match(/classList\.add\(LOCKED_CLASS\)/g) ?? []).length, 1);
  assert.ok((code.match(/classList\.remove\(LOCKED_CLASS\)/g) ?? []).length >= 1);
});

test('TEETH: the keyboard half exists and is NOT `inert`, which was measured not to work here', () => {
  // ⚠ THE MECHANISM THIS TEST IS REALLY ABOUT IS THE ONE THAT IS ABSENT. The first version of the
  // lock set `inert` on the map and looked complete: the pointer half worked, nothing threw, and
  // `'inert' in HTMLElement.prototype` was true. Measured in a browser against the built site, focus
  // still landed on a hit rect and Enter still opened a panel — with `inert` on the `<svg>` AND with
  // it on the containing `<div>`. It is an HTML global attribute and these are SVG elements.
  //
  // So the real mechanism is parking each rect's `tabindex` and swallowing Enter/Space in the
  // CAPTURE phase, and this test holds both — plus the absence of the thing that quietly did
  // nothing, because a later reader "simplifying" back to `inert` would reproduce the same
  // confident, silent hole.
  const mod = readFileSync(new URL('./act2-tell.ts', import.meta.url), 'utf8');
  const code = mod.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    !/inert/.test(code),
    '`inert` is back in the lock — measured 2026-09-01, it does not reach an SVG subtree',
  );
  assert.match(code, /setAttribute\('tabindex', '-1'\)/, 'nothing takes the map out of the tab order');
  assert.match(code, /keydown', swallowMapKeys, true\)/, 'the key guard is not on the capture phase');
  assert.match(code, /removeEventListener\('keydown', swallowMapKeys, true\)/, 'the key guard is never removed');
  // The parked values are RESTORED rather than reset to a hard-coded "0": all 35 hit rects carry
  // "0" today, and a lock that assumed that would silently rewrite a future map's keyboard order.
  assert.match(code, /getAttribute\('tabindex'\)/, 'the previous tabindex is never recorded');
  assert.match(code, /setAttribute\('tabindex', was\)/, 'the previous tabindex is never restored');
});

test('the lock is NOT applied on the reduced-motion path, where nothing would ever remove it', () => {
  // The branch that only runs when something upstream changes is the branch nobody notices is wrong.
  // Under reduced motion there is no schedule and therefore no `finish()`, so a lock applied at
  // mount would be permanent — the exact shape of the no-script failure above, arriving through a
  // different door. Asserted structurally: the lock lives inside the `else` arm, after the
  // reduced-motion arm has returned its static column.
  const mod = readFileSync(new URL('./act2-tell.ts', import.meta.url), 'utf8');
  const reducedArm = mod.indexOf('  if (reducedMotion) {');
  const elseArm = mod.indexOf('  } else {', reducedArm);
  const endOfElse = mod.indexOf('\n  }\n', elseArm);
  assert.ok(reducedArm > 0 && elseArm > reducedArm && endOfElse > elseArm, 'the branch has moved');
  // The arms are read as text rather than by where one call happens to sit, so moving the lock into
  // a helper (which is what happened once the keyboard half arrived) does not silently pass.
  assert.ok(
    !/\block\(\)/.test(mod.slice(reducedArm, elseArm)),
    'the controls lock is applied on the reduced-motion path, where no finish() will ever remove it',
  );
  assert.ok(
    /\block\(\)/.test(mod.slice(elseArm, endOfElse)),
    'the timed path no longer locks the map at all',
  );
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
