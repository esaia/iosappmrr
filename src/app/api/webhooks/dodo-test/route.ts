import { handleDodoWebhook } from '@/lib/dodo-webhook'
import { testWebhookSecret } from '@/lib/dodo'

/**
 * Dodo's test-mode webhook endpoint.
 *
 * This deployment always runs in live mode, so a webhook signed with a
 * test-mode secret can never verify against the live one at
 * `/api/webhooks/dodo`. This route exists so test-mode purchases — made from
 * localhost or anywhere else, since they all share this database — still get
 * granted without standing up a tunnel back to a laptop. Point Dodo's
 * test-mode webhook destination here, at this same domain, and everything
 * downstream is identical to the live endpoint.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let secret: string
  try {
    secret = testWebhookSecret()
  } catch (error) {
    console.error('[dodo] test webhook is not configured', error)
    return new Response('Webhook not configured', { status: 500 })
  }

  return handleDodoWebhook(request, secret)
}
