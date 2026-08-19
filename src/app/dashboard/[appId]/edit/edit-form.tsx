'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { dofollow } from '@/lib/dofollow'
import { advertising } from '@/lib/ads'
import { formatMoney } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { VisibilitySwitch } from '@/components/visibility-switch'
import {
  startDofollowCheckout,
  startSponsorCheckout,
  type CheckoutState,
} from '@/app/checkout/actions'
import { deleteAppAction, updateAppAction, type DeleteState, type EditState } from './actions'

type Option = { slug: string; name: string }
type LivePurchase = { id: string; kind: 'dofollow' | 'sponsor'; hidden: boolean }

const field =
  'border-border bg-surface-2 text-fg placeholder:text-dim focus:border-border-strong w-full rounded-[10px] border px-3 py-2 text-[13px] focus:outline-none'

export function EditForm({
  appId,
  appName,
  categories,
  tech,
  initial,
  offers,
}: {
  appId: string
  appName: string
  categories: Option[]
  tech: Option[]
  /** What can be sold right now, decided on the server from the Polar config. */
  offers: {
    dofollowAvailable: boolean
    sponsorAvailable: boolean
    sponsorActive: boolean
    spotsLeft: number
    totalSpots: number
    /** The live rows, so an active card can offer to switch itself off. */
    sponsorPurchase: LivePurchase | null
    dofollowPurchase: LivePurchase | null
  }
  initial: {
    name: string
    tagline: string
    description: string
    categorySlug: string
    website: string
    tech: string[]
  }
}) {
  const [state, action] = useActionState<EditState, FormData>(updateAppAction, {})
  // Controlled, because React resets uncontrolled fields once an action resolves.
  const [categorySlug, setCategorySlug] = useState(initial.categorySlug)

  return (
    <>
      <form action={action} className="mt-8 space-y-5">
        <input type="hidden" name="appId" value={appId} />

        <Field label="Name" error={state.fieldErrors?.name}>
          <input
            name="name"
            defaultValue={initial.name}
            maxLength={80}
            required
            className={field}
          />
        </Field>

        <Field label="Tagline" hint="One line, shown on cards." error={state.fieldErrors?.tagline}>
          <input name="tagline" defaultValue={initial.tagline} maxLength={110} className={field} />
        </Field>

        <Field label="Description" error={state.fieldErrors?.description}>
          <textarea
            name="description"
            defaultValue={initial.description}
            rows={5}
            maxLength={2000}
            className={field}
          />
        </Field>

        <Field label="Category" error={state.fieldErrors?.categorySlug}>
          <select
            name="categorySlug"
            value={categorySlug}
            onChange={(event) => setCategorySlug(event.target.value)}
            className={field}
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Website" hint="Optional." error={state.fieldErrors?.website}>
          <input name="website" type="url" defaultValue={initial.website} className={field} />
        </Field>

        <fieldset>
          <legend className="label">Built with</legend>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tech.map((tag) => (
              <TechChip
                key={tag.slug}
                slug={tag.slug}
                name={tag.name}
                defaultChecked={initial.tech.includes(tag.slug)}
              />
            ))}
          </div>
        </fieldset>

        {state.error && (
          <p role="alert" className="text-red text-[13px]">
            {state.error}
          </p>
        )}
        {state.saved && <p className="text-green text-[13px]">Saved.</p>}

        <Save />
      </form>

      <section className="mt-8 space-y-3">
        <h2 className="label">Paid upgrades</h2>
        <DofollowOffer
          appId={appId}
          active={Boolean(offers.dofollowPurchase)}
          available={offers.dofollowAvailable}
        />
        <SponsorOffer
          appId={appId}
          active={offers.sponsorActive}
          purchase={offers.sponsorPurchase}
          available={offers.sponsorAvailable}
          spotsLeft={offers.spotsLeft}
          totalSpots={offers.totalSpots}
        />
      </section>

      <DangerZone appId={appId} appName={appName} />
    </>
  )
}

/**
 * The paid link upgrade.
 *
 * A button that opens Polar, not a checkbox. The flag it grants is written by
 * the webhook once the order is paid, so there is nothing here for the founder
 * to tick — and nothing the form could set for free.
 */
function DofollowOffer({
  appId,
  active,
  available,
}: {
  appId: string
  active: boolean
  available: boolean
}) {
  const [state, action] = useActionState<CheckoutState, FormData>(startDofollowCheckout, {})

  return (
    <Offer
      title="Dofollow link"
      meta={
        dofollow.domainAuthority != null ? `Domain Authority ${dofollow.domainAuthority}` : null
      }
      price={formatMoney(dofollow.priceCents)}
      blurb={dofollow.blurb}
      active={active}
      activeLabel="Active — your website link is dofollow."
      // No switch on a one-time purchase — see the note on VisibilitySwitch.
      purchase={null}
      manageLabel="View in billing"
      available={available}
      appId={appId}
      action={action}
      error={state.error}
      cta="Buy"
    />
  )
}

/**
 * A sponsor slot in the side rails, billed monthly.
 *
 * The creative is this app's own listing, so buying a slot needs nothing from
 * the founder beyond the payment — no banner to upload or approve.
 */
