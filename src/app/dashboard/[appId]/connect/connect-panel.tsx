'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import { ProviderInstructions } from '@/components/provider-instructions'
import type { ProviderStep } from '@/lib/providers/types'
import { Button } from '@/components/ui/button'
import { providerLabel } from '@/components/verified-badge'
import { formatMoney, timeAgo } from '@/lib/utils'
import { connectProviderAction, disconnectProviderAction, type ConnectState } from './actions'

type Field = {
  name: string
  label: string
  type?: string
  placeholder?: string
  multiline?: boolean
}
type Provider = {
  id: string
  name: string
  instructions: string
  steps?: readonly ProviderStep[]
  docsUrl: string
  fields: Field[]
  /** Whether this provider can be connected for downloads alone. */
  canReportInstalls: boolean
}
type Connection = {
  provider: string
  status: string
  accountLabel: string | null
  installsOnly: boolean
  lastSyncedAt: string | null
  lastError: string | null
}

export function ConnectPanel({
  appId,
  appSlug,
  isLive,
  providers,
  connections,
}: {
  appId: string
  appSlug: string
  isLive: boolean
  providers: Provider[]
  connections: Connection[]
}) {
  const [selected, setSelected] = useState(providers[0]?.id ?? '')
  const [state, run, pending] = useActionState<ConnectState, FormData>(connectProviderAction, {})

  /*
   * useActionState keeps its result until the next submission, so switching
   * tabs would otherwise leave RevenueCat's validation error sitting under the
   * Stripe form. Remember which provider produced the result and only show it
   * on that tab.
   */
  const [resultFor, setResultFor] = useState<string | null>(null)

  function submit(formData: FormData) {
    setResultFor(String(formData.get('provider') ?? ''))
    return run(formData)
  }

  /*
   * The installs form posts as App Store Connect too, so it cannot be told
   * apart by provider — it gets a key of its own, or a failed install key
   * would print its error under the App Store Connect tab.
   */
  function submitInstalls(formData: FormData) {
    setResultFor('installs')
    return run(formData)
  }

  const shown = resultFor === selected ? state : {}
  const installsShown = resultFor === 'installs' ? state : {}

  /** Which provider the result banner is talking about. */
  const resultProvider = resultFor === 'installs' ? 'app_store_connect' : (resultFor ?? selected)

  const provider = providers.find((p) => p.id === selected)
  const connected = new Set(connections.map((c) => c.provider))

  /*
   * Installs are offered only once something else is reporting the money.
   *
   * The server refuses the combination anyway, but a checkbox that always
   * fails is worse than no checkbox: the whole point of the mode is to add
   * downloads *beside* a revenue provider, and an app with none of those is
   * being asked for its revenue source first.
   */
  const hasRevenueSource = connections.some(
    (connection) => !connection.installsOnly && connection.status === 'active',
  )
  /*
   * Apple is the only source of installs, so the section is about one specific
   * provider — found by capability rather than by name, so it follows if
   * another provider ever grows the same ability.
   */
  const installsProvider = providers.find((option) => option.canReportInstalls)

  /*
   * An App Store Connect connection reports installs either way: connected for
   * revenue it fills them alongside the money, and connected installs-only it
   * reports nothing else. Either one means this section has nothing left to ask
   * for.
   */
  const installsConnection = connections.find(
    (connection) => connection.provider === installsProvider?.id && connection.status === 'active',
  )

  /*
   * Shown on the tabs that cannot report installs themselves — which is where
   * it is needed. On the App Store Connect tab it would be offering a key for
   * the form already on screen.
   */
  const showInstallsSection = Boolean(provider && !provider.canReportInstalls && installsProvider)

  return (
    <div className="mt-8 space-y-8">
      {state.connected && (
        <div className="border-green/40 bg-green-dim rounded-card border p-5">
          <div className="text-green flex items-center gap-2">
            <CheckCircle2 className="size-5" />
            <h2 className="font-medium">
              {state.connected.installsOnly ? 'Connected' : 'Verified'}
            </h2>
          </div>
          {state.connected.installsOnly ? (
            <p className="text-fg mt-2 text-sm">
              We read {state.connected.installs ?? 0} install
              {state.connected.installs === 1 ? '' : 's'} from {providerLabel(resultProvider)} for
              its most recent day. Your MRR is unchanged — it still comes from the provider that
              bills your subscribers.
            </p>
          ) : (
            <p className="text-fg mt-2 text-sm">
              We read {formatMoney(state.connected.mrrCents, state.connected.currency)}/mo from{' '}
              {providerLabel(resultProvider)}. Your app is live.
            </p>
          )}
          <Link
            href={`/apps/${appSlug}`}
            className="text-blue mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            View your app page
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      )}

      {connections.length > 0 && (
        <section>
          <h2 className="label">Connected</h2>
          <ul className="mt-3 space-y-2">
            {connections.map((connection) => (
              <li
                key={connection.provider}
                className="border-border bg-surface rounded-card flex flex-wrap items-center gap-3 border px-4 py-3"
              >
                <span className="text-fg font-medium">{providerLabel(connection.provider)}</span>
                {connection.installsOnly && (
                  <span className="border-border text-muted rounded border px-1.5 py-0.5 text-[11px]">
                    installs only
                  </span>
                )}
                {connection.status === 'active' ? (
                  <span className="text-green text-[11px]">active</span>
                ) : (
                  <span className="text-red inline-flex items-center gap-1 text-[11px]">
                    <AlertTriangle className="size-3" />
                    {connection.status}
                  </span>
                )}
                <span className="text-muted text-[11px]">{connection.accountLabel}</span>
                <span className="text-muted ml-auto text-[11px]">
                  {connection.lastSyncedAt
                    ? `synced ${timeAgo(connection.lastSyncedAt)}`
                    : 'never synced'}{' '}
                </span>
                <form action={disconnectProviderAction}>
                  <input type="hidden" name="appId" value={appId} />
                  <input type="hidden" name="provider" value={connection.provider} />
                  <button
                    type="submit"
                    className="text-muted hover:text-red text-xs underline-offset-4 hover:underline"
                  >
                    Disconnect
                  </button>
                </form>
                {connection.lastError && (
                  <p className="text-red w-full text-[11px]">{connection.lastError}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="label">
          {connections.length > 0 ? 'Add another source' : 'Choose a provider'}
        </h2>{' '}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {providers.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelected(option.id)}
              className={
                option.id === selected
                  ? 'bg-accent text-accent-fg rounded-lg px-3 py-1.5 text-sm font-medium'
                  : 'border-border text-muted hover:border-border-strong hover:text-fg rounded-lg border px-3 py-1.5 text-sm'
              }
            >
              {option.name}
              {connected.has(option.id) && <span className="text-green ml-1.5">·</span>}
            </button>
          ))}
        </div>
        {provider && (
          <form action={submit} key={provider.id} className="mt-5 space-y-4">
            <input type="hidden" name="appId" value={appId} />
            <input type="hidden" name="provider" value={provider.id} />

            <ProviderInstructions
              name={provider.name}
              instructions={provider.instructions}
              steps={provider.steps}
              docsUrl={provider.docsUrl}
            />

            {provider.fields.map((field) => (
              <div key={field.name}>
                <label htmlFor={field.name} className="text-fg text-sm font-medium">
                  {field.label}
                </label>
                {field.multiline ? (
                  <textarea
                    id={field.name}
                    name={field.name}
                    rows={5}
                    required
                    placeholder={field.placeholder}
                    className="border-border bg-surface text-fg placeholder:text-muted focus:border-accent/60 focus:ring-accent/25 rounded-card mt-2 w-full border px-4 py-2.5 text-xs focus:ring-4 focus:outline-none"
                  />
                ) : (
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.type ?? 'text'}
                    required
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={field.placeholder}
                    className="border-border bg-surface text-fg placeholder:text-muted focus:border-accent/60 focus:ring-accent/25 rounded-card mt-2 w-full border px-4 py-2.5 text-sm focus:ring-4 focus:outline-none"
                  />
                )}
                {shown.fieldErrors?.[field.name] && (
                  <p className="text-red mt-1.5 text-sm">{shown.fieldErrors[field.name]}</p>
                )}
              </div>
            ))}

            {shown.error && (
              <p
                role="alert"
                className="border-red/40 bg-red-dim text-red rounded-card border px-4 py-3 text-sm"
              >
                {shown.error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" size="lg" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                {pending ? 'Checking the key…' : `Connect ${provider.name}`}
              </Button>
              {isLive && (
                <Link href="/dashboard" className="text-muted hover:text-fg text-sm">
                  Back to dashboard
                </Link>
              )}
            </div>

            <p className="text-muted text-xs leading-relaxed">
              Encrypted before it reaches the database and never shown again — not even to you. We
              test it before saving, so a key that doesn&apos;t work is never stored.
            </p>
          </form>
        )}
      </section>

      {showInstallsSection && installsProvider && (
        <section>
          <h2 className="label">Installs on your chart</h2>

          {installsConnection ? (
            <p className="text-muted mt-3 text-sm leading-relaxed">
              {providerLabel(installsConnection.provider)} is connected and reporting your daily
              download count. Nothing else to do.
            </p>
          ) : !hasRevenueSource ? (
            <p className="text-muted mt-3 text-sm leading-relaxed">
              Connect the provider that bills your subscribers first. Installs are added beside your
              revenue source, not instead of one.
            </p>
          ) : (
            <form action={submitInstalls} className="mt-3 space-y-4">
              <input type="hidden" name="appId" value={appId} />
              <input type="hidden" name="provider" value={installsProvider.id} />
              {/*
               * The whole point of this section. The money keeps coming from the
               * provider above; this key is read for downloads and nothing else.
               */}
              <input type="hidden" name="installsOnly" value="on" />

              <div className="border-border bg-surface rounded-card border p-4">
                <p className="text-fg text-sm leading-relaxed">
                  Your revenue provider reports money, not downloads — Apple is the only source for
                  those. Add an {installsProvider.name} key here and your chart gains a daily
                  install count.
                </p>
                <p className="text-muted mt-2 text-xs leading-relaxed">
                  Read for installs only, so your MRR is untouched: {installsProvider.name} reports
                  the same subscriptions your revenue provider already does, and the two would
                  otherwise be counted twice. This does not change how your app was verified.
                </p>
              </div>

              <ProviderInstructions
                name={installsProvider.name}
                instructions={installsProvider.instructions}
                steps={installsProvider.steps}
                docsUrl={installsProvider.docsUrl}
              />

              {installsProvider.fields.map((field) => (
                <div key={field.name}>
                  <label htmlFor={`installs-${field.name}`} className="text-fg text-sm font-medium">
                    {field.label}
                  </label>
                  {field.multiline ? (
                    <textarea
                      id={`installs-${field.name}`}
                      name={field.name}
                      rows={5}
                      required
                      placeholder={field.placeholder}
                      className="border-border bg-surface text-fg placeholder:text-muted focus:border-accent/60 focus:ring-accent/25 rounded-card mt-2 w-full border px-4 py-2.5 text-xs focus:ring-4 focus:outline-none"
                    />
                  ) : (
                    <input
                      id={`installs-${field.name}`}
                      name={field.name}
                      type={field.type ?? 'text'}
                      required
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={field.placeholder}
                      className="border-border bg-surface text-fg placeholder:text-muted focus:border-accent/60 focus:ring-accent/25 rounded-card mt-2 w-full border px-4 py-2.5 text-sm focus:ring-4 focus:outline-none"
                    />
                  )}
                  {installsShown.fieldErrors?.[field.name] && (
                    <p className="text-red mt-1.5 text-sm">
                      {installsShown.fieldErrors[field.name]}
                    </p>
                  )}
                </div>
              ))}

              {installsShown.error && (
                <p
                  role="alert"
                  className="border-red/40 bg-red-dim text-red rounded-card border px-4 py-3 text-sm"
                >
                  {installsShown.error}
                </p>
              )}

              <Button type="submit" size="lg" variant="secondary" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                {pending ? 'Checking the key…' : 'Add installs'}
              </Button>
            </form>
          )}
        </section>
      )}
    </div>
  )
}
