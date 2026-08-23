import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { timeoutFetch } from '@/lib/supabase/timeout'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set. See .env.example.`)
  return value
}

/** Request-scoped client that reads and refreshes the user's session cookies. */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component, where cookies are read-only. The
            // middleware refreshes the session instead, so this is safe to skip.
          }
        },
      },
      global: { fetch: timeoutFetch },
    },
  )
}