function SponsorOffer({
  appId,
  active,
  purchase,
  available,
  spotsLeft,
  totalSpots,
}: {
  appId: string
  active: boolean
  purchase: LivePurchase | null
  available: boolean
  spotsLeft: number
  totalSpots: number
}) {
  const [state, action] = useActionState<CheckoutState, FormData>(startSponsorCheckout, {})
  const price = advertising.monthlyPriceCents

  return (
    <Offer
      title="Sponsor a rail"
      meta={spotsLeft > 0 ? `${spotsLeft} of ${totalSpots} spots left` : 'Sold out'}
      price={price != null ? `${formatMoney(price)}/mo` : null}
      blurb="Your icon, name, and tagline rotate through the sponsor rails beside the index. Cancel anytime."
      active={active}
      activeLabel={
        purchase?.hidden
          ? 'Active — switched off, so the rails skip this app.'
          : 'Active — this app is sponsoring the rails.'
      }
      purchase={purchase}
      manageLabel="Manage subscription"
      available={available && spotsLeft > 0}
      appId={appId}
      action={action}
      error={state.error}
      cta="Sponsor"
    />
  )
}

/** Shared chrome for the two paid products, so they cannot drift apart. */
function Offer({
  title,
  meta,
  price,
  blurb,
  active,
  activeLabel,
  purchase,
  manageLabel,
  available,
  appId,
  action,
  error,
  cta,
}: {
  title: string
  meta: string | null
  price: string | null
  blurb: string
  active: boolean
  activeLabel: string
  /**
   * The live sponsor row, when there is one. Present only for products whose
   * card offers the rails switch, which is why the dofollow card passes null
   * even while it is active.
   */
  purchase: LivePurchase | null
  /** What the link into the billing tab offers while this is live. */
  manageLabel: string
  available: boolean
  appId: string
  action: (formData: FormData) => void
  error?: string
  cta: string
}) {
  return (
    <div className="border-border rounded-[10px] border border-dashed p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-fg text-[13px] font-medium">
          {title}
          {meta && <span className="text-muted font-normal"> · {meta}</span>}
        </span>
        {price && <span className="text-fg text-[13px] font-medium">{price}</span>}
      </div>

      <p className="text-muted mt-1.5 text-[12px] leading-relaxed">{blurb}</p>

      {active ? (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className={purchase?.hidden ? 'text-muted text-[12px]' : 'text-green text-[12px]'}>
              {activeLabel}
            </p>
            {/*
            Cancelling, resuming, and the receipt all live on the billing tab,
            which a founder looking at this card has no reason to know about.
            The card that sold it is where they will come back to change it.
          */}
            <Link href="/account" className="text-blue text-[12px] hover:underline">
              {manageLabel} →
            </Link>
          </div>

          {/*
            Offered here as well as on the billing tab: this is the app's own
            settings screen, and switching an upgrade off is a decision about
            the app rather than about the payment behind it.
          */}
          {purchase && (
            <VisibilitySwitch
              purchaseId={purchase.id}
              hidden={purchase.hidden}
              className="mt-2.5"
            />
          )}
        </>
      ) : available ? (
        <form action={action} className="mt-3">
          <input type="hidden" name="appId" value={appId} />
          <CheckoutButton label={cta} />
        </form>
      ) : (
        /*
         * No Polar product configured, or nothing left to sell. Saying so is
         * better than a button that fails once clicked.
         */
        <p className="text-dim mt-3 text-[11px]">Not available right now.</p>
      )}

      {error && (
        <p role="alert" className="text-red mt-2 text-[12px]">
          {error}
        </p>
      )}
    </div>
  )
}

function CheckoutButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Opening checkout…' : label}
    </Button>
  )
}

function Save() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  )
}

function DangerZone({ appId, appName }: { appId: string; appName: string }) {
  const [state, action] = useActionState<DeleteState, FormData>(deleteAppAction, {})
  const [open, setOpen] = useState(false)

  return (
    <section className="border-red/30 mt-12 rounded-[10px] border p-5">
      <h2 className="text-red flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="size-4" />
        Delete this app
      </h2>
      <p className="text-muted mt-2 text-[13px] leading-relaxed">
        Removes the listing, its revenue history, and any connected provider. This cannot be undone,
        and the App Store link becomes available for anyone to claim again.
      </p>

      {open ? (
        <form action={action} className="mt-4 space-y-3">
          <input type="hidden" name="appId" value={appId} />
          <label className="block">
            <span className="text-muted text-[12px]">
              Type <span className="text-fg font-medium">{appName}</span> to confirm
            </span>
            <input name="confirmName" autoComplete="off" className={`${field} mt-1.5`} />
          </label>

          {state.error && (
            <p role="alert" className="text-red text-[13px]">
              {state.error}
            </p>
          )}

          <div className="flex gap-2">
            <DeleteButton />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted hover:text-fg px-3 py-2 text-[13px]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-red/40 text-red hover:bg-red-dim mt-4 rounded-[10px] border px-3 py-2 text-[13px] transition-colors"
        >
          Delete app
        </button>
      )}
    </section>
  )
}

function DeleteButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-red text-bg rounded-[10px] px-3 py-2 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? 'Deleting…' : 'Delete permanently'}
    </button>
  )
}

function TechChip({
  slug,
  name,
  defaultChecked,
}: {
  slug: string
  name: string
  defaultChecked: boolean
}) {
  const [checked, setChecked] = useState(defaultChecked)
  return (
    <label
      className={
        checked
          ? 'bg-blue-dim text-blue cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px]'
          : 'border-border text-muted hover:border-border-strong hover:text-fg cursor-pointer rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors'
      }
    >
      <input
        type="checkbox"
        name="tech"
        value={slug}
        checked={checked}
        onChange={(event) => setChecked(event.target.checked)}
        className="sr-only"
      />
      {name}
    </label>
  )
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {hint && <span className="text-dim mt-1 block text-[11px]">{hint}</span>}
      <span className="mt-2 block">{children}</span>
      {error && <span className="text-red mt-1.5 block text-[13px]">{error}</span>}
    </label>
  )
}
