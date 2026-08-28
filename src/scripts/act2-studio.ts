// ---------------------------------------------------------------------------
// act2-studio — the Phase-Z STUDIO LAYER (ADR-0165 §6, run 2 of the opening
// redesign): after the island walk's finale the view crossfades INTO a
// re-created studio frame around the map area — the payoff of the whole walk,
// the diagram's promise made literal. One layer, revealed ADDITIVELY one chip
// per stage (each stage includes all previous; the guide script's `studio`
// field is the declarative target):
//
//   frame   — the studio chrome appears DIMMED (top bar: storytree ·
//             map/library/decisions tabs · "2 sessions live") with the
//             visitor's island centred, bright.
//   legend  — the legend card brightens bottom-left (the rest stays dim).
//   forest  — the frame un-dims and the FOREST lights up: the other islands,
//             faint trails, wisps ORBITING where agents are live.
//   details — the details panel slides in (promises with proof-signed marks,
//             the decisions behind the story as ADR chips, its needs).
//
// SUBSTRATE (ADR-0165 accepted default 4): the site's REAL map renderer over a
// hand-authored multi-island scene — every disc through the walk's exported
// buildDisc generator and the same buildScene → sceneToSvg rail the walked
// island rides (never a re-implementation, never screenshots) — plus studio
// chrome RE-CREATED from studio tokens (the landed chat-dock precedent). All
// data is FICTIONAL (the diorama boundary, ADR-0056/0066/0093): plain made-up
// story names, and exactly TWO orbiting wisps so the "2 sessions live" pill
// stays honest.
//
// DETERMINISM + REPLAY (accepted default 9): the scene string and the DOM are
// a pure function of fixed module data (hash/rand01 seeding inside the shared
// generators — no Math.random, no wall-clock); setStage() maps a stage to a
// fixed class set, so re-applying any stage (Back replay) renders
// byte-identical. Motion (crossfade, reveals, orbits) is CSS only;
// reduced-motion makes everything instant and parks the orbits at their fixed
// phase angles.
//
// NOT OPERABLE: the studio is a diorama — the scene's hit layer goes inert
// exactly as the walkthrough's does, the tabs are inert text, and nothing here
// advances the walk (the chat chips do). Text, tooltips and the legend/panel
// copy all live in the real DOM/SVG (free a11y).
//
// Witness hooks: layer root [data-act2-studio] (+ data-act2-studio-stage),
// legend [data-act2-studio-legend], details [data-act2-studio-details]; the
// orbiting wisps carry the run-1 .act2-orbit-spin / .act2-orbit-carrier
// structure (shared post-process). Styled by index.astro's global CSS
// (.act2-studio / act2-stu-*).
// ---------------------------------------------------------------------------

import {
  buildScene,
  routeTrails,
  type Pt,
  type RelaxedCell,
  type SceneInput,
  type SceneStatus,
  type SceneTerritoryInput,
} from '../lib/forest-world';
import { sceneToSvg } from '../lib/worldSvg';
import { buildDisc, escXml, orbitWispLayers, type DiscGeometry } from './act2-walkthrough';
import type { StudioStage } from './act2-guide';

// ── the hand-authored fiction (fixed data — the whole scene is a pure
//    function of these constants) ─────────────────────────────────────────────

/** Scene frame + where the visitor's island sits in it (dead centre — Z1's
 *  "your island centred"). Wider than tall: the studio band is landscape. */
const STU_W = 1500;
const STU_H = 620;
const STU_OFFSET: Pt = { x: 750, y: 280 };

/** Disc sizing mirrors the walk's: the visitor's island keeps its full size;
 *  the fictional islands are smaller single-ring discs. */
const HOME_RINGS = 2;
const OTHER_RINGS = 1;
const HOME_R = 64;
const OTHER_R = 40;
const HOME_PLATE_Y = 80;
const OTHER_PLATE_Y = 52;

interface StudioIsland {
  id: string;
  label: string;
  status: SceneStatus;
  centre: Pt;
  rings: number;
  radius: number;
  plateY: number;
  /** Crown fullness only (the scene's caps count — fixed fiction). */
  caps: number;
  /** A live-session wisp (exactly two islands carry one — the "2 sessions
   *  live" pill is honest by construction) with its FIXED orbit phase. */
  wisp?: { runId: string; phaseDeg: number };
}

/** The forest: the walked story (proven, centre) + five fictional neighbours —
 *  2 proven, 2 being built (each with an orbiting wisp), 1 withered (the mock
 *  baseline's mix). All names plain fiction. */
