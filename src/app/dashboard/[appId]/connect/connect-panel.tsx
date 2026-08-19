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
}
type Connection = {
  provider: string
  status: string
  accountLabel: string | null
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

  const shown = resultFor === selected ? state : {}

  const provider = providers.find((p) => p.id === selected)
  const connected = new Set(connections.map((c) => c.provider))

  return (
    <div className="mt-8 space-y-8">
      {state.connected && (
        <div className="border-green/40 bg-green-dim rounded-card border p-5">
          <div className="text-green flex items-center gap-2">
            <CheckCircle2 className="size-5" />
            <h2 className="font-medium">Verified</h2>
          </div>
          <p className="text-fg mt-2 text-sm">
            We read {formatMoney(state.connected.mrrCents, state.connected.currency)}/mo from{' '}
            {providerLabel(resultFor ?? selected)}. Your app is live.
          </p>
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
    </div>
  )
}
