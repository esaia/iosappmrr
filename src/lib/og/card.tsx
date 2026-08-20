import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { site } from '@/lib/site'

/**
 * The one social card layout, shared by every route that has an
 * `opengraph-image`. Kept here rather than repeated per route so a link to an
 * app page and a link to the home page are recognisably the same site.
 *
 * Deliberately plain: dark ground, the mark, one headline, one figure. A social
 * card is read at thumbnail size in a timeline, so anything smaller than the
 * headline is decoration that costs legibility.
 */

/** What Open Graph consumers expect, and what Next scales the card to. */
export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

const COLORS = {
  bg: '#0a0a0a',
  surface: '#141416',
  border: '#26262b',
  fg: '#f5f5f7',
  muted: '#9a9aa2',
  accent: '#0a84ff',
}

/*
 * The interface typefaces, so a card looks like the page it came from — both of
 * them, because the page uses both: Geist for the words, Geist Mono for the
 * figures. A card that set an app's name in the mono would no longer match the
 * page it is advertising.
 *
 * Read off disk from `public/` rather than fetched: these routes run on Node,
 * where a relative fetch has no origin to resolve against, and `public/` is the
 * one directory guaranteed to ship whole — no output-tracing hints needed. The
 * files are .ttf because Satori reads ttf, otf, and woff, but not woff2.
 *
 * Read once per process. Card generation is cached per URL anyway, but a warm
 * function serving a second app should not re-read 300KB to do it.
 */
const FONT_DIR = join(process.cwd(), 'public', 'fonts')
let fontCache: Promise<Awaited<ReturnType<typeof loadFonts>>> | null = null

async function loadFonts() {
  const [sans, sansBold, mono, monoBold] = await Promise.all([
    readFile(join(FONT_DIR, 'Geist-Regular.ttf')),
    readFile(join(FONT_DIR, 'Geist-Bold.ttf')),
    readFile(join(FONT_DIR, 'GeistMono-Regular.ttf')),
    readFile(join(FONT_DIR, 'GeistMono-Bold.ttf')),
  ])
  const normal = 'normal' as const
  return [
    { name: 'Geist', data: sans, weight: 400 as const, style: normal },
    { name: 'Geist', data: sansBold, weight: 700 as const, style: normal },
    { name: 'Geist Mono', data: mono, weight: 400 as const, style: normal },
    { name: 'Geist Mono', data: monoBold, weight: 700 as const, style: normal },
  ]
}

/**
 * Exported because the share card and the badge render in the same typefaces
 * and would otherwise read the same four files into caches of their own.
 */
export function cardFonts() {
  fontCache ??= loadFonts()
  return fontCache
}

/** The logo mark, inlined as SVG — Satori draws paths but cannot run CSS clips. */
function Mark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      <rect width="24" height="24" rx="6.6" fill={COLORS.accent} />
      <path
        d="M12 4.6l2.28 4.62 5.1.74-3.69 3.6.87 5.07L12 16.24l-4.56 2.39.87-5.07-3.69-3.6 5.1-.74L12 4.6z"
        fill="#ffffff"
      />
    </svg>
  )
}

/** App icon or avatar. Rounded the way iOS rounds an icon, near enough. */
function Artwork({ url, size }: { url: string; size: number }) {
  return (
    /* Satori rasterises a plain <img>; next/image renders nothing here, and alt
       text has no meaning inside a flattened PNG. */
    /* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */
    <img
      src={url}
      width={size}
      height={size}
      style={{ borderRadius: size * 0.22, border: `1px solid ${COLORS.border}` }}
    />
  )
}

/**
 * The badge, which is the claim the whole site rests on. Its tick is drawn
 * rather than typed: JetBrains Mono has no check glyph, and with a single font
 * loaded Satori renders a missing one as a blank box.
 */
function VerifiedPill({ children }: { children: string }) {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 999,
        padding: '12px 26px',
        fontSize: 26,
        fontWeight: 700,
      }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 6L9 17l-5-5"
          stroke={COLORS.accent}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </span>
  )
}

export type CardProps = {
  /** The large line. Wraps to at most three lines before it is clipped. */
  title: string
  /** One line under the title. Omit rather than pad it with filler. */
  subtitle?: string | null
  /** A figure small enough to sit in a pill, e.g. "$1.2M/mo across 24 apps". */
  figure?: string | null
  /**
   * A figure worth setting at 128px instead — the one number the card exists to
   * carry. Takes the place of `figure` where both are given.
   */
  hero?: { label: string; value: string; unit?: string } | null
  /** Optional square artwork — an App Store icon or an avatar. */
  iconUrl?: string | null
  /** Overrides the wordmark line. Defaults to the site name. */
  eyebrow?: string
}

export async function ogCard({ title, subtitle, figure, hero, iconUrl, eyebrow }: CardProps) {
  /*
   * With a hero figure the number is the card and the icon belongs beside the
   * name at the top, leaving the lower half to the figure. Without one the title
   * is the card, and the artwork sits opposite it at full size.
   */
  const layout = hero ? 'figure' : 'title'
  const iconSize = layout === 'figure' ? 132 : 220

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: COLORS.bg,
        color: COLORS.fg,
        fontFamily: 'Geist',
        padding: 64,
        // A single wash of accent from the top-left keeps the card from
        // reading as a screenshot of a terminal.
        backgroundImage: `radial-gradient(900px circle at 0% 0%, rgba(10,132,255,0.18), transparent 60%)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Mark />
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {eyebrow ?? site.name}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: layout === 'figure' ? 'center' : 'flex-end',
          gap: 40,
        }}
      >
        {iconUrl && layout === 'figure' && <Artwork url={iconUrl} size={iconSize} />}

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: title.length > 46 ? 56 : 68,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              // Satori has no line clamp; this is what the box fits.
              maxHeight: layout === 'figure' ? 160 : 250,
              overflow: 'hidden',
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 28,
                color: COLORS.muted,
                marginTop: 16,
                lineHeight: 1.35,
                maxHeight: 76,
                overflow: 'hidden',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {iconUrl && layout === 'title' && <Artwork url={iconUrl} size={iconSize} />}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: hero ? 'flex-end' : 'center',
          justifyContent: hero ? 'space-between' : 'flex-start',
          gap: 16,
        }}
      >
        {hero && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: 22,
                color: COLORS.muted,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              {hero.label}
            </span>
            <span
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                fontFamily: 'Geist Mono',
                fontSize: 128,
                fontWeight: 700,
                letterSpacing: '-0.05em',
                lineHeight: 1,
                marginTop: 8,
              }}
            >
              {hero.value}
              {hero.unit && (
                <span style={{ fontSize: 44, fontWeight: 400, color: COLORS.muted }}>
                  {hero.unit}
                </span>
              )}
            </span>
          </div>
        )}

        {/* Beside a label already reading VERIFIED MRR, a pill saying
            "Verified" says nothing twice. The tick plus the domain does the
            useful work: it names who checked the number. */}
        {hero && <VerifiedPill>{site.url.replace(/^https?:\/\//, '')}</VerifiedPill>}

        {!hero && figure && <VerifiedPill>{figure}</VerifiedPill>}
        {!hero && (
          <span style={{ fontSize: 24, color: COLORS.muted }}>
            {figure ? site.url.replace(/^https?:\/\//, '') : site.tagline}
          </span>
        )}
      </div>
    </div>,
    { ...OG_SIZE, fonts: await cardFonts() },
  )
}
