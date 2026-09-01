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
//   5. the ARC drawer   → the initiative layer above the code — why this island exists at all
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

/** The states a UAT leg's own signed verdict folds to. */
export type RoamUatState = 'proven' | 'pending' | 'failing';
const UAT_STATES: readonly RoamUatState[] = ['proven', 'pending', 'failing'];

/** Who witnesses a leg: a harness the spine owns, a person, or either. */
export type RoamWitness = 'machine' | 'human' | 'either';
const WITNESSES: readonly RoamWitness[] = ['machine', 'human', 'either'];

/**
 * ONE STEP OF THE STORY'S ACCEPTANCE JOURNEY — the public depth floor's new tier (ADR-0494 D1).
 *
 * The owner, 2026-09-01: *"it should show the capability tree and our uat tests, give them the
 * lot."* This is the level at which the map stops being a diagram and becomes evidence: the panel
 * above it says a story is proven, and this says what the proving consisted of.
 *
 * ⚠ NO ID AND NO BODY, AND NEITHER IS RETRIEVABLE FROM THIS REPO. The exporter publishes the
 * authored one-line title alone; a criterion's own id is a random hash no line renders, measured
 * and dropped upstream at 1.9 KB gzipped.
 */
export interface RoamUatCriterion {
  readonly title: string;
  readonly state: RoamUatState;
  readonly witness: RoamWitness;
}

export interface RoamStory {
  readonly id: string;
  readonly title: string;
  readonly status: RoamStatus;
  readonly capabilities: readonly RoamCapability[];
  /** The acceptance journey, IN AUTHORED ORDER. Empty is a real, designed state — measured
   *  2026-09-01, 11 of the 35 published stories declare no witnessable leg. */
  readonly uat: readonly RoamUatCriterion[];
  /** Decision numbers, keys into {@link RoamPayload.decisions}. Empty is a real state too. */
  readonly decisions: readonly number[];
  /** Arc ids, keys into {@link RoamPayload.arcs}. Empty is a real, designed state — see
   *  {@link ROAM_ARC_EMPTY}. */
  readonly arcs: readonly string[];
}

/**
 * ONE DECISION, at title-and-identity depth and no deeper (ADR-0494 D2).
 *
 * ⚠ THE BODY IS THE PROTECTION AND IT IS ABSENT UPSTREAM, exactly as arc prose is. The owner priced
 * this exposure himself — *"they can see adrs and other things is not line they can read them, even
 * if they read one or two its not a big issue"* — and what he priced was a stranger reading a
 * decision's NAME. A field added here would render blank; the fence lives in the exporter.
 *
 * Reached by NUMBER from both a story and an arc, so one decision has one record on the page.
 */
export interface RoamAdr {
  readonly number: number;
  readonly status: string;
  readonly title: string;
}

/**
 * ONE ARC — target 5's subject, at title-and-shape depth and no deeper (ADR-0453 D12).
 *
 * ⚠ THERE IS NO PROSE HERE AND THAT IS THE PROTECTION, not an omission this file could repair. The
 * forest above is safe to publish because it is illegible on purpose (D3) — a stranger reads `cli`
 * and learns nothing, and projects their own project onto the shape. **Arc titles are readable
 * English about strategy**, so D3's argument stops at this tier and what keeps it publishable is
 * that the bodies are not in the exported snapshot at all. A field added here would render blank,
 * because the exporter one repo up never wrote it.
 */
export interface RoamArc {
  readonly id: string;
  readonly title: string;
  readonly lifecycle: string;
  readonly incrementsClosed: number;
  readonly incrementsOpen: number;
  /** Decision numbers — the same keys a story's `decisions` uses, into the same registry. */
  readonly adrs: readonly number[];
}

