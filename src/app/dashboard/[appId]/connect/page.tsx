import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getOwnedApp, listConnections } from '@/lib/data/mutations'
import { CONNECTABLE_PROVIDERS } from '@/lib/providers'
import { ConnectPanel } from './connect-panel'

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
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <nav className="text-muted mb-6 text-xs">
        <Link href="/dashboard" className="hover:text-fg">
          Dashboard
        </Link>
        {' / '} {app.name}
      </nav>

      <p className="label">Step 2 of 2</p>
      <h1 className="display mt-2 text-4xl font-semibold">Verify {app.name}</h1>
      <p className="text-muted mt-3 leading-relaxed">
        Connect the provider that bills your subscribers. We make one read-only call to confirm the
        key works, then re-read it daily. Your app goes live the moment this succeeds.
      </p>

      <ConnectPanel
        appId={appId}
        appSlug={app.slug}
        isLive={app.status === 'live'}
        providers={CONNECTABLE_PROVIDERS.map((provider) => ({
          id: provider.id,
          name: provider.name,
          instructions: provider.instructions,
          docsUrl: provider.docsUrl,
          fields: FIELDS[provider.id],
        }))}
        connections={connections.map((connection) => ({
          ...connection,
          lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  )
}

/**
 * The credential fields each provider needs. Kept beside the page rather than
 * in the adapter so the adapters stay free of UI concerns.
 */
const FIELDS: Record<
  string,
  { name: string; label: string; type?: string; placeholder?: string; multiline?: boolean }[]
> = {
  revenuecat: [
    { name: 'projectId', label: 'Project ID', placeholder: 'proj1ab2cd3e' },
    { name: 'apiKey', label: 'V2 secret key', type: 'password', placeholder: 'sk_…' },
  ],
  app_store_connect: [
    { name: 'issuerId', label: 'Issuer ID', placeholder: '57246542-96fe-1a63-e053-0824d011072a' },
    { name: 'keyId', label: 'Key ID', placeholder: '2X9R4HXF34' },
    { name: 'vendorNumber', label: 'Vendor number', placeholder: '85123456' },
    {
      name: 'privateKey',
      label: 'Private key (.p8 contents)',
      multiline: true,
      placeholder: '-----BEGIN PRIVATE KEY-----',
    },
  ],
  stripe: [
    { name: 'secretKey', label: 'Restricted key', type: 'password', placeholder: 'rk_live_…' },
  ],
}
