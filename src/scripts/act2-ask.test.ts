// ASK — the site's ending (act2-ask.ts).
//
// ⚠ WHAT THIS SUITE IS ACTUALLY FOR. The ending is one link and two sentences, so the interesting
// failure is never "it did not render". It is one of three, and each of them would read perfectly on
// the page:
//
//   1. the copy drifts back into a PROMISE — "join the waitlist", "we'll let you know" — describing
//      a follow-up nobody is holding a list to deliver (ADR-0493 D4/D5);
//   2. something starts CAPTURING — a form, an endpoint, an embed, a click counter — which is the
//      four routes the owner explicitly declined (D2/D3), and the shape a later "let's just measure
//      it" would take;
//   3. the two copies of the link DRIFT APART. It is written twice on purpose (runtime for the
//      guided path, markup for the no-script one), and a contact link that is right in one place and
//      mistyped in the other is a defect nothing else on this page can detect.
//
// ⚠ `bun test` TRANSPILES AND DOES NOT TYPECHECK. `npm run typecheck` covers this file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ASK_AVAILABILITY_PHRASINGS, ASK_CTA, ASK_FORBIDDEN, ASK_HREF, ASK_LINE } from './act2-ask';

const page = (): string => readFileSync(new URL('../pages/index.astro', import.meta.url), 'utf8');
const module_ = (): string => readFileSync(new URL('./act2-ask.ts', import.meta.url), 'utf8');

// ── 1. it invites, it does not promise ──────────────────────────────────────

test('the ending asks for COLLABORATION, never notification (ADR-0493 D4)', () => {
  const copy = `${ASK_LINE} ${ASK_CTA}`.toLowerCase();
  for (const phrase of ASK_FORBIDDEN) {
    assert.ok(
      !copy.includes(phrase),
      `the ending says "${phrase}" — we hold no list, so that promises a follow-up nobody can deliver`,
    );
  }
  // And it actually invites: the register is a real ask rather than a link with no sentence round it.
  assert.match(ASK_CTA, /want in|get involved|say hello|reach out/i, `"${ASK_CTA}" is not an invitation`);
});

test('TEETH: the register guard catches the copy the open question was FRAMED with', () => {
  // `oq-the-site-s-ending-where-does-a-waitlist-signup-actually-g` put four capture routes to the
  // owner and he declined all four. The drift back is one word, and it would read perfectly — so
  // assert the guard refuses the exact sentence that question assumed.
  const drifted = 'Join the waitlist and we\'ll let you know when it is ready.'.toLowerCase();
  const caught = ASK_FORBIDDEN.filter((phrase) => drifted.includes(phrase));
  assert.ok(caught.length >= 2, `the guard only caught ${caught.join(', ')} in the waitlist sentence`);
});

test('the no-script ending obeys the same register — it is copy, not a second decision', () => {
  const fallback = /<p class="fallback__ask">([\s\S]*?)<\/p>/.exec(page());
  assert.ok(fallback !== null, 'the calm view carries no ending at all');
  const copy = (fallback[1] ?? '').toLowerCase();
  for (const phrase of ASK_FORBIDDEN) {
    assert.ok(!copy.includes(phrase), `the no-script ending says "${phrase}"`);
  }
});

test('TEETH: the register guard refuses a SALE as well as a promise (owner, 2026-09-01)', () => {
  // ⚠ A DIFFERENT DRIFT FROM THE WAITLIST ONE, AND NEITHER LIST CATCHES THE OTHER. The owner:
  // "the invite is to get involved not to buy a product." A page with nothing to sell that reads
  // like a storefront is the vapour ADR-0453 D2's reader is fastest to smell — and the sentence
  // below would look entirely normal on any other product site.
  const drifted = 'Get started free — no card needed. Pricing from $9.'.toLowerCase();
  const caught = ASK_FORBIDDEN.filter((phrase) => drifted.includes(phrase));
  assert.ok(caught.length >= 2, `the guard only caught ${caught.join(', ')} in the storefront sentence`);
});

