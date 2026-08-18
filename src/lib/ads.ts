/**
 * Sponsor rail configuration.
 *
 * The sponsors themselves live in the `purchases` table — a slot is sold
 * through Polar and granted by its webhook, so booking one no longer takes a
 * deploy. What stays here is the shape of the inventory: how many slots exist
 * and how fast they rotate.
 *
 * There are more spots for sale than there are rails on screen, so booked
 * sponsors rotate through the two rails. Unsold spots show an
 * "advertise here" placeholder rather than blank space.
 */

/**
 * How many sponsors to sell at once, before an admin says otherwise.
 *
 * The live number lives in `site_settings` and is read through
 * `getSponsorSlots()` — this is only the value a fresh database starts with.
 * Server code must not import this constant to decide whether a slot is
 * available; it would ignore whatever the admin set.
 */
export const DEFAULT_SPONSOR_SLOTS = 6

/** How long each sponsor holds a rail before the next one takes it. */
export const ROTATE_MS = 10_000

/**
 * Splits booked sponsors between the two rails, so the same sponsor is never
 * on screen twice at once. Left takes the even indices, right the odd.
 */
export function forSide<T>(items: T[], side: 'left' | 'right') {
  return items.filter((_, index) => (side === 'left' ? index % 2 === 0 : index % 2 === 1))
}

/**
 * Terms shown in the "advertise here" modal.
 *
 * Every figure here is a factual claim made to a prospective advertiser, so
 * nothing is invented: leave a field null and its card is hidden rather than
 * filled with a plausible-looking number.
 */
export type Testimonial = {
  quote: string
  name: string
  company: string
  /** Path under /public. Optional; initials are used when absent. */
  avatarUrl?: string
}

export const advertising = {
  /**
   * Monthly price in cents, for display only. The amount actually charged is
   * whatever the Polar product is priced at — this figure must be kept in step
   * with it by hand, and it is the one shown before anyone reaches checkout.
   */
  monthlyPriceCents: 1000 as number | null,
  /**
   * Verified monthly visitors. Null until you have analytics to cite — do not
   * put a number here you cannot evidence.
   */
  monthlyVisitors: null as number | null,
  /** Real quotes from real sponsors only. Empty hides the section. */
  testimonials: [] as Testimonial[],
}
