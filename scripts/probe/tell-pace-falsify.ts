// FALSIFIABILITY RECORD. The pre-fix budget, transcribed from git HEAD~ of act2-tell.ts and
// index.astro, fed to the NEW ceiling test's own predicate. If the ceiling test cannot red here,
// it is an instrument that cannot fail.
import { TELL_SCRIPT, resolveScript, stateAt, type ForestFacts } from '../../src/scripts/act2-tell';

const TODAY: ForestFacts = {
  stories: 35, proven: 21, capabilities: 128,
  selfIsland: 'website-experience', selfIsGreen: false, busiestIsland: 'studio',
};

// --- the SHIPPED constants as of commit 3e9663b (web) / 00d7db3 (parent) ---
const MS_PER_WORD = 252;
const MS_LINE_FLOOR = 1150;
const MS_LINE_TAIL = 430;
const MS_BEAT_GAP = 470;
const MS_FIGURE_DWELL = 260 + 3 * 420 + 3600;
const BLOCK_FADE = 700 + 20;   // .tell-block { transition: opacity 0.7s }
const LINE_FADE = 550;         // .tell-line  { transition: opacity 0.55s }

const words = (s: string): number => (s.trim() === '' ? 0 : s.trim().split(/\s+/).length);
const oldLineDwell = (s: string): number => Math.max(MS_LINE_FLOOR, words(s) * MS_PER_WORD);

// The NEW test's predicate, unchanged, over the OLD schedule.
const CPS = 13;
const script = resolveScript(TELL_SCRIPT, TODAY);
const offenders: string[] = [];
for (let i = 0; i < script.length; i += 1) {
  const st = stateAt(i, script, TODAY);
  const body = st.lines.reduce((t, l) => t + oldLineDwell(l), 0) + MS_LINE_TAIL;
  const dwell = st.figure === 'none' ? body : Math.max(body, MS_FIGURE_DWELL);
  st.lines.forEach((line, j) => {
    const isLast = j === st.lines.length - 1;
    const fade = j === 0 ? BLOCK_FADE : LINE_FADE;
    const legible = isLast
      ? oldLineDwell(line) + MS_LINE_TAIL + (dwell - body) + MS_BEAT_GAP - fade
      : oldLineDwell(line) - fade;
    const cps = line.length / (legible / 1000);
    if (cps > CPS + 0.5) offenders.push(`${st.id}[${j}] "${line}" — ${cps.toFixed(1)} cps over ${legible}ms`);
  });
}
console.log(`OFFENDERS UNDER THE PRE-FIX BUDGET: ${offenders.length}`);
offenders.forEach((o) => console.log('  ' + o));
console.log(offenders.length > 0
  ? '\nRESULT: the ceiling test REDS against the shipped-on-2026-08-29 state. It can fail.'
  : '\nRESULT: THE TEST CANNOT FAIL — do not trust it.');
process.exit(offenders.length > 0 ? 0 : 1);
