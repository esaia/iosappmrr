import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false },
}

/**
 * Where Dodo sends the customer back to, on success and on failure alike —
 * the same `return_url` is used for both, distinguished only by a `status`
 * query param Dodo appends (`succeeded`, `failed`, `cancelled`, …).
 *
 * A successful-looking status here is still not proof of payment — anyone can
 * type this URL with `status=succeeded` on it — so the benefit is applied by
 * the signed webhook regardless of what this page says. That means it can
 * arrive a second or two after this page renders, which is what the success
 * copy says rather than pretending the purchase is already live. A failed
 * status, on the other hand, is safe to trust for display purposes: showing
 * a wrong "payment received" to someone whose card was declined is a worse
 * failure than showing a wrong "something went wrong" to nobody, since the
 * webhook never grants anything for a payment that did not happen.
 *
 * The animation is CSS only, so this stays a server component and the text is
 * in the HTML whether or not anything moves. Each element ends at its resting
 * state, so the reduced-motion rule in globals.css simply lands them there.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const failed = status != null && status !== 'succeeded'

  return (
    <Container className="py-20">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        {failed ? <FailureMark /> : <SuccessMark />}

        <h1 className="display rise mt-8 text-3xl font-semibold" style={{ animationDelay: '0.5s' }}>
          {failed ? 'Payment failed' : 'Payment received'}
        </h1>

        <p
          className="text-muted rise mt-4 text-[13px] leading-relaxed"
          style={{ animationDelay: '0.62s' }}
        >
          {failed
            ? 'Your card was not charged. Try again from the app’s edit screen, or use a different card.'
            : 'Thank you. Your purchase is being applied now — it usually takes a few seconds. Reload your dashboard if you do not see it straight away.'}
        </p>

        <Link
          href="/dashboard"
          className="bg-fg text-bg rise rounded-card mt-7 inline-flex items-center justify-center px-4 py-2.5 text-[13px] font-medium transition-opacity hover:opacity-90"
          style={{ animationDelay: '0.74s' }}
        >
          Back to dashboard
        </Link>
      </div>
    </Container>
  )
}

/**
 * A ring and a tick that draw themselves, under a single ring leaving the mark.
 *
 * `pathLength` normalises every stroke to 1 regardless of its real geometry, so
 * the dash values below are fractions rather than numbers that would have to be
 * re-measured whenever the path moves.
 */
function SuccessMark() {
  return (
    <div className="relative flex size-24 items-center justify-center">
      {/* Behind everything, so the mark sits in its own light rather than on
          a flat panel. */}
      <div className="bg-green/12 absolute inset-0 rounded-full blur-2xl" aria-hidden="true" />

      <span
        className="border-green/40 halo absolute inset-2 rounded-full border"
        aria-hidden="true"
      />

      <svg
        viewBox="0 0 100 100"
        className="settle relative size-24"
        fill="none"
        role="img"
        aria-label="Payment received"
      >
        <circle
          cx="50"
          cy="50"
          r="34"
          pathLength={1}
          className="stroke-green/25"
          strokeWidth="4"
          strokeDasharray="1"
        />
        <circle
          cx="50"
          cy="50"
          r="34"
          pathLength={1}
          className="stroke-green draw"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="1"
          strokeDashoffset="1"
          // Starts at twelve o'clock rather than three, so it reads as a dial
          // closing rather than a shape rotating.
          transform="rotate(-90 50 50)"
        />
        <path
          d="M34 51.5 L45.5 63 L67 41"
          pathLength={1}
          className="stroke-green draw"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1"
          strokeDashoffset="1"
          style={{ animationDelay: '0.42s', animationDuration: '0.4s' }}
        />
      </svg>
    </div>
  )
}

/** The same ring-and-mark shape as `SuccessMark`, in red and with a cross. */
function FailureMark() {
  return (
    <div className="relative flex size-24 items-center justify-center">
      <div className="bg-red/12 absolute inset-0 rounded-full blur-2xl" aria-hidden="true" />

      <span className="border-red/40 halo absolute inset-2 rounded-full border" aria-hidden="true" />

      <svg
        viewBox="0 0 100 100"
        className="settle relative size-24"
        fill="none"
        role="img"
        aria-label="Payment failed"
      >
        <circle
          cx="50"
          cy="50"
          r="34"
          pathLength={1}
          className="stroke-red/25"
          strokeWidth="4"
          strokeDasharray="1"
        />
        <circle
          cx="50"
          cy="50"
          r="34"
          pathLength={1}
          className="stroke-red draw"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="1"
          strokeDashoffset="1"
          transform="rotate(-90 50 50)"
        />
        <path
          d="M39 39 L61 61 M61 39 L39 61"
          pathLength={1}
          className="stroke-red draw"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1"
          strokeDashoffset="1"
          style={{ animationDelay: '0.42s', animationDuration: '0.4s' }}
        />
      </svg>
    </div>
  )
}
