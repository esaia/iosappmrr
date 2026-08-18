'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client' /** lucide dropped brand marks in v1, so the GitHub logo lives here. */
function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
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
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const redirectTo = `${typeof window === 'undefined' ? '' : window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault()
    setStatus('sending')
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    if (signInError) {
      setError(signInError.message)
      setStatus('idle')
      return
    }
    setStatus('sent')
  }

  /*
   * `x` is the OAuth 2.0 provider. Supabase also exposes a separate `twitter`
   * id for the deprecated OAuth 1.0a integration — they are different entries
   * in the dashboard, and enabling one does not enable the other.
   */
  async function signInWithOAuth(provider: 'github' | 'x') {
    setError(null)
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })
    if (oauthError) setError(oauthError.message)
  }

  if (status === 'sent') {
    return (
      <div className="border-border bg-surface mt-8 rounded-[10px] border p-6">
        <h2 className="text-fg font-medium">Check your email</h2>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          We sent a sign-in link to <span className="text-[13px]">{email}</span>. It works once and
          expires in an hour.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="text-blue mt-4 text-sm hover:underline"
        >
          Use a different address
        </button>
      </div>
    )
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
          onClick={() => signInWithOAuth('github')}
          className="w-full"
        >
          <GitHubMark />
          Continue with GitHub
        </Button>
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="bg-line h-px flex-1" />
        <span className="text-muted text-[11px] tracking-widest uppercase">or</span>
        <span className="bg-line h-px flex-1" />
      </div>

      <form onSubmit={sendMagicLink} className="space-y-3">
        <label htmlFor="email" className="sr-only">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="border-border bg-surface text-fg placeholder:text-muted focus:border-border-strong w-full rounded-[10px] border px-4 py-2.5 text-sm focus:outline-none"
        />
        <Button type="submit" size="lg" disabled={status === 'sending'} className="w-full">
          {' '}
          {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-red mt-3 text-sm">
          {error}
        </p>
      )}

      <p className="text-muted mt-6 text-xs leading-relaxed">
        We only email you sign-in links and alerts about your own apps.
      </p>
    </div>
  )
}
