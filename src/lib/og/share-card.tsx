import { ImageResponse } from 'next/og'
import { cardFonts } from '@/lib/og/card'
import { colorHex, type ShareOptions } from '@/lib/share-image'
import { site } from '@/lib/site'
import { formatMrr } from '@/lib/utils'

/**
 * The image a founder downloads from an app page and posts.
 *
 * Two shapes: a chart of the revenue history we hold, and a badge that is only
 * the current figure. Both are drawn here rather than screenshotted in the
 * browser, so what gets posted is the same image for everyone — no device
 * pixel ratio, no font that failed to load, no scrollbar caught in the corner.
 *
 * The card can say only what the app page says. It carries the name we hold
 * (already replaced with the stealth placeholder for an anonymous listing, by
 * the query that loads it), the figure, and the site that checked it. There is
 * no projection line and no smoothing: a share image that flatters the data
 * would undo the one thing this site sells.
 */

export const SHARE_CONTENT_TYPE = 'image/png'

/** 16:10 — wide enough for a month of days, tall enough to read on a phone. */
export const CHART_SIZE = { width: 1200, height: 750 }
export const BADGE_SIZE = { width: 1000, height: 320 }

type Palette = {
  bg: string
  fg: string
  muted: string
  grid: string
  border: string
  surface: string
}

const PALETTES: Record<ShareOptions['theme'], Palette> = {
  dark: {
    bg: '#0a0a0a',
    fg: '#f5f5f7',
    muted: '#9a9aa2',
    grid: 'rgba(255,255,255,0.10)',
    border: 'rgba(255,255,255,0.13)',
    surface: '#151517',
  },
  light: {
    bg: '#ffffff',
    fg: '#0a0a0a',
    muted: '#6d6d78',
    grid: 'rgba(0,0,0,0.09)',
    border: 'rgba(0,0,0,0.11)',
    surface: '#f4f4f6',
  },
}

export type SharePoint = {
  date: string
  /** Null on a day no revenue source reported. */
  mrrCents: number | null
  /** Money taken that day. Null wherever the provider cannot report one. */
  revenueCents: number | null
}

export type ShareCardInput = {
  name: string
  iconUrl?: string | null
  mrrCents: number
  /** Oldest first. The chart variant needs at least two. */
  points: SharePoint[]
  periodLabel: string
  options: ShareOptions
}

/**
 * What the chart draws: a day's takings where the provider reports them, and
 * the MRR level where it does not.
 *
 * Daily revenue is the better picture — it moves, it spikes on a launch, and it
 * is what a founder means by "how the app is doing". MRR over a month is close
 * to a flat line, which is why the card looked like a filled rectangle.
 *
 * But most apps will never have it. RevenueCat's overview reports a 28-day
 * aggregate and nothing per day, so for those the honest card is still the MRR
 * one — an empty chart would be worse than the flat line it replaces.
 *
 * Two days are enough to switch, which is the same threshold the app page's
 * chart uses to offer the metric at all. Anything short of the whole window
 * used to fall back to MRR, so a card sat on the flat line while the page
 * beside it drew the spikes. Days without a figure stay null and the line is
 * drawn across them rather than through a floor of zeroes, which would invent
 * takings of nothing on a day we simply did not hear about.
 */
function series(points: SharePoint[]) {
  const daily = points.filter((point) => point.revenueCents != null)

  return daily.length >= 2
    ? {
        values: points.map((point) => point.revenueCents),
        // The period's takings, which is what the line adds up to. MRR is a
        // rate and could not be summed like this.
        headline: daily.reduce((total, point) => total + (point.revenueCents as number), 0),
        label: 'Revenue',
      }
    : { values: points.map((point) => point.mrrCents), headline: null, label: 'MRR' }
}

/** The top of the axis: the tallest day, with 8% of headroom above it. */
function axisMax(values: (number | null)[]) {
  return Math.max(...values.filter((value): value is number => value != null), 1) * 1.08
}

/* ---------------------------------------------------------------- the plot */

/*
 * The plot is shorter than the space it could fill. `justify-content:
 * space-between` distributes slack, and at the old height there was none — so
 * the top gridline label ran into the subtitle above it and the verified line
 * sat on the dates below it. The gaps are now explicit margins, and this is
 * what is left over.
 */
const PLOT = { width: 964, height: 336 }
/** Gridlines, and the y-axis labels that sit on them. Top to bottom. */
const TICKS = [1, 0.75, 0.5, 0.25, 0]

/**
 * The line, its fill and the gridlines, as one SVG handed to Satori as an
 * image.
 *
 * Satori lays out flexbox and draws text; it does not draw a path from data.
 * Emitting the geometry as SVG and letting the rasteriser handle it is the
 * whole of the chart. Text stays outside this string on purpose — the labels
 * are Satori's, so they use the loaded font rather than whatever the SVG
 * renderer would substitute.
 */
