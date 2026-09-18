import { handleDodoWebhook } from '@/lib/dodo-webhook'
import { webhookSecret } from '@/lib/dodo'

/**
 * Dodo's live-mode webhook endpoint — the only place a purchase is granted.
 *
 * The return URL the customer lands on proves nothing: anyone can type it.
 * A signed webhook is the only evidence money actually moved, so every write
 * that hands out something paid for happens here.
 *
 * Node runtime, not edge: signature verification needs the raw bytes and the
 * database client is a Postgres socket.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let secret: string
  try {
    secret = webhookSecret()
  } catch (error) {
    console.error('[dodo] webhook is not configured', error)
    return new Response('Webhook not configured', { status: 500 })
  }

  return handleDodoWebhook(request, secret)
}
