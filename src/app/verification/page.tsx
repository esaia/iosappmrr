import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { CONNECTABLE_PROVIDERS } from '@/lib/providers'
import { site } from '@/lib/site'
import { Container, Measure } from '@/components/ui/container'

export const metadata: Metadata = {
  alternates: { canonical: '/verification' },
  title: 'How verification works',
  description: `What a verified badge on ${site.name} actually means: which providers we read, what a connected key can and cannot do, and how often figures refresh.`,
}

export default function VerificationPage() {
  return (
    <Container className="py-10 sm:py-16">
      <Measure className="max-w-3xl">
        <p className="label">The method</p>
        <h1 className="display mt-2 text-4xl font-semibold sm:text-5xl">
          How a number gets on this site
        </h1>
        <p className="text-muted mt-5 text-lg leading-relaxed">
          A revenue figure is only worth reading if you know where it came from. Here is exactly
          what happens between a founder&apos;s payment provider and the number on their profile —
          including what we cannot verify.
        </p>

        <Section title="1. The founder connects a read-only key">
          <p>
            Verification starts with the founder granting us the narrowest credential their provider
            offers. We test it immediately, and only store it if the test call succeeds — so a key
            that does not work is never saved.
          </p>
          <div className="mt-5 space-y-4">
            {CONNECTABLE_PROVIDERS.map((provider) => (
              <div key={provider.id} className="border-border bg-surface rounded-card border p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-fg font-medium">{provider.name}</h3>
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue shrink-0 text-[11px] hover:underline"
                  >
                    Provider docs
                  </a>
                </div>
                <p className="text-muted mt-2 text-sm leading-relaxed">{provider.instructions}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="2. The key is encrypted before it reaches the database">
          <p>
            Credentials are encrypted with AES-256-GCM using a key held only by the server, then
            written to a table that no browser session can read. The founders who add them cannot
            read them back either — reconnecting always means entering the credential again.
          </p>
        </Section>

        <Section title="3. Revenue is re-read every day">
          <p>
            A figure that was true last quarter is not verification. Every active connection is
            re-read daily and written to an append-only history, which is what draws the chart on
            each app page. Profiles show the last sync time so you can judge freshness yourself.
          </p>
          <p className="mt-3">
            App Store Connect publishes sales data a day behind, so apps verified through that route
            show a <span className="text-[13px]">data as of</span> date rather than today&apos;s.
          </p>
        </Section>

        <Section title="4. Multiple providers add up, they don't double-count">
          <p>
            An app billing through both in-app purchase and a web checkout can connect both. Each
            provider is stored separately and summed once per day, so connecting a second source
            cannot inflate a figure.
          </p>
        </Section>

        <Section title="What this does not prove">
          <p>
            Verification confirms that a provider account reports this revenue. It does not audit
            the business behind it. Specifically, it cannot tell you:
          </p>
          <ul className="mt-3 space-y-2 pl-5">
            <li className="list-disc">
              Whether refunds and chargebacks have been fully deducted — that depends on how the
              provider reports.
            </li>
            <li className="list-disc">
              Whether the connected account belongs solely to the app shown, if a founder ships
              several apps under one provider project.
            </li>
            <li className="list-disc">
              Profit. Every figure here is revenue, before Apple&apos;s cut and costs.
            </li>
          </ul>
          <p className="mt-3">
            We state these limits rather than round them off. If you are buying a business on the
            strength of a number here, ask for provider access directly.
          </p>
        </Section>

        <Section title="Superwall">
          <p>
            Superwall is not currently a connectable provider. It issues public SDK keys only, and
            publishes no API for reading revenue charts, so there is no way for us to verify a
            figure through it. We would rather list nothing than a badge we cannot stand behind. If
            that changes, we will add it.
          </p>
        </Section>

        <div className="border-border bg-surface rounded-card mt-12 border p-6">
          <h2 className="display text-xl font-semibold">Ready to verify your app?</h2>
          <p className="text-muted mt-2 text-sm">
            Connecting takes about two minutes and needs one read-only key.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink href="/submit">Submit your app</ButtonLink>
            <ButtonLink href="/leaderboard" variant="secondary">
              See who else is verified
            </ButtonLink>
          </div>
        </div>

        <p className="text-muted mt-8 text-sm">
          Questions about the method?{' '}
          <Link href="/about" className="text-blue hover:underline">
            About this site
          </Link>
          .
        </p>
      </Measure>
    </Container>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-border mt-10 border-t pt-8">
      <h2 className="display text-2xl font-semibold">{title}</h2>
      <div className="text-muted mt-3 space-y-3 leading-relaxed">{children}</div>
    </section>
  )
}
