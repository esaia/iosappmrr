'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AdvertiseModal } from '@/components/advertise-modal'
import { forSide, ROTATE_MS } from '@/lib/ads'
import type { Sponsor } from '@/lib/data/purchases'
import { site } from '@/lib/site'

/**
 * A sponsor slot in the page margin.
 *
 * Fixed to the viewport and centred vertically, so it stays put while the index
 * scrolls. It appears only above 1600px, where there is genuinely empty margin
 * either side of the 1152px content column — below that the content keeps the
 * full width rather than being squeezed for an ad.
 *
 * More sponsors are sold than there are rails, so each rail cycles through its
 * share of them. Left and right draw from different halves of the list, so the
 * same sponsor is never on screen twice.
 *
 * Sponsors are passed in from the server rather than fetched here: they come
 * from the `purchases` table, and the rail is a client component only because
 * of the rotation timer.
 */
export function AdRail({
  side,
  sponsors,
  spotsLeft,
  totalSpots,
}: {
  side: 'left' | 'right'
  sponsors: Sponsor[]
  spotsLeft: number
  totalSpots: number
}) {
  const slots = forSide(sponsors, side)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slots.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % slots.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [slots.length])

  const sponsor = slots[index % slots.length]

  return (
    <aside
      aria-label={`Sponsor, ${side} margin`}
      /*
       * Stays visible for the whole scroll, including over the footer. A
       * sponsor is paying for the slot by the month, so hiding it for the part
       * of the page people reach last is selling less than was bought. The
       * footer's own rule is drawn on the content column rather than the full
       * viewport, so the two no longer collide.
       */
      className={[
        'fixed top-1/2 z-10 hidden w-[160px] -translate-y-1/2 [@media(min-width:1600px)]:block',
        side === 'left' ? 'left-6' : 'right-6',
      ].join(' ')}
    >
      {sponsor ? (
        <Slot sponsor={sponsor} />
      ) : (
        <EmptySlot spotsLeft={spotsLeft} totalSpots={totalSpots} />
      )}

      {slots.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {slots.map((slot, i) => (
            <span
              key={slot.appId}
              className={
                i === index % slots.length
                  ? 'bg-fg h-1 w-1 rounded-full'
                  : 'bg-surface-3 h-1 w-1 rounded-full'
              }
            />
          ))}
        </div>
      )}
    </aside>
  )
}

/*
 * Both slot states share a floor so a filled left rail and an empty right one
 * sit at the same height. A floor rather than a fixed height: a two-line app
 * name should push the card down, not be clipped by it.
 */
const SLOT_MIN_HEIGHT = 'min-h-[148px]'

/**
 * The creative is the sponsor's own listing — icon and name — rather than an
 * uploaded banner. Nothing here is artwork the site has not already indexed
 * from the App Store, so there is no upload step and nothing to moderate.
 *
 * Built from the same parts as the directory's own `AppCard`: 34px icon, bold
 * 13px name, hairline divider, corner ribbon. A sponsor slot showing a real
 * listing should look like a listing, not like an ad slotted beside one.
 *
 * The ribbon is gold where `AppCard`'s is blue, and the difference carries the
 * meaning: blue says the site verified this app's revenue, gold says the
 * founder paid for the placement. Two different claims should never wear the
 * same colour.
 *
 * No tagline. At 160px a description costs four lines to say what the icon and
 * name already said, and the slot is competing with the page for attention it
 * has not earned.
 */
function Slot({ sponsor }: { sponsor: Sponsor }) {
  // Sponsors pay for traffic to their own site. Without one, the click still
  // has somewhere useful to go.
  const href = sponsor.website ?? `/apps/${sponsor.slug}`
  const external = Boolean(sponsor.website)

  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      // `sponsored` tells search engines this link is paid for. Omitting it on a
      // paid link is exactly what a manual penalty is for.
      rel={external ? 'sponsored noopener noreferrer' : 'sponsored'}
      className={`group border-border bg-surface hover:border-border-strong hover:bg-surface-2 relative flex ${SLOT_MIN_HEIGHT} flex-col justify-between overflow-hidden rounded-[10px] border p-3.5 transition-colors`}
    >
      {/*
        A corner ribbon rather than a line of body text: the disclosure is
        still the first thing read, but it costs no vertical space in a slot
        that had far too much of it.
      */}
      <span className="bg-gold-dim text-gold absolute top-0 right-0 rounded-tr-[9px] rounded-bl-[10px] px-2 py-1 text-[9px] font-bold tracking-wider uppercase">
        Sponsored
      </span>

      <div>
        {sponsor.iconUrl && (
          <Image
            src={sponsor.iconUrl}
            alt=""
            width={120}
            height={120}
            className="border-border size-10 rounded-[9px] border"
            unoptimized
          />
        )}
        <p className="text-fg mt-2.5 line-clamp-2 text-[13px] leading-snug font-bold">
          {sponsor.name}
        </p>
      </div>

      <span className="border-border text-muted group-hover:text-fg mt-3 flex items-center gap-1 border-t pt-2.5 text-[11px] transition-colors">
        {external ? 'Visit site' : 'View profile'}
        <span aria-hidden className="transition-transform motion-safe:group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </a>
  )
}

function EmptySlot({ spotsLeft, totalSpots }: { spotsLeft: number; totalSpots: number }) {
  return (
    <AdvertiseModal
      contactEmail={site.contactEmail}
      siteName={site.name}
      spotsLeft={spotsLeft}
      totalSpots={totalSpots}
    >
      <span
        className={`border-border text-muted hover:border-border-strong hover:text-fg flex ${SLOT_MIN_HEIGHT} flex-col items-center justify-center rounded-[10px] border border-dashed p-4 text-center transition-colors`}
      >
        <span className="text-[13px] font-medium">Advertise here</span>
        <span className="text-dim mt-1.5 text-[11px] leading-relaxed">
          Reach founders reading verified revenue
        </span>
      </span>
    </AdvertiseModal>
  )
}
