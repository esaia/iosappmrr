'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

/** lucide dropped brand marks in v1, so the Google logo lives here. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  )
}

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null)

  /*
   * `x` is the OAuth 2.0 provider. Supabase also exposes a separate `twitter`
   * id for the deprecated OAuth 1.0a integration — they are different entries
   * in the dashboard, and enabling one does not enable the other.
   */
  async function signInWithOAuth(provider: 'google' | 'x') {
    setError(null)
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })
    if (oauthError) setError(oauthError.message)
  }

  return (
    <div className="mt-8">
      <div className="space-y-2">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => signInWithOAuth('x')}
          className="w-full"
        >
          <XMark />
          Continue with X
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => signInWithOAuth('google')}
          className="w-full"
        >
          <GoogleMark />
          Continue with Google
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-red mt-3 text-sm">
          {error}
        </p>
      )}

      <p className="text-muted mt-6 text-xs leading-relaxed">
        We only email you alerts about your own apps.
      </p>
    </div>
  )
}
