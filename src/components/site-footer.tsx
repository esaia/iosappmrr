import Link from 'next/link'
import { Logo } from '@/components/logo'
import { site } from '@/lib/site'

const columns = [
  {
    heading: 'Browse',
    links: [
      { href: '/leaderboard', label: 'Top 50 by MRR' },
      { href: '/apps', label: 'All apps' },
      { href: '/categories', label: 'Categories' },
      { href: '/stats', label: 'Stats' },
    ],
  },
  {
    heading: 'Founders',
    links: [
      { href: '/submit', label: 'Add your app' },
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/verification', label: 'How we verify' },
    ],
  },
  {
    heading: 'About',
    links: [
      { href: '/about', label: 'About' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-border mt-20 border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="text-muted mt-3 max-w-xs text-xs leading-relaxed">
            Revenue is read directly from each app&apos;s payment provider and refreshed hourly.
            Nothing here is self-reported.
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.heading}>
            <h2 className="label">{column.heading}</h2>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-muted hover:text-fg text-[13px]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-border mx-auto max-w-6xl border-t px-4 py-6 sm:px-6">
        <p className="text-dim text-[11px]">
          {site.name} — not affiliated with Apple Inc. App Store data via the public iTunes API.
        </p>
      </div>
    </footer>
  )
}
