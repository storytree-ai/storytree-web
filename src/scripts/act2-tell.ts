// ---------------------------------------------------------------------------
// TELL — the one movement where we speak.
//
// Chapter 2's four movements are GROW · TELL · ROAM · ASK, and each name says who is driving
// (`storytree library artifact grow-tell-roam-ask`). GROW settles the real forest at its designed
// resting frame and goes quiet. This is what happens next: short, light prose phases in over that
// forest ON A TIMING WE OWN, names what chapter 1 only dramatised, and hands the map back.
//
// ⚠ TELL IS THE ONLY MOVEMENT THAT SPEAKS. That is its whole licence and its whole fence. A
// sentence that wants to live on the map during ROAM has drifted, by name.
//
// ⚠ SHORT AND LIGHT IS THE BINDING CONSTRAINT, NOT A STYLE NOTE (ADR-0453 D1). The site's job is
// excitement, not teaching; the education proper lives in the desktop app's guided intro (D8). A
// TELL that grows into a lesson has failed even if every sentence is true. The measure is whether
// it earns ROAM, not whether it explains the system.
//
// ── WHAT SURVIVED THE NARRATOR, AND WHY THIS FILE IS NEW ────────────────────────────────────────
//
// `act2-orchestrator.ts` was a good declarative state machine wearing a bad costume: each step
// named its target state and Back re-applied it so the scene rendered byte-identical, with timers
// driving reveal cadence ONLY. The owner rejected the costume, not the machine — a chat dock that
// offered exactly one reply chip per step, "a Next button in a costume" (2026-08-22).
//
// KEEP THE MACHINE, RETIRE THE PRESENTER. The machine is that PROPERTY, not those 427 lines: every
// DOM node the orchestrator built was namespaced `a2chat-` and every field of its step type carried
// dialogue. Re-mounting it would have resurrected the voice to reach the property. So the property
// is rebuilt here, in a module with no chat DOM and no reply chips, and the orchestrator and its
// chrome are deleted. `stateAt()` below is that property: a beat's rendered state is a pure
// function of its index, so replaying to n from anywhere lands byte-identical.
//
// ── THE TWO THINGS THIS FILE REFUSES TO DO ──────────────────────────────────────────────────────
//
// 1. **IT NEVER HARD-CODES A NUMBER.** Every count in the copy is a `{placeholder}` filled from the
//    map's own build-time payload. The forest is a SNAPSHOT that will be republished (that is the
//    open question on this arc), and a literal "35 stories" would become a lie the first time the
//    job runs — on the one page whose entire pitch is that its signals are real. `renderLine`
//    substitutes; `act2-tell.test.ts` proves a different corpus moves every count-bearing line.
//
// 2. **IT NEVER ASSERTS A STATUS IT HAS NOT READ.** The `self` beat points at the island that IS
//    this website and says out loud that it is not green. That is the strongest sentence here and
//    the most fragile: the day someone signs that story off, the boast becomes a falsehood. So the
//    clause is CHOSEN from the live status class on the rendered island (`selfIsGreen`), never
//    written down, and the beat is dropped entirely when the island is absent from the snapshot.
//
// Both are the same rule: the page may only say what the map in front of it actually shows.
//
// ⚠ THIS MODULE IS PURE UNTIL `mountTell` IS CALLED. Nothing at module scope touches `document`, so
// the script and the state machine are importable under `bun test`, which has no DOM.
// ---------------------------------------------------------------------------

import { buildLoopDiagram, HONEST_LOOP } from './act2-loop-diagram';

// ── the vocabulary ──────────────────────────────────────────────────────────

/**
 * What a beat asks the FOREST to do while it speaks.
 *
 * ⚠ PREFER POINTING AT THE REAL THING OVER DESCRIBING IT. Every lens here is a change to how the
 * already-rendered, already-real map is displayed — never a drawing of a pretend one. `trails`
 * brings forward edges routed from the corpus's own `dependsOn`; `proven` dims islands by the status
 * class the snapshot gave them; `self` moves the camera to a story that exists. Nothing is invented
 * for the telling.
 */
export type TellLens =
  /** Leave the map exactly as GROW left it. */
  | 'none'
  /** Lift the island bodies out of the ground a little — "these things are the unit". */
  | 'islands'
  /** Hold the green islands and let everything else fall back. */
  | 'proven'
  /** Bring the dependency trails forward. They are already on screen — GROW opts this surface in —
   *  so this lens EMPHASISES rather than reveals, and deliberately does not touch the resting frame. */
  | 'trails'
  /** Fly to the island that is this website and ring it. */
  | 'self';

