import { ImageResponse } from 'next/og'
import { cardFonts } from '@/lib/og/card'
import { Mark } from '@/lib/og/share-card'
import { BADGE_SCALE, BADGE_SIZE, type BadgeTheme } from '@/lib/embed-badge'
import { site } from '@/lib/site'
import { formatMoney, formatMrr } from '@/lib/utils'

/**
 * The embed badge, as a PNG.
 *
 * A picture rather than markup because it has to survive on a page whose CSS we
 * will never see: a founder's landing page, a Notion doc, a site builder's
 * footer. An image renders the same in all of them and cannot be restyled into
 * something that misquotes us.
 *
 * Everything is written in device pixels — the badge is drawn at 2× and shown
 * at half — so the numbers below are twice what they look like on the page.
 */

const PALETTES: Record<BadgeTheme, { bg: string; fg: string; muted: string; border: string }> = {
  dark: {
    bg: '#0a0a0a',
    fg: '#f5f5f7',
    muted: '#9a9aa2',
    border: 'rgba(255,255,255,0.16)',
  },
  light: {
    bg: '#ffffff',
    fg: '#0a0a0a',
    muted: '#6d6d78',
    border: 'rgba(0,0,0,0.14)',
  },
}

/**
 * The exact figure, unless it is too long to sit on a badge this size.
 *
 * `$248,900` is the point of the thing and reads at a glance. Ten characters is
 * `$1,000,000`, which still fits beside the rule; past that the row runs out of
 * badge, and a compacted `$12.3M` is the same claim in a box that still closes.
 */
function figure(mrrCents: number) {
  const exact = formatMoney(mrrCents)
  return exact.length > 10 ? formatMrr(mrrCents) : exact
}

/* Satori rasterises a plain <img>; next/image renders nothing here, and alt
   text has no meaning inside a flattened PNG. */
/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */

export async function badgeImage({
  iconUrl,
  mrrCents,
  theme,
}: {
  iconUrl?: string | null
  mrrCents: number
  theme: BadgeTheme
}) {
  const palette = PALETTES[theme]

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        background: palette.bg,
        color: palette.fg,
        fontFamily: 'JetBrains Mono',
        border: `2px solid ${palette.border}`,
        borderRadius: 18,
      }}
    >
      {/* The ring matters on the light badge: most app icons have a pale
          background, and without it they dissolve into the card. */}
      {iconUrl && (
        <img
          src={iconUrl}
          width={64}
          height={64}
          style={{
            borderRadius: 15,
            flexShrink: 0,
            marginRight: 16,
            border: `2px solid ${palette.border}`,
          }}
        />
      )}

      {/*
       * Two lines, optically centred rather than mathematically: the label's
       * cap height sits above its box and the figure's does not, so equal
       * boxes read as a block sitting low. Explicit line heights and a hair of
       * space between them is what makes the pair look centred in the badge.
       */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 15,
            lineHeight: 1,
            letterSpacing: '0.16em',
            color: palette.muted,
          }}
        >
          VERIFIED REVENUE
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginTop: 9,
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: '-0.035em',
            lineHeight: 1,
          }}
        >
          {figure(mrrCents)}
          <span style={{ fontSize: 18, fontWeight: 400, color: palette.muted, marginLeft: 5 }}>
            /mo
          </span>
        </span>
      </div>

      {/*
       * Whose word the figure is on. Same mark, same blue, on every badge — it
       * is a signature, not part of the founder's colour scheme.
       *
       * The rule is doing real work. A short figure leaves a hand's width of
       * nothing between it and the wordmark, and unbounded space reads as a
       * layout that failed rather than one that breathes. Divided, the badge is
       * two fields: the claim, and who stands behind it. The share card's badge
       * separates the same two things the same way.
       */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          flexShrink: 0,
          borderLeft: `2px solid ${palette.border}`,
          marginLeft: 20,
          paddingLeft: 20,
          height: 62,
        }}
      >
        <Mark size={25} />
        <span style={{ fontSize: 19, fontWeight: 700 }}>{site.shortName}</span>
      </div>
    </div>,
    {
      width: BADGE_SIZE.width * BADGE_SCALE,
      height: BADGE_SIZE.height * BADGE_SCALE,
      fonts: await cardFonts(),
    },
  )
}

/* eslint-enable @next/next/no-img-element, jsx-a11y/alt-text */
