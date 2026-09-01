// A probe over the SHIPPED schedule: it reads every timing constant and the copy out of
// `act2-tell.ts` itself and prints, per line, how long that line is LEGIBLE — the allotted
// dwell minus the CSS fade the reader cannot read through — and the effective rate that
// implies. Nothing here is a number I chose; the fade durations are transcribed from
// index.astro and named, so a change there falsifies this probe rather than silently
// diverging from it.
import {
  TELL_SCRIPT,
  resolveScript,
  stateAt,
  beatStarts,
  lineDwellMs,
  beatDwellMs,
  totalDurationMs,
  CPS,
  MS_READ_FLOOR,
  MS_BLOCK_ACQUIRE,
  MS_LINE_ACQUIRE,
  legibleMs,
  deliveredCps,
  MS_BEAT_GAP,
  MS_LINE_TAIL,
  MS_LEAD_IN,
  MS_FIGURE_DWELL,
  type ForestFacts,
} from '../../src/scripts/act2-tell';

const BLOCK_FADE_MS = MS_BLOCK_ACQUIRE;
const LINE_FADE_MS = MS_LINE_ACQUIRE;

// The live snapshot's own numbers, so the rendered copy is the copy the visitor gets.
const facts: ForestFacts = {
  stories: 35,
  proven: 21,
  capabilities: 128,
  selfIsland: 'website-experience',
  selfIsGreen: false,
  busiestIsland: 'studio',
};

function words(s: string): number {
  const t = s.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
}

const script = resolveScript(TELL_SCRIPT, facts);
const starts = beatStarts(script, facts);

console.log(`CPS=${CPS}  MS_READ_FLOOR=${MS_READ_FLOOR}  acquire=${MS_BLOCK_ACQUIRE}/${MS_LINE_ACQUIRE}`);
console.log(`MS_BEAT_GAP=${MS_BEAT_GAP}  MS_LINE_TAIL=${MS_LINE_TAIL}`);
console.log(`MS_LEAD_IN=${MS_LEAD_IN}  MS_FIGURE_DWELL=${MS_FIGURE_DWELL}`);
console.log(`beats=${script.length}  total=${(totalDurationMs(script, facts) / 1000).toFixed(1)}s\n`);

const header = ['beat', 'ln', 'w', 'ch', 'allot', 'fade', 'legible', 'eff wpm', 'eff cps'];
console.log(header.join('\t'));

let worstWpm = Infinity;
let worstLabel = '';
for (let i = 0; i < script.length; i += 1) {
  const state = stateAt(i, script, facts);
  const beatDwell = beatDwellMs(state.lines, state.figure);
  state.lines.forEach((line, j) => {
    const w = words(line);
    const ch = line.length;
    // Line j's own slice of the beat. The LAST line additionally keeps the tail, the beat's
    // figure-floor slack, and the inter-beat gap, because nothing replaces it until the next
    // beat starts.
    const fade = j === 0 ? BLOCK_FADE_MS : LINE_FADE_MS;
    const legible = legibleMs(state.lines, j, state.figure);
    const allot = legible + fade;
    void beatDwell;
    const effWpm = (w / (legible / 60000));
    const effCps = ch / (legible / 1000);
    if (effWpm < worstWpm) {
      worstWpm = effWpm;
      worstLabel = `${state.id}[${j}] "${line.slice(0, 46)}"`;
    }
    console.log(
      [
        state.id,
        j,
        w,
        ch,
        allot,
        fade,
        legible,
        effWpm.toFixed(0),
        deliveredCps(state.lines, j, state.figure).toFixed(1),
      ].join('\t'),
    );
  });
}
console.log(`\nstarts(s): ${starts.map((s) => (s / 1000).toFixed(1)).join(' ')}`);
console.log(`SLOWEST-ALLOWANCE line (the reader's binding constraint): ${worstLabel} at ${worstWpm.toFixed(0)} wpm`);