const ISLANDS: readonly StudioIsland[] = [
  {
    id: 'stu-checkout',
    label: 'Shoppers can check out',
    status: 'healthy',
    centre: { x: 0, y: 0 },
    rings: HOME_RINGS,
    radius: HOME_R,
    plateY: HOME_PLATE_Y,
    caps: 3,
  },
  {
    id: 'stu-signin',
    label: 'Sign-in works',
    status: 'healthy',
    centre: { x: -430, y: -100 },
    rings: OTHER_RINGS,
    radius: OTHER_R,
    plateY: OTHER_PLATE_Y,
    caps: 2,
  },
  {
    id: 'stu-browse',
    label: 'Shoppers can browse',
    status: 'healthy',
    centre: { x: 330, y: -130 },
    rings: OTHER_RINGS,
    radius: OTHER_R,
    plateY: OTHER_PLATE_Y,
    caps: 2,
  },
  {
    id: 'stu-orders',
    label: 'Orders can be tracked',
    status: 'proposed',
    centre: { x: -350, y: 150 },
    rings: OTHER_RINGS,
    radius: OTHER_R,
    plateY: OTHER_PLATE_Y,
    caps: 1,
    wisp: { runId: 'studio:stu-orders', phaseDeg: 40 },
  },
  {
    id: 'stu-refunds',
    label: 'Refunds are handled',
    status: 'proposed',
    centre: { x: 470, y: 90 },
    rings: OTHER_RINGS,
    radius: OTHER_R,
    plateY: OTHER_PLATE_Y,
    caps: 1,
    wisp: { runId: 'studio:stu-refunds', phaseDeg: 210 },
  },
  {
    id: 'stu-search',
    label: 'Search finds products',
    status: 'unhealthy',
    centre: { x: 100, y: 235 },
    rings: OTHER_RINGS,
    radius: OTHER_R,
    plateY: OTHER_PLATE_Y,
    caps: 1,
  },
];

const HOME_ID = 'stu-checkout';

/** Faint trails between islands — dependent → prerequisite (the settled
 *  direction, ADR-0058/0153). No proven story rests on the withered one — the
 *  broken island broke on its own, honest with the Z2 legend line. The
 *  GEOMETRY is the shared engine's (routeTrails, ADR-0169 — procedural, never
 *  hand-forged): only the edge list is authored fiction. */
const ROADS: readonly { from: string; to: string }[] = [
  { from: 'stu-checkout', to: 'stu-signin' },
  { from: 'stu-checkout', to: 'stu-browse' },
  { from: 'stu-orders', to: 'stu-checkout' },
  { from: 'stu-refunds', to: 'stu-checkout' },
  { from: 'stu-search', to: 'stu-browse' },
];

// ── the scene, through the real rail (pure string of the fixed data) ─────────

function treeTitleOf(label: string, status: SceneStatus): string {
  switch (status) {
    case 'healthy':
      return `${label} — a story, proven`;
    case 'unhealthy':
      return `${label} — a story, broken (a proof went stale)`;
    default:
      return `${label} — a story, being built (not proven yet)`;
  }
}

