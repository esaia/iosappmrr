'use client'

import { useActionState, useEffect, useState } from 'react'
import { Loader2, LogIn, Search } from 'lucide-react'
import { AppIcon } from '@/components/app-icon'
import { Button, ButtonLink } from '@/components/ui/button'
import { createAppAction, lookupAppAction, type LookupState, type SubmitState } from './actions'

type Category = { slug: string; name: string; genre: string | null }
type Tech = { slug: string; name: string }

export function SubmitFlow({
  categories,
  tech,
  isSignedIn,
  initialApp,
}: {
  categories: Category[]
  tech: Tech[]
  isSignedIn: boolean
  initialApp?: LookupState['app'] | null
}) {
  const [lookup, runLookup, lookingUp] = useActionState<LookupState, FormData>(
    lookupAppAction,
    initialApp ? { app: initialApp } : {},
  )
  const [submit, runSubmit, submitting] = useActionState<SubmitState, FormData>(createAppAction, {})

  /*
   * Controlled, not defaultValue. React resets a form's uncontrolled fields
   * once its action resolves, so an unsigned-in submit — which comes back
   * asking for sign-in rather than navigating — would silently clear the
   * category the founder had picked.
   *
   * Declared above the lookup-step return so the hook order never changes.
   */
  const [categorySlug, setCategorySlug] = useState('')

  const suggestedSlug = lookup.app?.primaryGenre
    ? categories.find((category) => category.genre === lookup.app!.primaryGenre)?.slug
    : undefined

  // Apply the App Store genre suggestion once, when the lookup lands. Later
  // edits win, because this only fires while the field is still empty.
  useEffect(() => {
    if (suggestedSlug) setCategorySlug((current) => current || suggestedSlug)
  }, [suggestedSlug])

  if (!lookup.app) {
    return (
      <form action={runLookup} className="mt-8">
        <label htmlFor="appStoreUrl" className="text-fg text-sm font-medium">
          App Store link
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="appStoreUrl"
            name="appStoreUrl"
            required
            autoFocus
            placeholder="https://apps.apple.com/us/app/your-app/id123456789"
            className="border-border bg-surface text-fg placeholder:text-muted focus:border-border-strong min-w-0 flex-1 rounded-[10px] border px-4 py-2.5 text-sm focus:outline-none"
          />
          <Button type="submit" size="lg" disabled={lookingUp}>
            {lookingUp ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Find
          </Button>
        </div>

        {lookup.error && (
          <p role="alert" className="text-red mt-3 text-sm">
            {lookup.error}
          </p>
        )}

        <p className="text-muted mt-3 text-xs leading-relaxed">
          We read the public App Store listing for the icon, screenshots, rating, and version — so
          you only fill in what Apple doesn&apos;t already know.
        </p>
      </form>
    )
  }

  const app = lookup.app
  // Only categories that map to a real App Store genre can be suggested, and
  // the genre must be present — otherwise every untagged category matches null.
  const suggested = categories.find((category) => category.slug === suggestedSlug)

  return (
    <form action={runSubmit} className="mt-8 space-y-6">
      <input type="hidden" name="appStoreId" value={app.appStoreId} />

      <div className="border-border bg-surface flex items-center gap-4 rounded-[10px] border p-4">
        <AppIcon src={app.iconUrl} name={app.name} size={56} />
        <div className="min-w-0">
          <p className="text-fg truncate font-medium">{app.name}</p>
          <p className="text-muted truncate text-xs">
            {app.sellerName} · ID {app.appStoreId}
          </p>
        </div>
      </div>

      <Field
        label="Name"
        name="name"
        defaultValue={app.name}
        error={submit.fieldErrors?.name}
        required
      />

      <Field
        label="Tagline"
        name="tagline"
        defaultValue={app.tagline}
        maxLength={110}
        hint="One line, shown on every list. Say what the app does, not why it's great."
        error={submit.fieldErrors?.tagline}
      />

      <div>
        <label htmlFor="description" className="text-fg text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={app.description}
          maxLength={2000}
          className="border-border bg-surface text-fg placeholder:text-muted focus:border-border-strong mt-2 w-full rounded-[10px] border px-4 py-2.5 text-sm focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="categorySlug" className="text-fg text-sm font-medium">
          Category
        </label>
        <select
          id="categorySlug"
          name="categorySlug"
          required
          value={categorySlug}
          onChange={(event) => setCategorySlug(event.target.value)}
          className="border-border bg-surface text-fg focus:border-border-strong mt-2 w-full rounded-[10px] border px-4 py-2.5 text-sm focus:outline-none"
        >
          <option value="" disabled>
            Choose a category
          </option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        {suggested && (
          <p className="text-muted mt-1.5 text-xs">
            Suggested from the App Store genre &ldquo;{app.primaryGenre}&rdquo;.
          </p>
        )}
        {submit.fieldErrors?.categorySlug && (
          <p className="text-red mt-1.5 text-sm">{submit.fieldErrors.categorySlug}</p>
        )}
      </div>

      <Field
        label="Website"
        name="website"
        type="url"
        defaultValue={app.website ?? ''}
        hint="Optional."
        error={submit.fieldErrors?.website}
      />

      <fieldset>
        <legend className="text-fg text-sm font-medium">Built with</legend>
        <p className="text-muted mt-1 text-xs">
          Self-reported — unlike revenue, we can&apos;t check this.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tech.map((tag) => (
            <TechCheckbox key={tag.slug} slug={tag.slug} name={tag.name} />
          ))}
        </div>
      </fieldset>

      {/*
        Shown from the start when signed out, rather than after a submit that
        can only fail. Signing in first also means nothing typed here is lost
        on the round trip — only the App Store ID survives it.
      */}
      {!isSignedIn && (
        <div className="border-border bg-surface rounded-[10px] border p-4">
          <h2 className="text-fg flex items-center gap-2 text-[13px] font-bold">
            <LogIn className="size-4" />
            Sign in to save this listing
          </h2>
          <p className="text-muted mt-1.5 text-[12px] leading-relaxed">
            A listing belongs to a founder, so we need to know who you are before saving. Sign in
            now and your app comes straight back, ready to fill in.
          </p>
          <ButtonLink
            href={`/login?next=${encodeURIComponent(`/submit?id=${app.appStoreId}`)}`}
            className="mt-3"
          >
            Sign in and save
          </ButtonLink>
        </div>
      )}

      {submit.error && (
        <p role="alert" className="text-red text-sm">
          {submit.error}
        </p>
      )}

      {/*
        Once the draft is validated and only sign-in is missing, this button can
        do nothing but repeat itself. Hiding it leaves one obvious next step
        instead of two competing ones.
      */}
      {isSignedIn && (
        <div className="border-border flex items-center gap-3 border-t pt-6">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Continue to verification
          </Button>
          <p className="text-muted text-xs">Saved as a private draft until revenue verifies.</p>
        </div>
      )}
    </form>
  )
}

function Field({
  label,
  name,
  hint,
  error,
  ...props
}: {
  label: string
  name: string
  hint?: string
  error?: string
} & React.ComponentProps<'input'>) {
  return (
    <div>
      <label htmlFor={name} className="text-fg text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="border-border bg-surface text-fg placeholder:text-muted focus:border-border-strong mt-2 w-full rounded-[10px] border px-4 py-2.5 text-sm focus:outline-none"
        {...props}
      />
      {hint && !error && <p className="text-muted mt-1.5 text-xs">{hint}</p>}
      {error && <p className="text-red mt-1.5 text-sm">{error}</p>}
    </div>
  )
}

function TechCheckbox({ slug, name }: { slug: string; name: string }) {
  const [checked, setChecked] = useState(false)

  return (
    <label
      className={
        checked
          ? 'bg-blue-dim text-blue cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium'
          : 'border-border text-muted hover:border-border-strong hover:text-fg cursor-pointer rounded-md border px-2.5 py-1 text-xs'
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
