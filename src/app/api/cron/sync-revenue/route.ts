import { NextResponse, type NextRequest } from 'next/server'
import { authorizeCron } from '@/lib/cron'
import { syncAllRevenue } from '@/lib/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request)
  if (denied) return denied

  const started = Date.now()
  const report = await syncAllRevenue()

  return NextResponse.json({
    ...report,
    durationMs: Date.now() - started,
  })
}