/** The one drawing TELL is allowed. See `figure` on `TellBeat` for why there is exactly one. */
export type TellFigure = 'none' | 'loop';

export interface TellBeat {
  /** Stable id — the test names beats by this, and the DOM stamps it for the witness hook. */
  readonly id: string;
  /**
   * The beat's prose, one entry per line. Lines phase in one at a time within the beat; the beat's
   * dwell is DERIVED from their length (`beatDwellMs`) rather than hand-set, so editing the copy
   * cannot silently leave a line on screen for less time than it takes to read.
   */
  readonly lines: readonly string[];
  readonly lens: TellLens;
  readonly figure: TellFigure;
  /**
   * The decisions that make this beat's claim true, as `ADR-NNNN`. Written into the DOM as
   * `data-grounds` at runtime, and — the half that actually bites — read straight out of THIS
   * ARRAY by the parent repo's `check:web-grounding`, which resolves each id against the LIVE
   * decision log. A claim grounded on a number that does not exist, or on a decision since
   * superseded, reds the gate and names this file. All three were exercised against the real store
   * before this landed; see the falsifiability record in `docs/research/`.
   *
   * ⚠ THE RUNG HAD TO BE WIDENED TO SEE THIS, which is worth knowing before trusting it. Its
   * extractor matched only the `data-grounds="…"` ATTRIBUTE form in markup, so a claim written as
   * data in a script — every claim below — was invisible: it reported a confident OK over a page
   * whose copy it had never read. Keep the field named `grounds` and keep the ids as quoted
   * literals in an array; that literal shape is what the rung matches on.
   *
   * That is the mechanical half of "do not invent product claims". The judgement half — whether the
   * sentence is true of the system as it stands — is still a person's, and no check replaces it.
   */
  readonly grounds?: readonly string[];
}

/**
 * What TELL knows about the forest it is speaking over — read from the rendered map at mount, never
 * baked in. See refusal 1 and 2 in the header.
 */
export interface ForestFacts {
  readonly stories: number;
  readonly proven: number;
  readonly capabilities: number;
  /** The story id of the island that IS this website, or null when the snapshot has no such story. */
  readonly selfIsland: string | null;
  /** Whether that island is green RIGHT NOW, read off its status class. */
  readonly selfIsGreen: boolean;
}

/** The fully-resolved state of one beat: what is on screen, and what the map is doing. */
export interface TellState {
  readonly index: number;
  readonly id: string;
  /** The beat's lines with every placeholder substituted — what the DOM actually shows. */
  readonly lines: readonly string[];
  readonly lens: TellLens;
  readonly figure: TellFigure;
  readonly grounds: readonly string[];
}

// ── the script ──────────────────────────────────────────────────────────────

/**
 * The story id this site tells about itself. Not a guess: `website-experience` is the story whose
 * capabilities are the two acts you are looking at ("The two-act vibe-coding experience — the
 * public site's front door enacts chaos → calm"). If it is ever renamed or dropped from the
 * snapshot, `resolveScript` drops the `self` beat rather than pointing at nothing.
 */
export const SELF_STORY_ID = 'website-experience';

/**
 * ⚠ EVERYTHING ASSERTED HERE MUST BE TRUE OF THE SYSTEM AS IT STANDS TODAY. The whole page rests on
 * the forest being a genuine reading rather than a description, and prose that overclaims destroys
 * exactly that. A sentence that would be a nicer pitch than the truth supports gets cut, not
 * softened.
 *
 * The order is the owner's, 2026-08-26: the name, then WHY it was built — the founding false
 * binary, which chapter 1 dramatises and never names — then the basics of how it works, short and
 * light, and only as far as ROAM needs to be legible.
 */