// ── 1b. it says, out loud, that nobody can use this yet ─────────────────────

test('the ending STATES its unavailability — ADR-0453 D9, and the clause it went six days without', () => {
  // ⚠ THIS IS THE ASSERTION WHOSE ABSENCE COST SIX DAYS. ADR-0453 D9 asks the site to say plainly
  // that storytree is "being built in the open and is not available yet". ADR-0493 replaced only
  // the CAPTURE half of that clause; the ending then shipped carrying "building this in the open"
  // and nothing whatever about availability, and nothing red-lit, because no test asked.
  //
  // ⚠ AND SILENCE WAS NOT NEUTRAL, which is why the property is worth a rung rather than a comment.
  // ROAM names "the app" twice as the thing that opens the depth below the public map, so the page
  // positively asserts a product exists and then asks the reader if they want in. The honest
  // inference was that there is one to be let into.
  const line = ASK_LINE.toLowerCase();
  const said = ASK_AVAILABILITY_PHRASINGS.filter((phrase) => line.includes(phrase));
  assert.ok(
    said.length > 0,
    `the ending never says nobody can use it yet — "${ASK_LINE}" contains none of: ${ASK_AVAILABILITY_PHRASINGS.join(', ')}`,
  );
});

test('TEETH: the availability guard rejects the exact copy that shipped without it', () => {
  // The string this ending carried from 2026-08-26 to 2026-09-01. It satisfies every OTHER
  // assertion in this file — it promises nothing, sells nothing, captures nothing — which is
  // precisely why the suite passed over it. A guard that this sentence survives is not a guard.
  const shippedWithoutIt = 'One person, building this in the open.'.toLowerCase();
  const said = ASK_AVAILABILITY_PHRASINGS.filter((phrase) => shippedWithoutIt.includes(phrase));
  assert.deepEqual(said, [], 'the availability guard would pass the copy that lacked the clause');
});

// ── 1c. the two copies of the COPY, like the two copies of the link ─────────

test('the calm view carries the SAME words, not merely the same register', () => {
  // ⚠ THE HREF WAS HELD THIS WAY AND THE WORDS WERE NOT, and the words are where the substantive
  // claim lives. "Still under construction" is the site's only statement that nobody can use this;
  // if it reaches the guided path and not the no-script one, the visitors who get the plain page
  // are the only ones still misled — and they are the group this fallback exists to serve.
  const fallback = /<p class="fallback__ask">([\s\S]*?)<\/p>/.exec(page());
  assert.ok(fallback !== null, 'the calm view carries no ending at all');
  const markup = fallback[1] ?? '';
  assert.ok(
    markup.includes(ASK_LINE),
    `the calm view's line has drifted from ASK_LINE — expected "${ASK_LINE}"`,
  );
  assert.ok(
    markup.includes(ASK_CTA),
    `the calm view's call to action has drifted from ASK_CTA — expected "${ASK_CTA}"`,
  );
});

// ── 2. nothing is captured ──────────────────────────────────────────────────

test('the ending captures NOTHING — no form, no endpoint, no third-party script (ADR-0493 D2/D3)', () => {
  // ⚠ READ THE MODULE'S SOURCE, because this is a property about what the code CANNOT do rather than
  // about what one render produced. A `fetch` added behind a condition would never appear in a
  // rendered DOM a test happened to build, and it is exactly the shape a later "let's just count the
  // clicks" would take — the thing ADR-0493 D5 names as the accepted cost and tells nobody to fix.
  const code = module_().replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'navigator.sendBeacon', 'WebSocket', '<form', 'createElement(\'form\'', 'createElement(\'script\'', 'createElement(\'iframe\'']) {
    assert.ok(!code.includes(forbidden), `the ending reaches for "${forbidden}" — it captures something`);
  }
  // The only outward-facing thing it may build is an anchor.
  const created = [...code.matchAll(/createElement\('([a-z]+)'\)/g)].map((m) => m[1]);
  assert.deepEqual(created.sort(), ['a', 'div', 'p'], `the ending builds more than a link: ${created.join(', ')}`);
});