export interface RoamPayload {
  /** The snapshot's own date, already formatted — the same string the page's stamp prints. */
  readonly asOf: string;
  readonly stories: readonly RoamStory[];
  /** Every arc a story reaches, id-sorted — normalised, so a hub arc appears once. */
  readonly arcs: readonly RoamArc[];
  /** Every decision a story or an arc names, number-sorted — normalised for the same reason, and
   *  more sharply: the 35 published stories make 211 citations over 117 distinct decisions. */
  readonly decisions: readonly RoamAdr[];
}

/** Narrow an unknown status string, defaulting to `unknown`. A status this site has no reading for
 *  must surface as "we do not know" rather than silently borrowing a reading we do have — the same
 *  rule `toSceneStatus` applies to the colour. */
export function toRoamStatus(raw: unknown): RoamStatus {
  return typeof raw === 'string' && (STATUSES as readonly string[]).includes(raw)
    ? (raw as RoamStatus)
    : 'unknown';
}

/** Narrow a leg's state, defaulting to `pending` — the reading that claims LEAST. A state this page
 *  has no reading for must never borrow `proven`, on the surface whose pitch is that green is earned. */
export function toRoamUatState(raw: unknown): RoamUatState {
  return typeof raw === 'string' && (UAT_STATES as readonly string[]).includes(raw)
    ? (raw as RoamUatState)
    : 'pending';
}

/** Narrow a leg's witness, defaulting to `either` — the parser's own default for an untagged leg, so
 *  an unreadable value reads as the weakest true claim rather than naming a person or a harness. */
export function toRoamWitness(raw: unknown): RoamWitness {
  return typeof raw === 'string' && (WITNESSES as readonly string[]).includes(raw)
    ? (raw as RoamWitness)
    : 'either';
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
  const bag = parsed as Record<string, unknown>;
  const { asOf, stories } = bag;
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
    const storyArcs = Array.isArray(s.arcs) ? s.arcs.filter((a): a is string => typeof a === 'string') : [];
    // ⚠ THE JOURNEY'S ORDER IS THE EXPORTER'S AND IS NEVER RE-SORTED HERE. A leg with no title is
    // skipped rather than rendered blank — the same asymmetry the arc tier draws below.
    const uat: RoamUatCriterion[] = [];
    for (const u of Array.isArray(s.uat) ? (s.uat as unknown[]) : []) {
      if (typeof u !== 'object' || u === null) continue;
      const leg = u as Record<string, unknown>;
      if (typeof leg.title !== 'string' || leg.title.length === 0) continue;
      uat.push({
        title: leg.title,
        state: toRoamUatState(leg.state),
        witness: toRoamWitness(leg.witness),
      });
    }
    const decisions = Array.isArray(s.decisions)
      ? s.decisions.filter((n): n is number => typeof n === 'number')
      : [];
    out.push({
      id: s.id,
      title: s.title,
      status: toRoamStatus(s.status),
      capabilities,
      uat,
      decisions,
      arcs: storyArcs,
    });
  }

  // ⚠ A MISSING ARC TIER IS TOLERATED, A MALFORMED ONE IS NOT — and the asymmetry is deliberate.
  // Absent means the drawer simply has nothing to open, which is the honest reading of a snapshot
  // taken before the arc layer existed. A record present but unreadable is the shape that would
  // render a drawer full of `undefined`, so it is dropped rather than half-drawn.
  const arcs: RoamArc[] = [];
  for (const entry of Array.isArray(bag.arcs) ? (bag.arcs as unknown[]) : []) {
    if (typeof entry !== 'object' || entry === null) continue;
    const a = entry as Record<string, unknown>;
    if (typeof a.id !== 'string' || typeof a.title !== 'string') continue;
    const adrs = Array.isArray(a.adrs)
      ? a.adrs.filter((n): n is number => typeof n === 'number')
      : [];
    arcs.push({
      id: a.id,
      title: a.title,
      lifecycle: typeof a.lifecycle === 'string' ? a.lifecycle : 'unknown',
      incrementsClosed: typeof a.incrementsClosed === 'number' ? a.incrementsClosed : 0,
      incrementsOpen: typeof a.incrementsOpen === 'number' ? a.incrementsOpen : 0,
      adrs,
    });
  }

  // The decision registry. A malformed record is dropped for the same reason a malformed arc is:
  // the number that names it simply resolves to nothing, and the panel says so rather than printing
  // a numbered blank.
  const decisions: RoamAdr[] = [];
  for (const entry of Array.isArray(bag.decisions) ? (bag.decisions as unknown[]) : []) {
    if (typeof entry !== 'object' || entry === null) continue;
    const d = entry as Record<string, unknown>;
    if (typeof d.number !== 'number' || typeof d.title !== 'string') continue;
    decisions.push({
      number: d.number,
      status: typeof d.status === 'string' ? d.status : 'unknown',
      title: d.title,
    });
  }
  return { asOf, stories: out, arcs, decisions };
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
 * TARGET 6 — THE PROOF: the acceptance journey, which is where the map stops being a diagram.
 *
 * ⚠ THIS IS THE POINT OF THE WHOLE SURFACE, not one more expandable row. Every sentence above it
 * asserts that the green is earned; this is the only place a stranger can check the assertion,
 * because it names the steps and shows the verdict signed against each one.
 *
 * ⚠ "ACCEPTANCE TEST", NOT "UAT CRITERION". The corpus's noun is a criterion and the reader's is an
 * acceptance test; visitor-facing prose speaks the reader's (ADR-0494 D5). The map's own labels are
 * untouched by that rule and stay our real, illegible ids.
 */
