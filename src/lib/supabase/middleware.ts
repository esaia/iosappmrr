import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

const AUTH_TIMEOUT_MS = 3000

/**
 * Refreshes the auth session on every request and gates the private routes.
 * Without this, Server Components would see an expired token and log people out
 * mid-session.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const path = request.nextUrl.pathname
  const isPrivate = ['/dashboard', '/admin'].some((prefix) => path.startsWith(prefix))

  // No auth cookie means there is no session to refresh and nothing to gate on
  // for the public pages, so skip the Supabase round trip entirely.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'))
  if (!hasAuthCookie && !isPrivate) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
      global: {
        // A slow Supabase must not hold the request open until the platform
        // kills the middleware — a 504 for every signed-in visitor is far worse
        // than serving them a stale session for one request.
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) }),
      },
    },
  )

  // getUser() revalidates the token with Supabase; getSession() would trust
  // whatever the cookie claims.
  let user: User | null = null
  let authReachable = true
  try {
    user = (await supabase.auth.getUser()).data.user
  } catch {
    // Timed out or the network failed. Treat it as "unknown", not "signed out",
    // so a Supabase blip does not bounce signed-in people to /login.
    authReachable = false
  }

  // /submit is deliberately absent: anyone can look up an App Store link and
  // see the listing fill in. The save action enforces ownership instead, so the
  // sign-in prompt lands after the product has shown it works.
  if (!user && authReachable && isPrivate) {
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    login.searchParams.set('next', path)
    return NextResponse.redirect(login)
  }

  return response
}
