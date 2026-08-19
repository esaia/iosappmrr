import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getOwnedApp } from '@/lib/data/mutations'
import { InsightsForm } from './insights-form'
import { Container, Measure } from '@/components/ui/container'

export const metadata: Metadata = {
  title: 'App insights',
  robots: { index: false },
}

export default async function InsightsPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const user = await requireUser('/dashboard')
  const app = await getOwnedApp(appId, user.id)
  if (!app) notFound()

  return (
    <Container className="py-10 sm:py-14">
      <Measure className="mx-auto">
        <nav className="text-muted mb-6 text-xs">
          <Link href="/dashboard" className="hover:text-fg">
            Dashboard
          </Link>
          {' / '} {app.name}
        </nav>

        <h1 className="display mt-2 text-4xl font-semibold">App insights</h1>
        <p className="text-muted mt-3 leading-relaxed">
          Context for the people reading your numbers. Unlike revenue, this is what you write —
          leave anything blank and it simply will not appear on{' '}
          <Link href={`/apps/${app.slug}`} className="text-blue hover:underline">
            your app page
          </Link>
          .
        </p>

        <InsightsForm
          appId={appId}
          initial={{
            valueProposition: app.valueProposition ?? '',
            problemSolved: app.problemSolved ?? '',
            audience: app.audience ?? '',
            audienceType: app.audienceType ?? '',
            marketTags: app.marketTags.join(', '),
            marketingChannels: app.marketingChannels.join(', '),
            additionalInfo: app.additionalInfo ?? '',
          }}
        />
      </Measure>
    </Container>
  )
}
