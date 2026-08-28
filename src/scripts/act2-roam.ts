// ---------------------------------------------------------------------------
// ROAM — the visitor explores the real forest, and WE ARE QUIET.
//
// Chapter 2's four movements are GROW · TELL · ROAM · ASK, and each name says who is driving
// (`storytree library artifact grow-tell-roam-ask`). GROW settles the real forest at its designed
// resting frame. TELL speaks over it for about a minute and gets out of the way. This is what is
// left standing: a map, and a visitor who can now ask it things.
//
// ── WHY A MODULE THAT SHOWS PROSE IS NOT A SECOND TELL ──────────────────────────────────────────
//
// "TELL is the only movement that speaks" is the fence, and the thing it forbids is SPEAKING —
// volunteering sentences on our own clock, over a map the visitor did not ask about. Nothing here
// is on a clock. Every sentence below exists only after a click, stays until the reader dismisses
// it, and is never scheduled, never advanced, and never taken away. That is the push/pull split
// `the-reader-chooses-the-thread-and-the-depth` draws: triage is pushed, investigation is pulled,
// and this whole module lives on the pulled side.
//
// The practical test, and it is the one to apply to any future edit here: could this text appear
// while the visitor is doing nothing? If yes, it has drifted into TELL and belongs there or nowhere.
//
// ── THE THREE RULES EVERY PANEL LINE OBEYS ──────────────────────────────────────────────────────
//
// 1. **IT IS TRUE OF THE THING THAT WAS CLICKED, READ LIVE.** No count is written into the copy;
//    every one comes from `data-forest-roam`, the build-time payload emitted beside the picture by
//    the SAME fold that painted it (`forest-snapshot-map.ts`'s `roamPayload`). The status a panel
//    reports is the status the island is coloured with — one value, two consumers — so a panel
//    that flatters an island is not something this file can express. In particular: a story that
//    is NOT proven is said, in words, to be not proven, and the island that is this website is the
//    first one a visitor is likely to click.
//
// 2. **IT IS A READING OF A DATED PICTURE, NEVER A LIVE FEED.** The forest is a snapshot. Present
//    tense about the SYSTEM ("this is being built right now") would turn a stamped export into a
//    false live reading — the same reason wisps were excluded from it (ADR-0453 D5). So the panel
//    carries the snapshot's own date in its footer, once, and the one status whose meaning is
//    inherently in-flight (`building`) is phrased in the past: it was mid-build when the picture
//    was taken.
//
// 3. **IT EXPLAINS ONLY WHAT THE MAP ALREADY ASSERTS.** Islands are stories, trails are
//    `depends_on` edges, the colour is the folded status, and inside a story are its capabilities.
//    Nothing here invents a vocabulary the map does not carry. There is deliberately no explanation
//    of terrain or props on this surface, because the published snapshot draws neither: the
//    territories go out with `plants: []` and no wisps, so a sentence about them would be a
//    sentence about a picture that is not on the screen.
//
// ── THE FIVE TARGETS, AND WHY THERE ARE FIVE ────────────────────────────────────────────────────
//
// The owner, 2026-08-26: *"i think roam is a choose your own adventure but doesn't have a long
// journey, if we think about it the user only has so many things they can click on."* The set is
// finite and confirmed, and it is a constraint rather than a starting point:
//
//   1. an ISLAND        → what a story is, and the panel opens
//   2. its COLOUR       → proven vs not-yet-proven, and what proven means here
//   3. INSIDE it        → what a capability is; and this is where the forest's floor lives
//   4. a TRAIL          → dependencies, what rests on what
//   5. the ARC drawer   → the initiative layer above the code   (NOT BUILT — see ROAM_ARC_ABSENT)
//
// One or two sentences each. The reader is an experienced developer confirming what they already
// suspect (ADR-0453 D2/D4), not a student being taught (D1).
//
// ⚠ THIS MODULE IS PURE UNTIL `mountRoam` IS CALLED. Nothing at module scope touches `document`, so
// the payload parsing, the copy and the status vocabulary are importable under `bun test`, which has
// no DOM. Same shape as `act2-tell.ts`, for the same reason.
// ---------------------------------------------------------------------------

