'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Clears the Supabase session cookie and returns to the home page. */
export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // The header renders per request from the session, so every cached path is stale.
  revalidatePath('/', 'layout')
  redirect('/')
}
