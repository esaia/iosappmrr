export const site = {
  name: 'TrustMRR iOS',
  shortName: 'TrustMRR',
  tagline: 'Verified revenue for App Store apps',
  description:
    'Every number on this site is pulled straight from RevenueCat, App Store Connect, Superwall or Stripe — never typed in by hand. Browse verified iOS app revenue, or connect your own.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
} as const

export const nav = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/apps', label: 'Apps' },
  { href: '/categories', label: 'Categories' },
  { href: '/stats', label: 'Stats' },
  { href: '/verification', label: 'How we verify' },
] as const