export const ROAM_UAT_NOTE: RoamNote = {
  id: 'uat',
  lines: [
    'An acceptance test is one step of the journey this piece has to complete end to end.',
    'Each one is signed off on its own, so a part-proven journey shows exactly which steps stand.',
  ],
  grounds: ['ADR-0082'],
};

/**
 * THE EMPTY STATE, WHICH IS A REAL STATE AND NOT AN ERROR — the same rule the arc drawer follows.
 *
 * Measured on the published snapshot, eleven of the islands declare no witnessable step at all. A
 * blank section there would read as a bug in the page, and a sentence inventing a cause ("it is too
 * small to need one") would be a claim nothing in the snapshot supports.
 */
export const ROAM_UAT_EMPTY: RoamNote = {
  id: 'uat-empty',
  lines: ['No acceptance test is recorded against this one.'],
};

/**
 * TARGET 7 — THE DECISIONS: why this piece is shaped the way it is.
 *
 * The owner, 2026-09-01, pricing the exposure himself: *"they can see adrs and other things is not
 * line they can read them, even if they read one or two its not a big issue."* What is reachable is
 * the NAME of a decision, never its reasoning — the bodies are not in the published file at all.
 */
export const ROAM_DECISION_NOTE: RoamNote = {
  id: 'decision',
  lines: [
    'A decision record is one architectural choice, written down when it was made and never rewritten.',
    'The map can name them. What each one argued is in the app.',
  ],
  grounds: ['ADR-0037'],
};

/** The honest empty for a piece that declares no deciding record. */
export const ROAM_DECISION_EMPTY: RoamNote = {
  id: 'decision-empty',
  lines: ['No decision record is named against this one.'],
};

/**
 * THE FLOOR — and it is a door, not a wall (ADR-0453 D6, moved down by ADR-0494 D1/D2).
 *
 * ⚠ THE FLOOR MOVED ON 2026-09-01 AND THIS COPY MOVED WITH IT. It used to read "under a capability
 * sit its tests, the decisions behind it and the code" — which became FALSE in the same landing that
 * put the tests and the decision names on this panel. A conversion point that describes as
 * unreachable the thing the visitor is looking at is worse than none.
 *
 * What is genuinely past the floor is unchanged (ADR-0494 D3): the code, and the reasoning behind
 * each decision. And the clause that matters is still the second sentence — the floor arrives
 * exactly when the visitor has demonstrated they want depth, and rendering it as a dead end would be
 * the failure. It does not promise a download; there is no product to hand anyone yet (ADR-0453 D9).
 */
