'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The two halves of "your stuff": the apps you have listed, and the account
 * behind them.
 *
 * They were two header links, which made them look like unrelated
 * destinations. As tabs they read as one place with two views, and the header
 * carries a single entry into it.
 */
const TABS = [
  { href: '/dashboard', label: 'Your apps' },
  { href: '/account', label: 'Account & billing' },
]

export function AccountTabs() {
  const pathname = usePathname()

  return (
    <nav className="border-border flex gap-1 border-b" aria-label="Account">
      {TABS.map((tab) => {
        // Exact match, not a prefix: /dashboard/[appId]/edit is a page of its
        // own, and lighting the tab there would promise a view it is not.
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'border-fg text-fg -mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium'
                : 'text-muted hover:text-fg -mb-px border-b-2 border-transparent px-3 py-2.5 text-[13px] transition-colors'
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
