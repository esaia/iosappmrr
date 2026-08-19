import { getCurrentUser } from '@/lib/auth'
import { logAdminAction } from '@/lib/data/admin'
import { streamBackup } from '@/lib/data/backup'
import { backupFilename } from '@/lib/data/backup-tables'

export const dynamic = 'force-dynamic'
/** A dump of every table, over a long-haul connection. Give it the ceiling. */
export const maxDuration = 300

/**
 * Hands the admin the database as a file.
 *
 * A route handler rather than a server action because the response *is* the
 * backup — an action can only return a value to the page, which would mean
 * building the whole dump in memory and then handing it to the browser a second
 * time as a blob.
 *
 * The check here is its own, not the layout's. This endpoint is reachable
 * directly, and unlike the rest of /admin an unguarded GET would hand the
 * entire database, including every founder's email-adjacent profile data and
 * their encrypted provider credentials, to anyone who guessed the path.
 */
export async function GET() {
  const user = await getCurrentUser()

  if (!user || user.profile.role !== 'admin') {
    return new Response('Not an admin.\n', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  const actor = { id: user.id, handle: user.profile.handle }
  const filename = backupFilename()

  const stream = streamBackup({
    /*
     * Logged on completion rather than on request, so the entry records a
     * backup that exists. A failed dump leaves no line, which is correct: the
     * log is read as "this data left the building", and half a file did not.
     */
    onDone: ({ rows, bytes }) =>
      logAdminAction(actor, {
        action: 'download_backup',
        summary: `Downloaded a database backup (${rows.toLocaleString('en-US')} rows)`,
        detail: { filename, rows, bytes },
      }),
  })

  return new Response(stream, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}
