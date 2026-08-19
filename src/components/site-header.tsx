import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { nav } from '@/lib/site'
import { getCurrentUser } from '@/lib/auth'

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
              {/*
                Only admins see this. Not a security measure — the route and its
                actions check the role themselves — but showing a link that
                redirects everyone else straight back to the dashboard would be
                a dead end presented as navigation.
              */}
              {user.profile.role === 'admin' && (
                <Link
                  href="/admin"
                  className="text-gold hover:text-fg hidden px-2 py-1.5 text-[13px] transition-colors sm:block"
                >
                  Admin
                </Link>
              )}
              {/*
                One entry, not three. The dashboard and the account screen are
                tabs of each other, and signing out lives with the account it
                ends rather than beside the navigation.
              */}
              <Link
                href="/dashboard"
                className="text-muted hover:text-fg hidden px-2 py-1.5 text-[13px] transition-colors sm:block"
              >
                @{user.profile.handle}
              </Link>
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
        {/*
          The account controls live in the header proper from sm up, so this
          tail only exists below that. It still has to mirror the session —
          offering "Sign in" to someone already signed in reads as a lost
          session and sends them round a login they do not need.
        */}
        {user ? (
          <>
            {user.profile.role === 'admin' && (
              <Link
                href="/admin"
                className="text-gold hover:text-fg shrink-0 px-2.5 py-1 text-xs transition-colors sm:hidden"
              >
                Admin
              </Link>
            )}
            <Link
              href="/dashboard"
              className="text-muted hover:text-fg shrink-0 px-2.5 py-1 text-xs transition-colors sm:hidden"
            >
              @{user.profile.handle}
            </Link>
          </>
        ) : (
          <Link
            href="/login"
            className="text-muted hover:text-fg shrink-0 px-2.5 py-1 text-xs transition-colors sm:hidden"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  )
}
