// ROAM's falsification record — does `act2-roam.test.ts` actually REFUSE anything?
//
// ⚠ WHY THIS EXISTS. A suite that has only ever been green is not evidence; it is a suite that has
// only ever been green. This project has caught ten instruments in a few days that could not fail —
// a camera check computing its expectation from a hand-copied duplicate of its own subject, a frame
// timer measuring submission instead of execution, a quality gate that would have passed a tree
// whose textures never loaded. The cheapest defence is to break the thing on purpose and watch the
// test go red, ONCE, in a form anyone can re-run.
//
// Each mutation below is a defect that could genuinely land: a number typed into copy, a status
// reading softened, a present-tense sentence over a dated snapshot, a status the exporter can paint
// and the panel has no word for, a timer that turns ROAM into a second TELL, a payload that drops a
// field, a dependency sentence pointing the wrong way.
//
// It edits files in place, runs `bun test src/`, and restores them — including on a crash, and on
// SIGINT. Nothing is left mutated. A mutation that leaves the suite GREEN is the finding.
//
//   node scripts/probe/roam-falsify.mjs
//
// Laptop-only. Nothing here ships and nothing here runs in CI.

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../src/scripts/act2-roam.ts', import.meta.url));
const MAP = fileURLToPath(new URL('../../src/scripts/forest-snapshot-map.ts', import.meta.url));
const WEB = fileURLToPath(new URL('../../', import.meta.url));

/** Each entry: what defect it stands for, which file, and a find→replace that introduces it. */
const MUTATIONS = [
  {
    name: 'a number is written into the copy',
    file: SRC,
    from: "lines: ['An island is one story — one thing this system does.'],",
    to: "lines: ['An island is one of 35 stories — one thing this system does.'],",
    expect: 'no number is written into ROAM copy',
  },
  {
    name: 'a failing island is softened into "not yet proven"',
    file: SRC,
    from: "    word: 'failing',",
    to: "    word: 'not yet proven',",
    expect: 'a FAILING island is said to be failing',
  },
  {
    name: 'a dated snapshot is described in the live present tense',
    file: SRC,
    from: "    sentence: 'It was mid-build when this picture was taken.',",
    to: "    sentence: 'It is being built right now, as you read this.',",
    expect: 'nothing ROAM says claims the system is doing something RIGHT NOW',
  },
  {
    name: 'ROAM acquires a clock — a panel that dismisses itself',
    file: SRC,
    from: '    openPanel();\n    witness(\'trail\', segmentId);',
    to: "    openPanel();\n    setTimeout(shut, 4000);\n    witness('trail', segmentId);",
    expect: 'NOTHING IN ROAM IS ON A CLOCK',
  },
  {
    name: 'the exporter learns a status the panel has no word for',
    file: MAP,
    from: "    case 'unhealthy':\n      return status;",
    to: "    case 'unhealthy':\n    case 'archived':\n      return status as SceneStatus;",
    expect: 'every status the EXPORTER can produce has a reading here',
  },
  {
    name: 'the payload silently drops a story capability',
    file: MAP,
    from: '      capabilities: story.capabilities.map((cap) => ({',
    to: '      capabilities: story.capabilities.slice(1).map((cap) => ({',
    expect: 'the real snapshot round-trips through the payload without losing anything',
  },
  {
    name: 'a dependency sentence points the wrong way',
    file: SRC,
    from: 'return `${edgeName(edge.to, titleOf)} needs ${edgeName(edge.from, titleOf)}.`;',
    to: 'return `${edgeName(edge.from, titleOf)} needs ${edgeName(edge.to, titleOf)}.`;',
    expect: 'a dependency reads in the direction the arrow points',
  },
  {
    name: 'a capped list stops silently, understating a hub',
    file: SRC,
    from: '  const hidden = edges.length - TRAIL_LIST_CAP;\n  return hidden <= 0 ? null : ',
    to: '  const hidden = edges.length - TRAIL_LIST_CAP;\n  return true ? null : ',
    expect: 'a merged trunk is CAPPED and says how much it left out',
  },
  {
    name: 'a long story name is TRUNCATED, inventing a name the page never shows',
    file: SRC,
    from: '  return name.length > NAME_MAX ? id : name;',
    to: '  return name.length > NAME_MAX ? `${name.slice(0, NAME_MAX)}…` : name;',
    expect: 'a story with no NAME in its title is called by the label the map shows',
  },
  {
    name: 'the trunk sentence is shown on a plain single-dependency trail',
    file: SRC,
    from: '  return edges.length <= 1\n    ? ROAM_TRAIL_NOTE',
    to: '  return false\n    ? ROAM_TRAIL_NOTE',
    expect: 'only a MERGED trunk gets the extra sentence',
  },
  {
    name: 'a claim loses the citation the parent gate resolves',
    file: SRC,
    from: "  lines: ['The colour is not a label somebody chose. It is what the proof record says.'],\n  grounds: ['ADR-0040'],",
    to: "  lines: ['The colour is not a label somebody chose. It is what the proof record says.'],",
    expect: 'every note that asserts something about the PRODUCT carries grounding',
  },
  {
    name: 'a note grows past two sentences',
    file: SRC,
    from: "  lines: ['A capability is one organ of that story, proven on its own.'],",
    to:
      "  lines: ['A capability is one organ of that story, proven on its own.', " +
      "'It has its own tests.', 'And its own colour.'],",
    expect: 'every note is one or two sentences',
  },
  // ── target 5 · the arc drawer ─────────────────────────────────────────────
  //
  // ⚠ THE FIRST ONE IS THE IMPORTANT ONE. The arc tier's only protection is that the strategy prose
  // never leaves the exporter: the forest is safe because it is illegible on purpose, and arc bodies
  // are readable English about what we are trying to do. `ArcRollup` carries `intent`, `endState`
  // and every increment `objective` right there beside the title, so "completing" the drawer with
  // them is a one-line edit that looks like an improvement. It has to be a defect a NAMED test
  // refuses, on both sides of the repo boundary.
  //
  // ⚠ THE MUTATION IS A SPREAD, NOT AN ADDED FIELD, AND THE FIRST ATTEMPT AT IT WAS VACUOUS.
  // Writing `intent: arc.intent` here leaks nothing: `SnapshotArc` has no such field, the value
  // is `undefined`, and `JSON.stringify` drops undefined keys — so the mutant behaved exactly
  // like the original and this probe correctly reported that NOTHING caught it. The defect this
  // repo can genuinely commit is the SPREAD: `{ ...arc }` looks like a tidy-up, passes review,
  // and silently forwards whatever the exporter adds next — which is the one thing the named
  // fold exists to prevent. The test it must red is fed an arc that HAS a body, because today's
  // published data has none and a fence tested only against today's data has no teeth.
  {
    name: 'THE DRAWER RENDERS AN ARC BODY — the one protection this tier has',
    file: MAP,
    from: '    arcs: snap.arcs.map((arc) => ({',
    to: '    arcs: snap.arcs.map((arc) => ({ ...arc,',
    expect: 'roamPayload NARROWS',
  },
  {
    name: 'an OPEN arc is described as running now, over a dated picture',
    file: SRC,
    from: "  active: { word: 'open', sentence: 'It was still open when this picture was taken.' },",
    to: "  active: { word: 'open', sentence: 'It is still running right now.' },",
    expect: 'an OPEN arc is described in the picture',
  },
  {
    name: 'a closed step is counted as a LANDING it may not have been',
    file: SRC,
    from: "  if (open === 0) return done === 1 ? '1 step, closed' : `${done} steps, all closed`;",
    to: "  if (open === 0) return done === 1 ? '1 step, landed' : `${done} steps, all landed`;",
    expect: 'the arc shape is COUNTED from the payload',
  },
  {
    name: 'a lifecycle the exporter can publish has no reading here',
    file: SRC,
    from: "  closed: { word: 'finished', sentence: 'It ran to its end and closed.' },",
    to: "  closedd: { word: 'finished', sentence: 'It ran to its end and closed.' },",
    expect: 'every lifecycle the REAL corpus carries has a reading',
  },
  {
    name: 'the empty state invents a reason the snapshot does not support',
    file: SRC,
    from: "  lines: ['No initiative on record reaches this one. Not everything here was built under one.'],",
    to: "  lines: ['No initiative on record reaches this one, because it predates the arcs.'],",
    expect: 'the drawer’s own notes carry the same grounding and length bars',
  },
  {
    name: 'a long decision list stops silently, understating an arc',
    file: SRC,
    from: "  return hidden <= 0 ? null : `…and ${hidden} more.`;",
    to: "  return null;",
    expect: 'a long decision list is CAPPED and says how much it left out',
  },
];

