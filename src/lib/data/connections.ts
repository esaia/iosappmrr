import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apps, revenueConnections, revenueSnapshots } from '@/db/schema'
import { encryptCredentials } from '@/lib/crypto/credentials'
import { recomputeAppMetrics } from '@/lib/metrics'
import { getAdapter, ProviderError, type NormalizedMetrics, type ProviderId } from '@/lib/providers'

/**
 * Validates a credential against the live provider, and only persists it if the
 * call succeeds — so a broken key is never stored, and the first snapshot lands
 * in the same transaction as the connection itself.
 */
export async function connectProvider(options: {
  appId: string
  founderId: string
  provider: ProviderId
  credentials: unknown
}) {
  const adapter = getAdapter(options.provider)

  const parsed = adapter.schema.safeParse(options.credentials)
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? 'Those credentials are not valid.',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
      ),
    }
  }

  let result
  try {
    result = await adapter.validate(parsed.data)
  } catch (error) {
    if (error instanceof ProviderError) return { ok: false as const, error: error.message }
    throw error
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(revenueConnections)
      .values({
        appId: options.appId,
        provider: options.provider,
        status: 'active',
        encryptedCredentials: encryptCredentials(parsed.data),
        accountLabel: result.accountLabel,
        lastSyncedAt: new Date(),
        lastError: null,
        consecutiveFailures: 0,
      })
      .onConflictDoUpdate({
        target: [revenueConnections.appId, revenueConnections.provider],
        set: {
          status: 'active',
          encryptedCredentials: encryptCredentials(parsed.data),
          accountLabel: result.accountLabel,
          lastSyncedAt: new Date(),
          lastError: null,
          consecutiveFailures: 0,
        },
      })

    await writeSnapshot(tx, options.appId, options.provider, result.metrics)

    // Verification is what publishes an app. Nothing else flips this.
    await tx
      .update(apps)
      .set({ isVerified: true, verifiedAt: new Date(), status: 'live' })
      .where(eq(apps.id, options.appId))
  })

  await recomputeAppMetrics(options.appId)

  return { ok: true as const, metrics: result.metrics }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Upserts on the day key, so a same-day re-run refreshes rather than appends. */
export async function writeSnapshot(
  tx: Tx | typeof db,
  appId: string,
  provider: ProviderId,
  metrics: NormalizedMetrics,
) {
  const capturedOn = metrics.capturedOn.toISOString().slice(0, 10)

  await tx
    .insert(revenueSnapshots)
    .values({
      appId,
      provider,
      capturedOn,
      capturedAt: new Date(),
      mrrCents: metrics.mrrCents,
      activeSubscriptions: metrics.activeSubscriptions ?? null,
      activeTrials: metrics.activeTrials ?? null,
      newCustomers28d: metrics.newCustomers28d ?? null,
      revenue28dCents: metrics.revenue28dCents ?? null,
      currency: metrics.currency,
    })
    .onConflictDoUpdate({
      target: [revenueSnapshots.appId, revenueSnapshots.provider, revenueSnapshots.capturedOn],
      set: {
        capturedAt: new Date(),
        mrrCents: metrics.mrrCents,
        activeSubscriptions: metrics.activeSubscriptions ?? null,
        activeTrials: metrics.activeTrials ?? null,
        newCustomers28d: metrics.newCustomers28d ?? null,
        revenue28dCents: metrics.revenue28dCents ?? null,
        currency: metrics.currency,
      },
    })
}

/**
 * Removing a connection keeps the snapshot history — deleting it would rewrite
 * a public chart — but drops the credential and unverifies the app if that was
 * its last source.
 */
export async function disconnectProvider(appId: string, provider: ProviderId) {
  await db
    .delete(revenueConnections)
    .where(and(eq(revenueConnections.appId, appId), eq(revenueConnections.provider, provider)))

  const remaining = await db
    .select({ id: revenueConnections.id })
    .from(revenueConnections)
    .where(and(eq(revenueConnections.appId, appId), eq(revenueConnections.status, 'active')))

  if (remaining.length === 0) {
    await db
      .update(apps)
      .set({ isVerified: false, verifiedAt: null, status: 'hidden' })
      .where(eq(apps.id, appId))
  }
}
