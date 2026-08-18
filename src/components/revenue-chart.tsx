'use client'

import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMoney, formatMrr } from '@/lib/utils'

export type RevenuePoint = { date: string; mrrCents: number }

const RANGES = [
  { days: 30, label: '30D' },
  { days: 90, label: '90D' },
  { days: 180, label: '6M' },
] as const /**
 * One series, so no legend — the heading names it. The line is blue rather than
 * green because green means "growing" everywhere else on the site, and a
 * revenue line is a level, not a direction.
 */
export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const [days, setDays] = useState<number>(180)
  const visible = data.slice(-days)

  if (visible.length < 2) {
    return (
      <div className="border-border text-muted flex h-56 items-center justify-center rounded-[10px] border border-dashed text-sm">
        Not enough history to chart yet. The first sync landed today.
      </div>
    )
  }

  const available = RANGES.filter((range) => data.length > range.days * 0.5 || range.days === 180)

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-1">
        {available.map((range) => (
          <button
            key={range.days}
            type="button"
            onClick={() => setDays(range.days)}
            aria-pressed={days === range.days}
            className={
              days === range.days
                ? 'bg-surface-2 text-fg rounded-md px-2 py-1 text-[11px] font-medium'
                : 'text-muted hover:text-fg rounded-md px-2 py-1 text-[11px] transition-colors'
            }
          >
            {range.label}
          </button>
        ))}
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visible} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="mrr-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
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
              tickFormatter={(value: number) => formatMrr(value)}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
              content={<RevenueTooltip />}
            />
            <Area
              type="monotone"
              dataKey="mrrCents"
              stroke="var(--blue)"
              strokeWidth={2}
              fill="url(#mrr-fill)"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--blue)', stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function RevenueTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: RevenuePoint }[]
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload

  return (
    <div className="border-border bg-surface rounded-lg border px-3 py-2">
      <p className="text-muted text-[11px]">
        {new Date(point.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
      <p className="tabular text-fg text-sm font-medium">
        {formatMoney(point.mrrCents)}
        <span className="text-muted">/mo</span>
      </p>
    </div>
  )
}