export const ROAM_FLOOR_NOTE: RoamNote = {
  id: 'floor',
  lines: [
    'This is as deep as the public map goes.',
    'Below it are the code itself and the reasoning behind each decision — that is what the app opens.',
  ],
  grounds: ['ADR-0453', 'ADR-0494'],
};

/**
 * TARGET 5 — THE ARC DRAWER: the initiative layer above the code.
 *
 * The other four targets answer "what is this thing?" about something drawn on the map. This one
 * answers a question the map cannot draw at all: *why does this island exist?* — which is the layer
 * an experienced developer starts wondering about once the shape has stopped being new.
 *
 * ⚠ PAST TENSE, AND IT IS NOT A STYLE CHOICE. Measured on the published snapshot, 18 of the 19 arcs
 * that reach an island are CLOSED. Copy phrased as ongoing work ("the initiative currently building
 * this") would be false of almost every arc a visitor can open, and false in the direction this page
 * cannot afford — the snapshot-as-live-feed error one tier up from the forest, on the surface that
 * spends the preceding movement asserting its signals are real.
 */
export const ROAM_ARC_NOTE: RoamNote = {
  id: 'arc',
  lines: ['An arc is one initiative — a named piece of work, tracked from its intent to its end.'],
  grounds: ['ADR-0183'],
};

/**
 * THE EMPTY STATE, WHICH IS A REAL STATE AND NOT AN ERROR.
 *
 * Measured on the published snapshot, two of the 35 islands are reached by no arc. A blank panel
 * there would read as a bug in the page; a sentence that invented a cause ("it predates the arcs")
 * would be a claim nothing in the snapshot supports. So it says exactly what is known — the record
 * is empty — and nothing more.
 */
export const ROAM_ARC_EMPTY: RoamNote = {
  id: 'arc-empty',
  lines: ['No initiative on record reaches this one. Not everything here was built under one.'],
};

/** Every line of prose this module can put on the page. The test holds the "one or two sentences"
 *  bar against this list, so a note added later is covered without anyone remembering to add it. */
export const ROAM_NOTES: readonly RoamNote[] = [
  ROAM_STORY_NOTE,
  ROAM_COLOUR_NOTE,
  ROAM_CAPABILITY_NOTE,
  ROAM_TRAIL_NOTE,
  ROAM_UAT_NOTE,
  ROAM_UAT_EMPTY,
  ROAM_DECISION_NOTE,
  ROAM_DECISION_EMPTY,
  ROAM_FLOOR_NOTE,
  ROAM_ARC_NOTE,
  ROAM_ARC_EMPTY,
];

/**
 * WHAT A UAT STEP'S OWN VERDICT MEANS, in the visitor's words.
 *
 * ⚠ EVERY BRANCH SHIPS AND THE DATA PICKS ONE — the same rule `STATUS_READING` follows. `failing`
 * has never occurred on this map and is written anyway, for the same reason `unhealthy` is: a
 * vocabulary that can only say encouraging things is a brochure, and the sentence a failing step
 * will need is the one written here rather than a kinder one written under pressure later.
 *
 * ⚠ AND `pending` DOES NOT APOLOGISE FOR ITSELF. Most steps on this map are unproven; a reading
 * that hedged ("not proven YET, but…") would be the copy flattering the data.
 */
export const UAT_STATE_READING: Readonly<Record<RoamUatState, { word: string; sentence: string }>> = {
  proven: { word: 'proven', sentence: 'A signed verdict passed this step.' },
  pending: { word: 'not yet proven', sentence: 'Nothing has been signed against this step.' },
  failing: { word: 'failing', sentence: 'A verdict was signed against this step and it did not pass.' },
};

