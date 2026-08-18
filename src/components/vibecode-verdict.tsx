import { Check, Lock } from 'lucide-react'
import { verdictBlurb, verdictLabel, type Verdict } from '@/lib/vibecode'

/**
 * "Can I vibecode it?" — the rebuild-difficulty read on an app.
 *
 * Deliberately framed around difficulty rather than replacement. Every founder
 * here published verified revenue voluntarily, and a section telling readers
 * their product is disposable would make that openness costly. The two columns
 * carry the actual argument: what is easy to copy, and what is not.
 *
 * The model attribution is not fine print. A reader should be able to tell at a
 * glance that a language model wrote this and that nobody measured anything.
 */
const tone: Record<Verdict, { chip: string; dot: string }> = {
  yes: {
    chip: 'border-gold/40 bg-gold/10 text-gold',
    dot: 'bg-gold',
  },
  kinda: {
    chip: 'border-blue/40 bg-blue/10 text-blue',
    dot: 'bg-blue',
  },
  not_really: {
    chip: 'border-green/40 bg-green/10 text-green',
    dot: 'bg-green',
  },
}

export function VibecodeVerdict({
  verdict,
  headline,
  reasoning,
  rebuildable,
  moat,
  model,
}: {
  verdict: Verdict
  headline: string
  reasoning: string
  rebuildable: string[]
  moat: string[]
  model: string
}) {
  const style = tone[verdict]

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="display text-xl font-semibold">Can I vibecode it?</h2>
        <span className="text-dim text-[11px]">Rebuild difficulty</span>
      </div>

      <div className="border-border bg-surface mt-3 rounded-[10px] border p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-semibold ${style.chip}`}
          >
            <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden />
            {verdictLabel[verdict]}
          </span>
          <span className="text-muted text-[12px]">{verdictBlurb[verdict]}</span>
        </div>

        <p className="text-fg mt-4 text-[15px] leading-relaxed font-medium">{headline}</p>
        <p className="text-muted mt-2 text-[13px] leading-relaxed">{reasoning}</p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Column
            title="Straightforward to rebuild"
            items={rebuildable}
            icon={<Check className="text-gold mt-0.5 size-3.5 shrink-0" />}
          />
          <Column
            title="Harder to copy"
            items={moat}
            icon={<Lock className="text-green mt-0.5 size-3.5 shrink-0" />}
          />
        </div>

        <p className="border-border text-dim mt-5 border-t pt-3 text-[11px] leading-relaxed">
          Written by {model}, not measured. It reads the App Store listing, not the code, and it is
          not told what this app earns. Treat it as one engineer&rsquo;s opinion, formed in a few
          seconds.
        </p>
      </div>
    </section>
  )
}

function Column({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  if (items.length === 0) return null

  return (
    <div>
      <h3 className="text-dim text-[10px] font-bold tracking-[0.12em] uppercase">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-muted flex gap-2 text-[13px] leading-relaxed">
            {icon}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
