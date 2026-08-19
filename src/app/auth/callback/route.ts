import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncXProfile } from '@/lib/x-profile'

/** Exchanges the one-time code from an OAuth redirect for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Only ever redirect within this site — an open redirect here would let a
  // crafted callback link land users on someone else's page holding a session.
  const requested = searchParams.get('next') ?? '/dashboard'
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  /*
   * The provider token is handed over once, here, and is never persisted by
   * Supabase. If this is an X sign-in it is the only chance to read the
   * founder's own follower count without a paid app-wide lookup. A failure is
   * logged and ignored — sign-in must not depend on X being cooperative.
   */
  const provider = data.session?.user.app_metadata?.provider
  const providerToken = data.session?.provider_token
  if (provider === 'x' && providerToken && data.session) {
    const result = await syncXProfile(data.session.user.id, providerToken)
    if (!result.ok) console.warn('[x-profile] follower sync skipped:', result.reason)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
