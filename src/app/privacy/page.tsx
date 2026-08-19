import type { Metadata } from 'next'
import Link from 'next/link'
import { site } from '@/lib/site'
import { Container, Measure } from '@/components/ui/container'

export const metadata: Metadata = {
  alternates: { canonical: '/privacy' },
  title: 'Privacy',
  description: `What ${site.name} stores, why, and how provider credentials are protected.`,
}

const UPDATED = '18 August 2026'

export default function PrivacyPage() {
  return (
    <Container className="py-10 sm:py-16">
      <Measure className="mx-auto">
        <h1 className="display text-4xl font-semibold sm:text-5xl">Privacy</h1>
        <p className="text-dim mt-3 text-sm">Last updated {UPDATED}</p>

        <div className="text-muted mt-6 space-y-5 text-lg leading-relaxed">
          <p>
            {site.name} holds as little about you as the site can function on. This page describes
            what is actually stored, not what a template says might be.
          </p>
        </div>

        <Section title="What we store">
          <Item term="Account">
            The email address and username your X or Google account hands over at sign-in.
            Authentication runs on Supabase Auth; we never see or store a password, because there
            isn&apos;t one — sign-in is X or Google OAuth.
          </Item>
          <Item term="Profile">
            A handle, and optionally a display name, avatar URL, bio, website, and X handle. All of
            it is published on your founder page, and all of it is optional except the handle.
          </Item>
          <Item term="Apps you submit">
            The App Store link and the details Apple returns for it, plus any startup insights you
            choose to write. This is public by design — it is the point of the site.
          </Item>
          <Item term="Provider credentials">
            The read-only key you connect, encrypted before it reaches the database. See below.
          </Item>
          <Item term="Revenue figures">
            Daily totals read from your provider: monthly recurring revenue, active subscriptions,
            trials, and trailing revenue. Never individual customers, transactions, or payouts.
          </Item>
        </Section>

        <Section title="What we don't store">
          <p className="text-muted leading-relaxed">
            There are no third-party analytics or advertising scripts on this site, so there is no
            cross-site tracking to opt out of. Page popularity is counted as a single daily total
            per app — a number incremented per view, with no visitor identifier, IP address, or
            device record attached. We cannot tell which pages any individual visited, and neither
            can anyone who obtains the database.
          </p>
        </Section>

        <Section title="Provider credentials">
          <p className="text-muted leading-relaxed">
            The key you connect is encrypted with AES-256-GCM before it is written, using a key held
            in the server environment and never in the database. A stolen database dump does not
            yield working credentials. Keys are decrypted only in memory, only to make the scheduled
            read, and are never returned to a browser — not even yours. Disconnecting a provider
            deletes the stored credential outright.
          </p>
          <p className="text-muted mt-4 leading-relaxed">
            We ask for the narrowest key each provider offers: a RevenueCat key scoped to read
            metrics, or an App Store Connect key limited to finance reports. Neither can move money,
            issue refunds, or change your account.
          </p>
        </Section>

        <Section title="Who else sees it">
          <p className="text-muted leading-relaxed">
            Data is stored with Supabase and the site is served by Vercel; both process data on our
            behalf as infrastructure providers. Revenue is read from the provider you connect. App
            Store metadata comes from Apple&apos;s public lookup API, which involves sending them an
            app ID and nothing about you. We do not sell data, and we do not share it with anyone
            else.
          </p>
        </Section>

        <Section title="Your choices">
          <p className="text-muted leading-relaxed">
            You can edit or clear your profile and insights at any time from the dashboard,
            disconnect a provider to stop revenue being read, or ask us to delete your account
            entirely. Deleting an account removes your profile, your apps, and their revenue
            history. Reach us at{' '}
            <a href={`mailto:${site.contactEmail}`} className="text-blue hover:underline">
              {site.contactEmail}
            </a>
            .
          </p>
        </Section>

        <Section title="Cookies">
          <p className="text-muted leading-relaxed">
            One cookie, set by Supabase Auth to keep you signed in. It is not used for tracking, and
            signing out clears it. Signed-out visitors are not given a cookie at all.
          </p>
        </Section>

        <p className="border-border text-muted mt-12 border-t pt-8">
          Questions about any of this, or about how a specific number was produced, are answered on
          the{' '}
          <Link href="/verification" className="text-blue hover:underline">
            verification page
          </Link>{' '}
          or by email.
        </p>
      </Measure>
    </Container>
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

function Item({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="border-border mt-4 border-l-2 pl-4 first:mt-0">
      <p className="text-fg text-sm font-medium">{term}</p>
      <p className="text-muted mt-1 leading-relaxed">{children}</p>
    </div>
  )
}