function plotDataUri({
  values,
  hex,
  grid,
}: {
  values: (number | null)[]
  hex: string
  grid: string
}) {
  const { width, height } = PLOT
  /*
   * The scale starts at zero. Cropping the axis to the data is how a flat month
   * is made to look like a rocket, and this image goes out with our badge on it.
   * The 8% headroom keeps the peak off the top edge.
   */
  const max = axisMax(values)
  const step = values.length > 1 ? width / (values.length - 1) : 0
  const x = (index: number) => +(index * step).toFixed(2)
  const y = (value: number) => +(height - (value / max) * height).toFixed(2)

  /*
   * A day we hold no figure for is stepped over, not drawn as zero — and the x
   * position still comes from its place in the window, so the line stays lined
   * up with the dates underneath whatever is missing.
   */
  const drawn = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } => point.value != null)

  const line = drawn
    .map((point, order) => `${order ? 'L' : 'M'}${x(point.index)} ${y(point.value)}`)
    .join(' ')
  const area = `${line} L${x(drawn[drawn.length - 1].index)} ${height} L${x(drawn[0].index)} ${height} Z`
  const gridlines = TICKS.map((tick) => {
    const at = +((1 - tick) * height).toFixed(2)
    return `<line x1="0" y1="${at}" x2="${width}" y2="${at}" stroke="${grid}" stroke-width="1.5" />`
  }).join('')

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${hex}" stop-opacity="0.42" />` +
    `<stop offset="100%" stop-color="${hex}" stop-opacity="0.02" />` +
    `</linearGradient></defs>` +
    gridlines +
    `<path d="${area}" fill="url(#f)" />` +
    `<path d="${line}" fill="none" stroke="${hex}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />` +
    `</svg>`

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

/**
 * Dates along the bottom, each carrying the x position of the day it names.
 *
 * The position matters: five labels spread evenly across the axis would sit
 * under the wrong days, because the day they name is at `index / (n - 1)` and
 * that is only the same fraction when the window divides evenly. A reader
 * lining a peak up against a date would be off by a few days for their trouble.
 *
 * `left` is worked out rather than centred with a transform because the card is
 * set in a monospace face: every glyph is 0.6em wide, so the width of a label
 * is known exactly before it is drawn.
 */
const LABEL_SIZE = 22
const GLYPH = LABEL_SIZE * 0.6

function xLabels(points: SharePoint[], count = 5) {
  if (points.length < 2) return []
  const last = points.length - 1
  const seen = new Set<number>()

  return Array.from({ length: count }, (_, i) => Math.round((i / (count - 1)) * last))
    .filter((index) => {
      // A window shorter than the label count would otherwise name a day twice.
      if (seen.has(index)) return false
      seen.add(index)
      return true
    })
    .map((index) => {
      const text = new Date(points[index].date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      const width = text.length * GLYPH
      const centre = (index / last) * PLOT.width - width / 2
      return {
        text,
        // Clamped, so the first and last labels stay inside the plot rather
        // than hanging off its edges.
        left: Math.max(0, Math.min(PLOT.width - width, centre)),
      }
    })
}

/* ------------------------------------------------------------- the pieces */

/* Satori rasterises a plain <img>; next/image renders nothing here, and alt
   text has no meaning inside a flattened PNG. */
/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */

function Artwork({ url, size }: { url: string; size: number }) {
  return <img src={url} width={size} height={size} style={{ borderRadius: size * 0.22 }} />
}

/**
 * The site's mark: a star in a rounded tile, the same shape the header wears.
 *
 * The star is drawn inset to 57% of the tile — the proportion the header logo
 * uses — and centred on the tile rather than on its own bounding box, which
 * runs from y 1.5 to 20.5 and would otherwise sit high.
 *
 * Always the site blue, never the card's accent. The accent is the founder's
 * choice about their own chart; the mark is whose word the figure is on, and a
 * logo that arrives in a different colour on every post stops being one.
 */
export const BRAND = '#0a84ff'

export function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      <rect width="24" height="24" rx="6.6" fill={BRAND} />
      <path
        d="M12.0 6.59 L13.76 10.15 L17.7 10.72 L14.85 13.5 L15.52 17.41 L12.0 15.57 L8.48 17.41 L9.15 13.5 L6.3 10.72 L10.24 10.15Z"
        fill="#ffffff"
      />
    </svg>
  )
}

/** Who checked the number, under the mark that says it. */
function Verified({ palette, size = 24 }: { palette: Palette; size?: number }) {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: size,
        color: palette.muted,
      }}
    >
      <Mark size={size + 8} />
      Verified by {site.name}
    </span>
  )
}