test('the calm view captures nothing either — the whole page holds the boundary', () => {
  // The no-script route is the one where a form would be the OBVIOUS implementation, because there
  // is no script to prevent it. The section is read whole rather than by element name, so a `method`
  // or an `action` smuggled onto something else is caught too.
  const source = page();
  const section = source.slice(source.indexOf('class="calm-view"'), source.indexOf('</Base>'));
  for (const forbidden of ['<form', 'action=', 'method=', '<iframe', '<script src']) {
    assert.ok(!section.includes(forbidden), `the calm view carries "${forbidden}"`);
  }
});

// ── 3. one destination, written twice, never drifting ───────────────────────

test('both copies of the link point at exactly the profile ADR-0493 D1 names', () => {
  assert.equal(ASK_HREF, 'https://www.linkedin.com/in/mick-hua-353353a/');
  const hrefs = [...page().matchAll(/href="(https:\/\/[^"]*linkedin[^"]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 1, 'the calm view has no link to the profile');
  for (const href of hrefs) {
    assert.equal(href, ASK_HREF, 'the markup link and the runtime link have drifted apart');
  }
});

test('the outbound link is safe and quiet — new tab, no opener, no referrer', () => {
  // `noreferrer` is not decoration: it is the privacy-preserving default, and it costs only the one
  // thing ADR-0493 D5 already accepts losing — knowing how many people arrived from here. Asserted
  // on BOTH copies, because the markup one is the easy one to write without it.
  const code = module_();
  assert.match(code, /link\.rel = 'noopener noreferrer'/, 'the runtime link leaks its opener');
  assert.match(code, /link\.target = '_blank'/, 'the runtime link replaces the page');
  const anchor = /<a\s+class="ask-link"[\s\S]*?>/.exec(page());
  assert.ok(anchor !== null, 'the calm view anchor has moved');
  assert.match(anchor[0], /rel="noopener noreferrer"/, 'the markup link leaks its opener');
  assert.match(anchor[0], /target="_blank"/, 'the markup link replaces the page');
});

// ── the ending is reachable however the sequence ended ──────────────────────

test('TEETH: every exit from TELL reveals the ending — skipping must not cost it', () => {
  // ⚠ THE FAILURE THIS PINS IS A CALLBACK WIRED ONLY TO THE NATURAL END. It would look right, work
  // in every test that watches the sequence run to completion, and hide the site's one outbound link
  // from every visitor who skipped — the visitors most likely to have already decided they wanted
  // it. `signalDone` is called from `finish` (the end and the skip both route through it), from
  // `unmount` (the storm's disarm, which does NOT), and from the reduced-motion branch (where there
  // is no sequence to end at all), and it is once-only so the common path still fires exactly one.
  const tell = readFileSync(new URL('./act2-tell.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.equal(
    (tell.match(/signalDone\(\)/g) ?? []).length,
    3,
    'signalDone is not called from all three exits — finish, unmount, and the reduced-motion branch',
  );
  assert.match(tell, /if \(done\) return;/, 'signalDone can fire more than once');

  // And the ending arrives even when TELL never mounts at all — `mountTell` returns an inert handle
  // when the map is unreadable, and in that branch nothing would ever call onDone.
  const inflection = readFileSync(new URL('./inflection.ts', import.meta.url), 'utf8');
  assert.match(inflection, /if \(tell === null\) ask\?\.reveal\(\)/, 'a map-less page loses its ending');
});

test('the ending is out of the tab order until it is shown', () => {
  // It is mounted before TELL so TELL can reveal it, which means it exists behind the prose for the
  // whole sequence. A link a keyboard can reach behind an invisible layer is the same defect the
  // controls lock found on ROAM's hit rects, one surface along.
  const code = module_();
  assert.match(code, /link\.tabIndex = -1/, 'the hidden link is tabbable');
  assert.match(code, /link\.tabIndex = 0/, 'the revealed link is not tabbable');
});
