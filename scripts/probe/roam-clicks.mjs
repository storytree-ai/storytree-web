// ROAM in a REAL BROWSER: does clicking the map actually open a panel, and does the panel say what
// the corpus says?
//
// ⚠ WHY A BROWSER INSTRUMENT AND NOT JUST THE UNIT SUITE. `act2-roam.test.ts` proves the copy and
// the payload; it cannot see a CSS rule that does not apply, an element that is not reachable by a
// pointer, a hit layer covered by something else, or a click swallowed by the pan gesture bound to
// the same element. Those are exactly the defects that ship.
//
// ⚠ AND WHY EVERY NUMBER HERE COMES WITH A PICTURE. The session before this one animated an
// island's COASTLINE layer, wrote a browser probe that measured the same wrong layer, and got back
// a perfect staggered arrival over a forest standing completely still. An instrument that shares its
// subject's assumption cannot contradict it. So this probe screenshots the page beside every claim
// it makes, and the screenshots are the point rather than a courtesy.
//
// ⚠ THE CONTROL IS READ FROM DISK, NOT FROM THE PAGE. The panel's text is compared against
// `src/data/forest-snapshot.json` — the file the build read — never against the `data-forest-roam`
// attribute the build wrote. Comparing the panel to the payload would only prove the runtime can
// read its own input; comparing it to the source proves the whole chain.
//
//   npm run build && node scripts/probe/roam-clicks.mjs
//   OUT_DIR=/tmp/roam node scripts/probe/roam-clicks.mjs
//
// Laptop-only. Nothing here ships and nothing here runs in CI. Exits non-zero if any check fails.

import { createRequire } from 'node:module';
const require_ = createRequire(process.env.ST_PW_FROM ?? new URL('../../../apps/desktop/package.json', import.meta.url));
const { chromium } = require_('playwright-core');
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('../../dist/', import.meta.url).pathname;
const OUT = process.env.OUT_DIR ?? '/tmp/roam-clicks';
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

// THE CONTROL: the corpus as it sits on disk, independent of anything the page emitted.
const SNAP = JSON.parse(readFileSync(new URL('../../src/data/forest-snapshot.json', import.meta.url), 'utf8'));

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
await page.evaluate(() => window.__stormSkipToTutorial());
// Let GROW settle. ROAM is live before this, but a screenshot of a half-arrived forest is unreadable.
await page.waitForTimeout(3500);

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        ${detail}` : ''}`);
};

/** The panel's text, read off the DOM — never off the witness object, which would only report what
 *  the module INTENDED. `visible` is measured, so a panel rendered behind something still fails. */
const panelState = () =>
  page.evaluate(() => {
    const p = document.querySelector('.roam-panel');
    if (!p) return { present: false };
    const cs = getComputedStyle(p);
    return {
      present: true,
      hidden: p.hidden,
      visible: !p.hidden && cs.display !== 'none' && Number(cs.opacity) > 0.9,
      text: (p.textContent ?? '').replace(/\s+/g, ' ').trim(),
      title: document.querySelector('.roam-title')?.textContent ?? null,
      kind: document.querySelector('.roam-kind')?.textContent ?? null,
      rows: [...document.querySelectorAll('.roam-row')].map((r) => (r.textContent ?? '').trim()),
      caps: [...document.querySelectorAll('.roam-cap-title')].map((c) => c.textContent),
      edges: [...document.querySelectorAll('.roam-edge')].map((c) => c.textContent),
      notes: [...document.querySelectorAll('.roam-note')].map((n) => ({
        id: n.getAttribute('data-roam-note'),
        grounds: n.getAttribute('data-grounds'),
        text: (n.textContent ?? '').replace(/\s+/g, ' ').trim(),
      })),
      stamp: document.querySelector('.roam-stamp')?.textContent ?? null,
      // ⚠ VISIBILITY, NOT PRESENCE — and the difference is a defect this probe already missed once.
      // The stamp and the floor were both in the DOM and both scrolled off the panel's own
      // max-height; a check reading textContent cannot tell that apart from working, and passed.
      // The screenshot beside it is what disagreed.
      onScreen: (() => {
        const rect = p.getBoundingClientRect();
        const seen = (sel) => {
          const n = document.querySelector(sel);
          if (!n) return false;
          const r = n.getBoundingClientRect();
          return r.height > 0 && r.top >= rect.top - 1 && r.bottom <= rect.bottom + 1;
        };
        return { stamp: seen('.roam-stamp'), floor: seen('[data-roam-note="floor"]') };
      })(),
      selected: [...document.querySelectorAll('.roam-selected')].map((n) => n.getAttribute('data-id')),
      witness: window.__act2roam ?? null,
    };
  });

