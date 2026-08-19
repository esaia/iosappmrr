'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2 } from 'lucide-react'
import { AppIcon } from '@/components/app-icon'
import { Badge } from '@/components/ui/badge'
import { formatMoney } from '@/lib/utils'
import { cancelSponsorAction, openBillingPortalAction, type BillingActionState } from './actions'

type Row = {
  id: string
  kind: 'dofollow' | 'sponsor'
  status: string
  source: 'polar' | 'admin'
  amountCents: number | null
  currency: string | null
  currentPeriodEnd: string | null
  createdAt: string
  polarSubscriptionId: string | null
  app: { id: string; slug: string; name: string; iconUrl: string | null }
}

const KIND_LABEL: Record<Row['kind'], string> = {
  dofollow: 'Dofollow link',
  sponsor: 'Sponsor rail slot',
}

/** Tone by what the status means for the founder, not by its name. */
const STATUS_TONE: Record<string, 'up' | 'down' | 'neutral' | 'flag'> = {
  active: 'up',
  pending: 'flag',
  revoked: 'down',
  superseded: 'neutral',
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

export function BillingList({ rows }: { rows: Row[] }) {
  const [portal, openPortal] = useActionState<BillingActionState, FormData>(
    openBillingPortalAction,
    {},
  )

  return (
    <div className="mt-4 space-y-3">
      {rows.length === 0 ? (
        <p className="border-border text-muted rounded-[10px] border border-dashed px-4 py-6 text-center text-[13px]">
          Nothing purchased yet. Upgrades are offered on each app&apos;s{' '}
          <Link href="/dashboard" className="text-blue hover:underline">
            edit screen
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <BillingRow key={row.id} row={row} />
          ))}
        </ul>
      )}

      {/*
        Invoices, receipts, and card details live at Polar, who is the merchant
        of record — this site never sees a card number and cannot show them.
      */}
      <form action={openPortal} className="flex flex-wrap items-center gap-3 pt-1">
        <PortalButton />
        <p className="text-muted text-xs">
          Invoices, receipts, and payment methods are held by Polar, our merchant of record.
        </p>
      </form>
      {portal.error && (
        <p role="alert" className="text-red text-xs">
          {portal.error}
        </p>
      )}
    </div>
  )
}

function BillingRow({ row }: { row: Row }) {
  const [state, cancel, pending] = useActionState<BillingActionState, FormData>(
    cancelSponsorAction,
    {},
  )

  const renews = row.currentPeriodEnd ? new Date(row.currentPeriodEnd) : null
  // A sponsor slot is the only recurring product, and only a paid one can be
  // cancelled — a gift is the admin's to withdraw, not the founder's.
  const cancellable =
    row.status === 'active' && row.source === 'polar' && Boolean(row.polarSubscriptionId)

  return (
    <li className="border-border bg-surface rounded-[10px] border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <AppIcon src={row.app.iconUrl} name={row.app.name} size={32} />
        <div className="min-w-0 flex-1">
          <p className="text-fg text-[13px] font-medium">
            {KIND_LABEL[row.kind]}
            {row.source === 'admin' && <span className="text-muted font-normal"> · gifted</span>}
          </p>
          <Link
            href={`/apps/${row.app.slug}`}
            className="text-muted hover:text-fg truncate text-xs"
          >
            {row.app.name}
          </Link>
        </div>
        <div className="text-right">
          <p className="text-fg text-[13px] font-medium">
            {row.amountCents != null ? formatMoney(row.amountCents, row.currency ?? 'USD') : '—'}
            {row.kind === 'sponsor' && row.amountCents ? (
              <span className="text-muted font-normal">/mo</span>
            ) : null}
          </p>
          <p className="text-dim text-[11px]">{dateFormat.format(new Date(row.createdAt))}</p>
        </div>
        <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{row.status}</Badge>
      </div>

      {renews && row.status === 'active' && (
        <p className="text-muted mt-2 text-xs">Renews {dateFormat.format(renews)}.</p>
      )}

      {cancellable && (
        <form action={cancel} className="mt-3">
          <input type="hidden" name="purchaseId" value={row.id} />
          <button
            type="submit"
            disabled={pending}
            className="text-muted hover:text-red inline-flex items-center gap-1.5 text-xs underline-offset-4 hover:underline disabled:opacity-50"
          >
            {pending && <Loader2 className="size-3 animate-spin" />}
            Cancel at period end
          </button>
        </form>
      )}

      {state.error && (
        <p role="alert" className="text-red mt-2 text-xs">
          {state.error}
        </p>
      )}
    </li>
  )
}

function PortalButton() {
  return (
    <button
      type="submit"
      className="border-border text-fg hover:border-border-strong inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[13px] transition-colors"
    >
      Manage billing
      <ExternalLink className="size-3.5" />
    </button>
  )
}
