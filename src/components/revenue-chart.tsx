'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Area,
  Bar,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Check, ChevronDown, Lock, Plus, X } from 'lucide-react'
import { formatCount, formatGrowth, formatMrr, percentChange } from '@/lib/utils'

export type RevenuePoint = {
  date: string
  /**
   * Null on a day no revenue source reported. An installs-only connection
   * writes a snapshot for a day without saying anything about the money, so
   * "we have a row for this day" and "we know the MRR for this day" came apart
   * and the level series has to be able to say it does not know.
   */
  mrrCents: number | null
  activeSubscriptions?: number | null
  activeTrials?: number | null
  revenue28dCents?: number | null
  revenueCents?: number | null
  installs?: number | null
}

type MetricKey = 'revenueDaily' | 'revenue28d' | 'mrr' | 'subscribers' | 'trials' | 'installs'

type Metric = {
  key: MetricKey
  label: string
  dot: string
  /** Pulls the value out of a day's row. Null means "no data for this day". */
  read: (point: RevenuePoint) => number | null
  format: (value: number) => string
  /**
   * How the window collapses to one headline figure.
   *
   * A stock — MRR, subscribers, trials — is a level, so the headline is the
   * last day and the comparison is the previous window's last day. A flow —
   * money taken — only means anything added up, and its last day is often zero,
   * which would headline a healthy month as "$0, down 100%".
   */
  kind: 'stock' | 'flow'
}

/*
 * Only metrics a provider actually reports. RevenueCat's overview returns mrr,
 * revenue, active_subscriptions, active_trials and new_customers; App Store
 * Connect's subscription report returns MRR and active subscriptions. Neither
 * exposes visitors or churn, so offering them — even locked — would advertise
 * something the sync can never fill.
 */
/**
 * Shared so the pill, the line and the tooltip dot cannot drift apart.
 *
 * Amber against the blue the money is drawn in — opposite sides of the wheel,
 * which is what makes two series legible on top of each other. Cooler
 * candidates sat on the same side as the bars and separated only by
 * brightness, which the eye reads as a lighter shade of the same thing.
 */
const INSTALLS_DOT = 'var(--gold)'

const METRICS: Metric[] = [
  {
    /*
     * A day's takings, which is the series that actually looks like a business:
     * mostly small, occasionally a renewal cluster, and frequently zero. Only
     * providers with a per-day report can fill it, so for most apps every day
     * is null and `metricHasData` drops it from the picker.
     */
    key: 'revenueDaily',
    kind: 'flow',
    label: 'Daily revenue',
    dot: 'var(--blue)',
    read: (p) => p.revenueCents ?? null,
    format: formatMrr,
  },
  {
    /*
     * Downloads, which is the other half of the story a revenue chart tells on
     * its own: the day a launch lands shows up here long before it shows up in
     * the money. App Store Connect fills it; every other provider reads a
     * payments ledger and has no idea how many people installed the app.
     */
    key: 'installs',
    kind: 'flow',
    label: 'Installs',
    dot: INSTALLS_DOT,
    read: (p) => p.installs ?? null,
    format: formatCount,
  },
  {
    key: 'revenue28d',
    kind: 'stock',
    label: 'Revenue (28d)',
    dot: '#7c86ff',
    read: (p) => p.revenue28dCents ?? null,
    format: formatMrr,
  },
  {
    key: 'mrr',
    kind: 'stock',
    label: 'MRR',
    dot: 'var(--green)',
    read: (p) => p.mrrCents,
    format: formatMrr,
  },
  {
    key: 'subscribers',
    kind: 'stock',
    label: 'Subscribers',
    // Mint, not the tan this was: installs are amber and can be drawn over
    // this series, and two oranges on one chart is a colour scheme with a
    // collision in it rather than two things you can tell apart.
    dot: '#66d4cf',
    read: (p) => p.activeSubscriptions ?? null,
    format: formatCount,
  },
  {
    key: 'trials',
    kind: 'stock',
    label: 'Trials',
    // Violet rather than the cyan this was: trials and installs can be drawn
    // together, and a cool line over cool bars under a cyan area was three
    // shades of one hue.
    dot: '#bf5af2',
    read: (p) => p.activeTrials ?? null,
    format: formatCount,
  },
]

