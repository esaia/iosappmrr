import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { PaddleCheckout } from './paddle-checkout'

export const metadata: Metadata = {
  title: 'Opening checkout',
  robots: { index: false },
}

/**
 * Where a Paddle checkout opens.
 *
 * Paddle, unlike Polar, hosts no checkout page: the overlay is drawn by
 * Paddle.js over a page of the seller's own. So this page exists to be that
 * page. `createCheckout` names it when it creates the transaction, Paddle
 * appends `?_ptxn=txn_…`, and Paddle.js opens the overlay for that transaction
 * as soon as it initialises.
 *
 * Nothing is granted here and nothing is read from the query string by us — the
 * transaction id in the URL is Paddle's to interpret, and the entitlement comes
 * from the signed webhook however this page ends.
 */
export default function CheckoutPayPage() {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
  const environment = process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox'

  return (
    <Container className="py-20">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <h1 className="display text-2xl font-semibold">Opening checkout…</h1>

        {token ? (
          <>
            <p className="text-muted mt-4 text-[13px] leading-relaxed">
              Paddle handles the payment. If the checkout does not appear, your browser may be
              blocking it — allow pop-ups for this site and reload.
            </p>
            <PaddleCheckout token={token} environment={environment} />
          </>
        ) : (
          <p className="text-muted mt-4 text-[13px] leading-relaxed">
            Checkout is not available yet.
          </p>
        )}

        <Link href="/dashboard" className="text-muted hover:text-fg mt-8 text-[13px]">
          Back to dashboard
        </Link>
      </div>
    </Container>
  )
}
