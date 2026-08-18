import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { nav } from '@/lib/site'
import { getCurrentUser } from '@/lib/auth'
import { signOutAction } from '@/app/auth/actions'

/**
 * Reads the session so the right-hand side reflects who is signed in. This
 * makes every page render per request rather than at build time — the cost of
 * a header that can tell the truth about the reader.
 */
export async function SiteHeader() {
  const user = await getCurrentUser()
  return (
    <header className="border-border bg-bg/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted hover:bg-surface-2 hover:text-fg rounded-md px-2.5 py-1.5 text-[13px] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-muted hover:text-fg hidden px-2 py-1.5 text-[13px] transition-colors sm:block"
              >
                @{user.profile.handle}
              </Link>
              <form action={signOutAction} className="hidden sm:block">
                <button
                  type="submit"
                  className="text-muted hover:text-fg px-2 py-1.5 text-[13px] transition-colors"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="text-muted hover:text-fg hidden px-2 py-1.5 text-[13px] transition-colors sm:block"
            >
              Sign in
            </Link>
          )}
          <ButtonLink href="/submit" size="sm">
            Add app
          </ButtonLink>
        </div>
      </div>

      {/*
        Below md the main nav has nowhere to sit. Rather than hide navigation
        behind a hamburger, the same links run as a scrollable strip.
      */}
      <nav
        className="rail border-border flex gap-1 overflow-x-auto border-t px-4 py-1.5 md:hidden"
        aria-label="Sections"
      >
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-muted hover:bg-surface-2 hover:text-fg shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors"
          >
            {item.label}
          </Link>
        ))}
        <Link href="/login" className="text-muted shrink-0 px-2.5 py-1 text-xs sm:hidden">
          Sign in
        </Link>
      </nav>
    </header>
  )
}
