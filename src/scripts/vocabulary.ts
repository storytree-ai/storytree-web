// ---------------------------------------------------------------------------
// THE VOCABULARY FENCE — the reader's nouns on the page, ours off it.
//
// ADR-0494 D5, from the owner walking the built site on 2026-09-01: *"our prose terminology needs
// better alignment to the audience, each island is a microservice - this is what devs outside of
// storytree will understand, we shouldnt state storytree terminology and expect them to understand
// it."*
//
// So visitor-facing prose says MICROSERVICE, DEPENDS-ON and DAG. It does not say story, capability,
// arc or contract — those are the nouns of the corpus this system keeps, and a stranger is not
// expected to acquire them in order to read a marketing page.
//
// ⚠ THIS IS NOT A SOFTENING OF "EXCITEMENT, NOT TEACHING" (ADR-0453 D1) — IT IS THAT RULE APPLIED
// PROPERLY. Teaching a stranger the word "story" is instruction. Saying "microservice" to the
// experienced developer ADR-0453 D2 names as the reader is fluency in a language they already hold,
// and it costs a sentence LESS rather than more: `Every island is one story — one thing the system
// does` became `Every island is a microservice.` and lost the gloss along with the noun.
//
// ⚠⚠ THE FENCE REACHES THE PROSE AND STOPS AT THE MAP. Island and component LABELS are our real,
// untranslated, deliberately illegible corpus names, and they stay that way: ADR-0453 D3's whole
// mechanism is a visitor projecting their OWN system onto a shape they cannot read, so renaming an
// island would invert that decision while looking like the same job. ADR-0494 D5 clarified D3 in
// place for exactly this reason, because a session reading D3's "no glossary" alone would refuse
// this work and be reading half the record. Nothing here scans a label, an id, or a title that came
// out of the snapshot — only prose the site itself wrote.
//
// ⚠ AND IT IS A WORD LIST, WHICH IS THE HONEST LIMIT OF WHAT A CHECK CAN SEE. It catches the noun
// arriving; it cannot tell whether the sentence around it is written for the reader. That judgement
// is a person's and no test replaces it — `a-compliance-gate-turns-a-judgment-ceremony-into-theatre`
// is the standing reason not to pretend otherwise.
//
// This module is pure and DOM-free so `vocabulary.test.ts` can hold every prose surface in chapter 2
// to it under `bun test`, which has no DOM.
// ---------------------------------------------------------------------------

/**
 * The internal nouns, and what the reader's language calls each of them instead.
 *
 * The value half is not enforced — a check cannot know which replacement a given sentence wanted —
 * but it is written down here rather than in four separate comments so that the next person to
 * translate a string reaches for the same word the last one did. Two beats written in two
 * vocabularies is worse than either alone.
 */
export const INTERNAL_NOUNS: Readonly<Record<string, string>> = {
  story: 'microservice',
  stories: 'microservices',
  capability: 'component',
  capabilities: 'components',
  contract: 'component',
  contracts: 'components',
  arc: 'initiative',
  arcs: 'initiatives',
};

/**
 * Every internal noun in `text`, lowercased, in the order they appear.
 *
 * ⚠ WORD BOUNDARIES ON BOTH SIDES, WHICH IS WHAT KEEPS THE PRODUCT NAME OUT OF IT. `storytree`
 * contains `story` and is the one word on this page that must never be flagged; `\bstory\b` does not
 * match inside it because `t` is a word character. The same boundary keeps `search` clear of `arc`.
 * A substring scan would have reported the site's own name as a violation on its first run, which is
 * the shape of check that gets deleted rather than obeyed.
 */
export function findInternalNouns(text: string): string[] {
  const hits: Array<{ readonly at: number; readonly word: string }> = [];
  for (const noun of Object.keys(INTERNAL_NOUNS)) {
    for (const m of text.matchAll(new RegExp(`\\b${noun}\\b`, 'gi'))) {
      hits.push({ at: m.index ?? 0, word: noun });
    }
  }
  // Ordered by POSITION in the sentence rather than by the order of the noun list, so a failure
  // message points at the offending phrase in the order a reader would meet it.
  return hits.sort((a, b) => a.at - b.at).map((hit) => hit.word);
}

/** True when `text` is free of internal nouns — the property every visitor-facing string holds. */
export function speaksReaderVocabulary(text: string): boolean {
  return findInternalNouns(text).length === 0;
}
