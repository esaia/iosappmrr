import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
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
   *
   * A signed-in non-admin is told so rather than bounced to the dashboard. A
   * silent redirect is indistinguishable from a broken link: you click, you end
   * up somewhere else, and nothing says why. The pages themselves and every
   * action still call `requireAdmin`, so this is a message, not the gate.
   */
  const user = await requireUser('/admin')

  if (user.profile.role !== 'admin') {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
        <h1 className="display text-2xl font-semibold">Not an admin</h1>
        <p className="text-muted mt-3 text-[13px] leading-relaxed">
          You are signed in as <span className="text-fg">@{user.profile.handle}</span>, which does
          not have the admin role. If that is the wrong account, sign out and sign back in with the
          right one.
        </p>
        <p className="text-muted mt-3 text-[13px] leading-relaxed">
          To grant the role, run{' '}
          <code className="bg-surface-2 rounded px-1.5 py-0.5 text-[12px]">
            npm run role -- {user.profile.handle} admin
          </code>{' '}
          and reload — the role is read from the database on every request, so there is no need to
          sign in again.
        </p>
        <Link href="/dashboard" className="text-blue mt-6 inline-block text-[13px] hover:underline">
          Back to your dashboard
        </Link>
      </div>
    )
  }

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