/**
 * WHO SIGNS A STEP — the short label beside it, never a sentence.
 *
 * ⚠ THIS IS THE PAGE'S OWN CLAIM MADE CHECKABLE. The stamp under the map says green is earned
 * "because a signed test said so"; showing which steps a harness proves and which ones a person
 * had to judge is what stops that from being a slogan. Most are the machine, and the exceptions
 * are the interesting part rather than an embarrassment.
 *
 * `either` is the parser's default for an untagged step, so it is the weakest true claim rather
 * than an assertion that nobody looked.
 */
export const WITNESS_LABEL: Readonly<Record<RoamWitness, string>> = {
  machine: 'by test',
  human: 'by a person',
  either: 'by test or person',
};

/** How many of a story's acceptance steps are proven, counted from the payload, never stated. */
export function provenUatCount(story: RoamStory): number {
  return story.uat.filter((u) => u.state === 'proven').length;
}

/** "9 acceptance tests, 6 proven" — or the singular, or the honest empty. Every number is counted
 *  at render time; none is ever written into copy. */
export function uatTally(story: RoamStory): string {
  const total = story.uat.length;
  if (total === 0) return 'no acceptance test recorded';
  const noun = total === 1 ? '1 acceptance test' : `${total} acceptance tests`;
  return `${noun}, ${provenUatCount(story)} proven`;
}

/**
 * WHAT AN ARC'S LIFECYCLE MEANS, in the visitor's words and in the picture's tense.
 *
 * ⚠ EVERY BRANCH SHIPS AND THE DATA PICKS ONE — the same rule `STATUS_READING` follows, for the same
 * reason: today's snapshot is almost entirely `closed`, and writing only that branch would leave the
 * drawer speechless the day a live arc reaches an island, with the failure invisible because the row
 * would still render.
 *
 * ⚠ THE TWO OPEN BRANCHES ARE PAST-TENSE ABOUT THE PICTURE, not present-tense about the system. "It
 * is still running" would describe a live feed; "it was still open when this picture was taken" is
 * what a dated export can honestly say.
 */
export const LIFECYCLE_READING: Readonly<Record<string, { word: string; sentence: string }>> = {
  closed: { word: 'finished', sentence: 'It ran to its end and closed.' },
  active: { word: 'open', sentence: 'It was still open when this picture was taken.' },
  parked: { word: 'parked', sentence: 'It was set aside when this picture was taken, not dropped.' },
  unknown: { word: 'unknown', sentence: 'Its state did not load, so the map does not guess at one.' },
};

/** The reading for a lifecycle, falling back to `unknown` rather than borrowing a reading we have —
 *  the same rule `toRoamStatus` applies to a colour, and for the same reason. */
export function lifecycleReading(lifecycle: string): { word: string; sentence: string } {
  return LIFECYCLE_READING[lifecycle] ?? LIFECYCLE_READING.unknown!;
}

/**
 * "12 closed, 3 still open" — an arc's shape, counted from the payload and never written into copy.
 *
 * ⚠ "STEPS", NOT "INCREMENTS". The corpus's word is `increment`, and this is the one place ROAM
 * translates rather than quoting: the ids stay gibberish on purpose (ADR-0453 D3) because the
 * visitor projects their own project onto them, but the SENTENCES are plain English, and an
 * unexplained internal noun is neither.
 *
 * ⚠ AND "CLOSED", NOT "LANDED". A step also closes when the work drifted or turned out wrong, which
 * is a closure and not a delivery. The exporter counts what the record says; so does this.
 */
export function incrementTally(arc: RoamArc): string {
  const { incrementsClosed: done, incrementsOpen: open } = arc;
  if (done + open === 0) return 'no steps recorded';
  if (open === 0) return done === 1 ? '1 step, closed' : `${done} steps, all closed`;
  if (done === 0) return open === 1 ? '1 step, still open' : `${open} steps, all still open`;
  return `${done} closed, ${open} still open`;
}

/** How many decisions an ARC row lists before it stops and says how many are left. An arc sits
 *  inside a list of arcs, so it has no column of its own to scroll — the story's own decision
 *  section does, and is deliberately uncapped (the owner: *"give them the lot"*). */
export const ADR_LIST_CAP = 3;

