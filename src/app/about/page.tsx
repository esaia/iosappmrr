import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { site } from '@/lib/site'
import { Container, Measure } from '@/components/ui/container'

export const metadata: Metadata = {
  title: 'About',
  description: `Why ${site.name} exists, what it indexes, and what it deliberately leaves out.`,
}

export default function AboutPage() {
  return (
    <Container className="py-10 sm:py-16">
      <Measure className="max-w-2xl">
        <h1 className="display text-4xl font-semibold sm:text-5xl">About</h1>

        <div className="text-muted mt-6 space-y-5 text-lg leading-relaxed">
          <p>
            Indie iOS revenue is mostly folklore. A screenshot on X, a number in a podcast, a figure
            in a listing that nobody can check. It makes the market hard to read and easy to fake.
          </p>
          <p>
            {site.name} indexes one thing: App Store apps whose revenue we read directly from their
            payment provider. If a founder will not connect a provider, their number does not appear
            here — there is no self-reported tier.
          </p>
          <p>
            Restricting the index to iOS is what makes it useful. Every listing is an App Store app,
            so each one carries its real icon, rating, category, and version alongside its revenue,
            pulled from Apple&apos;s public catalogue. A general SaaS directory cannot do that.
          </p>
        </div>

        <h2 className="display mt-12 text-2xl font-semibold">What we index</h2>
        <ul className="text-muted mt-4 space-y-2 pl-5">
          <li className="list-disc">
            Apps published on the App Store, with a live provider connection.
          </li>
          <li className="list-disc">
            Subscription and in-app purchase revenue, normalised to monthly.
          </li>
          <li className="list-disc">
            Revenue read from the provider, refreshed daily, never self-reported.
          </li>
        </ul>

        <h2 className="display mt-10 text-2xl font-semibold">What we don&apos;t</h2>
        <ul className="text-muted mt-4 space-y-2 pl-5">
          <li className="list-disc">Estimates, projections, or scraped figures.</li>
          <li className="list-disc">
            Profit. Everything here is revenue before Apple&apos;s cut and costs.
          </li>
          <li className="list-disc">Anything a founder has not chosen to connect and publish.</li>
        </ul>

        <p className="text-muted mt-8">
          The full method, including its limits, is on the{' '}
          <Link href="/verification" className="text-blue hover:underline">
            verification page
          </Link>
          .
        </p>

        <div className="border-border mt-12 flex flex-wrap gap-3 border-t pt-8">
          <ButtonLink href="/submit">Verify your app</ButtonLink>
          <ButtonLink href="/leaderboard" variant="secondary">
            Browse the index
          </ButtonLink>
        </div>

        <p className="text-muted mt-10 text-sm">
          Not affiliated with Apple Inc. App Store metadata comes from Apple&apos;s public iTunes
          lookup API.
        </p>
      </Measure>
    </Container>
  )
}
