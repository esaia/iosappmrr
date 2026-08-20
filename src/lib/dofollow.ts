/**
 * The paid dofollow upgrade.
 *
 * Sold through Paddle. The price below is for display only — the amount actually
 * charged is whatever the Paddle price is set to, so the two must be kept in
 * step by hand. The flag it grants is written solely by the Paddle webhook.
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