function studioSvg(): string {
  const discs = new Map<string, DiscGeometry>();
  for (const isl of ISLANDS) {
    discs.set(isl.id, buildDisc(isl.centre, isl.rings, `act2-studio-${isl.id}`));
  }
  const byId = new Map(ISLANDS.map((i) => [i.id, i] as const));

  const allCells: RelaxedCell[] = [];
  const territories: SceneTerritoryInput[] = [];
  ISLANDS.forEach((isl, owner) => {
    const disc = discs.get(isl.id)!;
    for (const c of disc.cells) allCells.push({ ...c, owner });
    const plateW = Math.max(150, isl.label.length * 7.6 + 26);
    territories.push({
      id: isl.id,
      status: isl.status,
      caps: isl.caps,
      centroid: isl.centre,
      // ⚠ `radius` SPLIT INTO TWO FIELDS in the synced engine (scene-territory-radius-states-its-space)
      // and this caller was never updated — `radius` is not in `SceneTerritoryInput`, so under
      // `astro build` (esbuild: transpile-only, no typecheck) it was silently DROPPED and every
      // island reached the scene with `groundRadius`/`screenRadius` UNDEFINED. Restoring BOTH to the
      // one declared value reproduces the pre-split behaviour exactly, which is all this fix claims:
      // the seam used to carry one number for both spaces, and refining them apart is a look change
      // nobody has attested.
      groundRadius: isl.radius,
      screenRadius: isl.radius,
      treeSpot: disc.treeSpot,
      labelY: isl.centre.y + isl.plateY,
      coastPaths: disc.coastPaths,
      decor: disc.decor,
      plants: [],
      treeTitle: treeTitleOf(isl.label, isl.status),
      wisps: isl.wisp ? [{ runId: isl.wisp.runId, title: 'a live agent session' }] : [],
      plate: {
        w: plateW,
        h: 34,
        rx: 7,
        idY: 15,
        subY: 28,
        idText: isl.label,
        subText: isl.id === HOME_ID ? 'the story you walked' : 'a story',
        title: isl.label,
      },
    });
  });

  // the trail network through the SHARED router (ADR-0169 §1): islands as
  // obstacle discs, the authored edge list, a fixed seed — procedural, never
  // hand-forged `d` strings. Titles keep the walk's "needs" vocabulary.
  const trails = routeTrails(
    ISLANDS.map((isl) => ({ id: isl.id, x: isl.centre.x, y: isl.centre.y, r: isl.radius })),
    ROADS.map((r) => ({
      from: r.from,
      to: r.to,
      title: `${byId.get(r.from)!.label} needs ${byId.get(r.to)!.label}`,
    })),
    'act2-studio-trails',
  );

  const sceneInput: SceneInput = {
    offset: STU_OFFSET,
    width: STU_W,
    height: STU_H,
    empties: [],
    relaxedCells: allCells,
    drawTiles: [],
    wheatSets: [],
    trails,
    territories,
  };

  const scene = sceneToSvg(buildScene(sceneInput));

  const label =
    'A staged studio map on made-up data: story islands — some proven green, some being ' +
    'built with a light circling where an agent session is live, one withered — with faint ' +
    'trails between them. Nothing here is live.';
  return (
    `<svg class="tw-svg act2-stu-svg" viewBox="0 0 ${STU_W} ${STU_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escXml(label)}">` +
    scene +
    `</svg>`
  );
}

// ── the layer + its handle ────────────────────────────────────────────────────

export interface StudioHandle {
  /** Apply a reveal stage declaratively: null = hidden (Back into Phase I);
   *  a stage = the layer on with that ADDITIVE reveal (frame ⊂ legend ⊂
   *  forest ⊂ details). Re-applying any stage yields the identical class
   *  set/DOM — Back replay is byte-identical. */
  setStage(stage: StudioStage | null): void;
  unmount(): void;
}

const STAGE_ORDER: readonly StudioStage[] = ['frame', 'legend', 'forest', 'details'];

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
 * Mount the studio layer into `host` (the 2.5D land layer), hidden until the
 * first setStage. The DOM is built ONCE from fixed data; stages only toggle a
 * pure class set. One handle out — the guide sequencer drives it and chains
 * unmount() into its own teardown.
 */
