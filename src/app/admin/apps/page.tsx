import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { AppIcon } from '@/components/app-icon'
import { Badge } from '@/components/ui/badge'
import { listAdminApps, type AdminAppRow } from '@/lib/data/admin'
import { getSlotInventory } from '@/lib/data/purchases'
import { formatMoney } from '@/lib/utils'
import { ActionForm } from '../action-form'
import {
  giftDofollowAction,
  giftSponsorAction,
  revokeDofollowAction,
  revokeSponsorAction,
  setAppStatusAction,
} from '../actions'
import { AdminFilters } from '../filters'

export const metadata: Metadata = { title: 'Apps' }

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'hidden', label: 'Hidden' },
]

export default async function AdminAppsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q, status } = await searchParams
  const validStatus = ['draft', 'pending', 'live', 'hidden'].includes(status ?? '')
    ? (status as 'draft' | 'pending' | 'live' | 'hidden')
    : undefined

  const [rows, inventory] = await Promise.all([
    listAdminApps({ q, status: validStatus }),
    getSlotInventory(),
  ])

  const { slots, booked, free } = inventory

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-muted text-[13px]">
          {rows.length} app{rows.length === 1 ? '' : 's'}
          {rows.length === 100 && ' (showing the 100 most recent)'}
        </p>
        <p className="text-muted text-[13px]">
          Sponsor slots:{' '}
          <span className="text-fg font-medium">
            {booked} of {slots} in use
          </span>
          {free === 0 && (
            <>
              {' — '}
              <Link href="/admin/settings" className="text-blue hover:underline">
                add more
              </Link>
            </>
          )}
        </p>
      </div>

      <AdminFilters
        basePath="/admin/apps"
        placeholder="Search by app name, slug, or founder handle"
        filters={STATUS_FILTERS}
        filterKey="status"
      />

      {rows.length === 0 ? (
        <p className="text-muted border-border-strong mt-6 rounded-[10px] border border-dashed p-10 text-center text-[13px]">
          No apps match that.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <AppCard key={row.id} row={row} slotsFree={free} />
          ))}
        </ul>
      )}
    </div>
  )
}

function AppCard({ row, slotsFree }: { row: AdminAppRow; slotsFree: number }) {
  const sponsoring = row.sponsorSource !== null
  const dofollow = row.websiteDofollow

  return (
    <li className="border-border bg-surface rounded-[10px] border p-4">
      <div className="flex flex-wrap items-start gap-3">
        <AppIcon src={row.iconUrl} name={row.name} size={40} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/apps/${row.slug}`}
              className="text-fg hover:text-blue truncate font-medium"
            >
              {row.name}
            </Link>
            <StatusBadge status={row.status} />
            {row.isVerified && <Badge tone="verified">Verified</Badge>}
            {sponsoring && (
              <Badge tone="flag">
                {row.sponsorSource === 'admin' ? 'Slot — gifted' : 'Slot — paid'}
              </Badge>
            )}
            {dofollow && (
              <Badge tone="up">
                {row.dofollowSource === 'admin'
                  ? 'Dofollow — gifted'
                  : row.dofollowSource === 'polar'
                    ? 'Dofollow — paid'
                    : /*
                       * The flag is on with no purchase behind it. Worth naming
                       * rather than showing as "paid": it means seed data or a
                       * hand-edited row, and it is free link equity nobody is
                       * accounted for.
                       */
                      'Dofollow — no purchase'}
              </Badge>
            )}
          </div>

          <p className="text-muted mt-1 text-[12px]">
            <Link href={`/founders/${row.founderHandle}`} className="hover:text-fg">
              @{row.founderHandle}
            </Link>
            {' · '}
            {formatMoney(Number(row.mrrCents ?? 0))}/mo
            {' · '}
            {row.connectionCount === 0
              ? 'no provider connected'
              : `${row.connectionCount} source${row.connectionCount === 1 ? '' : 's'}`}
          </p>

          {row.failingConnections > 0 && (
            <p className="text-red mt-1 flex items-center gap-1.5 text-[12px]">
              <AlertTriangle className="size-3.5" />
              {row.failingConnections} connection
              {row.failingConnections === 1 ? '' : 's'} failing — revenue is not refreshing
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/apps/${row.slug}`}
            className="text-muted hover:text-fg text-[12px] whitespace-nowrap"
          >
            View page
          </Link>
        </div>
      </div>

      <div className="border-border mt-3 grid gap-4 border-t pt-3 sm:grid-cols-3">
        {/* ------------------------------- Slot ------------------------------ */}
        <Control
          title="Sponsor slot"
          state={
            sponsoring
              ? row.sponsorSource === 'admin'
                ? 'Enabled — gifted'
                : 'Enabled — paying'
              : 'Not in the rails'
          }
        >
          {sponsoring ? (
            <ActionForm
              action={revokeSponsorAction}
              fields={{ appId: row.id }}
              label="Disable slot"
              variant="danger"
              confirm
              note="Why (optional)"
            />
          ) : row.status !== 'live' ? (
            <p className="text-dim text-[12px]">The app must be live to appear in a rail.</p>
          ) : slotsFree === 0 ? (
            <p className="text-dim text-[12px]">
              No free slots.{' '}
              <Link href="/admin/settings" className="text-blue hover:underline">
                Add more
              </Link>
            </p>
          ) : (
            <ActionForm
              action={giftSponsorAction}
              fields={{ appId: row.id }}
              label="Enable slot"
              duration
              note="Why (optional)"
            />
          )}
        </Control>

        {/* ----------------------------- Dofollow ---------------------------- */}
        <Control
          title="Dofollow link"
          state={
            dofollow
              ? row.dofollowSource === 'admin'
                ? 'On — gifted'
                : row.dofollowSource === 'polar'
                  ? 'On — paid'
                  : 'On — no purchase on record'
              : row.website
                ? 'Off — link is nofollow'
                : 'No website set'
          }
        >
          {dofollow ? (
            <ActionForm
              action={revokeDofollowAction}
              fields={{ appId: row.id }}
              label="Turn off"
              variant="danger"
              confirm
              note="Why (optional)"
            />
          ) : (
            <ActionForm
              action={giftDofollowAction}
              fields={{ appId: row.id }}
              label="Gift dofollow"
              note="Why (optional)"
            />
          )}
        </Control>

        {/* ------------------------------ Listing ---------------------------- */}
        {/*
          Publish and Hide only. Verification is deliberately not editable
          here: `is_verified` is owned by the provider-connection flow — set
          when a founder connects a source, cleared when they disconnect the
          last one — and it is shown below purely as information.
        */}
        <Control title="Listing" state={`${row.status}${row.isVerified ? ' · verified' : ''}`}>
          <div className="flex flex-wrap gap-2">
            {row.status !== 'live' && (
              <ActionForm
                action={setAppStatusAction}
                fields={{ appId: row.id, status: 'live' }}
                label="Publish"
              />
            )}
            {row.status !== 'hidden' && (
              <ActionForm
                action={setAppStatusAction}
                fields={{ appId: row.id, status: 'hidden' }}
                label="Hide"
                variant="danger"
                confirm
              />
            )}
          </div>
        </Control>
      </div>
    </li>
  )
}

function Control({
  title,
  state,
  children,
}: {
  title: string
  state: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="label">{title}</p>
      <p className="text-muted mt-0.5 mb-2 text-[12px]">{state}</p>
      {children}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') return <Badge tone="up">Live</Badge>
  if (status === 'hidden') return <Badge tone="down">Hidden</Badge>
  return <Badge tone="neutral">{status}</Badge>
}
