'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/apps', label: 'Apps' },
  { href: '/admin/purchases', label: 'Purchases' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/activity', label: 'Activity' },
  { href: '/admin/backup', label: 'Backup' },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav
      className="border-border rail mt-6 flex gap-1 overflow-x-auto border-b pb-2"
      aria-label="Admin sections"
    >
      {TABS.map((tab) => {
        // Overview owns only the exact path; the rest own their subtrees, so a
        // detail page still highlights the section it belongs to.
        const active = tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-[13px] transition-colors',
              active ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