/** The honest tail of a truncated decision list, or null when nothing was left out. The count is
 *  what keeps the truncation from reading as completeness — the same rule the trail list follows. */
export function adrOverflow(count: number): string | null {
  const hidden = count - ADR_LIST_CAP;
  return hidden <= 0 ? null : `…and ${hidden} more.`;
}

/** "5 decisions behind it" / "1 decision behind it" / null when there are none — counted, never
 *  written. Shared by the arc drawer and the story's own decision row, so the two cannot phrase
 *  the same fact two ways. */
export function adrTally(count: number): string | null {
  if (count === 0) return null;
  return count === 1 ? '1 decision behind it' : `${count} decisions behind it`;
}

/** The row label for a story's decisions — the tally, or the honest empty. Unlike the arc drawer's,
 *  this row is always offered: an island that names no decision is a fact worth being able to see. */
export function decisionTally(story: RoamStory): string {
  return adrTally(story.decisions.length) ?? 'no decision record named';
}

/** "N initiatives" for the row that opens the drawer — or the singular, or the honest empty. */
export function arcTally(story: RoamStory): string {
  const n = story.arcs.length;
  if (n === 0) return 'no initiative on record';
  return n === 1 ? '1 initiative' : `${n} initiatives`;
}

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

  const arcById = new Map(payload.arcs.map((a) => [a.id, a]));
  const adrByNumber = new Map(payload.decisions.map((d) => [d.number, d]));
  /** Resolve decision numbers to records, dropping any the registry does not carry. A number with
   *  no record is not renderable — the tally below counts what RESOLVED, so the row and the list
   *  cannot disagree about how many there are. */
  const adrsOf = (numbers: readonly number[]): RoamAdr[] =>
    numbers.map((n) => adrByNumber.get(n)).filter((d): d is RoamAdr => d !== undefined);

  let openSection: 'colour' | 'inside' | 'proof' | 'decisions' | 'arcs' | null = null;
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
    }

    // target 6 · the proof — the acceptance journey. This is the level the owner opened the map to
    // on 2026-09-01, and it is where the picture stops being a diagram: everything above claims the
    // green is earned, and this is where a stranger can check the claim step by step.
    const proofRow = el('button', 'roam-row');
    proofRow.type = 'button';
    proofRow.setAttribute('data-roam-row', 'proof');
    proofRow.setAttribute('aria-expanded', String(openSection === 'proof'));
    proofRow.append(el('span', 'roam-row-word', uatTally(story)));
    body.append(proofRow);
    if (openSection === 'proof') {
      if (story.uat.length === 0) {
        body.append(noteBlock(ROAM_UAT_EMPTY));
      } else {
        body.append(noteBlock(ROAM_UAT_NOTE));
        // ⚠ UNCAPPED, AND IT SCROLLS INSIDE ITSELF. The owner asked for "the lot"; a list that
        // stopped at three of thirteen would be the panel deciding which of a journey's steps
        // matter. The column below it is flex, so this list shrinks to what is left rather than
        // pushing the floor and the stamp off the panel.
        const list = el('ul', 'roam-uat');
        for (const leg of story.uat) {
          const item = el('li', `roam-uat-leg uat-${leg.state}`);
          const dot = el('span', `roam-uat-dot uat-${leg.state}`);
          dot.setAttribute('aria-hidden', 'true');
          // The state is on the row as TEXT as well as colour — the dot alone would make the one
          // fact this section exists to carry unreadable to anyone not seeing the hue.
          item.append(
            dot,
            el('span', 'roam-uat-title', leg.title),
            el('span', 'roam-uat-meta', `${UAT_STATE_READING[leg.state].word} · ${WITNESS_LABEL[leg.witness]}`),
          );
          list.append(item);
        }
        body.append(list);
      }
    }

    // target 7 · the decisions behind it — reachable at their NAME, never their reasoning.
    const decisionRow = el('button', 'roam-row');
    decisionRow.type = 'button';
    decisionRow.setAttribute('data-roam-row', 'decisions');
    decisionRow.setAttribute('aria-expanded', String(openSection === 'decisions'));
    decisionRow.append(el('span', 'roam-row-word', decisionTally(story)));
    body.append(decisionRow);
    if (openSection === 'decisions') {
      const decisions = adrsOf(story.decisions);
      if (decisions.length === 0) {
        // Either the story names none, or a number did not resolve. Both are "the record is empty
        // here", and neither licenses a sentence about why — the same rule the arc drawer follows.
        body.append(noteBlock(ROAM_DECISION_EMPTY));
      } else {
        body.append(noteBlock(ROAM_DECISION_NOTE));
        const list = el('ul', 'roam-adrs');
        for (const adr of decisions) {
          const item = el('li', 'roam-adr');
          item.append(
            el('span', 'roam-adr-no', `ADR-${String(adr.number).padStart(4, '0')}`),
            el('span', 'roam-adr-title', adr.title),
          );
          list.append(item);
        }
        body.append(list);
      }
    }

    // target 5 · the arc drawer — the initiative layer ABOVE the code, which is why it sits below
    // the capability row rather than inside it: the visitor has just reached the bottom of the
    // structure, and this is the one direction that is still up.
    const arcRow = el('button', 'roam-row');
    arcRow.type = 'button';
    arcRow.setAttribute('data-roam-row', 'arcs');
    arcRow.setAttribute('aria-expanded', String(openSection === 'arcs'));
    arcRow.append(el('span', 'roam-row-word', arcTally(story)));
    body.append(arcRow);
    if (openSection === 'arcs') {
      const arcs = story.arcs.map((id) => arcById.get(id)).filter((a): a is RoamArc => a !== undefined);
      if (arcs.length === 0) {
        // Either nothing reaches this story, or an id did not resolve. Both are "the record is
        // empty here", and neither licenses a sentence about why.
        body.append(noteBlock(ROAM_ARC_EMPTY));
      } else {
        body.append(noteBlock(ROAM_ARC_NOTE));
        const list = el('ul', 'roam-arcs');
        for (const arc of arcs) {
          const item = el('li', 'roam-arc');
          const reading = lifecycleReading(arc.lifecycle);
          item.append(el('p', 'roam-arc-title', arc.title));
          const shape = el('p', 'roam-arc-shape');
          shape.append(
            el('span', `roam-arc-word lc-${arc.lifecycle}`, reading.word),
            el('span', 'roam-arc-tally', incrementTally(arc)),
          );
          item.append(shape);
          item.append(el('p', 'roam-arc-line', reading.sentence));
          const adrs = adrsOf(arc.adrs);
          const tally = adrTally(adrs.length);
          if (tally !== null) {
            item.append(el('p', 'roam-arc-adr-head', tally));
            const decisions = el('ul', 'roam-arc-adrs');
            for (const adr of adrs.slice(0, ADR_LIST_CAP)) {
              decisions.append(el('li', 'roam-arc-adr', adr.title));
            }
            item.append(decisions);
            const more = adrOverflow(adrs.length);
            if (more !== null) item.append(el('p', 'roam-more', more));
          }
          list.append(item);
        }
        body.append(list);
      }
    }

    // ⚠ THE FLOOR IS A PROPERTY OF THE BOTTOM OF THE PANEL, NOT OF ONE SECTION — and it belongs to
    // the three rows that go DOWN. `colour` is not depth, and `arcs` is the one direction that is
    // UP (the initiative above the code), so neither earns it. Rendering it unconditionally would
    // put the conversion point in front of a visitor who has not yet asked for depth, which is the
    // clause ADR-0453 D6 is actually about.
    if (openSection === 'inside' || openSection === 'proof' || openSection === 'decisions') {
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
    if (
      which !== 'colour' &&
      which !== 'inside' &&
      which !== 'proof' &&
      which !== 'decisions' &&
      which !== 'arcs'
    ) {
      return;
    }
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