// ── the payload ─────────────────────────────────────────────────────────────

/** The statuses the export can fold to — the same set `toSceneStatus` produces and the same set the
 *  island's `st-*` class is built from. Duplicated as a literal union rather than imported from the
 *  engine so this module stays free of the render core. */
export type RoamStatus = 'healthy' | 'mapped' | 'proposed' | 'building' | 'unhealthy' | 'unknown';

const STATUSES: readonly RoamStatus[] = [
  'healthy',
  'mapped',
  'proposed',
  'building',
  'unhealthy',
  'unknown',
];

export interface RoamCapability {
  readonly id: string;
  readonly title: string;
  readonly status: RoamStatus;
}

export interface RoamStory {
  readonly id: string;
  readonly title: string;
  readonly status: RoamStatus;
  readonly capabilities: readonly RoamCapability[];
}

export interface RoamPayload {
  /** The snapshot's own date, already formatted — the same string the page's stamp prints. */
  readonly asOf: string;
  readonly stories: readonly RoamStory[];
}

/** Narrow an unknown status string, defaulting to `unknown`. A status this site has no reading for
 *  must surface as "we do not know" rather than silently borrowing a reading we do have — the same
 *  rule `toSceneStatus` applies to the colour. */
export function toRoamStatus(raw: unknown): RoamStatus {
  return typeof raw === 'string' && (STATUSES as readonly string[]).includes(raw)
    ? (raw as RoamStatus)
    : 'unknown';
}

/**
 * Parse the `data-forest-roam` payload off the rendered map.
 *
 * Returns null rather than throwing or defaulting, and the caller then does not mount ROAM at all.
 * A panel that opened on invented facts would read perfectly and be wrong invisibly, which is the
 * one failure this whole surface exists to avoid; a map with no panel is merely a map.
 */
export function parseRoamPayload(raw: string | null): RoamPayload | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { asOf, stories } = parsed as Record<string, unknown>;
  if (typeof asOf !== 'string' || asOf.length === 0) return null;
  if (!Array.isArray(stories) || stories.length === 0) return null;

  const out: RoamStory[] = [];
  for (const entry of stories) {
    if (typeof entry !== 'object' || entry === null) return null;
    const s = entry as Record<string, unknown>;
    if (typeof s.id !== 'string' || typeof s.title !== 'string') return null;
    const rawCaps = Array.isArray(s.capabilities) ? s.capabilities : [];
    const capabilities: RoamCapability[] = [];
    for (const c of rawCaps) {
      if (typeof c !== 'object' || c === null) continue;
      const cap = c as Record<string, unknown>;
      if (typeof cap.id !== 'string' || typeof cap.title !== 'string') continue;
      capabilities.push({ id: cap.id, title: cap.title, status: toRoamStatus(cap.status) });
    }
    out.push({ id: s.id, title: s.title, status: toRoamStatus(s.status), capabilities });
  }
  return { asOf, stories: out };
}

// ── the copy ────────────────────────────────────────────────────────────────

/**
 * What a status MEANS, in the visitor's words.
 *
 * ⚠ EVERY BRANCH SHIPS AND THE DATA PICKS ONE — the same rule as TELL's self-clause, for the same
 * reason. Today's corpus contains only `healthy` and `proposed` stories, so four of these six never
 * fire; writing only the two that do would leave a panel with no reading the day one of the others
 * arrives, and the failure would be silent because the island would still be painted.
 *
 * ⚠ `unhealthy` IS DELIBERATELY NOT SOFTENED. A map that only knows how to say nice things is a
 * brochure. It has never once occurred in this corpus — the gate refuses red work from reaching
 * trunk — but it stays in the vocabulary because it becomes real the moment storytree maps a
 * brownfield system it did not build (ADR-0453 D10), and the sentence it will need then is the one
 * written here, not a kinder one written under pressure later.
 *
 * ⚠ `building` IS PAST TENSE ON PURPOSE. It is the one reading whose plain present tense would
 * describe a live system rather than a dated picture.
 */
