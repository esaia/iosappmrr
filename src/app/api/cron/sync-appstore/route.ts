import { NextResponse, type NextRequest } from 'next/server'
import { authorizeCron } from '@/lib/cron'
import { syncAppStoreMetadata } from '@/lib/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request)
  if (denied) return denied

  const started = Date.now()
  const report = await syncAppStoreMetadata()

  return NextResponse.json({ ...report, durationMs: Date.now() - started })
}
