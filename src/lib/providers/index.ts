import { adaptyAdapter } from './adapty'
import { appStoreConnectAdapter } from './app-store-connect'
import { revenueCatAdapter } from './revenuecat'
import { stripeAdapter } from './stripe'
import { ProviderError, type InstallsAdapter, type ProviderAdapter, type ProviderId } from './types'

/**
 * Superwall is deliberately absent.
 *
 * Superwall only issues public SDK keys (pk_…) and publishes no REST API for
 * reading revenue charts, so there is no way to verify a number through them.
 * The `superwall` value is kept in the database enum so connections can be
 * added the day they ship a metrics API — but listing it as an option here
 * would promise verification we cannot perform.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ADAPTERS: Partial<Record<ProviderId, ProviderAdapter<any>>> = {
  revenuecat: revenueCatAdapter,
  adapty: adaptyAdapter,
  app_store_connect: appStoreConnectAdapter,
  stripe: stripeAdapter,
}

/**
 * Providers a founder can actually connect, in the order we recommend them.
 *
 * Stripe is absent by choice, not by limitation: this index is about App Store
 * revenue, and web billing muddies the comparison. The adapter stays registered
 * above so connections already made keep syncing — dropping it there would
 * strand them with "no adapter registered" on the next run.
 */
export const CONNECTABLE_PROVIDERS = [
  revenueCatAdapter,
  adaptyAdapter,
  appStoreConnectAdapter,
] as const

export function getAdapter(provider: ProviderId) {
  const adapter = ADAPTERS[provider]
  if (!adapter) {
    throw new Error(`No adapter is registered for provider "${provider}".`)
  }
  return adapter
}

/**
 * The half of a provider a connection actually talks to.
 *
 * A connection is either reporting the money or reporting installs, and the
 * two are different objects with the same shape. Resolving it in one place
 * keeps `connectProvider` and the sync from each deciding for themselves what
 * an installs-only connection means.
 */
export function getSource(
  provider: ProviderId,
  installsOnly: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ProviderAdapter<any> | InstallsAdapter<any> {
  const adapter = getAdapter(provider)
  if (!installsOnly) return adapter

  if (!adapter.installs) {
    throw new ProviderError(
      `${adapter.name} cannot report installs. Only App Store Connect reads Apple's download ` +
        'figures — every other provider here sees payments, and most people who install an app ' +
        'never pay for it.',
    )
  }

  return adapter.installs
}

/** Providers that can be connected for installs alone. */
export function canReportInstalls(provider: ProviderId) {
  return Boolean(ADAPTERS[provider]?.installs)
}

export function isConnectable(provider: string): provider is ProviderId {
  return provider in ADAPTERS
}

export * from './types'