export const TELL_SCRIPT: readonly TellBeat[] = [
  {
    id: 'name',
    lines: ['This is storytree.'],
    lens: 'none',
    figure: 'none',
  },
  {
    // Naming the storm the visitor just sat through. Chapter 1 is the false binary ENACTED — a
    // prompt breeds a swarm of terminals until the lead agent concedes it is not working — and
    // until this line nothing on the site ever says what it was about.
    id: 'problem',
    lines: [
      'You just watched the problem.',
      'Point a few agents at a codebase and they write more than anyone can read.',
    ],
    lens: 'none',
    figure: 'none',
  },
  {
    // The founding account, in the owner's own framing: you either reviewed every line the model
    // wrote or you trusted it, and there was no in-between that let you go straight to the surfaces
    // that called for your attention.
    id: 'binary',
    lines: [
      'Which leaves two options, both bad: read every line yourself, or trust it and hope.',
      'What was missing was the middle — a way to see which parts wanted your attention.',
    ],
    lens: 'none',
    figure: 'none',
  },
  {
    // The turn. "This is the real one" is the site's load-bearing claim and it is literally true:
    // the map underneath was published from storytree's own records by a job, not drawn for the
    // pitch (ADR-0453 D11).
    id: 'turn',
    lines: [
      'So storytree grows software as a map you can stand in front of.',
      'This one is real. It is storytree, drawn from its own records.',
    ],
    lens: 'none',
    figure: 'none',
    grounds: ['ADR-0453'],
  },
  {
    id: 'islands',
    lines: ['Every island is one story — one thing the system does.', '{stories} of them.'],
    lens: 'islands',
    figure: 'none',
  },
  {
    // The claim the whole map exists to support, stated as the NEGATIVE because that is the form
    // that is exactly true. ADR-0040: green derives from a signed verdict and authoring
    // `status: healthy` stops painting anything green — "signed pass → healthy (the ONLY green
    // source)", in `apps/studio/src/lib/worldStatus.ts`'s own words.
    //
    // ⚠ AN EARLIER DRAFT SAID "it means a test signed off on the work", AND THAT OVERCLAIMS. Green
    // requires a signed verdict, but the SIGNER is not always a test: a story whose UAT is
    // operator-attested (ADR-0070 stage 2) goes green on a human's signature. What holds for every
    // green on this map without exception is that nobody awarded it to themselves — so that is what
    // the sentence says. (The same imprecision sits in `/forest/`'s shipped lede. Correcting that is
    // not this increment's, but it must not be copied forward.)
    id: 'proven',
    lines: [
      '{proven} of them are green.',
      'Nothing goes green here because somebody said it was done.',
    ],
    lens: 'proven',
    figure: 'none',
    grounds: ['ADR-0040'],
  },
  {
    // THE ONE DRAWING. The map can show you which islands are green; it cannot show you the loop
    // that makes green mean anything, because that happens between the agents rather than in the
    // corpus. So the single figure earns its place by carrying what the forest structurally cannot
    // — and the prose beside it is ONE SHORT LINE, because the diagram already names all four steps
    // and captions itself "the system checks — not the AI". Anything longer here would be the page
    // reading its own diagram aloud.
    id: 'loop',
    lines: ['Nobody signs off their own work.'],
    lens: 'none',
    figure: 'loop',
    grounds: ['ADR-0040'],
  },
  {
    id: 'trails',
    lines: ['The trails are what depends on what.'],
    lens: 'trails',
    figure: 'none',
  },
  {
    // The honesty beat, and the reason it is worth the camera move: a map that flatters its author
    // is a brochure. This one puts the page you are reading on itself, at whatever colour it has
    // actually earned. `{selfClause}` is chosen from the live status, never written down.
    id: 'self',
    lines: ['That one is this website.', '{selfClause}'],
    lens: 'self',
    figure: 'none',
    grounds: ['ADR-0040'],
  },
  {
    // TELL ends by getting out of the way. It does not promise clicking: ROAM is the next movement
    // and is not built yet, so this names the two gestures that genuinely work today.
    id: 'handoff',
    lines: ['It is yours now.', 'Drag to move around it. Scroll to zoom.'],
    lens: 'none',
    figure: 'none',
  },
];

/**
 * The two readings of the self beat's second line.
 *
 * ⚠ BOTH BRANCHES SHIP AND THE DATA PICKS ONE. The site is not green today, which is the sharper
 * sentence, but a story's status is exactly the thing this system is built to change — so the copy
 * that survives its own subject going green is the only copy that can be trusted to stay true.
 */
export const SELF_CLAUSE = {
  notGreen: 'It is not green. Nobody has signed it off, so the map does not say otherwise.',
  green: 'It went green the way everything else does — a test proved it, and the system checked.',
} as const;

// ── rendering the copy ──────────────────────────────────────────────────────

