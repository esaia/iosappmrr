import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { getCurrentUser } from '@/lib/auth'
import { listAdminUsers, type AdminUserRow } from '@/lib/data/admin'
import { highResAvatar, timeAgo } from '@/lib/utils'
import { ActionForm } from '../action-form'
import { setRoleAction } from '../actions'
import { AdminFilters } from '../filters'

export const metadata: Metadata = { title: 'Users' }

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const [rows, me] = await Promise.all([listAdminUsers({ q }), getCurrentUser()])

  return (
    <div>
      <p className="text-muted text-[13px]">
        {rows.length} user{rows.length === 1 ? '' : 's'}
        {rows.length === 100 && ' (showing the 100 most recent)'}
      </p>

      <AdminFilters basePath="/admin/users" placeholder="Search by handle or name" />

      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <UserRow key={row.id} row={row} isSelf={row.id === me?.id} />
        ))}
      </ul>

      {rows.length === 0 && (
        <p className="text-muted border-border-strong mt-6 rounded-[10px] border border-dashed p-10 text-center text-[13px]">
          No users match that.
        </p>
      )}
    </div>
  )
}

function UserRow({ row, isSelf }: { row: AdminUserRow; isSelf: boolean }) {
  const avatar = highResAvatar(row.avatarUrl)

  return (
    <li className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-[10px] border p-3">
      {avatar ? (
        <Image
          src={avatar}
          alt=""
          width={36}
          height={36}
          className="size-9 shrink-0 rounded-full object-cover"
          unoptimized
        />
      ) : (
        <span className="bg-surface-3 text-muted flex size-9 shrink-0 items-center justify-center rounded-full text-[13px]">
          {row.handle.slice(0, 2).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/founders/${row.handle}`} className="text-fg hover:text-blue font-medium">
            @{row.handle}
          </Link>
          {row.role === 'admin' && <Badge tone="flag">Admin</Badge>}
          {isSelf && <Badge tone="outline">You</Badge>}
        </div>
        <p className="text-muted mt-0.5 text-[12px]">
          {row.name ?? 'No name'} ·{' '}
          <Link href={`/admin/apps?q=${row.handle}`} className="hover:text-fg">
            {row.appCount} app{row.appCount === 1 ? '' : 's'}
          </Link>
          {row.appCount > 0 && ` (${row.liveAppCount} live)`} · joined {timeAgo(row.createdAt)}
        </p>
      </div>

      {isSelf ? (
        /*
         * You cannot change your own role here — the action refuses it too.
         * Being able to demote yourself is the one mistake this screen cannot
         * undo, since the screen itself would become unreachable.
         */
        <p className="text-dim text-[12px]">Your own role is fixed here</p>
      ) : (
        <ActionForm
          action={setRoleAction}
          fields={{ profileId: row.id, role: row.role === 'admin' ? 'founder' : 'admin' }}
          label={row.role === 'admin' ? 'Demote to founder' : 'Make admin'}
          variant={row.role === 'admin' ? 'danger' : 'secondary'}
          confirm
        />
      )}
    </li>
  )
}