function Title({
  name,
  iconUrl,
  palette,
  size,
}: {
  name: string
  iconUrl?: string | null
  palette: Palette
  size: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      {iconUrl && <Artwork url={iconUrl} size={size + 26} />}
      <span
        style={{
          fontSize: size,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: palette.fg,
          // Satori has no ellipsis; this is what the corner fits.
          maxWidth: 420,
          overflow: 'hidden',
        }}
      >
        {name}
      </span>
    </div>
  )
}

/* --------------------------------------------------------------- the cards */

function ChartCard({ name, iconUrl, mrrCents, points, periodLabel, options }: ShareCardInput) {
  const palette = PALETTES[options.theme]
  const hex = colorHex(options.color)
  const { values, headline, label } = series(points)
  const max = axisMax(values)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: palette.bg,
        color: palette.fg,
        fontFamily: 'Geist',
        padding: 64,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontFamily: 'Geist Mono',
              fontSize: 86,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            {formatMrr(headline ?? mrrCents)}
          </span>
          <span style={{ fontSize: 26, color: palette.muted, marginTop: 14 }}>
            {label}, {periodLabel}
          </span>
        </div>
        <Title name={name} iconUrl={iconUrl} palette={palette} size={30} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginTop: 36 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            width: 88,
            /*
             * A line taller than the plot at each end, pulled back by half a
             * line, so a label's middle lands on its gridline instead of its
             * top edge landing there.
             */
            height: PLOT.height + LABEL_SIZE,
            marginTop: -LABEL_SIZE / 2,
            marginBottom: -LABEL_SIZE / 2,
            fontSize: LABEL_SIZE,
            color: palette.muted,
          }}
        >
          {TICKS.map((tick) => (
            <span key={tick} style={{ lineHeight: 1 }}>
              {formatMrr(Math.round(max * tick))}
            </span>
          ))}
        </div>
        <img src={plotDataUri({ values, hex, grid: palette.grid })} {...PLOT} />
      </div>

      <div
        style={{
          display: 'flex',
          position: 'relative',
          width: PLOT.width,
          height: 30,
          marginLeft: 108,
          marginTop: 14,
          fontSize: LABEL_SIZE,
          color: palette.muted,
        }}
      >
        {xLabels(points).map((label) => (
          <span key={label.text} style={{ position: 'absolute', left: label.left }}>
            {label.text}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 26 }}>
        <Verified palette={palette} />
      </div>
    </div>
  )
}

/*
 * No accent anywhere on this one. The badge is a figure, a name and the mark —
 * and the mark is fixed — so the colour picker has nothing left to change here.
 * The dialog hides it for this variant, and `shareImageUrl` leaves it out of the
 * URL rather than minting a second address for identical bytes.
 */
function BadgeCard({ name, iconUrl, mrrCents, options }: ShareCardInput) {
  const palette = PALETTES[options.theme]

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 36,
        background: palette.bg,
        color: palette.fg,
        fontFamily: 'Geist',
        padding: 56,
        border: `2px solid ${palette.border}`,
      }}
    >
      {iconUrl && <Artwork url={iconUrl} size={140} />}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 28,
            color: palette.muted,
            letterSpacing: '-0.01em',
            maxWidth: 560,
            overflow: 'hidden',
          }}
        >
          {name}
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 4,
            fontFamily: 'Geist Mono',
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
            marginTop: 6,
          }}
        >
          {formatMrr(mrrCents)}
          <span style={{ fontSize: 34, fontWeight: 400, color: palette.muted }}>/mo</span>
        </span>
      </div>

      {/* The whole point of a badge: who says so. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 10,
          borderLeft: `2px solid ${palette.border}`,
          paddingLeft: 32,
          height: 140,
          justifyContent: 'center',
        }}
      >
        <Mark size={48} />
        <span style={{ fontSize: 22, color: palette.muted, textAlign: 'right' }}>
          Verified revenue
        </span>
        <span style={{ fontSize: 22, fontWeight: 700 }}>{site.name}</span>
      </div>
    </div>
  )
}

/* eslint-enable @next/next/no-img-element, jsx-a11y/alt-text */

export async function shareCard(input: ShareCardInput) {
  /*
   * A chart needs two points to be a line. One day of history renders the badge
   * instead of an axis with a dot on it — the founder still gets an image, and
   * it still says something true.
   */
  const asChart = input.options.variant === 'chart' && input.points.length >= 2
  const size = asChart ? CHART_SIZE : BADGE_SIZE

  return new ImageResponse(asChart ? <ChartCard {...input} /> : <BadgeCard {...input} />, {
    ...size,
    fonts: await cardFonts(),
  })
}