export const STATUS_READING: Readonly<Record<RoamStatus, { word: string; sentence: string }>> = {
  healthy: {
    word: 'proven',
    sentence:
      'Green means a signed verdict proved it. Nothing goes green here because somebody marked it done.',
  },
  proposed: {
    word: 'not yet proven',
    sentence: 'Nothing has signed it off, so the map does not say otherwise.',
  },
  mapped: {
    word: 'mapped, not yet proven',
    sentence: 'Its shape is written down. No verdict has been signed against it.',
  },
  building: {
    word: 'part-way built',
    sentence: 'It was mid-build when this picture was taken.',
  },
  unhealthy: {
    word: 'failing',
    sentence: 'A signed verdict came back failing, and the map says so rather than hiding it.',
  },
  unknown: {
    word: 'unknown',
    sentence: 'Its record did not load, so the map does not guess at a colour.',
  },
};

/**
 * The five targets' prose.
 *
 * ⚠ `grounds` IS READ BY A GATE RUNG IN THE PARENT REPO. `check:web-grounding` extracts the quoted
 * ids straight out of these array literals and resolves each against the LIVE decision log, so a
 * claim resting on a decision that has been superseded reds the gate and names this file. Keep the
 * field called `grounds` and keep the ids as quoted literals in an array — that literal shape is
 * what the rung matches on. (The runtime writes them into `data-grounds` on the rendered block, so
 * the citation is discoverable from the page as well as from the source.)
 */
export interface RoamNote {
  readonly id: string;
  readonly lines: readonly string[];
  readonly grounds?: readonly string[];
}

export const ROAM_STORY_NOTE: RoamNote = {
  id: 'story',
  lines: ['An island is one story — one thing this system does.'],
  grounds: ['ADR-0002'],
};

export const ROAM_COLOUR_NOTE: RoamNote = {
  id: 'colour',
  lines: ['The colour is not a label somebody chose. It is what the proof record says.'],
  grounds: ['ADR-0040'],
};

export const ROAM_CAPABILITY_NOTE: RoamNote = {
  id: 'capability',
  lines: ['A capability is one organ of that story, proven on its own.'],
  grounds: ['ADR-0010'],
};

export const ROAM_TRAIL_NOTE: RoamNote = {
  id: 'trail',
  lines: ['A trail is a dependency. It runs from the thing that is needed to the thing that needs it.'],
  grounds: ['ADR-0010'],
};

/**
 * The second sentence a MERGED trunk needs, and only a merged trunk.
 *
 * ⚠ MEASURED ON THE SHIPPED MAP RATHER THAN GUESSED. The router draws trails that run the same way
 * as ONE line: across the 118 segments the site ships, the median carries 4 dependencies, 43 carry
 * more than 6, and the busiest carries 33 from 11 different sources. So "why does this one line
 * mean thirty-three things?" is a question a visitor will genuinely have, and it has a one-sentence
 * answer. A single-dependency trail gets no extra sentence, because it raises no question.
 */
export const ROAM_TRUNK_LINE =
  'Trails that run the same way are drawn as one, so a busy stretch carries several.';

/** How many dependency sentences a trail panel prints before it stops and says how many are left.
 *  ROAM is a short journey; a panel that prints 33 long sentences is a document. */
export const TRAIL_LIST_CAP = 4;

/** The note a trail panel shows — one sentence for a plain trail, two for a merged trunk. */
export function trailNote(edges: readonly RoamEdge[]): RoamNote {
  return edges.length <= 1
    ? ROAM_TRAIL_NOTE
    : { ...ROAM_TRAIL_NOTE, lines: [...ROAM_TRAIL_NOTE.lines, ROAM_TRUNK_LINE] };
}

/**
 * The honest tail of a truncated list, or null when nothing was left out.
 *
 * ⚠ THE COUNT IS WHAT MAKES THE TRUNCATION HONEST. A list that simply stops looks complete, which
 * would make the panel understate a hub — the exact opposite of what a dependency view is for. The
 * heading already carries the true total; this says plainly how much of it is not on screen.
 */
export function trailOverflow(edges: readonly RoamEdge[]): string | null {
  const hidden = edges.length - TRAIL_LIST_CAP;
  return hidden <= 0 ? null : `…and ${hidden} more along the same stretch.`;
}

