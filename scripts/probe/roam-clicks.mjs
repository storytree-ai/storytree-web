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
import { fileURLToPath } from 'node:url';

// ⚠ `fileURLToPath`, NOT `.pathname`. On Windows a file URL's pathname is `/C:/…` — the leading
// slash survives `join`, which then resolves to `C:\C:\…` and every request 404s. The symptom is
// not a path error: the server answers "nope" to everything, the page loads as plain text, and the
// probe dies on a `waitForFunction` timeout that names the wrong thing entirely.
const ROOT = fileURLToPath(new URL('../../dist/', import.meta.url));
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

// ⚠ THE PATH IS OVERRIDABLE BECAUSE THIS PROBE IS LAPTOP-ONLY AND LAPTOPS DIFFER. The default is
// the Linux box it was written on; `PW_CHROME` is how a Windows checkout points it at the browser
// Playwright already downloaded (…/ms-playwright/chromium-*/chrome-win/chrome.exe). Hard-coding one
// machine's path meant the browser half of the ROAM proof could only ever be run on that machine —
// and the browser half is the one that catches what the unit suite structurally cannot.
const CHROME = process.env.PW_CHROME ?? '/usr/bin/google-chrome';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
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
        return {
          stamp: seen('.roam-stamp'),
          floor: seen('[data-roam-note="floor"]'),
          arcRow: seen('[data-roam-row="arcs"]'),
        };
      })(),
      arcs: [...document.querySelectorAll('.roam-arc')].map((a) => ({
        title: a.querySelector('.roam-arc-title')?.textContent ?? null,
        word: a.querySelector('.roam-arc-word')?.textContent ?? null,
        tally: a.querySelector('.roam-arc-tally')?.textContent ?? null,
        adrs: [...a.querySelectorAll('.roam-arc-adr')].map((d) => d.textContent),
      })),
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

// ── 5b · TARGET 5 · the arc drawer, and the empty state ─────────────────────
//
// ⚠ THE CONTROL IS THE SNAPSHOT ON DISK, as everywhere else here. The panel's arc titles are
// compared against the arcs the FILE says reach this island — never against the `data-forest-roam`
// attribute the build wrote, which would only prove the runtime can read its own input.
check('the arc row is ON SCREEN, not scrolled off below the floor', s.onScreen.arcRow === true,
  `arcRow onScreen=${s.onScreen.arcRow} — the drawer is the tier above the code, and the visitor ` +
  `has just reached the bottom of the tier below it`);

await clickEl('[data-roam-row="arcs"]');
await page.screenshot({ path: join(OUT, '04b-arc-drawer.png') });
s = await panelState();
const diskArcIds = (selfStory?.arcs ?? []).map((a) => a.id);
const diskArcs = diskArcIds.map((id) => SNAP.arcs.find((a) => a.id === id)).filter(Boolean);
check('the drawer lists the initiatives the CORPUS attaches to this island',
  diskArcs.length === s.arcs.length && diskArcs.every((a, i) => a.title === s.arcs[i]?.title),
  `panel ${s.arcs.length}, disk ${diskArcs.length}  [04b-arc-drawer.png]`
  + `
        panel: ${JSON.stringify(s.arcs.map((a) => a.title))}`
  + `
        disk : ${JSON.stringify(diskArcs.map((a) => a.title))}`);
check('the arc note explains what an initiative is, and is grounded in a decision',
  (s.notes.find((n) => n.id === 'arc')?.grounds ?? '').startsWith('ADR-'),
  `arc note: ${JSON.stringify(s.notes.find((n) => n.id === 'arc'))}`);
check('the shape on screen is the shape on disk — counted, never written',
  diskArcs.every((a, i) => {
    const t = s.arcs[i]?.tally ?? '';
    return a.incrementsOpen === 0
      ? t.includes(String(a.incrementsClosed)) && !/still open/.test(t)
      : t.includes(String(a.incrementsClosed)) && t.includes(String(a.incrementsOpen));
  }),
  `disk: ${JSON.stringify(diskArcs.map((a) => [a.incrementsClosed, a.incrementsOpen]))}  `
  + `panel: ${JSON.stringify(s.arcs.map((a) => a.tally))}`);
