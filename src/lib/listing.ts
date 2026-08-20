/**
 * How long a listing's own text may be.
 *
 * One copy, because there are four places that have to agree: the submit
 * schema, the edit schema, the `maxLength` on each form's input, and the script
 * that writes a listing straight from Apple's metadata. They were four literals
 * and they had already drifted — `db:add-app` wrote a 120-character tagline off
 * the App Store description, which the database accepted happily and the edit
 * form then refused to save, leaving a listing its owner could not edit.
 *
 * The tagline is a line on a card, so it is bounded by what fits there rather
 * than by anything Apple sends. The description is bounded by what a reader
 * will actually read.
 */
export const LISTING_LIMITS = {
  tagline: 110,
  description: 2000,
} as const

/**
 * Cuts text down to a limit without leaving half a word at the end.
 *
 * Used where the text is not ours — Apple's description, pulled in when a
 * listing is created from the store rather than typed by its founder. Backs up
 * to the last space in the final tenth and adds an ellipsis, so the result
 * reads as shortened rather than as truncated. Text already inside the limit is
 * returned untouched, ellipsis and all decisions skipped.
 */
export function clampText(text: string, limit: number) {
  const trimmed = text.trim()
  if (trimmed.length <= limit) return trimmed

  // One character of headroom for the ellipsis itself.
  const cut = trimmed.slice(0, limit - 1)
  const lastSpace = cut.lastIndexOf(' ')
  const body = lastSpace > limit * 0.9 ? cut.slice(0, lastSpace) : cut
  return `${body.replace(/[\s,;:.–—-]+$/, '')}…`
}

/**
 * The message a length rule shows when it fires.
 *
 * Zod's own is "Invalid input", which tells a founder that something on the
 * page is wrong and nothing about which rule they broke or by how much — and
 * for a field they very often filled by pasting store copy, "too long" is the
 * one thing they need to hear. Built from the same constant the rule uses, so
 * the number in the sentence cannot drift from the number being enforced.
 */
export function tooLong(what: string, limit: number) {
  return `${what} are capped at ${limit} characters. Trim it and try again.`
}
