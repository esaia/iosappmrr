'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { dofollow } from '@/lib/dofollow'
import { formatMoney } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { deleteAppAction, updateAppAction, type DeleteState, type EditState } from './actions'

type Option = { slug: string; name: string }

const field =
  'border-border bg-surface-2 text-fg placeholder:text-dim focus:border-border-strong w-full rounded-[10px] border px-3 py-2 text-[13px] focus:outline-none'

export function EditForm({
  appId,
  appName,
  categories,
  tech,
  initial,
}: {
  appId: string
  appName: string
  categories: Option[]
  tech: Option[]
  initial: {
    name: string
    tagline: string
    description: string
    categorySlug: string
    website: string
    websiteDofollow: boolean
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

        <DofollowOffer defaultChecked={initial.websiteDofollow} />

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

      <DangerZone appId={appId} appName={appName} />
    </>
  )
}

/**
 * The paid link upgrade. There is no payment provider yet, so ticking this
 * grants the dofollow link outright — the checkout step slots in here later.
 */
function DofollowOffer({ defaultChecked }: { defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <label className="border-border hover:border-border-strong block cursor-pointer rounded-[10px] border border-dashed p-4 transition-colors">
      <span className="flex items-start gap-3">
        <input
          type="checkbox"
          name="websiteDofollow"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="border-border bg-surface-2 mt-0.5 size-4 shrink-0 rounded-full border accent-[var(--blue)]"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-fg text-[13px] font-medium">
              Dofollow link
              {dofollow.domainAuthority != null && (
                <span className="text-muted font-normal">
                  {' '}
                  · Domain Authority {dofollow.domainAuthority}
                </span>
              )}
            </span>
            <span className="text-fg text-[13px] font-medium">
              {formatMoney(dofollow.priceCents)}
            </span>
          </span>
          <span className="text-muted mt-1.5 block text-[12px] leading-relaxed">
            {dofollow.blurb}
          </span>
          <span className="text-dim mt-2 block text-[11px]">
            Not charged yet — payment is not wired up.
          </span>
        </span>
      </span>
    </label>
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
