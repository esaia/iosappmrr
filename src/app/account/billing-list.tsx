'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, RotateCcw } from 'lucide-react'
import { AppIcon } from '@/components/app-icon'
import { Badge } from '@/components/ui/badge'
import { formatMoney } from '@/lib/utils'
import { VisibilitySwitch } from '@/components/visibility-switch'
import {
  openBillingPortalAction,
  setSponsorCancellationAction,
  type BillingActionState,
} from './actions'

type Row = {
  id: string
  kind: 'dofollow' | 'sponsor'
  status: string
  source: 'paddle' | 'admin'
  amountCents: number | null
  currency: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  hidden: boolean
  createdAt: string
  subscriptionId: string | null
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
        <p className="border-border text-muted rounded-card border border-dashed px-4 py-6 text-center text-[13px]">
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
        Invoices, receipts, and card details live at Paddle, who is the merchant
        of record — this site never sees a card number and cannot show them.
      */}
      <form action={openPortal} className="flex flex-wrap items-center gap-3 pt-1">
        <PortalButton />
        <p className="text-muted text-xs">
          Invoices, receipts, and payment methods are held by Paddle, our merchant of record.
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
  const [state, run, pending] = useActionState<BillingActionState, FormData>(
    setSponsorCancellationAction,
    {},
  )

  const periodEnd = row.currentPeriodEnd ? new Date(row.currentPeriodEnd) : null
  // A sponsor slot is the only recurring product, and only a paid one can be
  // cancelled — a gift is the admin's to withdraw, not the founder's.
  const cancellable =
    row.status === 'active' && row.source === 'paddle' && Boolean(row.subscriptionId)
  const ending = row.cancelAtPeriodEnd
  // Live sponsor slots only. On a revoked or pending row the switch would
  // imply something could be turned back on, and a dofollow link has nothing
  // worth switching — see the note on VisibilitySwitch.
  const switchable = row.status === 'active' && row.kind === 'sponsor'

  return (
    <li className="border-border bg-surface rounded-card border p-4">
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

      {/*
        "Renews" and "Ends" are the same date meaning opposite things, so the
        row has to say which. A winding-down slot still reading "Renews" would
        tell a founder they are about to be charged again.
      */}
      {periodEnd && row.status === 'active' && (
        <p className={ending ? 'text-gold mt-2 text-xs' : 'text-muted mt-2 text-xs'}>
          {ending
            ? `Ends ${dateFormat.format(periodEnd)}. You keep the slot until then.`
            : `Renews ${dateFormat.format(periodEnd)}.`}
        </p>
      )}

      {switchable && <VisibilitySwitch purchaseId={row.id} hidden={row.hidden} className="mt-3" />}

      {cancellable && (
        <form action={run} className="mt-3">
          <input type="hidden" name="purchaseId" value={row.id} />
          {/* The button says what it will do, so it posts the opposite of
              where the row stands now. */}
          <input type="hidden" name="cancel" value={ending ? 'false' : 'true'} />
          <button
            type="submit"
            disabled={pending}
            className={
              ending
                ? 'text-blue inline-flex items-center gap-1.5 text-xs underline-offset-4 hover:underline disabled:opacity-50'
                : 'text-muted hover:text-red inline-flex items-center gap-1.5 text-xs underline-offset-4 hover:underline disabled:opacity-50'
            }
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : ending ? (
              <RotateCcw className="size-3" />
            ) : null}
            {ending ? 'Resume subscription' : 'Cancel at period end'}
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
      className="border-border text-fg hover:border-border-strong rounded-card inline-flex items-center gap-1.5 border px-3 py-2 text-[13px] transition-colors"
    >
      Manage billing
      <ExternalLink className="size-3.5" />
    </button>
  )
}