// ⚠ THIS CHECK ASKS THE PAYLOAD, NOT THE PROSE, AND IT WAS WRONG TWICE BEFORE IT WAS RIGHT.
//
// It began as a grep of the panel's text for body words — and shipped with a literal BACKSPACE byte
// where each `\\b` should have been (a shell heredoc ate the escape), so the regex could not match
// anything and the check passed unconditionally. It reported a PASS against the LIVE site having
// verified nothing: the exact fault this file's own header warns about, landed in the check whose
// subject is the only protection this tier has.
//
// Repairing the escape is NOT the fix, because the grep was the wrong question anyway: ROAM's own
// copy says "tracked from its intent to its end", so a WORKING word-grep fails on correct output.
// Body prose is a DATA property — does the published record carry a field it may not — so this walks
// the keys of every arc record the build emitted. That can genuinely fail, does not depend on what
// any sentence happens to say, and catches a leak wherever in the payload it lands.
const arcRecords = await page.evaluate(() => {
  const raw = document.querySelector('.forest-arrival-svg')?.getAttribute('data-forest-roam');
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  const arcs = parsed.arcs ?? [];
  return {
    arcKeys: [...new Set(arcs.flatMap((a) => Object.keys(a)))].sort(),
    adrKeys: [...new Set(arcs.flatMap((a) => (a.adrs ?? []).flatMap((d) => Object.keys(d))))].sort(),
    count: arcs.length,
  };
});
const ARC_ALLOWED = ['adrs', 'id', 'incrementsClosed', 'incrementsOpen', 'lifecycle', 'title'];
const ADR_ALLOWED = ['number', 'status', 'title'];
const arcKeysOk =
  arcRecords !== null &&
  arcRecords.count > 0 &&
  arcRecords.arcKeys.every((k) => ARC_ALLOWED.includes(k)) &&
  arcRecords.adrKeys.every((k) => ADR_ALLOWED.includes(k));
check('NO ARC BODY REACHES THE PAGE — the one protection this tier has', arcKeysOk,
  arcRecords === null
    ? 'no arc payload on the page at all'
    : `${arcRecords.count} arc record(s); keys ${JSON.stringify(arcRecords.arcKeys)} / decision keys `
      + `${JSON.stringify(arcRecords.adrKeys)}`
      + `\n        allowed: ${JSON.stringify(ARC_ALLOWED)} / ${JSON.stringify(ADR_ALLOWED)}`);
// TEETH, in the same run: the walk must reject a record carrying a body field. Without this the
// check is indistinguishable from the vacuous one it replaced — both print a tick.
check('TEETH: the key walk REJECTS an arc record carrying a body',
  !['id', 'title', 'intent'].every((k) => ARC_ALLOWED.includes(k)),
  'a record with `intent` must not satisfy the allow-list the check above applies');
check('every decision listed is one the corpus attaches to that arc',
  s.arcs.every((panelArc, i) => (panelArc.adrs ?? []).every((t) => (diskArcs[i]?.adrs ?? []).some((d) => d.title === t))),
  `panel: ${JSON.stringify(s.arcs.map((a) => a.adrs))}`);

// ── 6 · TARGET 4 · a trail between islands ──────────────────────────────────
// The busiest trunk on the map: the segment carrying the most merged dependencies. Clicking a
// hairline is the case a unit test cannot see at all.
// ⚠ IT MUST BE THE BUSIEST SEGMENT A VISITOR CAN ACTUALLY REACH, NOT THE BUSIEST FULL STOP. The map
// is CROPPED to the designed resting frame (ADR-0471) and the visitor pans from there, so a segment
// whose midpoint sits outside the viewport is not a target — clicking it lands on nothing. This
// probe used to take the busiest segment unconditionally, which was fine only for as long as the
// layout held still: the corpus moved between two snapshot publishes, the winner moved with it, and
// its midpoint came to rest 88 px ABOVE the top of the frame. The run then reported three failures
// about the trail panel and the cap, none of which was about the trail panel or the cap.
const trail = await page.evaluate(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const segs = [...document.querySelectorAll('.tw-trail-fill[data-edges]')];
  let best = null;
  let bestOffScreen = null;
  for (const seg of segs) {
    const n = (seg.getAttribute('data-edges') ?? '').split(',').filter(Boolean).length;
    const id = seg.getAttribute('data-id');
    const row = { id, n, edges: seg.getAttribute('data-edges') };
    if (bestOffScreen === null || n > bestOffScreen.n) bestOffScreen = row;
    const casing = document.querySelector(`.tw-trail-casing[data-id="${id}"]`);
    if (!casing) continue;
    const pt = casing.getPointAtLength(casing.getTotalLength() / 2);
    const p = new DOMPoint(pt.x, pt.y).matrixTransform(casing.getScreenCTM());
    if (p.x < 8 || p.y < 8 || p.x > vw - 8 || p.y > vh - 8) continue;
    if (best === null || n > best.n) best = row;
  }
  return best === null ? { ...bestOffScreen, offScreen: true } : best;
});
check('the busiest reachable trail is ON SCREEN — a target the visitor can actually click',
  trail !== null && trail.offScreen !== true,
  trail?.offScreen === true
    ? `every trail midpoint is outside the resting frame; the busiest overall is "${trail.id}" (${trail.n} edges)`
    : `"${trail?.id}" carries ${trail?.n} edges`);
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
  // ⚠ `visible` IS LOAD-BEARING, not decoration. Without it this reads a CLOSED panel's own empty
  // text against itself and passes — which it did, once, after an earlier step panned the island
  // out from under the click that was meant to open it. "Nothing changed" is only evidence of a
  // quiet surface when there was something on screen to change.
  afterState.visible === true && before.length > 40 && before === after,
  `${before.length} chars before a 6s wait, ${after.length} after; still visible=${afterState.visible}  [07-after-6s-wait.png]`);

