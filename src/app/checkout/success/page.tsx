import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Payment received',
  robots: { index: false },
}

/**
 * Where Polar sends the customer back to.
 *
 * Deliberately does no granting. Landing here is not proof of payment — anyone
 * can type this URL — so the benefit is applied by the signed webhook instead.
 * That means it can arrive a second or two after this page renders, which is
 * what the copy says rather than pretending the purchase is already live.
 */
export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
      <h1 className="display text-3xl font-semibold">Payment received</h1>
      <p className="text-muted mt-4 text-[13px] leading-relaxed">
        Thank you. Your purchase is being applied now — it usually takes a few seconds. Reload your
        dashboard if you do not see it straight away.
      </p>
      <Link
        href="/dashboard"
        className="bg-fg text-bg mt-7 inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-[13px] font-medium transition-opacity hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
