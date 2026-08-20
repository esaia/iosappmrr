import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apps, revenueConnections, revenueSnapshots } from '@/db/schema'
import { encryptCredentials, fingerprintAccount } from '@/lib/crypto/credentials'
import { recomputeAppMetrics } from '@/lib/metrics'
import {
  getAdapter,
  getSource,
  ProviderError,
  type NormalizedMetrics,
  type ProviderId,
  type VerificationTarget,
} from '@/lib/providers'

/**
 * Validates a credential against the live provider, and only persists it if the
 * call succeeds — so a broken key is never stored, and the first snapshot lands
 * in the same transaction as the connection itself.
 *
 * Validation is against the listing, not just the provider: the adapter is told
 * which app is being claimed and is expected to refuse a credential that reads
 * someone else's revenue. Without that, "verified" would mean no more than
 * "this founder can read *an* account", and anyone could list Facebook and
 * publish their own MRR under its name.
 */
export async function connectProvider(options: {
  appId: string
  founderId: string
  provider: ProviderId
  credentials: unknown
  /** Report downloads instead of money — see `revenueConnections.installsOnly`. */
  installsOnly?: boolean
}) {
  const adapter = getAdapter(options.provider)
  const installsOnly = options.installsOnly ?? false

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

  const [app] = await db
    .select({ appStoreId: apps.appStoreId, bundleId: apps.bundleId, name: apps.name })
    .from(apps)
    .where(eq(apps.id, options.appId))
    .limit(1)

  if (!app) return { ok: false as const, error: 'App not found.' }

  const target: VerificationTarget = {
    appStoreId: app.appStoreId,
    bundleId: app.bundleId,
    name: app.name,
  }

  /*
   * Installs are a companion metric, never a listing's only source.
   *
   * An installs-only connection cannot verify an app — a download is not a
   * dollar — so allowing it on its own would leave a founder with a connected
   * key, a hidden listing, and no way to tell why. Requiring the revenue
   * connection first also means the App Store Connect account is being added
   * beside a provider that already reports the money, which is the only
   * arrangement where switching the money off makes sense.
   */
  if (installsOnly) {
    const [revenueSource] = await db
      .select({ id: revenueConnections.id })
      .from(revenueConnections)
      .where(
        and(
          eq(revenueConnections.appId, options.appId),
          eq(revenueConnections.status, 'active'),
          eq(revenueConnections.installsOnly, false),
        ),
      )
      .limit(1)

    if (!revenueSource) {
      return {
        ok: false as const,
        error:
          'Connect the provider that bills your subscribers first. Installs are added beside ' +
          'your revenue source, not instead of one — on their own they cannot verify an app.',
      }
    }
  }

  let result
  try {
    result = await getSource(options.provider, installsOnly).validate(parsed.data, target)
  } catch (error) {
    if (error instanceof ProviderError) return { ok: false as const, error: error.message }
    throw error
  }

  /*
   * One account, one listing — unless the provider reports per app, in which
   * case the app is part of the fingerprint and a founder's whole portfolio can
   * share one Apple account.
   *
   * Checked here for the sentence a founder can act on, and again by a unique
   * index for the two submissions that race each other.
   */
  const fingerprint = fingerprintAccount({
    provider: options.provider,
    accountKey: result.accountKey,
    appStoreId: adapter.appScoped ? target.appStoreId : undefined,
  })

  const [taken] = await db
    .select({ appId: revenueConnections.appId, slug: apps.slug })
    .from(revenueConnections)
    .innerJoin(apps, eq(apps.id, revenueConnections.appId))
    .where(eq(revenueConnections.credentialFingerprint, fingerprint))
    .limit(1)

  if (taken && taken.appId !== options.appId) {
    return {
      ok: false as const,
      error:
        `This ${adapter.name} account is already the source for another listing ` +
        `(/apps/${taken.slug}). Its figures cover the whole account, so it can only stand ` +
        'behind one app. Disconnect it there first, or connect the account that belongs to ' +
        'this app.',
    }
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
        credentialFingerprint: fingerprint,
        installsOnly,
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
          credentialFingerprint: fingerprint,
          installsOnly,
          lastSyncedAt: new Date(),
          lastError: null,
          consecutiveFailures: 0,
        },
      })

    await writeSnapshot(tx, options.appId, options.provider, result.metrics, installsOnly)

    /*
     * Verification is what publishes an app. Nothing else flips this — and an
     * installs-only connection is not it: it proves the vendor account ships
     * the app, which is not a claim about revenue, and the badge on this site
     * means a figure was read from the books.
     */
    if (!installsOnly) {
      await tx
        .update(apps)
        .set({ isVerified: true, verifiedAt: new Date(), status: 'live' })
        .where(eq(apps.id, options.appId))
    }
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
  installsOnly = false,
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
      revenueCents: metrics.revenueCents ?? null,
      installs: metrics.installs ?? null,
      installsOnly,
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
        revenueCents: metrics.revenueCents ?? null,
        installs: metrics.installs ?? null,
        installsOnly,
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

  /*
   * Only revenue sources count here. An installs-only connection cannot verify
   * an app, so an app left with nothing but one is unverified just as surely as
   * an app left with none at all — counting it would keep a listing published
   * on a download figure.
   *
   * The orphaned connection is left in place rather than deleted: it keeps
   * recording installs, costs nothing while the listing is hidden, and is
   * already there if the founder reconnects their revenue provider.
   */
  const remaining = await db
    .select({ id: revenueConnections.id })
    .from(revenueConnections)
    .where(
      and(
        eq(revenueConnections.appId, appId),
        eq(revenueConnections.status, 'active'),
        eq(revenueConnections.installsOnly, false),
      ),
    )

  if (remaining.length === 0) {
    await db
      .update(apps)
      .set({ isVerified: false, verifiedAt: null, status: 'hidden' })
      .where(eq(apps.id, appId))
  }
}
