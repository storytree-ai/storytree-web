// ---------------------------------------------------------------------------
// ASK — the site's ending, and the only thing on the page that points off it.
//
// Chapter 2's four movements are GROW · TELL · ROAM · ASK (`storytree library artifact
// grow-tell-roam-ask`). GROW settles the real forest, TELL speaks over it for about a minute and
// hands the map back, ROAM answers whatever the visitor clicks. This is what is left: a visitor who
// has just watched a system explain itself, and — until now — nothing to do about it.
//
// ⚠ IT ASKS FOR COLLABORATION, NOT NOTIFICATION (ADR-0493 D4). "Join the waitlist" and "we'll let
// you know" are both wrong and both worse than wrong: they promise a follow-up nobody is holding a
// list to deliver. We hold no list. The register is "get involved", and the reader ADR-0453 D2
// names — an experienced developer who has just watched a system prove itself — is a potential
// collaborator rather than a mailing-list subscriber.
//
// ⚠ NOTHING IS CAPTURED, BY ANY MECHANISM (ADR-0493 D2/D3). No form, no endpoint, no email address
// on the page, no third-party script, no analytics and no click counter. One outbound hyperlink.
// ADR-0299's static-output and no-live-connection boundaries stand verbatim and this does not test
// them: if an implementation here ever finds itself adding a `fetch`, a form action or an embed, it
// has left the decision. We consequently cannot tell how many people reach this — only how many
// write — and ADR-0493 D5 accepts that knowingly. Do not "fix" it with tracking.
//
// ── WHY IT IS BUILT AT RUNTIME RATHER THAN WRITTEN INTO THE MARKUP ──────────────────────────────
//
// Everything here is created by `mountAsk` and nothing is hidden by the base stylesheet, which is
// the same no-script property `forest-growth` and TELL's controls lock hold and one door further
// along. A markup element hidden by default and revealed by script would be invisible to exactly the
// visitors whose script never runs — and those visitors get the whole forest as a static dated
// picture today, so they are people the site genuinely serves rather than a rounding error.
//
// They are not left without an ending either: the calm view carries the same link in its own markup,
// where no script is involved at all. Two routes to one destination, each honest on its own path.
//
// ⚠ AND IT IS OUTSIDE THE TIMED SEQUENCE, WHICH IS A COMPOSITION CHOICE WORTH STATING. Putting the
// ending inside TELL would have spent its characters against the reading budget — on a sequence the
// owner already has an open question about the LENGTH of — and would have flashed the one thing on
// the page a visitor might act on for about five seconds before taking it away. It is revealed when
// TELL finishes and then STAYS, through ROAM and for as long as the visitor is on the map, because
// the moment somebody decides to reach out is while they are turning the thing over, not during the
// pitch. It costs the sequence nothing.
//
// ⚠ THIS MODULE IS PURE UNTIL `mountAsk` IS CALLED. Nothing at module scope touches `document`, so
// the copy and the destination are importable under `bun test`, which has no DOM.
// ---------------------------------------------------------------------------

/**
 * The one destination (ADR-0493 D1), verbatim from the owner, 2026-09-01: *"you can point them to my
 * linkedin account https://www.linkedin.com/in/mick-hua-353353a/ so they can reach out if they want
 * to get involved."*
 *
 * ⚠ EXPORTED SO ONE VALUE SERVES BOTH ROUTES AND THE TEST. The calm view carries the same link in
 * markup, so this is asserted against `index.astro` rather than being trusted to match it — a
 * contact link that is right in one place and mistyped in the other is a defect nothing else on this
 * page can detect.
 */
export const ASK_HREF = 'https://www.linkedin.com/in/mick-hua-353353a/';

/**
 * The ending's copy.
 *
 * ⚠ EVERY WORD HERE IS FENCED TWICE. It is visitor-facing prose, so `vocabulary.test.ts` holds it to
 * the reader's nouns (ADR-0494 D5) — no story, no capability, no arc. And it is an ASK, so
 * `act2-ask.test.ts` holds it to ADR-0493 D4's register: it may not promise a follow-up, which in
 * practice means it may not contain the vocabulary of a mailing list.
 *
 * "One person, building in the open" is a fact about the project rather than a pitch, and it is what
 * makes the invitation legible: the reader has just been shown a system that proves its own work,
 * and the honest next sentence is how small the thing behind it is.
 */
export const ASK_LINE = 'One person, building this in the open.';
export const ASK_CTA = 'Want in? Say hello on LinkedIn';

/**
 * Phrases that would turn this from an invitation into a promise (ADR-0493 D4/D5).
 *
 * ⚠ THE POINT IS NOT THAT THESE WORDS ARE UGLY. It is that we hold no list, so a page that says
 * "we'll let you know" is describing a system that does not exist and that nobody is on the hook to
 * build. The open question this ending settles was FRAMED as a waitlist and the owner declined all
 * four capture routes; the drift back is a single word away, and it would read perfectly.
 */
export const ASK_FORBIDDEN = [
  'waitlist',
  'wait list',
  'sign up',
  'signup',
  'notify',
  'keep you posted',
  "we'll let you know",
  'early access',
  'join the list',
  'subscribe',
] as const;

export interface AskOptions {
  /** The land layer the ending mounts into (`#storm-land`) — the same host TELL and ROAM use. */
  readonly host: HTMLElement;
}

export interface AskHandle {
  /** Show the ending. Idempotent: TELL's `finish` runs once, but a caller that also reveals on a
   *  skip must not be able to mount two of these. */
  reveal(): void;
  unmount(): void;
}

/**
 * Build the ending, hidden until `reveal()`.
 *
 * The element exists from mount so the reveal is one class rather than a construction — the same
 * reason TELL's layer is mounted through its own lead-in — but nothing is visible and nothing is
 * focusable until it is revealed, so it cannot be tabbed into from behind the prose.
 */
export function mountAsk(opts: AskOptions): AskHandle {
  const { host } = opts;

  const layer = document.createElement('div');
  layer.className = 'ask-layer';
  layer.setAttribute('data-act2-ask', '');

  const line = document.createElement('p');
  line.className = 'ask-line';
  line.textContent = ASK_LINE;

  const link = document.createElement('a');
  link.className = 'ask-link';
  link.href = ASK_HREF;
  link.textContent = `${ASK_CTA} →`;
  link.target = '_blank';
  // `noreferrer` as well as `noopener`: it is the privacy-preserving default, and it costs us only
  // the one thing ADR-0493 D5 already accepts losing — knowing how many people arrived from here.
  link.rel = 'noopener noreferrer';
  // Out of the tab order until it is shown. A link behind an invisible layer that a keyboard can
  // still reach is the ROAM-hit-rect problem the controls lock met, one surface along.
  link.tabIndex = -1;

  layer.append(line, link);
  host.append(layer);

  let shown = false;
  return {
    reveal(): void {
      if (shown) return;
      shown = true;
      layer.classList.add('is-on');
      link.tabIndex = 0;
    },
    unmount(): void {
      layer.remove();
    },
  };
}
