import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { createBillingPortalSession } from '@/lib/checkout'

/**
 * Sends the founder to Paddle's customer portal.
 *
 * A GET route rather than a server action, because this is the one control on
 * the page that leaves the site: a plain link can carry `target="_blank"` and
 * open a tab from the click itself, where an action's redirect can only replace
 * the page the founder is standing on. Their billing history is somewhere to
 * look things up, not somewhere to be sent.
 *
 * The session is minted per request and is short-lived, which is the other
 * reason this is not a static href — there is nothing to put in the markup
 * ahead of the click.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await requireUser('/account')
  const result = await createBillingPortalSession(user)

  // Back to the account page, which says what happened. The tab has already
  // opened by this point, so there is nowhere else to put the answer.
  if ('error' in result) redirect('/account?billing=unavailable')

  redirect(result.url)
}