// ── 11 · TARGET 5's EMPTY STATE, on a real island, and it PANS to reach one ──
//
// ⚠ THIS RUNS LAST, AND THE ORDER IS THE DECISION. Reaching an arc-less island means DRAGGING the
// map, and a drag moves every other island too — including the one the earlier steps are about. Run
// mid-sequence, this excursion left the later steps clicking co-ordinates their targets had vacated:
// every click became a no-op, and the final "nothing is on a clock" check compared a CLOSED panel
// against itself and passed. A vacuous pass is worse than the red it replaced, so the pan goes at
// the end where it can disturb nothing.
// The EMPTY state, driven on a real island rather than described. Measured on the published
// snapshot, a minority of islands are reached by no arc — a blank drawer there would read as a bug.
// ⚠ AND IT MUST BE ONE THE CROP ACTUALLY SHOWS, for the same reason the trail target must be. An
// island outside the resting frame has a zero-size client rect, `clickEl` returns false, and the
// NEXT click then toggles the previous island's drawer shut — which reads exactly like the empty
// state working, on a story that has an arc. The two `assert`-shaped returns below are what stop a
// no-op reading as a pass.
const lonelyIds = SNAP.stories.filter((st) => (st.arcs ?? []).length === 0).map((st) => st.id);
const inFrame = () =>
  page.evaluate((ids) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const id of ids) {
      const el = document.querySelector(`.tw-hit[data-id="${id}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.left > 8 && r.top > 8 && r.right < vw - 8 && r.bottom < vh - 8) {
        return { id, x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
    }
    return null;
  }, lonelyIds);

let lonely = await inFrame();
if (lonely === null && lonelyIds.length > 0) {
  // PAN TO IT, because a visitor can. The resting frame is a designed crop, not the whole map
  // (ADR-0471) — GROW settles there and leaves the visitor free to drag. So an island outside the
  // opening view is reachable, and testing the empty state only when the layout happens to put one
  // on screen would make this check come and go with the corpus. The drag is a REAL gesture on the
  // same element the pan is bound to, and it is far longer than the click slop, so it cannot be
  // mistaken for a click.
  const target = await page.evaluate((ids) => {
    for (const id of ids) {
      const el = document.querySelector(`.tw-hit[data-id="${id}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      return { id, x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  }, lonelyIds);
  if (target !== null) {
    const cx = 500;
    const cy = 450;
    let dx = cx - target.x;
    let dy = cy - target.y;
    // one drag can only move as far as the cursor can travel, so walk it in viewport-sized steps
    for (let i = 0; i < 6 && (Math.abs(dx) > 40 || Math.abs(dy) > 40); i += 1) {
      const stepX = Math.max(-600, Math.min(600, dx));
      const stepY = Math.max(-320, Math.min(320, dy));
      await page.mouse.move(700, 450);
      await page.mouse.down();
      await page.mouse.move(700 + stepX, 450 + stepY, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(120);
      const now = await page.evaluate((id) => {
        const el = document.querySelector(`.tw-hit[data-id="${id}"]`);
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, target.id);
      dx = cx - now.x;
      dy = cy - now.y;
    }
    lonely = await inFrame();
  }
}
if (lonely !== null) {
  const gotIsland = await clickEl(`.tw-hit[data-id="${lonely.id}"]`);
  const gotRow = await clickEl('[data-roam-row="arcs"]');
  check('the empty-state island and its drawer row were both actually clicked',
    gotIsland && gotRow, `island=${gotIsland} row=${gotRow} — a missed click would fake this test`);
  await page.screenshot({ path: join(OUT, '04c-arc-empty.png') });
  const e = await panelState();
  check('an island no initiative reaches says so, rather than opening an empty drawer',
    e.arcs.length === 0 && (e.notes.find((n) => n.id === 'arc-empty')?.text ?? '').length > 0,
    `"${lonely.id}" — arcs=${e.arcs.length} note=${JSON.stringify(e.notes.find((n) => n.id === 'arc-empty')?.text)}  [04c-arc-empty.png]`);
} else {
  check('an island no initiative reaches says so, rather than opening an empty drawer', false,
    'no island reached by zero arcs is inside the resting frame on this snapshot — the empty ' +
    'branch went untested in a browser. It is covered by the unit suite; this is the gap, stated.');
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${OUT}`);
if (failed.length > 0) {
  console.log('\nFAILED:');
  for (const f of failed) console.log(`  - ${f.name}`);
}
process.exit(failed.length === 0 ? 0 : 1);
