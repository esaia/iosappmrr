import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { AdminNav } from './admin-nav'

/**
 * Nothing under /admin should ever be indexed, cached, or served from a
 * previously rendered copy — every page here reflects one moment of database
 * state and is visible to a handful of people.
 */
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin' },
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  /*
   * The middleware only checks that *someone* is signed in — it has no database
   * access, so it cannot read a role. This is the check that actually gates the
   * section, and it runs before any child page renders.
   */
  const user = await requireAdmin()

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl font-semibold sm:text-4xl">Admin</h1>
          <p className="text-muted mt-1.5 text-[13px]">
            Signed in as{' '}
            <Link href={`/founders/${user.profile.handle}`} className="text-blue hover:underline">
              @{user.profile.handle}
            </Link>
            . Every change on these screens is recorded in the activity log.
          </p>
        </div>
      </div>

      <AdminNav />

      <div className="mt-6">{children}</div>
    </div>
  )
}
