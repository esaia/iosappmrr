import type { Metadata } from 'next'
import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { categories, techStackTags } from '@/db/schema'
import { lookupApp } from '@/lib/appstore/lookup'
import { getCurrentUser } from '@/lib/auth'
import { dofollow } from '@/lib/dofollow'
import { isPaddleConfigured } from '@/lib/paddle'
import { CONNECTABLE_PROVIDERS } from '@/lib/providers'
import { PROVIDER_FIELDS } from '@/lib/provider-fields'
import { formatMoney } from '@/lib/utils'
import { SubmitFlow } from './submit-flow'
import { Container, Measure } from '@/components/ui/container'

export const metadata: Metadata = {
  alternates: { canonical: '/submit' },
  title: 'Add your iOS app',
  description:
    'List your App Store app and connect its revenue in one step. Takes about two minutes and one read-only API key.',
}

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const [{ id }, user, categoryList, techList] = await Promise.all([
    searchParams,
    getCurrentUser(),
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(techStackTags).orderBy(asc(techStackTags.name)),
  ])

  /*
   * Returning from sign-in carries the App Store ID in the URL, so the form
   * comes back filled in rather than empty. Everything here is re-derived from
   * Apple, which is why a bare ID is enough to restore the step.
   */
  const resumed = id && /^\d{6,12}$/.test(id) ? await lookupApp(id).catch(() => null) : null

  return (
    <Container className="py-10 sm:py-14">
      <Measure className="mx-auto">
        <h1 className="display text-4xl">Add your app</h1>
        <p className="text-muted mt-3 text-[13px] leading-relaxed">
          Paste your App Store link and we&apos;ll fill in the rest. Add your provider key in the
          same form — your app goes live the moment it verifies.
        </p>

        {!user && (
          <p className="border-border bg-surface text-muted rounded-card mt-5 border px-4 py-3 text-[12px] leading-relaxed">
            No account needed to look up your app. You&apos;ll sign in when you save, so the listing
            belongs to you.{' '}
            <Link href="/login?next=%2Fsubmit" className="text-fg underline underline-offset-4">
              Sign in first
            </Link>
          </p>
        )}

        <SubmitFlow
          isSignedIn={Boolean(user)}
          initialApp={
            resumed && {
              appStoreId: resumed.appStoreId,
              name: resumed.name,
              tagline: (resumed.description?.split('\n')[0] ?? '').slice(0, 110),
              description: resumed.description?.slice(0, 1500) ?? '',
              iconUrl: resumed.iconUrl,
              sellerName: resumed.sellerName,
              primaryGenre: resumed.primaryGenre,
              bundleId: resumed.bundleId,
              appStoreUrl: resumed.appStoreUrl,
              website: resumed.website,
              releasedAt: resumed.releasedAt?.toISOString().slice(0, 10) ?? null,
            }
          }
          categories={categoryList.map((c) => ({
            slug: c.slug,
            name: c.name,
            genre: c.appStoreGenre,
          }))}
          tech={techList.map((t) => ({ slug: t.slug, name: t.name }))}
          providers={CONNECTABLE_PROVIDERS.map((provider) => ({
            id: provider.id,
            name: provider.name,
            instructions: provider.instructions,
            steps: provider.steps,
            docsUrl: provider.docsUrl,
            fields: PROVIDER_FIELDS[provider.id],
          }))}
          /* Not for sale until Paddle has a price for it, so it is not offered. */
          dofollowOffer={
            isPaddleConfigured('dofollow')
              ? {
                  price: formatMoney(dofollow.priceCents),
                  blurb: dofollow.blurb,
                  domainAuthority: dofollow.domainAuthority,
                }
              : null
          }
        />
      </Measure>
    </Container>
  )
}