/** Click the CENTRE of an element's own client rect. Real pointer events, so the pan gesture bound
 *  to the same SVG is exercised rather than bypassed — `page.click` on a selector would be too. */
const clickEl = async (selector) => {
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
  }, selector);
  if (box === null) return false;
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(140);
  return true;
};

console.log('\n=== ROAM, clicked in a real browser ===\n');

// ── 1 · WE ARE QUIET: nothing is on screen until something is clicked ───────
await page.screenshot({ path: join(OUT, '01-arrival-no-panel.png') });
let s = await panelState();
check('the panel is CLOSED on arrival — ROAM volunteers nothing', s.present && s.hidden === true,
  `panel present=${s.present} hidden=${s.hidden}  [01-arrival-no-panel.png]`);

// ── 2 · a DRAG must not be read as a click ──────────────────────────────────
const svgBox = await page.evaluate(() => {
  const r = document.querySelector('svg.forest-arrival-svg').getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.move(svgBox.x, svgBox.y);
await page.mouse.down();
for (let i = 1; i <= 8; i += 1) await page.mouse.move(svgBox.x + i * 9, svgBox.y + i * 4);
await page.mouse.up();
await page.waitForTimeout(160);
s = await panelState();
check('dragging the map does NOT open a panel — pan and click share one gesture', s.hidden === true,
  `after a 72px drag: hidden=${s.hidden}`);

// ── 3 · TARGET 1 · an island ────────────────────────────────────────────────
// Pick the island the site is most likely to be judged on: the one that IS this website.
const SELF = 'website-experience';
const selfStory = SNAP.stories.find((x) => x.id === SELF);
const opened = await clickEl(`.tw-hit[data-id="${SELF}"]`);
await page.screenshot({ path: join(OUT, '02-island-panel.png') });
s = await panelState();
check('clicking an island opens the panel', opened && s.visible === true,
  `clicked=${opened} visible=${s.visible} kind=${s.kind}  [02-island-panel.png]`);
check('the panel names the story the CORPUS names — control read from disk',
  selfStory !== undefined && s.title === selfStory.title,
  `panel: ${JSON.stringify(s.title)}\n        disk : ${JSON.stringify(selfStory?.title)}`);
check('the island the panel talks about is ringed on the map', s.selected.includes(SELF),
  `selected=${JSON.stringify(s.selected)}`);
check('the panel carries the snapshot date — a dated picture, never a live feed',
  /\d{4}/.test(s.stamp ?? '') && s.onScreen.stamp === true,
  `stamp: ${JSON.stringify(s.stamp)}  onScreen=${s.onScreen.stamp}`);
check('the story note is grounded in a decision', (s.notes.find((n) => n.id === 'story')?.grounds ?? '').startsWith('ADR-'),
  `grounds: ${JSON.stringify(s.notes.map((n) => [n.id, n.grounds]))}`);

// ── 4 · TARGET 2 · its colour, and the honesty fence ────────────────────────
const provenCaps = (selfStory?.capabilities ?? []).filter((c) => c.status === 'healthy').length;
const expectWord = selfStory?.status === 'healthy' ? 'proven' : 'not yet proven';
check('the colour row reads the status the CORPUS gives this island',
  s.rows.some((r) => r.includes(expectWord)),
  `disk status=${JSON.stringify(selfStory?.status)} → expected "${expectWord}"\n        rows: ${JSON.stringify(s.rows)}`);

await clickEl('[data-roam-row="colour"]');
await page.screenshot({ path: join(OUT, '03-colour-open.png') });
s = await panelState();
const colourNote = s.notes.find((n) => n.id === 'colour');
check('clicking the colour explains what it means, read from THIS island', colourNote !== undefined,
  `note: ${JSON.stringify(colourNote?.text)}  [03-colour-open.png]`);
check('a NOT-PROVEN island is said, in words, not to be proven — no flattery',
  selfStory?.status === 'healthy' || /signed it off|not/i.test(colourNote?.text ?? ''),
  `the site's own island is "${selfStory?.status}"; the panel says: ${JSON.stringify(colourNote?.text)}`);

// ── 5 · TARGET 3 · inside the island, and the floor ─────────────────────────
await clickEl('[data-roam-row="inside"]');
await page.screenshot({ path: join(OUT, '04-inside-and-floor.png') });
s = await panelState();
const diskCaps = (selfStory?.capabilities ?? []).map((c) => c.title);
const sameCaps = diskCaps.length === s.caps.length && diskCaps.every((t, i) => t === s.caps[i]);
check('the capability list is the one on disk, in order and complete', sameCaps,
  `panel ${s.caps.length} caps, disk ${diskCaps.length}  [04-inside-and-floor.png]`
  + (sameCaps ? '' : `\n        panel: ${JSON.stringify(s.caps)}\n        disk : ${JSON.stringify(diskCaps)}`));
check('the tally counts the proven capabilities the corpus records',
  s.rows.some((r) => r.includes(`${provenCaps} proven`)),
  `disk proven=${provenCaps}  rows: ${JSON.stringify(s.rows)}`);
const floor = s.notes.find((n) => n.id === 'floor');
check('the FLOOR arrives here, and names what opens it rather than dead-ending',
  floor !== undefined && /app/i.test(floor.text), `floor: ${JSON.stringify(floor?.text)}`);
check('the floor and the date are ON SCREEN, not merely in the DOM',
  s.onScreen.floor === true && s.onScreen.stamp === true,
  `floor onScreen=${s.onScreen.floor}  stamp onScreen=${s.onScreen.stamp} — the conversion point ` +
  `and the honesty stamp are the two things that must never be scrolled away`);

// ── 6 · TARGET 4 · a trail between islands ──────────────────────────────────
// The busiest trunk on the map: the segment carrying the most merged dependencies. Clicking a
// hairline is the case a unit test cannot see at all.
const trail = await page.evaluate(() => {
  const segs = [...document.querySelectorAll('.tw-trail-fill[data-edges]')];
  let best = null;
  for (const seg of segs) {
    const n = (seg.getAttribute('data-edges') ?? '').split(',').filter(Boolean).length;
    if (best === null || n > best.n) best = { id: seg.getAttribute('data-id'), n, edges: seg.getAttribute('data-edges') };
  }
  return best;
});
// Click the visible line's own midpoint, so what is exercised is the hit stroke under it.
const hitTrail = await page.evaluate((id) => {
  const seg = document.querySelector(`.tw-trail-casing[data-id="${id}"]`);
  if (!seg) return { ok: false, why: 'no casing pass for that segment' };
  const cs = getComputedStyle(seg);
  const pt = seg.getPointAtLength(seg.getTotalLength() / 2);
  const m = seg.getScreenCTM();
  const p = new DOMPoint(pt.x, pt.y).matrixTransform(m);
  return { ok: true, x: p.x, y: p.y, display: cs.display, width: cs.strokeWidth, pe: cs.pointerEvents };
}, trail?.id);
if (hitTrail.ok) {
  await page.mouse.move(hitTrail.x, hitTrail.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(160);
}
await page.screenshot({ path: join(OUT, '05-trail-panel.png') });
s = await panelState();
check('a trail is thick enough to hit — the casing pass is the invisible target',
  hitTrail.ok && hitTrail.display !== 'none' && hitTrail.pe === 'stroke',
  `display=${hitTrail.display} stroke-width=${hitTrail.width} pointer-events=${hitTrail.pe}`);
check('clicking a trail opens the dependency panel', s.kind === 'trail' && s.edges.length > 0,
  `kind=${s.kind} edges=${s.edges.length}  [05-trail-panel.png]`);
check('the HEADING carries the trunk\'s true total — the cap never understates a hub',
  (s.title ?? '').includes(String(trail?.n)),
  `the segment's own metadata carries ${trail?.n} edges; the heading reads ${JSON.stringify(s.title)}`);
// And every sentence must name two stories the corpus actually holds.
// ⚠ THE CONTROL IS A PREFIX TEST, NOT THE CODE'S OWN SPLITTING RULE. The panel prints a story's
// NAME, which is the head of its title; re-deriving that head here with the same rule the subject
// uses would be a self-comparison that passes whatever the rule does. Asking instead whether each
// name is a PREFIX of some real corpus title is independent of how the split is computed, and still
// catches a name the corpus does not contain.
const titles = SNAP.stories.map((x) => x.title);
const ids = new Set(SNAP.stories.map((x) => x.id));
const allNamed = s.edges.every((line) => {
  const [to, from] = (line ?? '').replace(/\.$/, '').split(' needs ');
  // Either the map's own nameplate label (the id) or a whole prefix of a real title. Both are
  // checkable against the corpus without re-deriving how the panel chose between them.
  return [to, from].every(
    (name) => name !== undefined && (ids.has(name) || titles.some((t) => t.startsWith(name))),
  );
});
check('every name in a dependency sentence is a real story from the corpus', allNamed,
  `first: ${JSON.stringify(s.edges[0])}`);

// ── 7 · the truncation is honest about what it left out ────────────────────
check('the trail panel\'s date is on screen too — the panel that first failed this',
  s.onScreen.stamp === true, `stamp onScreen=${s.onScreen.stamp}`);
check('a busy trunk is capped, and says how many it left out',
  s.edges.length <= 6 && /and \d+ more/.test(s.text),
  `printed ${s.edges.length} of the segment's ${trail?.n}; tail present=${/and \d+ more/.test(s.text)}`);

// ── 8 · the keyboard route the scene already provides actually answers ──────
//
// ⚠ ESCAPE IS NOT TESTED HERE, AND THE FIRST VERSION OF THIS PROBE TESTED IT AND WAS WRONG. Escape
// is chapter 1's never-stranded exit: it disarms the whole experience. The probe pressed it,
// expecting a closed panel, and found the panel GONE — because the storm had torn chapter 2 down
// underneath it. The finding was real and the expectation was mine; ROAM no longer binds Escape.
const kbd = await page.evaluate((id) => {
  const hit = document.querySelector(`.tw-hit[data-id="${id}"]`);
  if (!hit) return false;
  hit.focus();
  hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  return true;
}, SELF);
await page.waitForTimeout(160);
await page.screenshot({ path: join(OUT, '06-keyboard.png') });
s = await panelState();
check('the focusable island answers the keyboard, not just the mouse', kbd === true && s.visible === true,
  `dispatched=${kbd} visible=${s.visible} title=${JSON.stringify(s.title)}  [06-keyboard.png]`);

// ── 9 · the reader dismisses it, two ways ───────────────────────────────────
await clickEl('.roam-close');
s = await panelState();
check('the close button closes the panel', s.hidden === true, `hidden=${s.hidden}`);

await clickEl(`.tw-hit[data-id="${SELF}"]`);
// Open water: a point inside the map that is not on any island hit rect or trail.
const water = await page.evaluate(() => {
  const svg = document.querySelector('svg.forest-arrival-svg');
  const r = svg.getBoundingClientRect();
  for (let y = r.y + 12; y < r.y + r.height - 12; y += 17) {
    for (let x = r.x + 12; x < r.x + r.width - 12; x += 17) {
      const el = document.elementFromPoint(x, y);
      if (el === svg || el?.classList?.contains('tw-bg')) return { x, y };
    }
  }
  return null;
});
if (water !== null) {
  await page.mouse.move(water.x, water.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(140);
}
s = await panelState();
check('clicking open water closes the panel', water !== null && s.hidden === true,
  `water=${JSON.stringify(water)} hidden=${s.hidden}`);

// ── 10 · ROAM adds nothing to the clock ─────────────────────────────────────
await clickEl(`.tw-hit[data-id="${SELF}"]`);
const before = (await panelState()).text ?? '';
await page.waitForTimeout(6000);
const afterState = await panelState();
const after = afterState.text ?? '';
await page.screenshot({ path: join(OUT, '07-after-6s-wait.png') });
check('the panel does not change on its own — nothing here is on a clock',
  before.length > 0 && before === after,
  `${before.length} chars before a 6s wait, ${after.length} after; still visible=${afterState.visible}  [07-after-6s-wait.png]`);

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${OUT}`);
if (failed.length > 0) {
  console.log('\nFAILED:');
  for (const f of failed) console.log(`  - ${f.name}`);
}
process.exit(failed.length === 0 ? 0 : 1);