const originals = new Map();
const snapshot = (file) => {
  if (!originals.has(file)) originals.set(file, readFileSync(file, 'utf8'));
};
const restoreAll = () => {
  for (const [file, text] of originals) writeFileSync(file, text);
};
process.on('exit', restoreAll);
process.on('SIGINT', () => {
  restoreAll();
  process.exit(130);
});

const runSuite = () => {
  const r = spawnSync('bun', ['test', 'src/'], { cwd: WEB, encoding: 'utf8' });
  if (r.error) {
    console.error('bun is not on PATH — this probe needs it (see the repo CLAUDE.md).');
    process.exit(2);
  }
  return { green: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};

console.log('CONTROL — the suite as it stands:');
const control = runSuite();
console.log(`  ${control.green ? 'GREEN' : 'RED'}  ${control.out.trim().split('\n').pop()}`);
if (!control.green) {
  console.error('\nthe suite is already red — fix that before reading anything below.');
  process.exit(1);
}

console.log('\nMUTATIONS — each one is a defect that could land. RED is the pass.\n');
let unfalsifiable = 0;
for (const m of MUTATIONS) {
  snapshot(m.file);
  const before = readFileSync(m.file, 'utf8');
  if (!before.includes(m.from)) {
    console.log(`  SKIPPED  ${m.name}\n           (anchor no longer in the source — the mutation is stale, FIX IT)`);
    unfalsifiable += 1;
    continue;
  }
  writeFileSync(m.file, before.replace(m.from, m.to));
  const { green, out } = runSuite();
  writeFileSync(m.file, before);
  const named = out.includes(m.expect.slice(0, 40));
  if (green) {
    console.log(`  ⚠ GREEN  ${m.name}\n           NOTHING CAUGHT IT — this defect can reach the live site.`);
    unfalsifiable += 1;
  } else {
    console.log(`  RED      ${m.name}`);
    console.log(`           caught by: ${named ? m.expect : `a test (expected "${m.expect}")`}`);
    if (!named) unfalsifiable += 1;
  }
}

console.log(`\n${MUTATIONS.length - unfalsifiable} of ${MUTATIONS.length} defects are caught by a named test.`);
process.exit(unfalsifiable === 0 ? 0 : 1);
