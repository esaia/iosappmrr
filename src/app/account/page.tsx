import type { Metadata } from 'next'
import Link from 'next/link'
import { AccountTabs } from '@/components/account-tabs'
import { requireUser } from '@/lib/auth'
import { listBillingForProfile } from '@/lib/data/account'
import { signOutAction } from '@/app/auth/actions'
import { AccountForm } from './account-form'
import { BillingList } from './billing-list'
import { Container, Measure } from '@/components/ui/container'

export const metadata: Metadata = {
  title: 'Account & billing',
  robots: { index: false },
}

export default async function AccountPage() {
  const user = await requireUser('/account')
  const billing = await listBillingForProfile(user.id)

  return (
    <Container className="py-10 sm:py-14">
      <Measure className="max-w-2xl">
        <AccountTabs />

        <h1 className="display mt-8 text-4xl font-semibold">Account &amp; billing</h1>
        <p className="text-muted mt-3 text-[13px] leading-relaxed">
          Your public profile at{' '}
          <Link href={`/founders/${user.profile.handle}`} className="text-blue hover:underline">
            /founders/{user.profile.handle}
          </Link>
          , and everything you have paid for.
        </p>

        <section className="mt-10">
          <h2 className="label">Profile</h2>
          <AccountForm
            email={user.email}
            initial={{
              handle: user.profile.handle,
              name: user.profile.name ?? '',
              bio: user.profile.bio ?? '',
              website: user.profile.website ?? '',
              twitter: user.profile.twitter ?? '',
            }}
          />
        </section>

        <section className="mt-12">
          <h2 className="label">Billing</h2>
          <BillingList
            rows={billing.map((row) => ({
              ...row,
              currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
              createdAt: row.createdAt.toISOString(),
            }))}
          />
        </section>

        <section className="border-border mt-12 border-t pt-8">
          <h2 className="label">Session</h2>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <form action={signOutAction}>
              <button
                type="submit"
                className="border-border text-muted hover:border-border-strong hover:text-fg rounded-card border px-3 py-2 text-[13px] transition-colors"
              >
                Sign out
              </button>
            </form>
            <p className="text-muted text-xs">
              Signed in as {user.email ?? `@${user.profile.handle}`}.
            </p>
          </div>
        </section>
      </Measure>
    </Container>
  )
}
