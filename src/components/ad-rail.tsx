'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AdvertiseModal } from '@/components/advertise-modal'
import { adsForSide, ROTATE_MS, type Ad } from '@/lib/ads'
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
 */
export function AdRail({ side }: { side: 'left' | 'right' }) {
  const slots = adsForSide(side)
  const [index, setIndex] = useState(0)
  const [atFooter, setAtFooter] = useState(false)

  useEffect(() => {
    if (slots.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % slots.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [slots.length])

  /*
   * Fixed elements ignore document flow, so at the bottom of the page a rail
   * would sit on top of the footer. Fade it out once the footer appears rather
   * than letting an ad overlap the site's own links.
   */
  useEffect(() => {
    const footer = document.querySelector('footer')
    if (!footer) return
    const observer = new IntersectionObserver(([entry]) => setAtFooter(entry.isIntersecting), {
      rootMargin: '0px 0px -80px 0px',
    })
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  const ad = slots[index % slots.length]

  return (
    <aside
      aria-label={`Sponsor, ${side} margin`}
      // Hidden from assistive tech too when faded out, so it is not read as
      // content that happens to be invisible.
      aria-hidden={atFooter}
      className={[
        'fixed top-1/2 z-10 hidden w-[160px] -translate-y-1/2 transition-opacity duration-200 [@media(min-width:1600px)]:block',
        side === 'left' ? 'left-6' : 'right-6',
        atFooter ? 'pointer-events-none opacity-0' : 'opacity-100',
      ].join(' ')}
    >
      {ad ? <Slot ad={ad} /> : <EmptySlot />}

      {slots.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {slots.map((slot, i) => (
            <span
              key={slot.name}
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

function Slot({ ad }: { ad: Ad }) {
  return (
    <a
      href={ad.href}
      target="_blank"
      // `sponsored` tells search engines this link is paid for. Omitting it on a
      // paid link is exactly what a manual penalty is for.
      rel="sponsored noopener noreferrer"
      className="border-border bg-surface hover:border-border-strong block overflow-hidden rounded-[10px] border transition-colors"
    >
      <Image
        src={ad.imageUrl}
        alt={ad.name}
        width={160}
        height={480}
        className="h-auto w-full"
        unoptimized={ad.imageUrl.startsWith('http')}
      />
      <div className="p-3">
        <p className="text-fg text-[12px] font-medium">{ad.name}</p>
        {ad.blurb && <p className="text-muted mt-0.5 text-[11px] leading-relaxed">{ad.blurb}</p>}
        <p className="text-dim mt-2 text-[9px] font-bold tracking-wider uppercase">Sponsored</p>
      </div>
    </a>
  )
}

function EmptySlot() {
  return (
    <AdvertiseModal contactEmail={site.contactEmail} siteName={site.name}>
      <span className="border-border text-muted hover:border-border-strong hover:text-fg flex h-[420px] flex-col items-center justify-center rounded-[10px] border border-dashed p-4 text-center transition-colors">
        <span className="text-[13px] font-medium">Advertise here</span>
        <span className="text-dim mt-1.5 text-[11px] leading-relaxed">
          Reach founders reading verified revenue
        </span>
      </span>
    </AdvertiseModal>
  )
}
