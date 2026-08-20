/**
 * The origin every absolute URL on the site is built from, tidied up.
 *
 * This value ends up in canonical tags, the sitemap, the `@id` of every piece
 * of structured data, Paddle's return URLs, and — since the embed badge — inside
 * an `<img src>` pasted into somebody else's page. That last one is why this
 * function exists: an `http://` image on an `https://` site is mixed content,
 * and every browser blocks it outright. A badge that renders here and shows a
 * broken icon on the founder's page is worse than no badge.
 *
 * So: a missing scheme becomes `https://`, an `http://` one is upgraded, and a
 * trailing slash is dropped before it can double up in `${site.url}/apps/...`.
 * Localhost keeps its `http://`, because that is what a dev server serves.
 */
function origin(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '')
  const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
  return withScheme.replace(/^http:\/\/(?!localhost|127\.0\.0\.1)/, 'https://')
}

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
    'Every number on this site is pulled straight from RevenueCat, Adapty, or App Store Connect — never typed in by hand. Browse verified iOS app revenue, or connect your own.',
  url: origin(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  // TODO: replace with the real contact address before launch. Used on the
  // privacy and terms pages, which are legally required to name one.
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@example.com',
  /**
   * Where a reader is asked to get in touch. The site is one person, and a
   * reply on X arrives faster than one to the address the terms have to name —
   * so the FAQ points here and the legal pages keep the email.
   */
  x: { handle: 'esaia__', url: 'https://x.com/esaia__' },
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