/** The placeholders `renderLine` understands. A `{token}` outside this set is left alone so it is
 *  visible in the page rather than silently dropped. */
export const TELL_PLACEHOLDERS = ['stories', 'proven', 'capabilities', 'selfClause'] as const;

/** Substitute a line's placeholders from the facts read off the live map. */
export function renderLine(line: string, facts: ForestFacts): string {
  return line.replace(/\{(\w+)\}/g, (whole, token: string) => {
    switch (token) {
      case 'stories':
        return String(facts.stories);
      case 'proven':
        return String(facts.proven);
      case 'capabilities':
        return String(facts.capabilities);
      case 'selfClause':
        return facts.selfIsGreen ? SELF_CLAUSE.green : SELF_CLAUSE.notGreen;
      default:
        return whole;
    }
  });
}

/**
 * Drop the beats this forest cannot honestly carry.
 *
 * Today that is exactly one rule — the `self` beat needs an island to point at — but the shape
 * matters more than the rule: a beat whose lens cannot be honoured is REMOVED, never shown with a
 * dead pointer, and never left to fail quietly at mount time.
 */
export function resolveScript(
  script: readonly TellBeat[],
  facts: ForestFacts,
): readonly TellBeat[] {
  return script.filter((beat) => beat.lens !== 'self' || facts.selfIsland !== null);
}

/**
 * The whole of the state machine: a beat's rendered state is a PURE FUNCTION OF ITS INDEX.
 *
 * This is the property inherited from the retired orchestrator and the reason it was worth
 * inheriting — replaying to beat n from anywhere lands byte-identical, so there is no incremental
 * diff to get wrong and no ordering the DOM can drift into. Out-of-range indices clamp rather than
 * throw: a timer that fires once after teardown must not take the page down with it.
 */
export function stateAt(
  index: number,
  script: readonly TellBeat[],
  facts: ForestFacts,
): TellState {
  if (script.length === 0) {
    return { index: 0, id: '', lines: [], lens: 'none', figure: 'none', grounds: [] };
  }
  const i = Math.max(0, Math.min(script.length - 1, Math.trunc(index)));
  const beat = script[i]!;
  return {
    index: i,
    id: beat.id,
    lines: beat.lines.map((line) => renderLine(line, facts)),
    lens: beat.lens,
    figure: beat.figure,
    grounds: beat.grounds ?? [],
  };
}

// ── the timing we own ───────────────────────────────────────────────────────

/**
 * ⚠ THE CADENCE IS DERIVED FROM THE COPY, NOT HAND-SET PER BEAT — and that is the entire point of
 * "a timing we own". The retired narrator's pace was a model's response latency wearing a costume;
 * hand-tuned per-beat millisecond constants would be the same mistake one level down, because the
 * next person to edit a line would have to remember to retune a number in a different place, and
 * would not. Reading pace is a property of the sentence, so it is computed from the sentence.
 *
 * `MS_PER_WORD` is ~238 wpm — comfortable for short display lines held over a picture, slower than
 * silent prose reading because the reader is also looking at the map. It is ONE constant on
 * purpose: the whole sequence's length is an operator-attested judgement (ADR-0070 stage 2), and
 * the owner changing his mind about the pace should be one number, not ten.
 */
export const MS_PER_WORD = 252;
/** Floor per line — even three words need long enough to be seen arriving. */
export const MS_LINE_FLOOR = 1150;
/** The pause after a beat's last line before the next beat displaces it. */
export const MS_BEAT_GAP = 470;
/**
 * How long TELL waits, after mounting, before it says anything.
 *
 * ⚠ MEASURED, NOT GUESSED, AND IT IS NOT A POLISH DETAIL. `mountForestLand` is called at the moment
 * the land layer is UNHIDDEN, not when it is visible: chapter 1 then fades it up from the storm's
 * near-black, and the land's computed opacity was measured at 0.007 on the frame TELL mounted and
 * did not reach 1 until ~1.9 s later. Without this, "This is storytree." — the one beat that is
 * nothing but a name held over a picture — played out almost entirely against a dark screen and was
 * gone by the time there was a forest to say it over. The first thing the site says was the one
 * thing nobody could read.
 */