/**
 * The percentage beside a direction arrow. `formatGrowth` signs its output for
 * use on its own, which put a "+" next to a red down-arrow on any decline; the
 * arrow already carries the direction, so this prints the magnitude alone.
 */
function formatMagnitude(change: number) {
  return formatGrowth(Math.abs(change))?.replace(/^\+/, '')
}

/*
 * The shortest window is a week. There was a 24-hour option, but snapshots are
 * captured once a day: it could only ever join yesterday's capture to today's,
 * two points pretending to be a day of resolution. Hourly data would need the
 * providers to report it — RevenueCat's overview endpoint returns current
 * values with no series, so it cannot be backfilled — plus somewhere hourly to
 * put it, since revenue_snapshots is unique per day.
 */
const DEFAULT_DAYS = 30

const RANGES = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 3 months' },
  { days: 180, label: 'Last 6 months' },
  { days: 365, label: 'Last 12 months' },
  { days: 0, label: 'All time' },
] as const

/** Row handed to recharts: current window, plus the window before it aligned by index. */
type ChartRow = {
  date: string
  value: number | null
  prevValue: number | null
  prevDate: string | null
  /**
   * The day's downloads, carried alongside whichever metric is plotted so the
   * tooltip can name both.
   */
  installs: number | null
}

/** The tooltip's date format, shared so both rows read the same. */
function tooltipDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Whether the reader has asked for less motion.
 *
 * The site already honours the preference in CSS, but that block only clamps
 * CSS animations and transitions — Recharts moves its shapes by interpolating
 * SVG attributes in JavaScript, which no stylesheet can reach. Without this the
 * one thing on the page that moves the most would be the one thing ignoring the
 * request not to.
 *
 * Starts false and resolves in an effect, so the server and the first client
 * render agree and hydration does not warn.
 */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * A phone has no width to spare.
 *
 * The plot sits inside the card's padding with a value axis on each side, and
 * on a 390px screen those four gutters ate roughly a third of the row — the
 * bars were squeezed into the middle while the edges sat empty. Below `sm` the
 * chart bleeds out to the card's own edges and the axes give back what they
 * can, which is where the missing width comes from.
 *
 * Starts false and resolves in an effect so server and first client render
 * agree and hydration does not warn.
 */
function useNarrow() {
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)')
    setNarrow(query.matches)

    const onChange = (event: MediaQueryListEvent) => setNarrow(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return narrow
}

/**
 * Matches the site's own easing and pace — see `.rise` and `.draw` in
 * globals.css.
 *
 * No per-series delay. Staggering the overlay behind the bars read well on
 * first paint, but a toggle re-renders the chart mid-flight and a delayed
 * animation restarts from nothing each time — which left the installs line
 * invisible for as long as the reader kept clicking. Everything starts
 * together and always arrives.
 */
const MOTION = { duration: 650, easing: 'ease-out' } as const

/** Closes a dropdown on outside click and on Escape. */
function useDismiss(onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onDismiss()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [onDismiss])
  return ref
}

/**
 * One series at a time, so no legend — the metric picker names it. Revenue is
 * blue rather than green because green means "growing" everywhere else on the
 * site, and a revenue line is a level, not a direction.
 */
