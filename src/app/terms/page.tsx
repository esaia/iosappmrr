import type { Metadata } from 'next'
import Link from 'next/link'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Terms',
  description: `The rules for using ${site.name} and for listing an app on it.`,
}

const UPDATED = '18 August 2026'

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="display text-4xl font-semibold sm:text-5xl">Terms</h1>
      <p className="text-dim mt-3 text-sm">Last updated {UPDATED}</p>

      <div className="text-muted mt-6 space-y-5 text-lg leading-relaxed">
        <p>
          Using {site.name} means accepting what follows. It is written to be read, not to be
          impenetrable.
        </p>
      </div>

      <Section title="The service">
        <p className="text-muted leading-relaxed">
          {site.name} indexes App Store apps whose revenue is read directly from a payment provider
          the founder connects. It is an index, not a broker, an auditor, or a financial adviser.
        </p>
      </Section>

      <Section title="Accounts">
        <p className="text-muted leading-relaxed">
          You need an account to list an app. Keep access to your email and GitHub secure, since
          they are the only way into your account. One person or company per account; do not list an
          app you have no right to represent.
        </p>
      </Section>

      <Section title="Listing an app">
        <p className="text-muted leading-relaxed">
          By connecting a provider you authorise us to make scheduled read-only calls to it and to
          publish the resulting figures — monthly recurring revenue, growth, subscriber counts — on
          your app&apos;s public page. You keep ownership of everything you write. You grant us
          permission to display it here.
        </p>
        <p className="text-muted mt-4 leading-relaxed">
          You may disconnect at any time. Doing so stops further reads and removes the app from the
          index; history already published may persist in caches and third-party archives beyond our
          control.
        </p>
      </Section>

      <Section title="Accuracy, and its limits">
        <p className="text-muted leading-relaxed">
          Figures are reported by the connected provider and normalised to a monthly equivalent. We
          do not audit them, and a provider can itself be wrong, delayed, or temporarily
          unreachable. Revenue is gross — before Apple&apos;s commission, refunds, chargebacks,
          taxes, and every cost of running the business. It is not profit and should never be read
          as such.
        </p>
        <p className="text-muted mt-4 leading-relaxed">
          Nothing here is an offer, a valuation, or advice. Do your own diligence before acting on
          any number on this site. The method and its known gaps are described on the{' '}
          <Link href="/verification" className="text-blue hover:underline">
            verification page
          </Link>
          .
        </p>
      </Section>

      <Section title="Acceptable use">
        <p className="text-muted leading-relaxed">
          Do not submit apps you do not control, misrepresent who you are, attempt to inflate or
          fabricate figures, scrape the site at a volume that degrades it for others, or use it to
          harass anyone listed. We may remove a listing or close an account that does, and we may
          decline a submission without giving a reason.
        </p>
      </Section>

      <Section title="Availability">
        <p className="text-muted leading-relaxed">
          The service is provided as-is, with no guarantee of uptime, and may change or end. To the
          extent the law allows, we are not liable for losses arising from use of the site, reliance
          on a figure shown here, or an interruption to it.
        </p>
      </Section>

      <Section title="Not affiliated with Apple">
        <p className="text-muted leading-relaxed">
          {site.name} is independent of Apple Inc. App Store metadata comes from Apple&apos;s public
          iTunes lookup API. Apple, App Store, and related marks belong to Apple Inc.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p className="text-muted leading-relaxed">
          These terms may be updated; the date at the top shows when. Continuing to use the site
          after a change accepts it. They are governed by the laws of {site.jurisdiction}. Questions
          go to{' '}
          <a href={`mailto:${site.contactEmail}`} className="text-blue hover:underline">
            {site.contactEmail}
          </a>
          .
        </p>
      </Section>

      <p className="border-border text-muted mt-12 border-t pt-8">
        See also the{' '}
        <Link href="/privacy" className="text-blue hover:underline">
          privacy page
        </Link>
        , which covers what is stored and how credentials are protected.
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="display text-2xl font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}
