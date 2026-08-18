/**
 * Sponsor slots for the side rails.
 *
 * Kept as a typed constant rather than a database table: slots change rarely,
 * and a deploy is a reasonable price for editing them. Move this to a table
 * when someone needs to change an ad without a deploy.
 *
 * There are more spots for sale than there are rails on screen, so booked
 * sponsors rotate through the two rails. Unsold spots show an
 * "advertise here" placeholder rather than blank space.
 */
export type Ad = {
  /** Sponsor name, shown under the creative and used as the image alt text. */
  name: string
  /** Where the click goes. UTM parameters belong here. */
  href: string
  /** Path under /public, or an absolute URL on a host you control. */
  imageUrl: string
  /** One short line under the name. Optional. */
  blurb?: string
}

/** How many sponsors you are willing to sell at once. */
export const TOTAL_SPOTS = 6

/** How long each sponsor holds a rail before the next one takes it. */
export const ROTATE_MS = 10_000

/** Booked sponsors, in the order they were sold. Never longer than TOTAL_SPOTS. */
export const ads: Ad[] = []

/** Spots not yet sold. */
export function spotsLeft() {
  return Math.max(0, TOTAL_SPOTS - ads.length)
}

/**
 * Splits the booked sponsors between the two rails, so the same sponsor is
 * never on screen twice at once. Left takes the even indices, right the odd.
 */
export function adsForSide(side: 'left' | 'right') {
  return ads.filter((_, index) => (side === 'left' ? index % 2 === 0 : index % 2 === 1))
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
   * Monthly price in cents. Hardcoded until a payment provider is chosen —
   * Stripe does not serve Georgia, so Paddle or Lemon Squeezy are the likely
   * candidates. Change this one number when the real rate is set.
   */
  monthlyPriceCents: 1900 as number | null,
  /**
   * Checkout link, once there is one. Null renders the button as a disabled
   * "coming soon" rather than pretending a payment can be taken.
   */
  checkoutUrl: null as string | null,
  /**
   * Verified monthly visitors. Null until you have analytics to cite — do not
   * put a number here you cannot evidence.
   */
  monthlyVisitors: null as number | null,
  /** Real quotes from real sponsors only. Empty hides the section. */
  testimonials: [] as Testimonial[],
}
