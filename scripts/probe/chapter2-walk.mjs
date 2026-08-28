// A BROWSER instrument over the built site. It measures what the page actually delivers, in a real
// engine, at a real size — because every number in tell-pace-probe.ts is arithmetic over constants,
// and arithmetic cannot see a CSS rule that does not apply, an animation the engine drops, or an
// element whose opacity never reaches 1.
//
// TWO CONTROLS, READ IN THE SAME RUN:
//   * the LEGIBLE window per line is measured by POLLING computed opacity at 50ms — not by reading
//     the schedule back out of the module that wrote it (an expectation derived from its subject
//     cannot fail);
//   * the growth is measured by sampling how many islands are at full scale over time, so "there is
//     a growth animation" is a count that moves rather than a screenshot someone squinted at.
import { createRequire } from 'node:module';
// playwright-core lives in the PARENT monorepo's store, not in web/'s npm tree — this probe is a
// laptop instrument, never a shipped dependency, so it reaches for it rather than adding it here.
const require_ = createRequire(process.env.ST_PW_FROM ?? new URL('../../../apps/desktop/package.json', import.meta.url));
const { chromium } = require_('playwright-core');
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../../dist/', import.meta.url).pathname;
const OUT = process.env.OUT_DIR ?? '/tmp/chapter2-walk';
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const buf = await readFile(join(ROOT, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction('typeof window.__stormSkipToTutorial === "function"', { timeout: 20000 });

// Start the sampler BEFORE the jump, so t=0 is the mount, not the first poll.
await page.evaluate(() => {
  const w = window;
  w.__samples = [];
  w.__t0 = 0;
  w.__poll = null;
  w.__startSampling = () => {
    w.__t0 = performance.now();
    w.__poll = setInterval(() => {
      const t = Math.round(performance.now() - w.__t0);
      const svg = document.querySelector('svg.forest-arrival-svg');
      const isles = svg ? [...svg.querySelectorAll('.tw-ground')] : [];
      // How many islands are FULLY arrived: opacity 1 and no residual scale.
      let grown = 0;
      let mid = 0;
      for (const g of isles) {
        const cs = getComputedStyle(g);
        const op = Number(cs.opacity);
        const tr = cs.transform;
        const scale = tr && tr !== 'none' ? Number(tr.match(/matrix\(([-\d.]+)/)?.[1] ?? 1) : 1;
        if (op > 0.99 && scale > 0.995) grown += 1;
        else if (op > 0.02) mid += 1;
      }
      const land = document.querySelector('#storm-land');
      const landOpacity = land ? Number(Number(getComputedStyle(land).opacity).toFixed(2)) : null;
      const tell = w.__act2tell ?? null;
      const lines = [...document.querySelectorAll('.tell-line')].map((el) => ({
        text: el.textContent,
        op: Number(getComputedStyle(el).opacity),
      }));
      w.__samples.push({ t, isles: isles.length, grown, mid, landOpacity, beat: tell?.beat ?? null, lines });
    }, 50);
  };
});

/** Poll from NODE rather than waitForFunction: the latter defaults to rAF polling, which the
 *  engine throttles while the page is animating — the exact condition this probe runs under. */
async function until(pg, ms, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const n = await pg.evaluate(() => (window.__samples ?? []).length);
    if (n * 50 >= ms) return n;
    if (Date.now() > deadline) throw new Error(`stuck waiting for ${ms}ms of samples; have ${n * 50}ms`);
    await new Promise((r) => setTimeout(r, 120));
  }
}

const shots = [700, 1000, 1400, 1800, 2400, 3000, 3800];
await page.evaluate(() => { window.__startSampling(); window.__stormSkipToTutorial(); });
for (const at of shots) {
  await until(page, at);
  await page.screenshot({ path: join(OUT, `growth-${String(at).padStart(4, '0')}ms.png`) });
}
// Ride the whole TELL sequence out.
await until(page, 78000, 150000);
const samples = await page.evaluate(() => window.__samples);
await browser.close();
server.close();

// ── growth ──
const isleCount = samples.find((s) => s.isles > 0)?.isles ?? 0;
const firstGrown = samples.find((s) => s.grown > 0);
const allGrown = samples.find((s) => s.grown === isleCount && isleCount > 0);
const anyMid = samples.filter((s) => s.mid > 0).length;
console.log('=== GROWTH (measured in the engine, not computed) ===');
console.log(`islands in the DOM: ${isleCount}`);
console.log(`first island fully arrived: ${firstGrown ? firstGrown.t + 'ms' : 'NEVER'}`);
console.log(`all ${isleCount} arrived:            ${allGrown ? allGrown.t + 'ms' : 'NEVER'}`);
console.log(`samples with islands mid-arrival: ${anyMid} (${anyMid * 50}ms of visible growth)`);
const curve = samples.filter((s) => s.t <= 4200 && s.t % 200 < 50)
  .map((s) => `${s.t}:${s.grown}/land${s.landOpacity}`).join(' ');
console.log(`arrival curve (t:islandsArrived/landLayerOpacity):\n  ${curve}`);
// Is the growth VISIBLE, or does the storm's cross-fade mask it? Count the islands that finish
// arriving while the land layer is already readable.
const visibleArrivals = samples.filter((s) => (s.landOpacity ?? 0) > 0.6);
const firstReadable = visibleArrivals[0];
const grownWhenReadable = firstReadable ? firstReadable.grown : -1;
console.log(`land layer first readable (>0.6) at ${firstReadable?.t ?? '?'}ms, with ${grownWhenReadable}/${isleCount} islands already arrived`);
console.log(`  => ${isleCount - Math.max(0, grownWhenReadable)} of ${isleCount} islands arrive IN FULL VIEW`);

// ── pace ──
// A line's LEGIBLE window: consecutive samples where that exact text is on screen at opacity > 0.9.
const windows = new Map();
for (const s of samples) {
  for (const l of s.lines) {
    if (l.op > 0.9 && l.text) {
      const w = windows.get(l.text) ?? { first: s.t, last: s.t, beat: s.beat };
      w.last = s.t;
      windows.set(l.text, w);
    }
  }
}
console.log('\n=== PACE (opacity-measured legible window, 50ms poll) ===');
console.log('legible(ms)\tcps\twpm\tline');
let worst = { cps: 0 };
const rows = [];
for (const [text, w] of windows) {
  const ms = w.last - w.first + 50;
  const cps = text.length / (ms / 1000);
  const wpm = text.trim().split(/\s+/).length / (ms / 60000);
  rows.push({ text, ms, cps, wpm, beat: w.beat });
  if (cps > worst.cps) worst = { cps, text, ms };
  console.log(`${ms}\t\t${cps.toFixed(1)}\t${wpm.toFixed(0)}\t${text.slice(0, 62)}`);
}
console.log(`\nFASTEST DELIVERED LINE: ${worst.cps.toFixed(1)} cps over ${worst.ms}ms — "${worst.text}"`);
console.log(`lines measured: ${rows.length}`);
writeFileSync(join(OUT, 'measured.json'), JSON.stringify({ isleCount, firstGrown, allGrown, anyMid, rows }, null, 2));
console.log(`\nwrote ${OUT}`);
