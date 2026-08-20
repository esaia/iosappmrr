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
/**
 * The three verdicts, as an answer to the question in the heading.
 *
 * "Can I vibecode it?" is addressed to the reader, so the colours answer them:
 * green go ahead, amber partly, red don't bother. That ramp was previously gold
 * for yes, blue for kinda and green for not-really — three distinct colours, but
 * not a scale, and blue in the middle left the order meaningless.
 *
 * Answering the reader rather than grading the app also puts red where it does
 * the least harm. Read as a grade, red would land on the app anyone can copy —
 * a verdict on a founder who published verified revenue voluntarily, which is
 * the thing this section is written to avoid. Read as an answer, red lands on
 * the app with the strongest moat and says only that the reader should not
 * bother trying.
 */
const tone: Record<Verdict, { chip: string; dot: string; tick: string }> = {
  yes: {
    chip: 'border-green/40 bg-green/10 text-green',
    dot: 'bg-green',
    tick: 'text-green',
  },
  kinda: {
    chip: 'border-gold/40 bg-gold/10 text-gold',
    dot: 'bg-gold',
    tick: 'text-gold',
  },
  not_really: {
    chip: 'border-red/40 bg-red/10 text-red',
    dot: 'bg-red',
    tick: 'text-red',
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

      <div className="border-border bg-surface rounded-card mt-3 border p-5 sm:p-6">
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
          {/*
            The ticks take the verdict's colour; the locks stay neutral.

            Both icons used to be painted from fixed colours — every tick gold,
            every lock green, on all three verdicts — so two cards with opposite
            verdicts were the same card with a different chip on it, and the one
            element carrying the answer was the smallest thing in the panel.

            Only one of the two columns moves. Colouring both would put the
            verdict's colour on the argument against it as well as the argument
            for it, which says nothing; and the locks are the same claim on every
            card — this is the part you cannot copy — so they read better as a
            constant the eye can skip to.
          */}
          <Column
            title="Straightforward to rebuild"
            items={rebuildable}
            icon={<Check className={`mt-0.5 size-3.5 shrink-0 ${style.tick}`} />}
          />
          <Column
            title="Harder to copy"
            items={moat}
            icon={<Lock className="text-dim mt-0.5 size-3.5 shrink-0" />}
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