export const MS_LEAD_IN = 2100;
/** The beat holds after its last line lands, so the final sentence is not yanked mid-read. */
export const MS_LINE_TAIL = 430;
/** How long the loop figure takes to assemble: a lead, then its four nodes in clockwise order. */
export const MS_FIGURE_REVEAL = 260 + 3 * 420;
/**
 * The floor a beat carrying a figure holds for, whatever its copy says.
 *
 * ⚠ A DIAGRAM IS CONTENT, AND DERIVING THE DWELL FROM THE PROSE ALONE FORGETS THAT. Measured on the
 * built site: shortening the loop beat's line to five words dropped its dwell to 2.16 s while the
 * diagram beside it needs 1.52 s merely to finish assembling — so the reader met the completed
 * picture for about half a second before the next beat took it away. The failure is silent and
 * inverted: the beat got FASTER because its sentence got better. The floor covers the reveal plus
 * time to actually read four labels.
 */
export const MS_FIGURE_DWELL = MS_FIGURE_REVEAL + 3600;

function wordCount(line: string): number {
  const trimmed = line.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/** How long one rendered line stays before the next line of the same beat joins it. */
export function lineDwellMs(line: string): number {
  return Math.max(MS_LINE_FLOOR, wordCount(line) * MS_PER_WORD);
}

/** How long a whole beat holds, derived from everything it puts on screen — its copy AND its
 *  figure, whichever needs longer. */
export function beatDwellMs(
  lines: readonly string[],
  figure: TellFigure = 'none',
): number {
  const body = lines.reduce((total, line) => total + lineDwellMs(line), 0) + MS_LINE_TAIL;
  return figure === 'none' ? body : Math.max(body, MS_FIGURE_DWELL);
}

/**
 * The millisecond offset from mount at which each beat begins, plus a final entry for the moment
 * the last beat ends. `starts.length === script.length + 1` — the tail entry is what the runtime
 * uses to schedule the fade-out, so the end of the sequence is part of the same computed schedule
 * rather than another constant somewhere else.
 */
export function beatStarts(script: readonly TellBeat[], facts: ForestFacts): readonly number[] {
  const starts: number[] = [];
  let t = MS_LEAD_IN;
  for (let i = 0; i < script.length; i += 1) {
    starts.push(t);
    const state = stateAt(i, script, facts);
    t += beatDwellMs(state.lines, state.figure) + MS_BEAT_GAP;
  }
  starts.push(t);
  return starts;
}

/** The whole sequence's length, for anyone who needs to reason about it (and for the test that
 *  keeps it honest about "short and light"). */
export function totalDurationMs(script: readonly TellBeat[], facts: ForestFacts): number {
  const starts = beatStarts(script, facts);
  return starts[starts.length - 1] ?? 0;
}

// ── reading the forest ──────────────────────────────────────────────────────

/** The counts payload `forestArrivalSvg` stamps onto the rendered `<svg>`. */
export interface ForestCounts {
  readonly stories: number;
  readonly proven: number;
  readonly capabilities: number;
}

/**
 * Parse the `data-forest-counts` payload.
 *
 * Returns null rather than throwing or defaulting: a TELL that cannot read the map's own numbers
 * must not speak about them, and the caller drops the sequence entirely. Numbers invented to keep a
 * sequence running would be exactly the failure this module's second header refusal exists to
 * prevent, and they would be invisible — the copy would read perfectly.
 */
export function parseForestCounts(raw: string | null): ForestCounts | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { stories, proven, capabilities } = parsed as Record<string, unknown>;
    if (typeof stories !== 'number' || typeof proven !== 'number') return null;
    if (typeof capabilities !== 'number') return null;
    if (!Number.isFinite(stories) || !Number.isFinite(proven) || !Number.isFinite(capabilities)) {
      return null;
    }
    if (stories < 0 || proven < 0 || capabilities < 0) return null;
    // A corpus cannot have more proven stories than stories. This is the one internal contradiction
    // cheap enough to catch here, and it is the one that would put a boast on the page.
    if (proven > stories) return null;
    return { stories, proven, capabilities };
  } catch {
    return null;
  }
}

// ── the DOM half ────────────────────────────────────────────────────────────
//
// Everything below touches `document` and is only reached through `mountTell`. The pure half above
// is what `act2-tell.test.ts` exercises; this half is thin on purpose — it applies a state, it does
// not compute one.

/** What TELL needs from the map it is speaking over. Supplied by `forest-arrival`'s handle, kept as
 *  a narrow interface so the test never needs an SVG and the two modules never import each other's
 *  DOM. */