export function RevenueChart({
  data,
  signedIn = false,
}: {
  data: RevenuePoint[]
  /**
   * Longer windows are for signed-in readers. The page enforces it where it
   * counts — a signed-out visitor is only sent the days they may see — so this
   * exists to say why the control is locked rather than to do the locking.
   */
  signedIn?: boolean
}) {
  /*
   * Opens on the day's takings where the provider reports them, and on MRR
   * where it does not.
   *
   * MRR is the figure the site is built around, but as an opening chart it is
   * the least interesting thing an app has: a level moves slowly by
   * construction, so a healthy app and a dying one both draw a flat line for
   * thirty days. Daily revenue shows the same business actually working — the
   * quiet days, the renewal clusters — and MRR is one click away in the picker.
   */
  const [metricKey, setMetricKey] = useState<MetricKey>(() =>
    data.some((point) => point.revenueCents != null) ? 'revenueDaily' : 'mrr',
  )
  const [days, setDays] = useState<number>(DEFAULT_DAYS)
  /*
   * The companion series. On by default where there is anything to draw — it
   * is the second half of the story a revenue chart tells on its own, and a
   * founder should not have to find a toggle to see it — but dismissable,
   * since a chart of one thing is easier to read than a chart of two.
   */
  const [showInstalls, setShowInstalls] = useState(true)
  /*
   * On only for a chart that would otherwise draw one line.
   *
   * The comparison is worth its clutter when there is room for it, and an app
   * without installs has exactly that. Where installs are drawn the chart is
   * already carrying two series on two axes, and a third — dashed, on the
   * left-hand scale, describing a window that is not the one being read — is
   * where it stops being legible. Still one click away either way.
   */
  const [compare, setCompare] = useState(() => !data.some((point) => point.installs != null))
  const animate = !useReducedMotion()
  const narrow = useNarrow()
  const [metricOpen, setMetricOpen] = useState(false)
  const [rangeOpen, setRangeOpen] = useState(false)

  const metricRef = useDismiss(() => setMetricOpen(false))
  const rangeRef = useDismiss(() => setRangeOpen(false))

  // Falls back to MRR by name rather than by position, so inserting a metric
  // above it in the list cannot silently change what the chart plots.
  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS.find((m) => m.key === 'mrr')!

  /** A metric is offered only when some day actually carries a value for it. */
  const metricHasData = useMemo(() => {
    const seen = new Map<MetricKey, boolean>()
    for (const m of METRICS) {
      seen.set(
        m.key,
        data.some((point) => m.read(point) != null),
      )
    }
    return seen
  }, [data])

  /*
   * Metrics the picker actually lists.
   *
   * A locked row is a promise that the figure exists and this app has not
   * filled it in yet — true of trials or subscribers, which the connected
   * provider reports as soon as there are any. Installs are not like that: no
   * payments provider can ever report a download, so on an app without an App
   * Store Connect key the row would be advertising something that will never
   * arrive no matter how the app does. Better to say nothing than to dangle it.
   */
  const offeredMetrics = useMemo(
    () => METRICS.filter((m) => m.key !== 'installs' || metricHasData.get('installs')),
    [metricHasData],
  )

  /** All time means every day we hold; the rest are trailing windows. */
  const windowDays = days === 0 ? data.length : days

  /**
   * Why a range cannot be picked, or nothing if it can.
   *
   * Two different refusals, and they are worth telling apart: an app three days
   * old has no year to show anybody, while a year that exists but is not for
   * this reader is an invitation to sign in. Same lock, different sentence.
   */
  const rangeBlocked = (range: number) => {
    if (!signedIn && range !== DEFAULT_DAYS) return 'Sign in to see other date ranges'
    if (range === 0 ? data.length <= 1 : data.length < 2) return 'Not enough history for this range'
    return null
  }

  const rows = useMemo<ChartRow[]>(() => {
    const current = data.slice(-windowDays)
    // The window immediately before the current one, same length.
    const previous = data.slice(Math.max(0, data.length - windowDays * 2), data.length - windowDays)
    // Align by index from the right so both windows end on their final day.
    const offset = current.length - previous.length

    const rawCurrent = current.map((p) => metric.read(p))
    const rawPrev = current.map((_, i) => {
      const point = previous[i - offset]
      return point ? metric.read(point) : null
    })
    const rawInstalls = current.map((p) => p.installs ?? null)

    return current.map((point, i) => ({
      date: point.date,
      value: rawCurrent[i],
      prevValue: rawPrev[i],
      prevDate: previous[i - offset]?.date ?? null,
      installs: rawInstalls[i],
    }))
  }, [data, windowDays, metric])

  /*
   * Offered only when the days actually carry installs, and never against the
   * Installs metric itself — where the overlay would be a second copy of the
   * series already plotted.
   */
  const installsAvailable = metric.key !== 'installs' && rows.some((row) => row.installs != null)
  const installsOn = installsAvailable && showInstalls

  /*
   * A flow is drawn as bars and a level as an area.
   *
   * A day's takings is a quantity that happened and then stopped, so the line
   * between two days means nothing — and most of those days are zero. A level
   * like MRR is the opposite: true at every moment, so a continuous fill is
   * honest. The distinction already exists on the metric as `kind`.
   */
  const asBars = metric.kind === 'flow'

  const plotted = rows.filter((r) => r.value != null)
  if (plotted.length < 2) {
    return (
      <div className="border-border text-muted rounded-card flex h-56 items-center justify-center border border-dashed text-sm">
        Not enough history to chart yet. The first sync landed today.
      </div>
    )
  }

  const sum = (values: (number | null)[]) =>
    values.reduce<number>((total, value) => total + (value ?? 0), 0)

  const latest =
    metric.kind === 'flow'
      ? sum(rows.map((r) => r.value))
      : (plotted[plotted.length - 1].value as number)

  /*
   * Compare like for like: a level against the previous window's closing level,
   * a total against the previous window's total.
   */
  const priorEnd =
    metric.kind === 'flow'
      ? rows.some((r) => r.prevValue != null)
        ? sum(rows.map((r) => r.prevValue))
        : null
      : ([...rows].reverse().find((r) => r.prevValue != null)?.prevValue ?? null)
  const change = priorEnd != null ? percentChange(priorEnd, latest) : null
  const hasComparison = rows.some((r) => r.prevValue != null)
  const activeRange =
    RANGES.find((r) => r.days === days) ?? RANGES.find((r) => r.days === DEFAULT_DAYS)!

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        {/*
          Label above figure, not below it.
          
          On a page where this chart sits under a row of headline figures the
          reader needs to know what they are looking at before they read the
          number, and the old order made them read a bare figure and then go
          looking for its name. The figure is also a step smaller than the
          headline row above: it answers "over this window", which is a
          narrower question than the ones in the masthead.
        */}
        <div>
          <p className="label">{metric.label}</p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-2.5">
            <p className="tabular text-fg text-[26px] leading-none font-semibold tracking-tight">
              {metric.format(latest)}
            </p>
            {change != null && (
              <span
                className={
                  change >= 0
                    ? 'text-[13px] font-medium text-[var(--green)]'
                    : 'text-[13px] font-medium text-[var(--red)]'
                }
              >
                {change >= 0 ? '↑' : '↓'} {formatMagnitude(change)}
              </span>
            )}
            {change != null && <span className="text-dim text-[13px]">vs. prev period</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Metric picker */}
          <div className="relative" ref={metricRef}>
            <button
              type="button"
              onClick={() => setMetricOpen((open) => !open)}
              aria-expanded={metricOpen}
              className="border-border bg-surface-2 text-fg hover:border-border-strong flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors"
            >
              <span className="size-2 rounded-full" style={{ background: metric.dot }} />
              {metric.label}
              <ChevronDown className="text-muted size-3.5" />
            </button>
            {/*
              Solid, not glass: both these menus open downwards over the plot,
              and a blue bar reading through a row of labels is not a menu any
              more. The same reason the tooltip below is solid.
            */}
            {metricOpen && (
              <div className="solid-raised border-border absolute right-0 z-20 mt-1 w-[180px] overflow-hidden rounded-[14px] border py-1">
                {offeredMetrics.map((option) => {
                  const enabled = metricHasData.get(option.key)
                  return (
                    <button
                      key={option.key}
                      type="button"
                      disabled={!enabled}
                      title={enabled ? undefined : 'No data for this metric yet'}
                      onClick={() => {
                        setMetricKey(option.key)
                        setMetricOpen(false)
                      }}
                      className={
                        option.key === metricKey
                          ? 'bg-surface-2 text-fg flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]'
                          : 'text-muted hover:bg-surface-2 hover:text-fg flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent'
                      }
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: option.dot }}
                      />
                      <span className="flex-1">{option.label}</span>
                      {option.key === metricKey && <Check className="size-3.5 shrink-0" />}
                      {!enabled && <Lock className="size-3 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Range picker */}
          <div className="relative" ref={rangeRef}>
            <button
              type="button"
              onClick={() => setRangeOpen((open) => !open)}
              aria-expanded={rangeOpen}
              className="border-border bg-surface-2 text-fg hover:border-border-strong flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors"
            >
              {activeRange.label}
              <ChevronDown className="text-muted size-3.5" />
            </button>
            {rangeOpen && (
              <div className="solid-raised border-border absolute right-0 z-20 mt-1 w-[175px] overflow-hidden rounded-[14px] border py-1">
                {RANGES.map((range) => {
                  const blocked = rangeBlocked(range.days)
                  const enabled = !blocked
                  return (
                    <button
                      key={range.label}
                      type="button"
                      disabled={!enabled}
                      title={blocked ?? undefined}
                      onClick={() => {
                        setDays(range.days)
                        setRangeOpen(false)
                      }}
                      className={
                        range.days === days
                          ? 'bg-surface-2 text-fg flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]'
                          : 'text-muted hover:bg-surface-2 hover:text-fg flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent'
                      }
                    >
                      <span className="flex-1">{range.label}</span>
                      {range.days === days && <Check className="size-3.5 shrink-0" />}
                      {!enabled && <Lock className="size-3 shrink-0" />}
                    </button>
                  )
                })}

                {/*
                  A row of locks with no way past them is a dead end. Everything
                  above this line is one sign-in away, so the menu says so and
                  offers the door rather than leaving the reader to find it.
                */}
                {!signedIn && (
                  <Link
                    href="/login"
                    className="border-border text-blue hover:bg-surface-2 mt-1 flex items-center gap-2 border-t px-3 py-2 text-[13px] transition-colors"
                  >
                    Sign in to unlock
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {installsAvailable && (
        /*
         * A legend that does something. With two series drawn the colours need
         * naming, and the same row is the natural place to put the series back
         * or take it away — a separate toggle below would leave the reader
         * hunting for which control governs which line.
         */
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          <SeriesPill color={metric.dot} label={metric.label} />
          <SeriesPill
            color={INSTALLS_DOT}
            label="Installs"
            active={showInstalls}
            onToggle={() => setShowInstalls((on) => !on)}
          />
        </div>
      )}

      {/*
        Recharts makes its wrapper focusable for keyboard tooltip navigation,
        and a click lands focus on it — which drew the site's accent focus ring
        as a box around the whole plot. The chart is read, not operated: hover
        and the range pickers above do everything it offers, and those keep
        their rings. So the outline is dropped here rather than site-wide.
      */}
      <div className="-mx-5 h-72 w-auto sm:mx-0 sm:w-full [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 4, right: narrow ? 2 : 8, bottom: 0, left: narrow ? 2 : 0 }}
          >
            <defs>
              {/* Deep at the line, fading to nothing at the axis. */}
              <linearGradient id="metric-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric.dot} stopOpacity="0.75" />
                <stop offset="55%" stopColor={metric.dot} stopOpacity="0.28" />
                <stop offset="100%" stopColor={metric.dot} stopOpacity="0.03" />
              </linearGradient>
            </defs>

            {/* Grid and axes stay recessive — the line is the content. */}
            <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              minTickGap={narrow ? 28 : 48}
              tick={{
                fill: 'var(--fg-muted)',
                fontSize: narrow ? 10 : 11,
                fontFamily: 'var(--font-mono)',
              }}
              tickFormatter={(value: string) =>
                new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={narrow ? 40 : 56}
              tick={{
                fill: 'var(--fg-muted)',
                fontSize: narrow ? 10 : 11,
                fontFamily: 'var(--font-mono)',
              }}
              tickFormatter={(value: number) => metric.format(value)}
            />
            {installsOn && (
              /*
               * Its own axis, on the right. Installs and money share no unit
               * and routinely differ by an order of magnitude — forced onto one
               * scale, the smaller series would lie flat against the floor.
               */
              <YAxis
                yAxisId="installs"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={narrow ? 32 : 48}
                tick={{
                  fill: 'var(--fg-muted)',
                  fontSize: narrow ? 10 : 11,
                  fontFamily: 'var(--font-mono)',
                }}
                tickFormatter={(value: number) => formatCount(value)}
              />
            )}
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
              content={<MetricTooltip metric={metric} showInstalls={installsOn} />}
            />

            {compare && hasComparison && (
              <Line
                /*
                 * Stable keys on every series.
                 *
                 * These are conditional siblings, so without them React matches
                 * by position: switching the comparison on shifts the rest down
                 * the children array, they remount, and an untouched series
                 * redraws itself from nothing. Keyed, only the series that
                 * actually appeared animates.
                 */
                key="comparison"
                type="monotone"
                dataKey="prevValue"
                stroke="var(--fg-muted)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={animate}
                animationDuration={MOTION.duration}
                animationEasing={MOTION.easing}
              />
            )}

            {asBars ? (
              <Bar
                key="primary"
                dataKey="value"
                fill={metric.dot}
                fillOpacity={0.85}
                // Rounded at the top only: the bar stands on the axis, and
                // rounding its base would lift it off its own zero.
                radius={[3, 3, 0, 0]}
                maxBarSize={26}
                isAnimationActive={animate}
                animationDuration={MOTION.duration}
                animationEasing={MOTION.easing}
              />
            ) : (
              <Area
                key="primary"
                type="monotone"
                dataKey="value"
                stroke={metric.dot}
                strokeWidth={2}
                fill="url(#metric-fill)"
                dot={false}
                activeDot={{ r: 4, fill: metric.dot, stroke: 'var(--surface)', strokeWidth: 2 }}
                connectNulls
                isAnimationActive={animate}
                animationDuration={MOTION.duration}
                animationEasing={MOTION.easing}
              />
            )}

            {installsOn && (
              /*
               * Drawn last so it rides over the bars rather than behind them,
               * and as a line because a download count is a series of readings
               * rather than a set of quantities to compare side by side.
               */
              <Line
                key="installs"
                yAxisId="installs"
                type="monotone"
                dataKey="installs"
                stroke={INSTALLS_DOT}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: INSTALLS_DOT, stroke: 'var(--surface)', strokeWidth: 2 }}
                connectNulls
                isAnimationActive={animate}
                animationDuration={MOTION.duration}
                animationEasing={MOTION.easing}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="border-border mt-4 flex flex-wrap items-center gap-5 border-t pt-4">
        <Toggle
          checked={compare && hasComparison}
          disabled={!hasComparison}
          onChange={setCompare}
          label="Compare previous period"
          hint={hasComparison ? undefined : 'Needs a full earlier period of history'}
        />
      </div>
    </div>
  )
}

/**
 * One series in the legend. Inert for the metric the picker governs, and a
 * button for the overlay that can be dropped — the icon says which it is.
 */
function SeriesPill({
  color,
  label,
  active,
  onToggle,
}: {
  color: string
  label: string
  active?: boolean
  onToggle?: () => void
}) {
  const swatch = (
    <span
      className="size-2 shrink-0 rounded-[3px]"
      style={{ background: active === false ? 'var(--fg-muted)' : color }}
    />
  )

  if (!onToggle) {
    return (
      <span className="border-border bg-surface-2 text-fg flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px]">
        {swatch}
        {label}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={active ? `Hide ${label}` : `Show ${label}`}
      className={
        active
          ? 'border-border bg-surface-2 text-fg hover:border-border-strong flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] transition-colors'
          : 'border-border text-muted hover:text-fg hover:border-border-strong flex items-center gap-2 rounded-full border border-dashed px-3 py-1.5 text-[12px] transition-colors'
      }
    >
      {swatch}
      {label}
      {active ? <X className="size-3 shrink-0" /> : <Plus className="size-3 shrink-0" />}
    </button>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
  hint,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  hint?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={hint}
      onClick={() => onChange(!checked)}
      className="group flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={
          checked
            ? 'flex h-[18px] w-8 items-center rounded-full bg-[var(--blue)] px-[2px] transition-colors'
            : 'bg-surface-3 flex h-[18px] w-8 items-center rounded-full px-[2px] transition-colors'
        }
      >
        <span
          className={
            checked
              ? 'size-[14px] translate-x-[14px] rounded-full bg-white transition-transform'
              : 'size-[14px] translate-x-0 rounded-full bg-[var(--fg-muted)] transition-transform'
          }
        />
      </span>
      <span className="text-muted group-hover:text-fg text-[12px] transition-colors">{label}</span>
    </button>
  )
}

function MetricTooltip({
  active,
  payload,
  metric,
  showInstalls,
}: {
  active?: boolean
  payload?: { payload: ChartRow }[]
  metric?: Metric
  showInstalls?: boolean
}) {
  if (!active || !payload?.length || !metric) return null
  const point = payload[0].payload
  if (point.value == null) return null

  const installs = showInstalls && point.installs != null ? point.installs : null

  return (
    <div className="border-border solid-raised min-w-[170px] rounded-lg border px-3 py-2">
      {/*
       * One row per series, colour-keyed to the chart. With two series drawn
       * there is nothing to tell a bare number apart from the other one.
       *
       * The plotted metric is labelled by its date rather than its name: the
       * name is already on the legend pill and the picker directly above, and
       * printing it here cost a whole line to repeat it — while the date, which
       * only the tooltip can say, was sitting in a header of its own. The dot
       * carries the identity, and the row now carries the fact.
       */}
      <TooltipRow
        color={metric.dot}
        label={tooltipDate(point.date)}
        value={metric.format(point.value)}
      />
      {installs != null && (
        <TooltipRow color={INSTALLS_DOT} label="Installs" value={formatCount(installs)} />
      )}

      {/*
       * The comparison reads as a third series, because on the chart it is
       * one — the grey dashed line. Its grey dot keys it to that line, which
       * is what "Prev" used to say in words; a row that is already a date, a
       * colour and a figure does not need a fourth thing on it.
       *
       * Dated like the row above, day and month only. On the longest ranges
       * the window being compared against is a year back, so the two rows can
       * name the same month a year apart — the range picker overhead says
       * which, and the tooltip stays short.
       */}
      {point.prevValue != null && point.prevDate && (
        <TooltipRow
          color="var(--fg-muted)"
          label={tooltipDate(point.prevDate)}
          value={metric.format(point.prevValue)}
          muted
        />
      )}
    </div>
  )
}

/**
 * One series in the tooltip: its colour, its name, its figure for the day.
 *
 * `muted` is for the comparison, which is a reading from another window rather
 * than one of today's — it keeps the shape so the eye can scan the column, and
 * loses the weight so it does not compete with the day being read.
 */
function TooltipRow({
  color,
  label,
  value,
  muted,
}: {
  color: string
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <p className="flex items-center gap-2 py-[3px] text-[12px]">
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="text-muted">{label}</span>
      <span
        className={muted ? 'tabular text-muted ml-auto' : 'tabular text-fg ml-auto font-medium'}
      >
        {value}
      </span>
    </p>
  )
}
