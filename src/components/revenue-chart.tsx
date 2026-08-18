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
  mrrCents: number
  activeSubscriptions?: number | null
  activeTrials?: number | null
  revenue28dCents?: number | null
}

type MetricKey = 'revenue28d' | 'mrr' | 'subscribers' | 'trials' | 'visitors' | 'churn'

type Metric = {
  key: MetricKey
  label: string
  dot: string
  /** Pulls the value out of a day's row. Null means "no data for this day". */
  read: (point: RevenuePoint) => number | null
  format: (value: number) => string
  /** Series we have no column for. Shown locked so the menu reads as complete. */
  locked?: boolean
}

const METRICS: Metric[] = [
  {
    key: 'visitors',
    label: 'Visitors',
    dot: '#8b7fd4',
    read: () => null,
    format: formatCount,
    locked: true,
  },
  {
    key: 'revenue28d',
    label: 'Revenue',
    dot: 'var(--blue)',
    read: (p) => p.revenue28dCents ?? null,
    format: formatMrr,
  },
  {
    key: 'mrr',
    label: 'MRR',
    dot: 'var(--green)',
    read: (p) => p.mrrCents,
    format: formatMrr,
  },
  {
    key: 'subscribers',
    label: 'Subscribers',
    dot: '#e0a458',
    read: (p) => p.activeSubscriptions ?? null,
    format: formatCount,
  },
  {
    key: 'trials',
    label: 'Trials',
    dot: '#5bbcd4',
    read: (p) => p.activeTrials ?? null,
    format: formatCount,
  },
  {
    key: 'churn',
    label: 'Churn',
    dot: '#b08442',
    read: () => null,
    format: (v) => `${v}%`,
    locked: true,
  },
]

const RANGES = [
  { days: 1, label: 'Last 24 hours' },
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
  const [metricKey, setMetricKey] = useState<MetricKey>('mrr')
  const [days, setDays] = useState<number>(30)
  const [compare, setCompare] = useState(true)
  const [trend, setTrend] = useState(false)
  const [metricOpen, setMetricOpen] = useState(false)
  const [rangeOpen, setRangeOpen] = useState(false)

  const metricRef = useDismiss(() => setMetricOpen(false))
  const rangeRef = useDismiss(() => setRangeOpen(false))

  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[2]

  /** A metric is offered only when some day actually carries a value for it. */
  const metricHasData = useMemo(() => {
    const seen = new Map<MetricKey, boolean>()
    for (const m of METRICS) {
      seen.set(m.key, !m.locked && data.some((point) => m.read(point) != null))
    }
    return seen
  }, [data])

  /** All time means every day we hold; the rest are trailing windows. */
  const windowDays = days === 0 ? data.length : days
  const rangeAvailable = (range: number) =>
    range === 0 ? data.length > 1 : data.length >= Math.min(range, 2) && range > 1

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
    }))
  }, [data, windowDays, trend, metric])

  const plotted = rows.filter((r) => r.value != null)
  if (plotted.length < 2) {
    return (
      <div className="border-border text-muted flex h-56 items-center justify-center rounded-[10px] border border-dashed text-sm">
        Not enough history to chart yet. The first sync landed today.
      </div>
    )
  }

  const latest = plotted[plotted.length - 1].value as number
  // Compare like for like: the last day of the previous window, not its average.
  const priorEnd = [...rows].reverse().find((r) => r.prevValue != null)?.prevValue ?? null
  const change = priorEnd != null ? percentChange(priorEnd, latest) : null
  const hasComparison = rows.some((r) => r.prevValue != null)
  const activeRange = RANGES.find((r) => r.days === days) ?? RANGES[2]

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
                {change >= 0 ? '↑' : '↓'} {formatGrowth(Math.abs(change))}
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
              <div className="border-border bg-surface absolute right-0 z-20 mt-1 w-[180px] overflow-hidden rounded-lg border py-1">
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
              <div className="border-border bg-surface absolute right-0 z-20 mt-1 w-[175px] overflow-hidden rounded-lg border py-1">
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

      <div className="h-72 w-full">
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
    <div className="border-border bg-surface rounded-lg border px-3 py-2">
      <p className="text-muted text-[11px]">
        {new Date(point.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
      <p className="tabular text-fg text-sm font-medium">{metric.format(point.value)}</p>
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