export interface TellStage {
  /** Centre the map on one island and hold it there. False when the island is not on the map. */
  focusIsland(id: string): boolean;
  /** Return to the composition GROW settled on. */
  resetView(): void;
  /** Fires the first time the READER pans or zooms — never for a move TELL itself made. */
  onReaderTakeOver(cb: () => void): void;
}

export interface TellOptions {
  /** The land layer TELL mounts its overlay into (`#storm-land`). */
  readonly host: HTMLElement;
  /** The rendered forest `<svg>`, which carries the counts and the island status classes. */
  readonly map: Element;
  readonly stage: TellStage;
  /** True when the visitor asked for less motion. See `mountTell` for what that changes. */
  readonly reducedMotion: boolean;
}

export interface TellHandle {
  unmount(): void;
}

/** Read the facts off the rendered map. Null when the map cannot answer — the caller then does not
 *  run TELL at all rather than running it on invented numbers. */
export function readForestFacts(map: Element): ForestFacts | null {
  const counts = parseForestCounts(map.getAttribute('data-forest-counts'));
  if (counts === null) return null;
  const isle = map.querySelector(`.tw-isle[data-id="${CSS.escape(SELF_STORY_ID)}"]`);
  return {
    stories: counts.stories,
    proven: counts.proven,
    capabilities: counts.capabilities,
    selfIsland: isle === null ? null : SELF_STORY_ID,
    selfIsGreen: isle !== null && isle.classList.contains('st-healthy'),
  };
}

