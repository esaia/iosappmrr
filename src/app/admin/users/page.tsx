import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { requireAdmin } from '@/lib/auth'
import { listAdminUsers, type AdminUserRow } from '@/lib/data/admin'
import { formatMoney, timeAgo } from '@/lib/utils'
import { ActionForm } from '../action-form'
import { setUserRoleAction } from '../actions'
import { AdminFilters } from '../filters'

export const metadata: Metadata = { title: 'Users' }

const ROLE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'founder', label: 'Founders' },
  { value: 'admin', label: 'Admins' },
]

/**
 * Everyone with an account.
 *
 * No email column, deliberately: the address lives in Supabase's `auth.users`
 * and `profiles` mirrors that table without copying it. The handle is what
 * identifies a person everywhere else on the site, and it is enough to find
 * them here.
 *
 * The signed-in admin is marked rather than hidden — a list of users that
 * silently omits you reads as a bug — but their own role controls are absent,
 * because changing your own role is the one move that can lock you out.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>
}) {
  const [{ q, role }, admin] = await Promise.all([searchParams, requireAdmin()])

  const validRole = role === 'admin' || role === 'founder' ? role : undefined
  const rows = await listAdminUsers({ search: q, role: validRole })

  return (
    <div>
      <p className="text-muted text-[13px]">
        {rows.length} user{rows.length === 1 ? '' : 's'}
        {q ? ` matching “${q}”` : ''}
      </p>

      <AdminFilters
        basePath="/admin/users"
        placeholder="Search by handle or name"
        filters={ROLE_FILTERS}
        filterKey="role"
      />

      {rows.length === 0 ? (
        <p className="border-border text-muted rounded-card mt-4 border border-dashed px-4 py-8 text-center text-[13px]">
          Nobody matches that.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <UserRow key={row.id} row={row} isSelf={row.id === admin.id} />
          ))}
        </ul>
      )}
    </div>
  )
}

function UserRow({ row, isSelf }: { row: AdminUserRow; isSelf: boolean }) {
  return (
    <li className="border-border bg-surface rounded-card border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/founders/${row.handle}`}
              className="text-fg truncate text-[13px] font-medium hover:underline"
            >
              @{row.handle}
            </Link>
            {row.role === 'admin' && <Badge tone="flag">admin</Badge>}
            {isSelf && <span className="text-dim text-[11px]">you</span>}
          </div>
          <p className="text-muted mt-0.5 text-xs">
            {row.name ?? 'No name'} · joined {timeAgo(row.createdAt)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-fg text-[13px]">
            {row.appCount} app{row.appCount === 1 ? '' : 's'}
            {row.appCount > 0 && <span className="text-muted"> · {row.liveAppCount} live</span>}
          </p>
          <p className="text-dim text-[11px]">
            {row.paidCents > 0 ? `${formatMoney(row.paidCents)} paid` : 'never paid'}
          </p>
        </div>
      </div>

      {/*
        Absent on your own row. Demoting yourself is one click from losing this
        screen, and the way back is `npm run role`, which needs a terminal
        rather than a second admin.
      */}
      {!isSelf && (
        <div className="mt-3">
          <ActionForm
            action={setUserRoleAction}
            fields={{ profileId: row.id, role: row.role === 'admin' ? 'founder' : 'admin' }}
            label={row.role === 'admin' ? 'Demote to founder' : 'Make admin'}
            variant={row.role === 'admin' ? 'danger' : 'secondary'}
            note="Why?"
            confirm={row.role === 'founder'}
          />
        </div>
      )}
    </li>
  )
}
