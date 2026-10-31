/**
 * The splash wordmark timeline, shared by the CSS reveal and the audio ident so the two
 * cannot drift apart. `notflixLetterReveal` in index.css is 2.4s long; the ident treats
 * 72% of it as the moment a letter stops blurring and becomes readable.
 */

export const LETTER_START_DELAY = 0.9
export const LETTER_STAGGER = 0.4
export const LETTER_REVEAL_SECONDS = 2.4

const LETTER_COUNT = 7

/** When each letter starts flying in, in seconds from the splash appearing. */
export const LETTER_AT = Array.from({ length: LETTER_COUNT }, (_, index) =>
  LETTER_START_DELAY + index * LETTER_STAGGER + (index >= 3 ? 0.18 : 0),
)

/** When the last letter has settled — the ident puts its final hit here. */
export const WORDMARK_RESOLVED_AT = LETTER_AT[LETTER_COUNT - 1] + LETTER_REVEAL_SECONDS * 0.72

/** When the band of light starts crossing the finished wordmark. */
export const SWEEP_START_AT = WORDMARK_RESOLVED_AT + 0.12
export const SWEEP_SECONDS = 3

/**
 * `notflixSweep` runs on cubic-bezier(.4,0,.2,1), which burns through half of its travel in the
 * first 35% of its clock, so the centre of the band sits on the letters 1.05s after it starts.
 * The ident lands its finale there.
 */
export const LIGHT_OVER_WORDMARK_AT = SWEEP_START_AT + SWEEP_SECONDS * 0.35