/**
 * THE FLOOR — and it is a door, not a wall (ADR-0453 D6).
 *
 * The public map stops at the capability tree. Below it are the tests, the decisions and the code,
 * and those are the app's. The clause that matters is the second sentence: the floor is the
 * conversion point, arriving exactly when the visitor has demonstrated they want more depth, and
 * rendering it as a dead end would be the failure. It does not promise a download — there is no
 * product to hand anyone yet (D9), and the site's own ending is where that is said.
 */
export const ROAM_FLOOR_NOTE: RoamNote = {
  id: 'floor',
  lines: [
    'This is as deep as the public map goes.',
    'Under a capability sit its tests, the decisions behind it and the code — that is what the app opens.',
  ],
  grounds: ['ADR-0453'],
};

/**
 * ⚠ TARGET 5, THE ARC DRAWER, IS NOT BUILT — and this constant is here so that absence is a stated
 * fact rather than something a later reader has to infer from silence.
 *
 * The published snapshot carries stories and capabilities and nothing else: there is no arc in
 * `data-forest-roam`, because there is none in `src/data/forest-snapshot.json`, because the
 * exporter one repo up does not put one there. Shipping the drawer therefore is not a website
 * change at all — it is an export change (a new field, a schema-version bump, a re-publish), and
 * it must come through that path rather than through a second join, because ADR-0453 D12's closing
 * line puts the arc surface behind exactly the same D7 fence the forest is behind.
 *
 * Faking it here — hard-coding an arc, or deriving one from story ids — would have produced a
 * drawer that looked finished and asserted something the map never read.
 */
export const ROAM_ARC_ABSENT =
  'the arc surface is not in the published snapshot; shipping it is an exporter change (ADR-0453 D12 + D7)';

/** Every line of prose this module can put on the page. The test holds the "one or two sentences"
 *  bar against this list, so a note added later is covered without anyone remembering to add it. */
export const ROAM_NOTES: readonly RoamNote[] = [
  ROAM_STORY_NOTE,
  ROAM_COLOUR_NOTE,
  ROAM_CAPABILITY_NOTE,
  ROAM_TRAIL_NOTE,
  ROAM_FLOOR_NOTE,
];

// ── reading the map's own facts ─────────────────────────────────────────────

/** How many of a story's capabilities are proven, counted from the payload rather than stated. */
export function provenCount(story: RoamStory): number {
  return story.capabilities.filter((c) => c.status === 'healthy').length;
}

/** "6 capabilities, 4 proven" — or the singular, or the honest "none recorded". Every number here
 *  is counted from the payload at render time; none is ever written into copy. */
export function capabilityTally(story: RoamStory): string {
  const total = story.capabilities.length;
  if (total === 0) return 'no capabilities recorded';
  const noun = total === 1 ? '1 capability' : `${total} capabilities`;
  return `${noun}, ${provenCount(story)} proven`;
}

/** One dependency edge, as the trail metadata encodes it: `from` is depended ON, `to` depends on it. */
export interface RoamEdge {
  readonly from: string;
  readonly to: string;
}

/**
 * Parse a trail segment's `data-edges` — the comma-separated `from->to` list the scene emits.
 *
 * ⚠ ONE SEGMENT CARRIES MANY EDGES, AND THAT IS THE POINT OF THE TRAIL NETWORK RATHER THAN A QUIRK.
 * Routed trails MERGE: a trunk that seven dependencies share is drawn once and stamped with all
 * seven. Measured on the shipped map, the busiest segment carries seven. So a panel opened from a
 * trunk reports what that trunk actually carries — reducing it to one edge would be picking a
 * favourite, and picking one silently would make the panel disagree with the line under the cursor.
 */
export function parseTrailEdges(raw: string | null): readonly RoamEdge[] {
  if (raw === null) return [];
  const out: RoamEdge[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const key = part.trim();
    if (key.length === 0 || seen.has(key)) continue;
    const arrow = key.indexOf('->');
    if (arrow <= 0 || arrow + 2 >= key.length) continue;
    seen.add(key);
    out.push({ from: key.slice(0, arrow), to: key.slice(arrow + 2) });
  }
  return out;
}

