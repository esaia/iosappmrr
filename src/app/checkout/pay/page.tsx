import type { Metadata } from 'next'
import Link from 'next/link'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apps, purchases } from '@/db/schema'
import { Container } from '@/components/ui/container'
import { getCurrentUser } from '@/lib/auth'
import { advertising } from '@/lib/ads'
import { dofollow } from '@/lib/dofollow'
import { formatMoney } from '@/lib/utils'
import { PaddleCheckout } from './paddle-checkout'

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false },
}

/**
 * Where a Paddle checkout opens.
 *
 * Paddle, unlike Polar, hosts no checkout page: the payment UI is drawn by
 * Paddle.js over a page of the seller's own. So this page exists to be that
 * page. `createCheckout` names it when it creates the transaction, Paddle
 * appends `?_ptxn=txn_…`, and Paddle.js renders the checkout into the frame
 * below for that transaction.
 *
 * Nothing is granted here — the entitlement comes from the signed webhook
 * however this page ends. The summary above the frame is read from our own
 * pending row rather than from Paddle, and only for the founder who opened the
 * checkout: the transaction id travels in a URL, and a URL gets shared.
 */
export default async function CheckoutPayPage({
  searchParams,
}: {
  searchParams: Promise<{ _ptxn?: string }>
}) {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
  const environment = process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox'

  const { _ptxn: transactionId } = await searchParams
  const user = await getCurrentUser()

  const [pending] =
    transactionId && user
      ? await db
          .select({ kind: purchases.kind, appName: apps.name })
          .from(purchases)
          .innerJoin(apps, eq(apps.id, purchases.appId))
          .where(
            and(
              eq(purchases.checkoutId, transactionId),
              // Theirs, or no summary. Paddle's own frame is the authority on
              // what is being charged either way.
              eq(purchases.profileId, user.id),
            ),
          )
          .limit(1)
      : []

  const summary = pending
    ? pending.kind === 'sponsor'
      ? {
          title: 'Sponsor a rail',
          price: advertising.monthlyPriceCents,
          suffix: '/mo',
          appName: pending.appName,
        }
      : {
          title: 'Dofollow link',
          price: dofollow.priceCents,
          suffix: '',
          appName: pending.appName,
        }
    : null

  return (
    <Container className="py-16">
      <div className="mx-auto max-w-xl">
        <div className="border-border bg-surface rounded-card overflow-hidden border">
          <div className="border-border border-b px-6 py-5">
            {summary ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h1 className="text-fg font-medium">{summary.title}</h1>
                  <p className="tabular text-fg text-sm font-medium">
                    {summary.price != null ? formatMoney(summary.price) : ''}
                    <span className="text-muted text-[11px]">{summary.suffix}</span>
                  </p>
                </div>
                <p className="text-muted mt-1 text-[13px]">For {summary.appName}</p>
              </>
            ) : (
              <h1 className="text-fg font-medium">Checkout</h1>
            )}
          </div>

          <div className="px-6 py-5">
            {token ? (
              <PaddleCheckout token={token} environment={environment} />
            ) : (
              <p className="text-muted text-[13px] leading-relaxed">
                Checkout is not available yet.
              </p>
            )}
          </div>
        </div>

        <p className="text-muted mt-6 text-center text-[11px] leading-relaxed">
          Paddle is our merchant of record. They take the payment, handle VAT, and send the receipt
          — your card details never reach us.
        </p>

        <p className="mt-4 text-center">
          <Link href="/dashboard" className="text-muted hover:text-fg text-[13px]">
            Back to dashboard
          </Link>
        </p>
      </div>
    </Container>
  )
}
