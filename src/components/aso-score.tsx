import { ASO_BAND_LABEL, asoBand, type AsoSignal } from '@/lib/appstore/aso'
import { cn } from '@/lib/utils'

/**
 * How well the App Store listing itself is built, next to the revenue it earns.
 *
 * Framed as listing quality rather than "ASO rank" on purpose: the score is
 * computed from Apple's public catalogue, which does not expose the subtitle,
 * the keyword field, or conversion rate. Claiming a rank from it would be a
 * guess dressed up as a measurement.
 */
export function AsoScore({
  total,
  signals,
  fetchedAt,
}: {
  total: number
  signals: AsoSignal[]
  fetchedAt?: Date | null
}) {
  const band = asoBand(total)
  const tone = {
    strong: { text: 'text-green', bar: 'bg-green', pill: 'bg-green-dim text-green' },
    fair: { text: 'text-gold', bar: 'bg-gold', pill: 'bg-gold-dim text-gold' },
    weak: { text: 'text-red', bar: 'bg-red', pill: 'bg-red-dim text-red' },
  }[band]

  return (
    <section className="border-border glass-panel rounded-card border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="label">Listing quality (ASO)</h2>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide',
            tone.pill,
          )}
        >
          {ASO_BAND_LABEL[band]}
        </span>
      </div>

      <p className="tabular mt-2">
        <span className={cn('text-3xl font-semibold tracking-tight', tone.text)}>{total}</span>
        <span className="text-muted text-sm">/100</span>
      </p>

      <dl className="mt-4 space-y-3">
        {signals.map((signal) => (
          <div key={signal.key}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <dt className="text-fg">{signal.label}</dt>
              <dd className="tabular text-muted text-xs">
                {(signal.score * signal.weight).toFixed(1)}
                <span className="text-dim">/{signal.weight}</span>
              </dd>
            </div>
            {/*
              Decorative: the points beside the label already say what the bar
              says, so a screen reader gains nothing from reading it twice.
            */}
            <div
              className="bg-surface-3 mt-1.5 h-1 overflow-hidden rounded-full"
              aria-hidden="true"
            >
              <div
                className={cn('h-full rounded-full', tone.bar)}
                style={{ width: `${Math.round(signal.score * 100)}%` }}
              />
            </div>
            <p className="text-dim mt-1 text-[11px] leading-snug">{signal.detail}</p>
          </div>
        ))}
      </dl>

      <p className="border-border text-dim mt-4 border-t pt-3 text-[11px] leading-relaxed">
        Scored from Apple’s public catalogue. Search rank also depends on the subtitle, keyword
        field, and install conversion, which Apple does not publish.
        {fetchedAt && ` Read ${fetchedAt.toISOString().slice(0, 10)}.`}
      </p>
    </section>
  )
}
