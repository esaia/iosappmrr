import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { listAdminPurchases, type AdminPurchaseRow } from '@/lib/data/admin'
import { formatMoney, timeAgo } from '@/lib/utils'
import { ActionForm } from '../action-form'
import { revokePurchaseAction, settlePurchaseAction } from '../actions'
import { AdminFilters } from '../filters'

export const metadata: Metadata = { title: 'Purchases' }

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'superseded', label: 'Superseded' },
]

export default async function AdminPurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const validStatus = ['pending', 'active', 'revoked', 'superseded'].includes(status ?? '')
    ? (status as 'pending' | 'active' | 'revoked' | 'superseded')
    : undefined

  const rows = await listAdminPurchases({ status: validStatus })
  const pending = rows.filter((r) => r.status === 'pending').length

  return (
    <div>
      <p className="text-muted text-[13px]">
        {rows.length} purchase{rows.length === 1 ? '' : 's'}
      </p>

      <AdminFilters basePath="/admin/purchases" filters={STATUS_FILTERS} filterKey="status" />

      {pending > 0 && (
        <div className="border-border bg-surface-2 mt-4 rounded-[10px] border p-3">
          <p className="text-fg text-[13px]">
            <span className="font-medium">Before settling anything by hand</span>, run{' '}
            <code className="bg-surface-3 rounded px-1 py-0.5 text-[12px]">
              npm run polar:reconcile
            </code>
            . It asks Polar whether each pending checkout was actually paid and grants only the ones
            that were. Settling here skips that check, so it is for payments you have confirmed
            another way.
          </p>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <PurchaseRow key={row.id} row={row} />
        ))}
      </ul>

      {rows.length === 0 && (
        <p className="text-muted border-border-strong mt-6 rounded-[10px] border border-dashed p-10 text-center text-[13px]">
          Nothing here.
        </p>
      )}
    </div>
  )
}

function PurchaseRow({ row }: { row: AdminPurchaseRow }) {
  const expired = row.currentPeriodEnd != null && row.currentPeriodEnd.getTime() < Date.now()

  return (
    <li className="border-border bg-surface rounded-[10px] border p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-fg text-[13px] font-medium">
              {row.kind === 'dofollow' ? 'Dofollow link' : 'Sponsor slot'}
            </span>
            <StatusBadge status={row.status} expired={expired} />
            {row.source === 'admin' && <Badge tone="flag">Gift</Badge>}
          </div>

          <p className="text-muted mt-1 text-[12px]">
            <Link href={`/admin/apps?q=${row.appSlug}`} className="hover:text-fg">
              {row.appName}
            </Link>
            {' · @'}
            {row.founderHandle}
            {' · '}
            {row.amountCents == null
              ? 'amount unknown'
              : row.amountCents === 0
                ? 'free'
                : formatMoney(row.amountCents, row.currency ?? 'USD')}
            {' · created '}
            {timeAgo(row.createdAt)}
            {row.currentPeriodEnd && (
              <>
                {expired ? ' · lapsed ' : ' · renews '}
                {timeAgo(row.currentPeriodEnd)}
              </>
            )}
          </p>

          <p className="text-dim mt-1 font-mono text-[11px]">
            {row.polarCheckoutId ? `checkout ${row.polarCheckoutId}` : 'no checkout (granted)'}
            {row.polarOrderId && ` · order ${row.polarOrderId}`}
          </p>

          {row.note && <p className="text-muted mt-1 text-[12px] italic">“{row.note}”</p>}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {row.status === 'pending' && (
            <ActionForm
              action={settlePurchaseAction}
              fields={{ purchaseId: row.id }}
              label="Settle by hand"
              confirm
              note="How was the payment confirmed?"
            />
          )}
          {row.status === 'active' && (
            <ActionForm
              action={revokePurchaseAction}
              fields={{ purchaseId: row.id }}
              label="Revoke"
              variant="danger"
              confirm
              note="Why (optional)"
            />
          )}
        </div>
      </div>
    </li>
  )
}

function StatusBadge({ status, expired }: { status: string; expired: boolean }) {
  if (status === 'active') return expired ? <Badge>Lapsed</Badge> : <Badge tone="up">Active</Badge>
  if (status === 'pending') return <Badge tone="flag">Pending</Badge>
  // Neutral, not red: a superseded gift is a founder who started paying, which
  // is the best outcome available and should not read as a withdrawal.
  if (status === 'superseded') return <Badge tone="outline">Superseded by payment</Badge>
  return <Badge tone="down">Revoked</Badge>
}
