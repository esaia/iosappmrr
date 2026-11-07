import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { nav } from '@/lib/site'
import { HeaderAccount } from '@/components/header-account'

/**
 * The account corner asks who is signed in from the browser (`HeaderAccount`),
 * so the header reads no cookies and every page around it can be cached rather
 * than rendered per request.
 *
 * The chrome is a floating capsule rather than a full-width bar: it is inset
 * from all three edges, so content scrolls visibly past its sides and the blur
 * has something moving behind it. A bar pinned edge to edge would have to be
 * near-opaque to stay readable, which is the point at which glass stops being
 * glass and becomes a dark strip.
 *
 * Its inner width matches `Container`, so the logo sits directly above the
 * first character of every page's heading.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="glass-raised border-border mx-auto max-w-6xl rounded-[14px] border">
        <div className="flex h-14 items-center gap-6 px-3 sm:px-4">
          <Logo />

          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted hover:text-fg rounded-md px-3 py-1.5 text-[13px] transition-colors hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <HeaderAccount variant="bar" />
            <ButtonLink href="/submit" size="sm">
              Add app
            </ButtonLink>
          </div>
        </div>

        {/*
          Below md the main nav has nowhere to sit. Rather than hide navigation
          behind a hamburger, the same links run as a scrollable strip — inside
          the capsule, so the chrome stays one object.
        */}
        <nav
          className="rail border-border flex gap-1 overflow-x-auto border-t px-3 py-2 md:hidden"
          aria-label="Sections"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted hover:text-fg shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors hover:bg-white/10"
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
          <HeaderAccount variant="rail" />
        </nav>
      </div>
    </header>
  )
}
