import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without this check the
 * sync endpoints would be a public button for hammering provider APIs.
 */
export function authorizeCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 })
  }

  const header = request.headers.get('authorization')
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
