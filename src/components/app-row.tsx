import Link from 'next/link'
import { AppIcon } from '@/components/app-icon'
import { AnonymousName } from '@/components/anonymous-name'
import { FounderAvatar } from '@/components/founder-avatar'
import { GrowthPill } from '@/components/growth-pill'
import type { AppListing } from '@/lib/data/apps'
import { cn, formatMoney } from '@/lib/utils'

/** Medals for the podium, plain numerals below it. */
function rankMark(rank: number) {
  return { 1: '🥇', 2: '🥈', 3: '🥉' }[rank] ?? rank
}

/**
 * One row of the leaderboard table. Columns line up across rows because every
 * figure is tabular monospace — the whole point of setting the site in mono.
 */
export function AppRow({
  app,
  rank,
  className,
}: {
  app: AppListing
  rank?: number
  className?: string
}) {
  return (
    /*
      A row is two links, not one. The app link is an overlay stretched across
      the whole row so the row still behaves like a single target, and the
      founder sits above it on its own stack level — nesting one anchor inside
      another is invalid markup and browsers resolve it however they like.
      Everything else is lifted out of the overlay's way with `relative`, and
      the cells that are only type get `pointer-events-none` on top of that so
      a click on the app's name still reaches the overlay underneath it rather
      than landing on dead text.
    */
    <div
      className={cn(
        'group border-border relative flex items-center gap-3 border-b px-3 py-3 transition-colors last:border-b-0 hover:bg-white/6 sm:gap-4 sm:px-4',
        className,
      )}
    >
      <Link href={`/apps/${app.slug}`} className="absolute inset-0" aria-label={app.name} />

      {rank !== undefined && (
        <span
          className="tabular text-dim pointer-events-none relative w-6 shrink-0 text-center text-xs"
          aria-hidden="true"
        >
          {rankMark(rank)}
        </span>
      )}

      <div className="pointer-events-none relative shrink-0">
        <AppIcon src={app.iconUrl} name={app.name} size={36} />
      </div>

      {/*
        The flex item still takes the whole gap so the columns to its right stay
        put, but the type inside it is capped — an App Store description runs to
        a few hundred characters, and left uncapped it would truncate somewhere
        under the founder's name instead of well before it.
      */}
      <div className="pointer-events-none relative min-w-0 flex-1">
        <div className="max-w-md min-w-0">
          <h3 className="text-fg truncate text-[13px] font-bold">
            {app.isAnonymous ? (
              <AnonymousName tooltip className="pointer-events-auto">
                {app.name}
              </AnonymousName>
            ) : (
              app.name
            )}
          </h3>
          <p className="text-muted truncate text-[11px]">
            {app.isAnonymous ? (
              <AnonymousName>{app.tagline}</AnonymousName>
            ) : (
              (app.tagline ?? app.categoryName)
            )}
          </p>
        </div>
      </div>

      <div className="relative hidden w-40 shrink-0 lg:block">
        {app.founderHandle && (
          <Link
            href={`/founders/${app.founderHandle}`}
            className="text-muted hover:text-blue group/founder flex w-fit max-w-full items-center gap-2.5 transition-colors"
          >
            <FounderAvatar
              avatarUrl={app.founderAvatarUrl}
              name={app.founderName ?? app.founderHandle}
            />
            {/*
              The person's name, not their slug. A handle identifies a row in the
              database; a name is what a reader recognises. Falls back to the
              handle — with its @ — for founders who never set one.

              The hover rule sits on the name rather than on the link, so it
              tracks the word instead of running under the avatar beside it. The
              group is named because the row is a group too.
            */}
            <span className="min-w-0 truncate text-[12px] underline-offset-2 group-hover/founder:underline">
              {app.founderName ?? `@${app.founderHandle}`}
            </span>
          </Link>
        )}
      </div>

      <div className="tabular text-fg pointer-events-none relative w-24 shrink-0 text-right text-[13px] font-extrabold sm:w-28">
        {formatMoney(app.mrrCents)}
      </div>

      <div className="pointer-events-none relative w-16 shrink-0 text-right">
        <GrowthPill value={app.growth30d} />
      </div>
    </div>
  )
}

/** Column keys for the row above. Rendered once at the top of a table. */
export function AppRowHeader({ withRank = true }: { withRank?: boolean }) {
  return (
    <div className="border-border flex items-center gap-3 border-b px-3 py-2 sm:gap-4 sm:px-4">
      {withRank && <span className="label w-6 text-center">#</span>}
      <span className="label w-9 shrink-0" />
      <span className="label flex-1">App</span>
      <span className="label hidden w-40 shrink-0 lg:block">Founder</span>
      <span className="label w-24 shrink-0 text-right sm:w-28">MRR</span>
      <span className="label w-16 shrink-0 text-right">MoM</span>
    </div>
  )
}