const LENS_CLASS: Readonly<Record<TellLens, string>> = {
  none: '',
  islands: 'tell-lens-islands',
  proven: 'tell-lens-proven',
  trails: 'tell-lens-trails',
  self: 'tell-lens-self',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Mount TELL over the settled forest.
 *
 * ⚠ THE MAP STAYS LIVE THE WHOLE TIME, and the overlay is `pointer-events: none` except for its
 * skip control. TELL is something the visitor is being shown, never something they are held inside:
 * the moment they touch the map it stops (`onReaderTakeOver`), because `the-reader-chooses-the-
 * thread-and-the-depth` outranks finishing the sentence. That is also what stops this becoming the
 * thing the narrator was — a sequence you can only get out of by agreeing with it.
 *
 * ⚠ UNDER REDUCED MOTION THERE IS NO SEQUENCE AT ALL. Every beat's prose renders at once as a
 * static column, no timers, no lens changes, no camera move. Auto-advancing text is itself a motion
 * the reader asked not to have, and a slower version of it is still a clock they do not control.
 * (In practice this branch is unreachable today: chapter 1 only arms for motion-OK visitors, so a
 * reduced-motion visitor never reaches the land. It is written because the branch that only runs
 * when something upstream changes is exactly the branch nobody notices is wrong.)
 */
export function mountTell(opts: TellOptions): TellHandle {
  const { host, map, stage, reducedMotion } = opts;

  const facts = readForestFacts(map);
  if (facts === null) return { unmount(): void {} };
  const script = resolveScript(TELL_SCRIPT, facts);
  if (script.length === 0) return { unmount(): void {} };

  const layer = el('div', 'tell-layer');
  layer.setAttribute('data-act2-tell', '');
  // Named rather than absent: during MS_LEAD_IN the layer is mounted and deliberately silent while
  // chapter 1's land fades up. A missing attribute here reads identically to "torn down", which is
  // the wrong answer to give anything watching this surface.
  layer.setAttribute('data-tell-beat', 'lead-in');
  const column = el('div', 'tell-column');
  column.setAttribute('aria-live', 'polite');
  const figureSlot = el('div', 'tell-figure');
  const skip = el('button', 'tell-skip', 'skip →');
  skip.type = 'button';
  skip.setAttribute('data-act2-tell-skip', '');
  layer.append(column, figureSlot, skip);

  const timers: number[] = [];
  let torn = false;
  /** The figure currently in the slot, so re-applying a beat is idempotent AND a beat that asks for
   *  no figure actually removes one. The first draft only ever ADDED, which left the loop diagram
   *  hanging under three later beats — and, worse, meant the rendered state was not a pure function
   *  of the index after all, which is the one property this whole module claims to have kept. */
  let figureShown: TellFigure = 'none';

  const clearLens = (): void => {
    for (const cls of Object.values(LENS_CLASS)) {
      if (cls !== '') host.classList.remove(cls);
    }
  };

  const applyFigure = (figure: TellFigure): void => {
    if (figure === figureShown) return;
    figureShown = figure;
    if (figure === 'none') {
      figureSlot.classList.remove('is-on');
      // Let it fade before it goes, so the beat that dismisses it does not blink.
      const stale = figureSlot.firstElementChild;
      timers.push(
        window.setTimeout(() => {
          stale?.remove();
        }, 750),
      );
      return;
    }
    const { body, nodeEls } = buildLoopDiagram(HONEST_LOOP, reducedMotion);
    figureSlot.append(body);
    figureSlot.classList.add('is-on');
    if (reducedMotion) return;
    // `buildLoopDiagram` already parked each node `is-hidden` for exactly this — the reveal is the
    // caller's to schedule. The four arrive in the loop's own clockwise order, so the reader watches
    // the cycle assemble rather than meeting it finished.
    nodeEls.forEach((node, i) => {
      timers.push(
        window.setTimeout(() => {
          node.classList.remove('is-hidden');
        }, 260 + i * 420),
      );
    });
  };

  /** Apply one beat's state to the page. Pure re-application, never a diff — the property the
   *  retired sequencer had and the reason replay is safe. */
  const applyBeat = (index: number): void => {
    if (torn) return;
    const state = stateAt(index, script, facts);
    layer.setAttribute('data-tell-beat', state.id);

    const block = el('div', 'tell-block');
    if (state.grounds.length > 0) {
      // Validated against the LIVE decision log by the parent's `check:web-grounding`.
      block.setAttribute('data-grounds', state.grounds.join(','));
    }
    state.lines.forEach((text, i) => {
      const line = el('p', 'tell-line', text);
      if (!reducedMotion && i > 0) {
        line.classList.add('is-hidden');
        const at = state.lines
          .slice(0, i)
          .reduce((total, prev) => total + lineDwellMs(prev), 0);
        timers.push(
          window.setTimeout(() => {
            line.classList.remove('is-hidden');
          }, at),
        );
      }
      block.append(line);
    });

    column.replaceChildren(block);
    if (!reducedMotion) {
      // One frame late so the transition has a start state to run from.
      timers.push(
        window.setTimeout(() => {
          block.classList.add('is-on');
        }, 20),
      );
    } else {
      block.classList.add('is-on');
    }

    clearLens();
    const cls = LENS_CLASS[state.lens];
    if (cls !== '') host.classList.add(cls);
    if (state.lens === 'self' && facts.selfIsland !== null) {
      if (!stage.focusIsland(facts.selfIsland)) host.classList.remove(cls);
    } else if (state.lens !== 'self') {
      stage.resetView();
    }
    applyFigure(state.figure);

    // The witness hook, kept from the retired orchestrator: an attested surface needs a way to say
    // where it is without reading pixels.
    (window as unknown as Record<string, unknown>).__act2tell = {
      beat: state.id,
      index: state.index,
      total: script.length,
      lines: state.lines,
    };
  };

  const finish = (): void => {
    if (torn) return;
    layer.classList.add('is-over');
    clearLens();
    stage.resetView();
    timers.push(
      window.setTimeout(() => {
        layer.remove();
      }, 900),
    );
  };

  const stop = (): void => {
    for (const t of timers) window.clearTimeout(t);
    timers.length = 0;
    finish();
  };

  skip.addEventListener('click', stop);
  stage.onReaderTakeOver(stop);

  if (reducedMotion) {
    // No clock at all: every beat's prose at once, and the map exactly as GROW left it.
    const all = el('div', 'tell-block is-on');
    for (let i = 0; i < script.length; i += 1) {
      for (const text of stateAt(i, script, facts).lines) {
        all.append(el('p', 'tell-line', text));
      }
    }
    column.replaceChildren(all);
    layer.classList.add('is-static');
  } else {
    const starts = beatStarts(script, facts);
    for (let i = 0; i < script.length; i += 1) {
      timers.push(window.setTimeout(() => applyBeat(i), starts[i] ?? 0));
    }
    timers.push(window.setTimeout(finish, starts[starts.length - 1] ?? 0));
  }

  host.append(layer);

  return {
    unmount(): void {
      torn = true;
      for (const t of timers) window.clearTimeout(t);
      timers.length = 0;
      clearLens();
      skip.removeEventListener('click', stop);
      layer.remove();
      delete (window as unknown as Record<string, unknown>).__act2tell;
    },
  };
}
