import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { highResAvatar } from '@/lib/utils'

/**
 * Reads the signed-in founder's own X profile using the OAuth token from
 * sign-in.
 *
 * This is deliberately user-context rather than an app-wide lookup: looking up
 * an arbitrary account needs a paid X tier, while `GET /2/users/me` acts on
 * behalf of the person who just consented. If X declines — tier limits change,
 * or the scope was not granted — the handle is still stored and the follower
 * count simply stays null.
 */
export async function syncXProfile(userId: string, providerToken: string) {
  let response: Response
  try {
    response = await fetch(
      'https://api.x.com/2/users/me?user.fields=public_metrics,username,name,profile_image_url',
      {
        headers: { Authorization: `Bearer ${providerToken}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      },
    )
  } catch {
    // Never block sign-in on a third party being slow or unreachable.
    return { ok: false as const, reason: 'unreachable' }
  }

  if (!response.ok) {
    return { ok: false as const, reason: `x_${response.status}` }
  }

  const body = (await response.json()) as {
    data?: {
      username?: string
      profile_image_url?: string
      public_metrics?: { followers_count?: number }
    }
  }

  const username = body.data?.username ?? null
  const followers = body.data?.public_metrics?.followers_count ?? null
  // X returns the 48px variant here as well; store the large one.
  const avatar = highResAvatar(body.data?.profile_image_url)

  await db
    .update(profiles)
    .set({
      ...(username ? { twitter: username } : {}),
      ...(followers != null ? { twitterFollowers: followers } : {}),
      ...(avatar ? { avatarUrl: avatar } : {}),
      twitterSyncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId))

  return { ok: true as const, username, followers }
}