/**
 * A story's NAME, without the description that follows it.
 *
 * ⚠ MEASURED, NOT A STYLE PREFERENCE. Story titles in this corpus are a short name, a separator and
 * then a sentence explaining the story — "The agent runtime — the swappable leaf behind the
 * PhaseAuthor seam". Read whole on both sides of a dependency, that produced sentences of over 200
 * characters, five to a panel: a document, not a click. Across the 35 published stories the head
 * alone averages 34 characters against the full title's 80, and 25 of the 35 carry a separator; the
 * ten that do not are returned unchanged rather than truncated, because cutting a name mid-word is
 * worse than a long one.
 *
 * The story PANEL still shows the full title — there the description is the point. This is for the
 * trail list, where the reader is scanning a relationship rather than reading about a story.
 */
export function shortStoryTitle(title: string): string {
  for (const sep of [' — ', ' – ', ' - ', ': ']) {
    const at = title.indexOf(sep);
    if (at > 0) return title.slice(0, at);
  }
  return title;
}

/**
 * The longest a story's NAME may be before a dependency sentence stops reading as a relation.
 *
 * ⚠ MEASURED ON THE PUBLISHED CORPUS. 24 of the 35 stories are titled "name — description"; the
 * other 11 are titled with a whole sentence and have no name to take, so their head IS the sentence
 * ("The app-guide concierge wires a newcomer's Claude Code into the observability layer"). Put on
 * both sides of "needs", those produce lines where the relation is invisible: "The forest wisp IS
 * the claim needs The agent runtime." At 36 characters exactly those 11 fall back and the other 24
 * keep their names, which is the split the data actually has.
 */
export const NAME_MAX = 36;

/**
 * What to call a story in a dependency sentence: its name, or — when the title carries no name —
 * THE ID, which is precisely what the island's own nameplate on the map says.
 *
 * ⚠ THE FALLBACK IS NOT A TRUNCATION, and that is the point. Cutting a title mid-phrase invents a
 * name nothing on the page shows. The id is already printed under the island the reader is looking
 * at, so it is the one short label that lets them follow the sentence back to the picture.
 */
export function edgeName(id: string, titleOf: (storyId: string) => string): string {
  const name = shortStoryTitle(titleOf(id));
  return name.length > NAME_MAX ? id : name;
}

/** "X needs Y", in the names the map itself shows — the same relation the trail's own `<title>`
 *  carries, built from the ids so a story missing from the payload degrades to its id, never blank. */
export function edgeSentence(edge: RoamEdge, titleOf: (id: string) => string): string {
  return `${edgeName(edge.to, titleOf)} needs ${edgeName(edge.from, titleOf)}.`;
}

/** The heading a trail panel gets: singular when the trail carries one dependency, counted when it
 *  carries several. The count is the length of what was parsed, never a written number. */
export function trailHeading(edges: readonly RoamEdge[]): string {
  return edges.length === 1 ? 'One dependency runs along this trail' : `${edges.length} dependencies run along this trail`;
}

// ── the DOM half ────────────────────────────────────────────────────────────
//
// Everything below touches `document` and is only reached through `mountRoam`. The pure half above
// is what `act2-roam.test.ts` exercises; this half is thin on purpose — it routes a click and
// renders a state, it does not decide what is true.

/** What ROAM needs from the map underneath it. Narrow on purpose, so the test never needs an SVG
 *  and this module never reaches into `forest-arrival`'s internals. */
export interface RoamOptions {
  /** The land layer the panel mounts into (`#storm-land`). */
  readonly host: HTMLElement;
  /** The rendered forest `<svg>` — the click surface, and where the payload is read from. */
  readonly map: Element;
}

export interface RoamHandle {
  unmount(): void;
}

/** How far a pointer may travel between down and up and still count as a CLICK rather than a PAN.
 *  The same gesture drives both — `forest-arrival` is dragging the viewBox the whole time — so the
 *  two are told apart by distance, not by which listener got there first. */
