// A time-stamped burst capture of the arrival. The earlier probe took screenshots by polling from
// Node, and each round trip cost more than a wave — so two shots 400ms apart came back identical
// and would have been read as "no growth". Here every frame carries the page's OWN measurement of
// how many islands have finished, taken in the same evaluate that stamps the time, so a frame can
// never be mislabelled by the round trip.
import { createRequire } from 'node:module';
// playwright-core lives in the PARENT monorepo's store, not in web/'s npm tree — these are laptop
// verification instruments, never shipped dependencies, so they reach for it rather than adding a
// browser download to everyone's `npm install` here. Point ST_PW_FROM at any package.json whose
// resolution reaches playwright-core.
const require_ = createRequire(process.env.ST_PW_FROM ?? new URL('../../../apps/desktop/package.json', import.meta.url));
const { chromium } = require_('playwright-core');
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../../dist/', import.meta.url).pathname;
const OUT = process.env.OUT_DIR ?? '/tmp/growth-burst';
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2' };
const server = createServer(async (req,res)=>{let p=decodeURIComponent((req.url??'/').split('?')[0]); if(p.endsWith('/'))p+='index.html';
 try{const b=await readFile(join(ROOT,p)); res.writeHead(200,{'content-type':TYPES[extname(p)]??'application/octet-stream'}); res.end(b);}catch{res.writeHead(404);res.end('x');}});
await new Promise(r=>server.listen(0,r));
const base=`http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome', args:['--no-sandbox'] });
const page = await browser.newPage({ viewport:{width:1600,height:900}, deviceScaleFactor:1 });
await page.goto(base, { waitUntil:'load' });
await page.waitForFunction('typeof window.__stormSkipToTutorial === "function"');

await page.evaluate(() => {
  window.__t0 = performance.now();
  window.__probe = () => {
    const isles = [...document.querySelectorAll('svg.forest-arrival-svg .tw-isle')];
    let grown = 0, sum = 0;
    for (const g of isles) {
      const cs = getComputedStyle(g);
      const m = cs.transform && cs.transform !== 'none' ? Number(cs.transform.match(/matrix\(([-\d.]+)/)?.[1] ?? 1) : 1;
      const s = m * Number(cs.opacity);
      sum += s;
      if (Number(cs.opacity) > 0.99 && m > 0.995) grown += 1;
    }
    const trails = document.querySelector('.tw-trails');
    return {
      t: Math.round(performance.now() - window.__t0),
      n: isles.length, grown,
      meanPresence: isles.length ? Number((sum / isles.length).toFixed(3)) : 0,
      trailsOpacity: trails ? Number(Number(getComputedStyle(trails).opacity).toFixed(2)) : null,
    };
  };
});
await page.evaluate(() => { window.__t0 = performance.now(); window.__stormSkipToTutorial(); });

const frames = [];
const deadline = Date.now() + 4200;
while (Date.now() < deadline) {
  const before = await page.evaluate(() => window.__probe());
  const buf = await page.screenshot();
  const after = await page.evaluate(() => window.__probe());
  frames.push({ ...before, tAfter: after.t, grownAfter: after.grown, buf });
}
await browser.close(); server.close();

// Pick the frames that tell the story: the ones whose BEFORE and AFTER agree (so the label is
// trustworthy) and whose grown-count is a new value.
const seen = new Set();
const kept = [];
for (const f of frames) {
  if (f.grown !== f.grownAfter) continue;          // the frame straddled a wave — unlabelable
  if (seen.has(f.grown)) continue;
  seen.add(f.grown);
  kept.push(f);
}
kept.sort((a,b)=>a.t-b.t);
for (const f of kept) {
  const name = `t${String(f.t).padStart(4,'0')}ms-grown${String(f.grown).padStart(2,'0')}of${f.n}.png`;
  writeFileSync(join(OUT, name), f.buf);
}
console.log(`captured ${frames.length} frames; kept ${kept.length} unambiguous ones`);
console.log('t(ms)\tgrown/n\tmeanPresence\ttrailsOpacity');
for (const f of kept) console.log(`${f.t}\t${f.grown}/${f.n}\t${f.meanPresence}\t\t${f.trailsOpacity}`);
const curve = frames.filter(f=>f.grown===f.grownAfter).map(f=>`${f.t}:${f.meanPresence}`).slice(0,30).join(' ');
console.log(`\npresence curve (t:mean scale*opacity across all ${frames[0]?.n} islands):\n${curve}`);
console.log(`\nwrote ${OUT}`);
