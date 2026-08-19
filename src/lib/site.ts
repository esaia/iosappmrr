export const site = {
  /**
   * The site as a thing being named — in prose, in the footer, in the terms,
   * and as the publisher in structured data. Carries the domain, because that
   * is what the site is called.
   */
  name: 'IosAppMRR.com',
  /**
   * The same name where it is a label rather than a subject: page titles, the
   * title template, share cards. A browser tab is narrow and truncates from the
   * right, so the `.com` there costs four characters of the tagline and adds
   * nothing a reader looking at the tab does not already know.
   *
   * Drops the `.com` only — the capitalisation matches the wordmark, so the tab
   * and the logo read as the same name.
   */
  shortName: 'IosAppMRR',
  /*
   * The wordmark, split so the logo does not hardcode it: renaming the site
   * should be an edit to this file and nothing else. `suffix` is set in the
   * dimmer grey after the main word — leave it empty for a one-word name.
   */
  wordmark: { main: 'IosAppMRR', suffix: '.com' },
  tagline: 'Verified revenue for App Store apps',
  description:
    'Every number on this site is pulled straight from RevenueCat or App Store Connect — never typed in by hand. Browse verified iOS app revenue, or connect your own.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  // TODO: replace with the real contact address before launch. Used on the
  // privacy and terms pages, which are legally required to name one.
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@example.com',
  /** Jurisdiction whose law governs the terms. TODO: confirm before launch. */
  jurisdiction: 'Georgia',
} as const

/**
 * The header only. Categories and Stats are deliberately absent: they are ways
 * of slicing the index rather than places someone arrives wanting to go, and
 * the footer's Browse column already lists both. A header short enough to read
 * at a glance is worth more than one that repeats the footer.
 */
export const nav = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/apps', label: 'Apps' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/verification', label: 'How we verify' },
] as const
