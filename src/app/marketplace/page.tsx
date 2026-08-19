import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Marketplace',
  description:
    'A marketplace for buying and selling App Store apps whose revenue is already verified. Not open yet.',
}

/**
 * The marketplace does not exist yet, and the page says so plainly rather than
 * dressing an empty route up as a product. It is linked from the main nav on
 * purpose: the point is to tell founders what is coming and let them ask to be
 * told when it opens, not to pad the index with a page that promises listings
 * it cannot show.
 */
export default function MarketplacePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <span className="border-gold/40 bg-gold-dim text-gold inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold tracking-[0.11em] uppercase">
        <span className="bg-gold size-1.5 rounded-full" aria-hidden="true" />
        Coming soon
      </span>
      <h1 className="display mt-4 text-4xl font-semibold sm:text-5xl">Marketplace</h1>

      <div className="text-muted mt-6 space-y-5 text-lg leading-relaxed">
        <p>
          Apps change hands constantly, and almost always on trust. A buyer sees a screenshot of a
          dashboard, takes the seller&apos;s word for the churn, and finds out what they actually
          bought a month after the wire clears.
        </p>
        <p>
          {site.name} already reads revenue straight from each app&apos;s payment provider. The
          marketplace is the obvious next step: listings where the asking price sits next to a
          revenue history nobody typed in by hand.
        </p>
      </div>

      <h2 className="display mt-12 text-2xl font-semibold">What it will be</h2>
      <ul className="text-muted mt-4 space-y-2 pl-5">
        <li className="list-disc">
          Listings only for apps with a live provider connection — no self-reported asking numbers.
        </li>
        <li className="list-disc">
          Revenue history over the whole period we have tracked, shown to the buyer as we recorded
          it.
        </li>
        <li className="list-disc">
          App Store metadata — ratings, category, release history — alongside it.
        </li>
        <li className="list-disc">
          Direct contact between founder and buyer. We are not a broker.
        </li>
      </ul>

      <div className="border-border bg-surface mt-12 rounded-xl border p-6">
        <h2 className="text-fg text-base font-medium">Want to list when it opens?</h2>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Connect your app now. The marketplace will draw on the revenue history we have already
          collected, so an app verified today will have months of it by the time listings open.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/submit">Verify your app</ButtonLink>
          <ButtonLink href="/leaderboard" variant="secondary">
            Browse the index
          </ButtonLink>
        </div>
      </div>

      <p className="text-muted mt-10 text-sm">
        No date yet — it opens when there is enough verified history to make a listing worth
        reading. Until then,{' '}
        <Link href="/verification" className="text-blue hover:underline">
          how we verify
        </Link>{' '}
        explains what those numbers are.
      </p>
    </div>
  )
}
