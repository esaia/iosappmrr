import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { createClient } from '@/lib/supabase/server'

/** Cached per request so a page and its children don't each hit Supabase. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()

  // A hung or failing Supabase Auth reads as "nobody is signed in" rather than
  // throwing. The header renders on every page, so letting the error escape
  // would turn an auth outage into a site outage.
  let user
  try {
    user = (await supabase.auth.getUser()).data.user
  } catch {
    return null
  }

  if (!user) return null

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1)
  return profile ? { id: user.id, email: user.email ?? null, profile } : null
})

export async function requireUser(next = '/dashboard') {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  return user
}

export async function requireAdmin() {
  const user = await requireUser('/admin')
  if (user.profile.role !== 'admin') redirect('/dashboard')
  return user
}
