import type { Metadata } from 'next'
import { Download, ShieldAlert } from 'lucide-react'
import { button } from '@/components/ui/button'
import { getBackupCounts } from '@/lib/data/backup'
import { BACKUP_TABLES } from '@/lib/data/backup-tables'
import { cn } from '@/lib/utils'

/*
 * Exact, not `formatCount`. Its abbreviation is right for a card on the public
 * site; here the number is what you check a restore against, and "2.9K rows"
 * cannot be compared to anything.
 */
const exact = (n: number) => n.toLocaleString('en-US')

export const metadata: Metadata = { title: 'Backup' }

export default async function AdminBackupPage() {
  const counts = await getBackupCounts()
  const total = BACKUP_TABLES.reduce((sum, table) => sum + (counts[table] ?? 0), 0)

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <h2 className="text-fg text-sm font-semibold">Download a backup</h2>
        <p className="text-muted mt-2 text-[13px] leading-relaxed">
          Every row of every table, as one JSON file. Supabase only keeps automated backups on its
          paid plans, so until that changes this is the copy that exists — take one before anything
          risky, and on whatever rhythm you can actually keep to.
        </p>
        <p className="text-muted mt-2 text-[13px] leading-relaxed">
          The file is read inside a single transaction, so all {BACKUP_TABLES.length} tables come
          from the same instant rather than drifting apart while the download runs. {exact(total)}{' '}
          rows at the moment.
        </p>

        {/*
          A plain anchor, not a Link: this URL is a 100-per-cent-side-effect GET,
          and Next would prefetch a Link on hover — dumping the database to warm
          a cache, on every pass of the mouse.
        */}
        <a href="/admin/backup/download" download className={cn(button(), 'mt-4')}>
          <Download className="size-4" />
          Download backup
        </a>
        <p className="text-dim mt-2 text-[12px]">
          Large databases take a while to stream. Leave the tab open until the file finishes.
        </p>
      </section>

      <section className="border-red/40 bg-red-dim rounded-card border p-4">
        <div className="text-red flex items-center gap-2">
          <ShieldAlert className="size-4" />
          <h2 className="text-sm font-medium">Treat the file as a secret</h2>
        </div>
        <ul className="text-fg mt-2 space-y-1.5 text-[13px] leading-relaxed">
          <li>
            It contains every founder&rsquo;s profile and their apps&rsquo; private revenue history,
            including apps still in draft.
          </li>
          <li>
            It contains the stored provider credentials. They are encrypted, and the key is{' '}
            <code className="bg-surface-2 rounded px-1 py-0.5 text-[12px]">
              CREDENTIALS_ENCRYPTION_KEY
            </code>
            , which is <em>not</em> in the file — so keep that key somewhere the backup is not, or
            neither is worth anything.
          </li>
          <li>Do not put it in the repository, in a shared drive, or in a chat.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-fg text-sm font-semibold">Putting one back</h2>
        <p className="text-muted mt-2 text-[13px] leading-relaxed">
          From a checkout of this repository, pointed at the database you want to write to:
        </p>
        <pre className="border-border bg-surface-2 rounded-card text-fg mt-3 overflow-x-auto border p-3 text-[12px]">
          npm run db:restore -- ~/Downloads/trustmrr-backup-….json
        </pre>
        <p className="text-muted mt-2 text-[13px] leading-relaxed">
          It refuses to touch a database that already has rows unless you add{' '}
          <code className="bg-surface-2 rounded px-1 py-0.5 text-[12px]">--replace</code>, and it
          tells you what it is about to do before it does it. Sign-in accounts live in
          Supabase&rsquo;s own{' '}
          <code className="bg-surface-2 rounded px-1 py-0.5 text-[12px]">auth</code> schema, which
          this backup cannot read — restoring into an empty project needs those users recreated
          first, and the script says so rather than failing halfway.
        </p>
      </section>

      <section>
        <h2 className="text-fg text-sm font-semibold">What is in it</h2>
        <dl className="border-border bg-surface rounded-card mt-3 divide-y divide-[var(--color-border)] border text-[13px]">
          {BACKUP_TABLES.map((table) => (
            <div key={table} className="flex items-baseline justify-between gap-2 px-3 py-2">
              <dt className="text-muted">
                <code className="text-[12px]">{table}</code>
              </dt>
              <dd className="text-fg font-medium tabular-nums">{exact(counts[table] ?? 0)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
