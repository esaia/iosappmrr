import type { Metadata } from 'next'
import Link from 'next/link'
import { getSlotInventory } from '@/lib/data/purchases'
import { SETTING_LIMITS } from '@/lib/settings'
import { advertising, ROTATE_MS } from '@/lib/ads'
import { dofollow } from '@/lib/dofollow'
import { formatMoney } from '@/lib/utils'
import { SlotsForm } from './slots-form'

export const metadata: Metadata = { title: 'Settings' }

export default async function AdminSettingsPage() {
  const { slots, booked } = await getSlotInventory()
  const { min, max } = SETTING_LIMITS.sponsor_slots

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <h2 className="text-fg text-sm font-semibold">Sponsor slots</h2>
        <p className="text-muted mt-2 text-[13px] leading-relaxed">
          How many rail spots exist to sell. {booked} of {slots} are in use right now. Raising this
          puts the extra spots on sale immediately; lowering it below {booked} does not evict anyone
          — it stops new checkouts and lets the count fall back as slots lapse.
        </p>
        <p className="text-muted mt-2 text-[13px] leading-relaxed">
          To turn an individual app&rsquo;s slot on or off, use{' '}
          <Link href="/admin/apps" className="text-blue hover:underline">
            Apps
          </Link>
          .
        </p>

        <SlotsForm current={slots} min={min} max={max} />
      </section>

      <section>
        <h2 className="text-fg text-sm font-semibold">Set in code, not here</h2>
        <p className="text-muted mt-2 text-[13px] leading-relaxed">
          These describe what is being sold rather than how much of it, so they stay in the
          repository where a change is reviewed before it goes live. The prices are display-only —
          the amount actually charged is whatever the Polar product is set to, and the two have to
          be kept in step by hand.
        </p>

        <dl className="border-border bg-surface mt-3 divide-y divide-[var(--color-border)] rounded-[10px] border text-[13px]">
          <Row
            term="Sponsor price"
            value={
              advertising.monthlyPriceCents != null
                ? `${formatMoney(advertising.monthlyPriceCents)}/mo`
                : 'not set'
            }
            file="src/lib/ads.ts"
          />
          <Row
            term="Rail rotation"
            value={`${Math.round(ROTATE_MS / 1000)}s`}
            file="src/lib/ads.ts"
          />
          <Row
            term="Dofollow price"
            value={formatMoney(dofollow.priceCents)}
            file="src/lib/dofollow.ts"
          />
          <Row
            term="Domain authority claim"
            value={dofollow.domainAuthority != null ? String(dofollow.domainAuthority) : 'hidden'}
            file="src/lib/dofollow.ts"
          />
          <Row
            term="Monthly visitors claim"
            value={
              advertising.monthlyVisitors != null ? String(advertising.monthlyVisitors) : 'hidden'
            }
            file="src/lib/ads.ts"
          />
        </dl>
      </section>
    </div>
  )
}

function Row({ term, value, file }: { term: string; value: string; file: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 p-3">
      <dt className="text-muted">{term}</dt>
      <dd className="text-fg flex items-baseline gap-2">
        <span className="font-medium">{value}</span>
        <code className="text-dim text-[11px]">{file}</code>
      </dd>
    </div>
  )
}
