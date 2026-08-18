/**
 * The paid dofollow upgrade.
 *
 * Hardcoded until a payment provider is chosen — Stripe does not support
 * Georgia, so this is a placeholder, not a live product. Nothing here charges
 * anyone: ticking the box currently grants the link outright.
 */
export const dofollow = {
  priceCents: 1900,
  /**
   * Domain authority to advertise. Null hides the claim entirely — do not put a
   * number here until a real SEO tool measures it. A new domain scores in the
   * single digits, and quoting 69 to someone paying $19 for a link would be
   * a straightforward misrepresentation.
   */
  domainAuthority: null as number | null,
  blurb:
    'Build trust with a verified revenue profile and an authority link that helps search engines and AI assistants recognise your site as the canonical destination.',
}
