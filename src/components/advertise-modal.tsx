'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Eye, Star, Users, X, Zap } from 'lucide-react'
import Link from 'next/link'
import { advertising, ROTATE_MS, type Testimonial } from '@/lib/ads'
import { formatCount, formatMoney } from '@/lib/utils'

/**
 * Wraps a trigger and shows the advertising details in a dialog.
 *
 * The trigger is passed in so the same modal can open from a rail placeholder,
 * a footer link, or anywhere else, without each caller repeating the content.
 */
export function AdvertiseModal({
  children,
  contactEmail,
  siteName,
  spotsLeft,
  totalSpots,
}: {
  children: React.ReactNode
  contactEmail: string
  siteName: string
  /** Counted from live sponsor purchases by the server, not from a constant. */
  spotsLeft: number
  /** Inventory size, set by an admin. Passed in because it lives in the database. */
  totalSpots: number
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    // Stop the page scrolling behind the dialog.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open])

  const remaining = spotsLeft
  const price = advertising.monthlyPriceCents
  const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent(`Advertising on ${siteName}`)}`

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        {children}
      </button>

      {open &&
        mounted &&
        // Portalled to the body: the ad rail is transformed, and a transformed
        // ancestor becomes the containing block for fixed children, which would
        // otherwise trap this dialog inside a 160px column.
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:p-8"
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpen(false)
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="advertise-title"
              className="glass border-border relative my-auto w-full max-w-xl rounded-[14px] border p-6 sm:p-8"
            >
              <button
                ref={closeRef}
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-muted hover:text-fg absolute top-5 right-5 transition-colors"
              >
                <X className="size-5" />
              </button>

              <h2 id="advertise-title" className="display pr-8 text-2xl font-semibold">
                Advertise on {siteName}
              </h2>
              <p className="text-muted mt-2 text-[13px] leading-relaxed">
                Reach founders who are reading verified revenue, not browsing.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {advertising.monthlyVisitors != null && (
                  <StatCard
                    icon={<Users className="size-4" />}
                    value={formatCount(advertising.monthlyVisitors)}
                    label="Monthly visitors"
                  />
                )}
                <StatCard
                  icon={<Eye className="size-4" />}
                  value="High-intent"
                  label="Founders, not browsers"
                />
                <StatCard
                  icon={<Zap className="text-gold size-4" />}
                  value={`${remaining}/${totalSpots}`}
                  label={remaining === 1 ? 'Spot left' : 'Spots left'}
                  highlight
                />
              </div>

              <h3 className="mt-7 text-sm font-semibold">How it works</h3>
              <p className="text-muted mt-2 text-[13px] leading-relaxed">
                Your product appears in the sponsor rails beside the index. There are {totalSpots}{' '}
                spots and two rails, so sponsors rotate every {Math.round(ROTATE_MS / 1000)} seconds
                — everyone gets an equal share of the margin, and no one is buried.
              </p>

              <div className="border-border bg-surface-2 rounded-card mt-5 border p-4">
                <p className="text-sm font-semibold">Pricing</p>
                {price != null ? (
                  <>
                    <p className="text-muted mt-2 text-[13px]">
                      <span className="text-fg font-medium">Monthly rate:</span>{' '}
                      {formatMoney(price)}
                      /month
                    </p>
                    <p className="text-muted mt-1 text-[13px]">
                      {remaining === 0
                        ? 'Currently sold out — get in touch to join the waiting list.'
                        : `${remaining} ${remaining === 1 ? 'spot' : 'spots'} available now. Cancel anytime.`}
                    </p>
                  </>
                ) : (
                  <p className="text-muted mt-2 text-[13px] leading-relaxed">
                    Rates depend on the slot and the month. Get in touch and we will send current
                    availability and traffic figures.
                  </p>
                )}
              </div>

              {remaining === 0 ? (
                <>
                  <button
                    type="button"
                    disabled
                    className="bg-fg text-bg rounded-card mt-5 flex w-full cursor-not-allowed items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium opacity-50"
                  >
                    Sold out
                  </button>
                  <p className="text-dim mt-2 text-center text-[11px]">
                    <a href={mailto} className="text-muted hover:text-fg underline">
                      Email to join the waiting list
                    </a>
                  </p>
                </>
              ) : (
                /*
                 * A slot is bought against a listing, so checkout starts from
                 * the dashboard where the founder picks which app is sponsoring.
                 * Sending them straight to Polar from here would leave the
                 * webhook with no app to attach the purchase to.
                 */
                <>
                  <Link
                    href="/dashboard"
                    className="bg-fg text-bg rounded-card mt-5 flex w-full items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium transition-opacity hover:opacity-90"
                  >
                    {price != null ? `Get started (${formatMoney(price)}/mo)` : 'Get started'}
                    <ExternalLink className="size-3.5" />
                  </Link>
                  <p className="text-dim mt-2 text-center text-[11px]">
                    Pick the app that sponsors, then pay — or{' '}
                    <a href={mailto} className="text-muted hover:text-fg underline">
                      email us
                    </a>
                  </p>
                </>
              )}

              {advertising.testimonials.length > 0 && (
                <div className="border-border mt-7 border-t pt-6">
                  <h3 className="text-sm font-semibold">What sponsors say</h3>
                  <div className="mt-4 space-y-5">
                    {advertising.testimonials.map((item) => (
                      <Quote key={item.name} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function StatCard({
  icon,
  value,
  label,
  highlight,
}: {
  icon: React.ReactNode
  value: string
  label: string
  highlight?: boolean
}) {
  return (
    <div
      className={
        highlight
          ? 'bg-gold-dim border-gold/40 rounded-card border p-4 text-center'
          : 'border-border bg-surface-2 rounded-card border p-4 text-center'
      }
    >
      <div
        className={highlight ? 'text-gold flex justify-center' : 'text-muted flex justify-center'}
      >
        {icon}
      </div>
      <p
        className={
          highlight ? 'text-gold mt-2 text-lg font-semibold' : 'text-fg mt-2 text-lg font-semibold'
        }
      >
        {value}
      </p>
      <p className="text-muted mt-0.5 text-[11px] leading-tight">{label}</p>
    </div>
  )
}

function Quote({ item }: { item: Testimonial }) {
  return (
    <figure className="flex gap-3">
      {item.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.avatarUrl} alt="" className="size-8 shrink-0 rounded-full" />
      ) : (
        <span className="bg-surface-3 text-fg flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
          {item.name.slice(0, 1)}
        </span>
      )}
      <div className="min-w-0">
        <figcaption className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="text-fg font-medium">{item.name}</span>
          <span className="text-dim">·</span>
          <span className="text-muted">{item.company}</span>
          <span className="text-gold flex">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className="fill-gold size-3" />
            ))}
          </span>
        </figcaption>
        <blockquote className="text-muted mt-1 text-[13px] leading-relaxed">
          “{item.quote}”
        </blockquote>
      </div>
    </figure>
  )
}