export function mountStudio(host: HTMLElement): StudioHandle {
  const layer = el('div', 'act2-studio');
  layer.setAttribute('data-act2-studio', '');
  layer.setAttribute('role', 'group');
  layer.setAttribute(
    'aria-label',
    'The storytree studio, staged — fictional stories on made-up data',
  );
  layer.setAttribute('aria-hidden', 'true');

  // the top bar — studio chrome re-created from studio tokens (the landed
  // chat-dock precedent). Inert text: the diorama is not operable.
  const bar = el('div', 'act2-stu-bar');
  bar.setAttribute('data-act2-studio-bar', '');
  const tabs = el('span', 'act2-stu-tabs');
  tabs.append(
    el('span', 'act2-stu-tab is-on', 'map'),
    el('span', 'act2-stu-tab', 'library'),
    el('span', 'act2-stu-tab', 'decisions'),
  );
  bar.append(
    el('span', 'act2-stu-logo', 'storytree'),
    tabs,
    el('span', 'act2-stu-session', '2 sessions live'),
  );

  // the map area: the hand-authored forest through the real rail.
  const main = el('div', 'act2-stu-main');
  main.innerHTML = studioSvg();

  // the diorama is not operable: the delegation hit layer goes inert exactly
  // as the walkthrough's does (tooltips/titles stay — free SVG DOM a11y).
  main.querySelectorAll('.tw-hit').forEach((h) => {
    h.removeAttribute('tabindex');
    h.removeAttribute('role');
    h.setAttribute('aria-hidden', 'true');
  });

  // the wisps ORBIT (the shared run-1 post-process; entries in territory
  // order for the wisp-bearing islands, each at its fixed phase angle).
  orbitWispLayers(
    main,
    ISLANDS.filter((i) => i.wisp !== undefined).map((i) => ({
      radius: i.radius,
      phaseDeg: i.wisp!.phaseDeg,
    })),
  );

  // tag everything that only lights at the 'forest' stage: every island but
  // the visitor's (ground/coast/flora — the wisps live inside the flora
  // groups, tagged explicitly too in case the rail moves them) + the trails.
  for (const isl of ISLANDS) {
    if (isl.id === HOME_ID) continue;
    main
      .querySelectorAll(
        `.tw-terr[data-id="${isl.id}"], .tw-isle[data-id="${isl.id}"], .tw-ground[data-id="${isl.id}"]`,
      )
      .forEach((n) => n.classList.add('act2-stu-other'));
  }
  main.querySelectorAll('.tw-trails, .tw-wisps').forEach((n) => n.classList.add('act2-stu-other'));

  // the legend card (Z2) — the mock's rows verbatim.
  const legend = el('div', 'act2-stu-legend');
  legend.setAttribute('data-act2-studio-legend', '');
  legend.setAttribute('role', 'group');
  legend.setAttribute('aria-label', 'How to read the map');
  legend.appendChild(el('h4', 'act2-stu-lg-h', 'Legend'));
  const lgRow = (key: string, text: string): HTMLElement => {
    const row = el('div', 'act2-stu-lg-row');
    const k = el('span', `act2-stu-lg-k is-${key}`);
    k.setAttribute('aria-hidden', 'true');
    row.append(k, document.createTextNode(` ${text}`));
    return row;
  };
  legend.append(
    lgRow('green', 'proven — a signed test passed'),
    lgRow('pale', 'being built — not proven yet'),
    lgRow('withered', 'broken — a proof went stale'),
    lgRow('wisp', 'a live agent session'),
  );

  // the details panel (Z4) — the mock's staged story card verbatim.
  const details = el('div', 'act2-stu-details');
  details.setAttribute('data-act2-studio-details', '');
  details.setAttribute('role', 'group');
  details.setAttribute('aria-label', 'Story details — a staged example');
  details.appendChild(el('h4', 'act2-stu-dp-title', 'Shoppers can check out'));
  details.appendChild(el('span', 'act2-stu-dp-status', 'proven'));
  details.appendChild(el('p', 'act2-stu-dp-h', 'Promises'));
  const dpLi = (mark: 'ok' | 'pend', markText: string, text: string): HTMLElement => {
    const row = el('div', 'act2-stu-dp-li');
    const m = el('span', mark, markText);
    m.setAttribute('aria-hidden', 'true');
    row.append(m, document.createTextNode(` ${text}`));
    return row;
  };
  details.append(
    dpLi('ok', '✓', 'Cart holds items — proof signed'),
    dpLi('ok', '✓', 'Payment completes — proof signed'),
    dpLi('pend', '…', 'Receipts — being built'),
  );
  details.appendChild(el('p', 'act2-stu-dp-h', 'Decisions behind this'));
  details.appendChild(el('span', 'act2-stu-dp-adr', 'ADR — mock-first, no backend'));
  details.appendChild(el('span', 'act2-stu-dp-adr', 'ADR — reads the database directly'));
  details.appendChild(el('p', 'act2-stu-dp-h', 'Needs'));
  details.appendChild(el('div', 'act2-stu-dp-li', 'a backend for checkout · a database'));

  main.append(legend, details);
  layer.append(bar, main);
  host.appendChild(layer);
  // establish the hidden initial style before the first setStage adds
  // `is-on` in the same tick — else the Z1 crossfade would jump-cut even for
  // motion-ok visitors (a freshly inserted element has no prior computed
  // style to transition FROM).
  void layer.offsetWidth;

  return {
    setStage(stage: StudioStage | null): void {
      const k = stage === null ? -1 : STAGE_ORDER.indexOf(stage);
      layer.classList.toggle('is-on', k >= 0);
      layer.classList.toggle('has-legend', k >= 1);
      layer.classList.toggle('has-forest', k >= 2);
      layer.classList.toggle('has-details', k >= 3);
      // Z1/Z2: the chrome sits dimmed while the visitor's island holds the
      // light; the forest stage lifts it (the mock's stu-dim idiom).
      layer.classList.toggle('is-dim', k >= 0 && k < 2);
      layer.setAttribute('aria-hidden', k >= 0 ? 'false' : 'true');
      if (stage === null) layer.removeAttribute('data-act2-studio-stage');
      else layer.setAttribute('data-act2-studio-stage', stage);
    },
    unmount(): void {
      layer.remove();
    },
  };
}
