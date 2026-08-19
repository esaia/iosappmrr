'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, RotateCcw } from 'lucide-react'
import { AppIcon } from '@/components/app-icon'
import { Badge } from '@/components/ui/badge'
import { formatMoney } from '@/lib/utils'
import {
  openBillingPortalAction,
  setPurchaseVisibilityAction,
  setSponsorCancellationAction,
  type BillingActionState,
} from './actions'

type Row = {
  id: string
  kind: 'dofollow' | 'sponsor'
  status: string
  source: 'polar' | 'admin'
  amountCents: number | null
  currency: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  hidden: boolean
  createdAt: string
  polarSubscriptionId: string | null
  app: { id: string; slug: string; name: string; iconUrl: string | null }
}

const KIND_LABEL: Record<Row['kind'], string> = {
  dofollow: 'Dofollow link',
  sponsor: 'Sponsor rail slot',
}

/** Said in terms of what a reader would see, not of the flag being written. */
const SHOWN_LABEL: Record<Row['kind'], { on: string; off: string }> = {
  dofollow: { on: 'Link is dofollow', off: 'Link is nofollow while hidden' },
  sponsor: { on: 'Showing in the rails', off: 'Hidden from the rails' },
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
  const [state, run, pending] = useActionState<BillingActionState, FormData>(
    setSponsorCancellationAction,
    {},
  )

  const periodEnd = row.currentPeriodEnd ? new Date(row.currentPeriodEnd) : null
  // A sponsor slot is the only recurring product, and only a paid one can be
  // cancelled — a gift is the admin's to withdraw, not the founder's.
  const cancellable =
    row.status === 'active' && row.source === 'polar' && Boolean(row.polarSubscriptionId)
  const ending = row.cancelAtPeriodEnd
  // Only a live entitlement has anything to show or hide. On a revoked or
  // pending row the switch would imply it could be turned back on.
  const switchable = row.status === 'active'

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

      {switchable && <VisibilitySwitch row={row} />}

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

/**
 * A show/hide switch for one live entitlement.
 *
 * Its own form and its own action state, so a founder with several purchases
 * gets a result against the row they touched rather than one shared message.
 * Submitted by the switch itself — there is no separate confirm, because
 * nothing is lost: the row keeps its status and switching back costs nothing.
 */
function VisibilitySwitch({ row }: { row: Row }) {
  const [state, run, pending] = useActionState<BillingActionState, FormData>(
    setPurchaseVisibilityAction,
    {},
  )

  const shown = !row.hidden
  const copy = SHOWN_LABEL[row.kind]

  return (
    <form action={run} className="mt-3">
      <input type="hidden" name="purchaseId" value={row.id} />
      {/* Posts the opposite of where the row stands, so the click is the
          intent rather than the current value. */}
      <input type="hidden" name="hidden" value={shown ? 'true' : 'false'} />
      <button
        type="submit"
        disabled={pending}
        role="switch"
        aria-checked={shown}
        className="group inline-flex items-center gap-2.5 disabled:opacity-50"
      >
        <span
          className={
            shown
              ? 'bg-green/80 relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors'
              : 'bg-surface-3 group-hover:bg-border-strong relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors'
          }
        >
          <span
            className={
              shown
                ? 'bg-bg size-3 translate-x-3.5 rounded-full transition-transform'
                : 'bg-muted size-3 translate-x-0.5 rounded-full transition-transform'
            }
          />
        </span>
        <span className={shown ? 'text-muted text-xs' : 'text-dim text-xs'}>
          {pending ? 'Saving…' : shown ? copy.on : copy.off}
        </span>
      </button>

      {state.error && (
        <p role="alert" className="text-red mt-1.5 text-xs">
          {state.error}
        </p>
      )}
    </form>
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
