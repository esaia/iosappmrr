import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getOwnedApp } from '@/lib/data/mutations'
import { InsightsForm } from './insights-form'

export const metadata: Metadata = {
  title: 'Startup insights',
  robots: { index: false },
}

export default async function InsightsPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const user = await requireUser('/dashboard')
  const app = await getOwnedApp(appId, user.id)
  if (!app) notFound()

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <nav className="text-muted mb-6 text-xs">
        <Link href="/dashboard" className="hover:text-fg">
          Dashboard
        </Link>
        {' / '} {app.name}
      </nav>

      <h1 className="display mt-2 text-4xl font-semibold">Startup insights</h1>
      <p className="text-muted mt-3 leading-relaxed">
        Context for the people reading your numbers. Unlike revenue, this is what you write — leave
        anything blank and it simply will not appear on{' '}
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
    </div>
  )
}