const CLICK_SLOP_PX = 5;
/** And how long. A press held still for a second is a reader deciding, not a reader picking. */
const CLICK_MAX_MS = 700;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== '') node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Render one note as a block, stamping its citations into the DOM so the claim is discoverable
 *  from the page as well as from the source. */
function noteBlock(note: RoamNote): HTMLElement {
  const block = el('div', 'roam-note');
  block.setAttribute('data-roam-note', note.id);
  if (note.grounds !== undefined && note.grounds.length > 0) {
    block.setAttribute('data-grounds', note.grounds.join(','));
  }
  for (const line of note.lines) block.append(el('p', 'roam-line', line));
  return block;
}

/** A status dot plus its word — the panel's smallest honest unit, and the only place a colour is
 *  turned into language. The class is the SAME `st-*` vocabulary the island carries. */
function statusChip(status: RoamStatus): HTMLElement {
  const wrap = el('span', 'roam-chip');
  const dot = el('span', `roam-dot st-${status}`);
  dot.setAttribute('aria-hidden', 'true');
  wrap.append(dot, el('span', 'roam-chip-word', STATUS_READING[status].word));
  return wrap;
}

/**
 * Mount ROAM over the settled forest.
 *
 * ⚠ IT MOUNTS AT THE SAME MOMENT THE FOREST DOES, NOT AFTER TELL FINISHES — and that is a design
 * decision rather than a convenience. A visitor who reaches for the map during TELL has already
 * taken it over (`forest-arrival` stops the sequence on their first gesture); making them then wait
 * out the rest of a minute before a click did anything would be the sequence holding on to them,
 * which is precisely what TELL's own skip exists to prevent. So ROAM is simply live, from the first
 * frame, and it adds NOTHING to the timed sequence: no beat, no delay, no clock.
 *
 * ⚠ THE PANEL STARTS CLOSED AND STAYS CLOSED UNTIL A CLICK. That is the whole of "we are quiet".
 */
