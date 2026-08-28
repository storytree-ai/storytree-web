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
const OUT='/tmp/beats'; mkdirSync(OUT,{recursive:true});
const TYPES={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{let p=decodeURIComponent((req.url??'/').split('?')[0]);if(p.endsWith('/'))p+='index.html';
 try{const b=await readFile(join(ROOT,p));res.writeHead(200,{'content-type':TYPES[extname(p)]??'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end('x');}});
await new Promise(r=>server.listen(0,r));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'load'});
await page.waitForFunction('typeof window.__stormSkipToTutorial === "function"');
await page.evaluate(()=>window.__stormSkipToTutorial());
const seen=new Set();
const deadline=Date.now()+80000;
while(Date.now()<deadline){
  const st=await page.evaluate(()=>{
    const t=window.__act2tell;
    const vis=[...document.querySelectorAll('.tell-line')].filter(e=>Number(getComputedStyle(e).opacity)>0.9).map(e=>e.textContent);
    return t?{beat:t.beat,index:t.index,total:t.total,vis}:null;
  });
  if(st && st.vis.length===st.vis.length && st.vis.length>0){
    const key=`${st.index}-${st.vis.length}`;
    if(!seen.has(key)){seen.add(key);
      writeFileSync(join(OUT,`beat${String(st.index).padStart(2,'0')}-${st.beat}-l${st.vis.length}.png`), await page.screenshot());
      console.log(`beat ${st.index}/${st.total} ${st.beat}: ${JSON.stringify(st.vis)}`);
    }
  }
  await new Promise(r=>setTimeout(r,120));
  if(seen.size>0 && st===null) break;
}
await browser.close();server.close();
