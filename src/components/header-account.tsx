'use client'

import Link from 'next/link'
import { useViewer } from '@/lib/use-viewer'

const STYLES = {
  bar: 'text-muted hover:text-fg hidden rounded-md px-2.5 py-1.5 text-[13px] transition-colors hover:bg-white/10 sm:block',
  rail: 'text-muted hover:text-fg shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors sm:hidden',
}

const ADMIN = {
  bar: 'text-gold hover:text-fg hidden rounded-md px-2.5 py-1.5 text-[13px] transition-colors hover:bg-white/10 sm:block',
  rail: 'text-gold hover:text-fg shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors sm:hidden',
}

/**
 * The header's account corner: the reader's handle when signed in, "Sign in"
 * otherwise. Read in the browser (see `useViewer`) so the pages around it can be
 * cached. Nothing shows until the answer is in, rather than a "Sign in" that
 * flips to a handle a moment later.
 *
 * Only admins see the Admin link. Not a security measure — the route and its
 * actions check the role themselves — but a link that redirects everyone else
 * straight back to the dashboard would be a dead end presented as navigation.
 */
export function HeaderAccount({ variant }: { variant: 'bar' | 'rail' }) {
  const viewer = useViewer()

  if (viewer === undefined) return null

  if (!viewer) {
    return (
      <Link href="/login" className={STYLES[variant]}>
        Sign in
      </Link>
    )
  }

  return (
    <>
      {viewer.role === 'admin' && (
        <Link href="/admin" className={ADMIN[variant]}>
          Admin
        </Link>
      )}
      <Link href="/dashboard" className={STYLES[variant]}>
        @{viewer.handle}
      </Link>
    </>
  )
}