export function mountRoam(opts: RoamOptions): RoamHandle {
  const { host, map } = opts;
  const inert: RoamHandle = { unmount(): void {} };

  const payload = parseRoamPayload(map.getAttribute('data-forest-roam'));
  if (payload === null) return inert;
  const byId = new Map(payload.stories.map((s) => [s.id, s]));
  const titleOf = (id: string): string => byId.get(id)?.title ?? id;

  // ── the panel shell ───────────────────────────────────────────────────────
  const panel = el('aside', 'roam-panel');
  panel.setAttribute('data-act2-roam', '');
  panel.setAttribute('aria-live', 'polite');
  panel.hidden = true;
  const close = el('button', 'roam-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  const body = el('div', 'roam-body');
  // The snapshot's own date, on every panel, once. Without it a sentence in the present tense about
  // a story's state reads as a live feed — the single way a stamped export backfires.
  const stamp = el('p', 'roam-stamp', `read from the snapshot of ${payload.asOf}`);
  panel.append(close, body, stamp);

  let openSection: 'colour' | 'inside' | null = null;
  let openStoryId: string | null = null;

  /** The witness hook. It reports WHICH panel is open, never what it says — a probe that read its
   *  copy from here would be reading the module's own intention rather than the page's text, and
   *  an expectation derived from its subject cannot fail. The text is read off the DOM. */
  const witness = (kind: string, subject: string | null): void => {
    (window as unknown as Record<string, unknown>).__act2roam = {
      kind,
      subject,
      section: openSection,
    };
  };

  const shut = (): void => {
    panel.hidden = true;
    body.replaceChildren();
    openSection = null;
    openStoryId = null;
    host.classList.remove('roam-open');
    for (const isle of map.querySelectorAll('.roam-selected')) {
      isle.classList.remove('roam-selected');
    }
    witness('none', null);
  };

  /** Ring the thing the panel is talking about, so the sentence and the shape are joined on screen.
   *  Selection is a CLASS on the already-rendered element — nothing is drawn, nothing is moved. */
  const select = (selector: string): void => {
    for (const prev of map.querySelectorAll('.roam-selected')) prev.classList.remove('roam-selected');
    for (const node of map.querySelectorAll(selector)) node.classList.add('roam-selected');
  };

  const openPanel = (): void => {
    panel.hidden = false;
    host.classList.add('roam-open');
  };

  // ── target 1 · an island, and targets 2 and 3 nested inside it ────────────
  const renderStory = (story: RoamStory): void => {
    body.replaceChildren();
    body.append(el('p', 'roam-kind', 'story'));
    body.append(el('h3', 'roam-title', story.title));
    body.append(el('p', 'roam-id', story.id));
    body.append(noteBlock(ROAM_STORY_NOTE));

    // target 2 · its colour
    const colourRow = el('button', 'roam-row');
    colourRow.type = 'button';
    colourRow.setAttribute('data-roam-row', 'colour');
    colourRow.setAttribute('aria-expanded', String(openSection === 'colour'));
    colourRow.append(statusChip(story.status));
    body.append(colourRow);
    if (openSection === 'colour') {
      // The reading of THIS island's own status, chosen by the data — never written down.
      const note: RoamNote = {
        id: 'colour',
        lines: [STATUS_READING[story.status].sentence, ...ROAM_COLOUR_NOTE.lines],
        ...(ROAM_COLOUR_NOTE.grounds === undefined ? {} : { grounds: ROAM_COLOUR_NOTE.grounds }),
      };
      body.append(noteBlock(note));
    }

    // target 3 · inside the island
    const insideRow = el('button', 'roam-row');
    insideRow.type = 'button';
    insideRow.setAttribute('data-roam-row', 'inside');
    insideRow.setAttribute('aria-expanded', String(openSection === 'inside'));
    insideRow.append(el('span', 'roam-row-word', capabilityTally(story)));
    body.append(insideRow);
    if (openSection === 'inside') {
      body.append(noteBlock(ROAM_CAPABILITY_NOTE));
      const list = el('ul', 'roam-caps');
      for (const cap of story.capabilities) {
        const item = el('li', 'roam-cap');
        item.append(statusChip(cap.status), el('span', 'roam-cap-title', cap.title));
        list.append(item);
      }
      if (story.capabilities.length > 0) body.append(list);
      // the floor — a door rather than a wall, and it arrives exactly here, at the moment the
      // visitor has clicked their way to the bottom of what the public map holds.
      body.append(noteBlock(ROAM_FLOOR_NOTE));
    }
    openPanel();
    witness('story', story.id);
  };

  const openStory = (id: string): void => {
    const story = byId.get(id);
    if (story === undefined) return;
    if (openStoryId !== id) openSection = null;
    openStoryId = id;
    select(`.tw-isle[data-id="${CSS.escape(id)}"], .tw-ground[data-id="${CSS.escape(id)}"]`);
    renderStory(story);
  };

  // ── target 4 · a trail between islands ────────────────────────────────────
  const openTrail = (segmentId: string, rawEdges: string | null): void => {
    const edges = parseTrailEdges(rawEdges);
    if (edges.length === 0) return;
    openStoryId = null;
    openSection = null;
    // Every pass of the SAME routed segment lights, so the reader sees the line they clicked rather
    // than a hairline inside it.
    select(`[data-id="${CSS.escape(segmentId)}"]`);
    body.replaceChildren();
    body.append(el('p', 'roam-kind', 'trail'));
    body.append(el('h3', 'roam-title', trailHeading(edges)));
    body.append(noteBlock(trailNote(edges)));
    const list = el('ul', 'roam-edges');
    for (const edge of edges.slice(0, TRAIL_LIST_CAP)) {
      list.append(el('li', 'roam-edge', edgeSentence(edge, titleOf)));
    }
    body.append(list);
    const overflow = trailOverflow(edges);
    if (overflow !== null) body.append(el('p', 'roam-more', overflow));
    openPanel();
    witness('trail', segmentId);
  };

  // ── routing a gesture ─────────────────────────────────────────────────────
  //
  // ⚠ THE MAP IS BEING DRAGGED BY SOMEBODY ELSE AT THE SAME TIME. `forest-arrival` binds pan and
  // zoom to this same element and calls `setPointerCapture`, which RETARGETS every later pointer
  // event to the `<svg>` root — so the element under the finger is only knowable at `pointerdown`.
  // It is captured there and used at `pointerup`; reading `e.target` on the up event would resolve
  // to the map every time and route every click to "nothing".
  let downTarget: Element | null = null;
  let downX = 0;
  let downY = 0;
  let downAt = 0;

  const onDown = (e: Event): void => {
    const pe = e as PointerEvent;
    if (pe.button !== 0) return;
    downTarget = pe.target instanceof Element ? pe.target : null;
    downX = pe.clientX;
    downY = pe.clientY;
    downAt = pe.timeStamp;
  };

  const onUp = (e: Event): void => {
    const pe = e as PointerEvent;
    const target = downTarget;
    downTarget = null;
    if (target === null) return;
    if (Math.abs(pe.clientX - downX) > CLICK_SLOP_PX) return;
    if (Math.abs(pe.clientY - downY) > CLICK_SLOP_PX) return;
    if (pe.timeStamp - downAt > CLICK_MAX_MS) return;
    route(target);
  };

  /** One element under the pointer → one panel. Islands win over trails because the hit layer is
   *  drawn last and therefore receives the event first; that ordering is the scene's, not ours. */
  const route = (target: Element): void => {
    const hit = target.closest('.tw-hit');
    const id = hit?.getAttribute('data-id') ?? null;
    if (id !== null) {
      openStory(id);
      return;
    }
    const seg = target.closest('[data-edges]');
    if (seg !== null) {
      const segId = seg.getAttribute('data-id');
      if (segId !== null) {
        openTrail(segId, seg.getAttribute('data-edges'));
        return;
      }
    }
    shut();
  };

  /** The hit rects already carry `tabindex` and `role="button"` from the scene, so keyboard reach is
   *  the engine's; making them ANSWER is ours. Without this the focus ring lands on 35 buttons that
   *  do nothing, which is worse than no keyboard route at all. */
  //
  // ⚠ ESCAPE IS DELIBERATELY NOT BOUND HERE. It is chapter 1's never-stranded exit — it disarms the
  // whole experience and lands the visitor on the static fallback — so a panel that also consumed it
  // would give one key two meanings, and the one it would shadow is the accessibility route. Closing
  // the panel is the × button, or a click on open water. Measured: with Escape bound, the browser
  // probe found the panel not merely closed but GONE, because the storm had torn chapter 2 down
  // underneath it.
  const onKey = (e: Event): void => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Enter' && ke.key !== ' ') return;
    const target = ke.target;
    if (!(target instanceof Element)) return;
    const hit = target.closest('.tw-hit');
    const id = hit?.getAttribute('data-id') ?? null;
    if (id === null) return;
    ke.preventDefault();
    openStory(id);
  };

  const onPanelClick = (e: Event): void => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.roam-close') !== null) {
      shut();
      return;
    }
    const row = target.closest('[data-roam-row]');
    const which = row?.getAttribute('data-roam-row') ?? null;
    if (which !== 'colour' && which !== 'inside') return;
    openSection = openSection === which ? null : which;
    if (openStoryId !== null) {
      const story = byId.get(openStoryId);
      if (story !== undefined) renderStory(story);
    }
  };

  map.addEventListener('pointerdown', onDown);
  map.addEventListener('pointerup', onUp);
  map.addEventListener('pointercancel', onUp);
  map.addEventListener('keydown', onKey);
  panel.addEventListener('click', onPanelClick);
  host.addEventListener('keydown', onKey);

  host.append(panel);
  witness('none', null);

  return {
    unmount(): void {
      map.removeEventListener('pointerdown', onDown);
      map.removeEventListener('pointerup', onUp);
      map.removeEventListener('pointercancel', onUp);
      map.removeEventListener('keydown', onKey);
      host.removeEventListener('keydown', onKey);
      panel.removeEventListener('click', onPanelClick);
      for (const node of map.querySelectorAll('.roam-selected')) {
        node.classList.remove('roam-selected');
      }
      host.classList.remove('roam-open');
      panel.remove();
      delete (window as unknown as Record<string, unknown>).__act2roam;
    },
  };
}
