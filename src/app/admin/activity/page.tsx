import type { Metadata } from 'next'
import { listAdminActions } from '@/lib/data/admin'

export const metadata: Metadata = { title: 'Activity' }

export default async function AdminActivityPage() {
  const rows = await listAdminActions(200)

  return (
    <div>
      <p className="text-muted text-[13px] leading-relaxed">
        Everything done from these screens, newest first. The log is append-only — there is no way
        to edit or delete an entry from the site, which is the only thing that makes it worth
        reading.
      </p>

      {rows.length === 0 ? (
        <p className="text-muted border-border-strong rounded-card mt-6 border border-dashed p-10 text-center text-[13px]">
          Nothing recorded yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="border-border bg-surface rounded-card border p-3">
              <p className="text-fg text-[13px]">{row.summary}</p>
              <p className="text-dim mt-1 text-[11px]">
                @{row.actorHandle} · {row.action}
                {row.targetType && ` · ${row.targetType}`} ·{' '}
                {row.createdAt.toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
              {/*
                The raw detail is shown rather than summarised: it holds the
                before/after values, and reversing a mistaken change by hand
                needs the exact previous value, not a description of it.
              */}
              {Object.keys(row.detail).length > 0 && (
                <pre className="text-muted mt-1.5 overflow-x-auto text-[11px]">
                  {JSON.stringify(row.detail)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
