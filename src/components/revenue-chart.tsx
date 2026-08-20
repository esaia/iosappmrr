'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Check, ChevronDown, Lock } from 'lucide-react'
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
/** Shared so the tooltip dot and the Installs series cannot drift apart. */
const INSTALLS_DOT = '#b48ce0'

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
    dot: '#e0a458',
    read: (p) => p.activeSubscriptions ?? null,
    format: formatCount,
  },
  {
    key: 'trials',
    kind: 'stock',
    label: 'Trials',
    dot: '#5bbcd4',
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
   * tooltip can name both. Not smoothed with the series: it is read off the
   * day rather than drawn, and a trend-view average would make the tooltip
   * disagree with the Installs metric on the same date.
   */
  installs: number | null
}

/** Centred moving average. Smooths daily noise without shifting the line sideways. */
function smooth(values: (number | null)[], window = 7) {
  const half = Math.floor(window / 2)
  return values.map((_, i) => {
    let sum = 0
    let n = 0
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      const v = values[j]
      if (v != null) {
        sum += v
        n++
      }
    }
    return n ? Math.round(sum / n) : null
  })
}

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
export function RevenueChart({ data }: { data: RevenuePoint[] }) {
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
  const [compare, setCompare] = useState(true)
  const [trend, setTrend] = useState(false)
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

  /** All time means every day we hold; the rest are trailing windows. */
  const windowDays = days === 0 ? data.length : days
  const rangeAvailable = (range: number) => (range === 0 ? data.length > 1 : data.length >= 2)

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
    const currentValues = trend ? smooth(rawCurrent) : rawCurrent
    const prevValues = trend ? smooth(rawPrev) : rawPrev

    return current.map((point, i) => ({
      date: point.date,
      value: currentValues[i],
      prevValue: prevValues[i],
      prevDate: previous[i - offset]?.date ?? null,
      installs: point.installs ?? null,
    }))
  }, [data, windowDays, trend, metric])

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
        <div>
          <div className="flex items-baseline gap-2.5">
            <p className="tabular text-fg text-3xl font-semibold tracking-tight">
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
            {change != null && <span className="text-muted text-[13px]">vs. prev period</span>}
          </div>
          <p className="text-muted mt-1 text-[11px]">{metric.label}</p>
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
            {metricOpen && (
              <div className="glass-raised border-border absolute right-0 z-20 mt-1 w-[180px] overflow-hidden rounded-[14px] border py-1">
                {METRICS.map((option) => {
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
              <div className="glass-raised border-border absolute right-0 z-20 mt-1 w-[175px] overflow-hidden rounded-[14px] border py-1">
                {RANGES.map((range) => {
                  const enabled = rangeAvailable(range.days)
                  return (
                    <button
                      key={range.label}
                      type="button"
                      disabled={!enabled}
                      title={enabled ? undefined : 'Not enough history for this range'}
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/*
        Recharts makes its wrapper focusable for keyboard tooltip navigation,
        and a click lands focus on it — which drew the site's accent focus ring
        as a box around the whole plot. The chart is read, not operated: hover
        and the range pickers above do everything it offers, and those keep
        their rings. So the outline is dropped here rather than site-wide.
      */}
      <div className="h-72 w-full [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
              minTickGap={48}
              tick={{ fill: 'var(--fg-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              tickFormatter={(value: string) =>
                new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: 'var(--fg-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              tickFormatter={(value: number) => metric.format(value)}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
              content={<MetricTooltip metric={metric} />}
            />

            {compare && hasComparison && (
              <Line
                type="monotone"
                dataKey="prevValue"
                stroke="var(--fg-muted)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}

            <Area
              type="monotone"
              dataKey="value"
              stroke={metric.dot}
              strokeWidth={2}
              fill="url(#metric-fill)"
              dot={false}
              activeDot={{ r: 4, fill: metric.dot, stroke: 'var(--surface)', strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        <Toggle
          checked={compare && hasComparison}
          disabled={!hasComparison}
          onChange={setCompare}
          label="Compare previous period"
          hint={hasComparison ? undefined : 'Needs a full earlier period of history'}
        />
        <Toggle checked={trend} onChange={setTrend} label="Trend view" />
      </div>
    </div>
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
}: {
  active?: boolean
  payload?: { payload: ChartRow }[]
  metric?: Metric
}) {
  if (!active || !payload?.length || !metric) return null
  const point = payload[0].payload
  if (point.value == null) return null

  return (
    <div className="border-border solid-raised rounded-lg border px-3 py-2">
      <p className="text-muted text-[11px]">
        {new Date(point.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
      <p className="tabular text-fg text-sm font-medium">{metric.format(point.value)}</p>
      {/*
       * Downloads on the same day, wherever we hold them — the question any
       * spike in the takings raises. Hidden while Installs is itself the
       * plotted metric, where it would print the same number twice.
       */}
      {point.installs != null && metric.key !== 'installs' && (
        <p className="tabular text-muted mt-1.5 flex items-center gap-1.5 text-[11px]">
          <span className="size-1.5 shrink-0 rounded-full" style={{ background: INSTALLS_DOT }} />
          {formatCount(point.installs)} install{point.installs === 1 ? '' : 's'}
        </p>
      )}
      {point.prevValue != null && (
        <p className="tabular text-muted mt-1 text-[11px]">
          Prev: {metric.format(point.prevValue)}
          {point.prevDate &&
            ` · ${new Date(point.prevDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
        </p>
      )}
    </div>
  )
}
