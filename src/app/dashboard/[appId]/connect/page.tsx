import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getOwnedApp, listConnections } from '@/lib/data/mutations'
import { canReportInstalls, CONNECTABLE_PROVIDERS } from '@/lib/providers'
import { PROVIDER_FIELDS } from '@/lib/provider-fields'
import { ConnectPanel } from './connect-panel'
import { Container, Measure } from '@/components/ui/container'

export const metadata: Metadata = {
  title: 'Connect revenue',
  robots: { index: false },
}

export default async function ConnectPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const user = await requireUser('/dashboard')
  const app = await getOwnedApp(appId, user.id)
  if (!app) notFound()

  const connections = await listConnections(appId)

  return (
    <Container className="py-10 sm:py-14">
      <Measure className="mx-auto">
        <nav className="text-muted mb-6 text-xs">
          <Link href="/dashboard" className="hover:text-fg">
            Dashboard
          </Link>
          {' / '} {app.name}
        </nav>

        <h1 className="display text-4xl font-semibold">Verify {app.name}</h1>
        <p className="text-muted mt-3 leading-relaxed">
          Connect the provider that bills your subscribers. We make one read-only call to confirm
          the key works, then re-read it daily. Your app goes live the moment this succeeds.
        </p>

        <ConnectPanel
          appId={appId}
          appSlug={app.slug}
          isLive={app.status === 'live'}
          providers={CONNECTABLE_PROVIDERS.map((provider) => ({
            id: provider.id,
            name: provider.name,
            instructions: provider.instructions,
            steps: provider.steps,
            docsUrl: provider.docsUrl,
            fields: PROVIDER_FIELDS[provider.id],
            canReportInstalls: canReportInstalls(provider.id),
          }))}
          connections={connections.map((connection) => ({
            ...connection,
            lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
          }))}
        />
      </Measure>
    </Container>
  )
}
