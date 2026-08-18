export const site = {
  name: 'TrustMRR iOS',
  shortName: 'TrustMRR',
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

export const nav = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/apps', label: 'Apps' },
  { href: '/categories', label: 'Categories' },
  { href: '/stats', label: 'Stats' },
  { href: '/verification', label: 'How we verify' },
] as const
