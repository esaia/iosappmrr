'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, LogIn, Search } from 'lucide-react'
import { AppIcon } from '@/components/app-icon'
import { Button, ButtonLink } from '@/components/ui/button'
import { useCheckedSync } from '@/components/ui/checked-sync'
import { lookupAppAction, submitAppAction, type LookupState, type SubmitState } from './actions'

type Category = { slug: string; name: string; genre: string | null }
type Tech = { slug: string; name: string }
type Field = {
  name: string
  label: string
  type?: string
  placeholder?: string
  multiline?: boolean
}
type Provider = { id: string; name: string; instructions: string; docsUrl: string; fields: Field[] }

const input =
  'border-border bg-surface text-fg placeholder:text-muted focus:border-accent/60 focus:ring-accent/25 focus:ring-4 w-full rounded-card border px-4 py-2.5 text-sm focus:outline-none'

export function SubmitFlow({
  categories,
  tech,
  providers,
  dofollowOffer,
  isSignedIn,
  initialApp,
}: {
  categories: Category[]
  tech: Tech[]
  providers: Provider[]
  /** Null when Polar has no dofollow product configured — then it is not for sale. */
  dofollowOffer: { price: string; blurb: string; domainAuthority: number | null } | null
  isSignedIn: boolean
  initialApp?: LookupState['app'] | null
}) {
  const [lookup, runLookup, lookingUp] = useActionState<LookupState, FormData>(
    lookupAppAction,
    initialApp ? { app: initialApp } : {},
  )
  const [submit, runSubmit, submitting] = useActionState<SubmitState, FormData>(submitAppAction, {})

  /*
   * Controlled, not defaultValue. React resets a form's uncontrolled fields
   * once its action resolves, and this form resolves in place whenever a key
   * fails to verify — uncontrolled state would empty the category and the
   * upgrade the founder had already chosen, on the one submit that hands the
   * form back.
   *
   * Declared above the lookup-step return so the hook order never changes.
   */
  const [categorySlug, setCategorySlug] = useState('')
  const [provider, setProvider] = useState(providers[0]?.id ?? '')
  const [dofollow, setDofollow] = useState(false)
  const [anonymous, setAnonymous] = useState(false)

  /*
   * This form hands itself back whenever a key fails to verify, and React
   * resets it on the way through. Controlled state alone does not survive that
   * for a checkbox — see `useCheckedSync`.
   */
  const dofollowBox = useCheckedSync(dofollow)
  const anonymousBox = useCheckedSync(anonymous)

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
            className={`${input} min-w-0 flex-1`}
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
  const selectedProvider = providers.find((option) => option.id === provider)

  return (
    <form action={runSubmit} className="mt-8 space-y-6">
      <input type="hidden" name="appStoreId" value={app.appStoreId} />

      <div className="border-border bg-surface rounded-card flex items-center gap-4 border p-4">
        <AppIcon src={app.iconUrl} name={app.name} size={56} />
        <div className="min-w-0">
          <p className="text-fg truncate font-medium">{app.name}</p>
          <p className="text-muted truncate text-xs">
            {app.sellerName} · ID {app.appStoreId}
          </p>
        </div>
      </div>

      <TextField
        label="Name"
        name="name"
        defaultValue={app.name}
        error={submit.fieldErrors?.name}
        required
      />

      <TextField
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
          className={`${input} mt-2`}
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
          className={`${input} mt-2`}
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

      <TextField
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
        Verification is part of this form, not a screen after it. The credential
        fields belong to whichever provider is selected, and only that
        provider's fields are read on the server — so switching tabs cannot
        smuggle a half-filled second set through.
      */}
      <section className="border-border border-t pt-6">
        <h2 className="text-fg text-sm font-medium">Connect revenue</h2>
        <p className="text-muted mt-1 text-xs leading-relaxed">
          One read-only key. We check it before saving anything, then re-read it daily. Your app
          goes live the moment it works.
        </p>

        <input type="hidden" name="provider" value={provider} />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {providers.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setProvider(option.id)}
              className={
                option.id === provider
                  ? 'bg-accent text-accent-fg rounded-lg px-3 py-1.5 text-sm font-medium'
                  : 'border-border text-muted hover:border-border-strong hover:text-fg rounded-lg border px-3 py-1.5 text-sm'
              }
            >
              {option.name}
            </button>
          ))}
        </div>
        {submit.fieldErrors?.provider && (
          <p className="text-red mt-1.5 text-sm">{submit.fieldErrors.provider}</p>
        )}

        {selectedProvider && (
          <div key={selectedProvider.id} className="mt-4 space-y-4">
            <div className="border-border bg-surface-2 rounded-card border p-4">
              <p className="text-muted text-sm leading-relaxed">{selectedProvider.instructions}</p>
              <a
                href={selectedProvider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue mt-2 inline-flex items-center gap-1 text-[11px] hover:underline"
              >
                {selectedProvider.name} docs
                <ExternalLink className="size-3" />
              </a>
            </div>

            {selectedProvider.fields.map((credential) => (
              <div key={credential.name}>
                <label htmlFor={credential.name} className="text-fg text-sm font-medium">
                  {credential.label}
                </label>
                {credential.multiline ? (
                  <textarea
                    id={credential.name}
                    name={credential.name}
                    rows={5}
                    required
                    placeholder={credential.placeholder}
                    className={`${input} mt-2 text-xs`}
                  />
                ) : (
                  <input
                    id={credential.name}
                    name={credential.name}
                    type={credential.type ?? 'text'}
                    required
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={credential.placeholder}
                    className={`${input} mt-2`}
                  />
                )}
                {submit.fieldErrors?.[credential.name] && (
                  <p className="text-red mt-1.5 text-sm">{submit.fieldErrors[credential.name]}</p>
                )}
              </div>
            ))}

            <p className="text-muted text-xs leading-relaxed">
              Encrypted before it reaches the database and never shown again — not even to you. We
              test it before saving, so a key that doesn&apos;t work is never stored.
            </p>
          </div>
        )}
      </section>

      {/*
        Anonymous mode hides the app, not the founder. The point of the site is a
        number somebody stands behind, so the byline stays and the app's own
        name, icon, screenshots and store link go — including out of the URL,
        which would otherwise spell it.
      */}
      <label
        className={
          anonymous
            ? 'border-border-strong bg-surface rounded-card block cursor-pointer border p-4'
            : 'border-border hover:border-border-strong rounded-card block cursor-pointer border border-dashed p-4'
        }
      >
        <div className="flex items-start gap-3">
          <input
            ref={anonymousBox}
            type="checkbox"
            name="anonymous"
            checked={anonymous}
            onChange={(event) => setAnonymous(event.target.checked)}
            className="accent-accent mt-0.5 size-4 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <span className="text-fg text-[13px] font-medium">Anonymous mode</span>
            <p className="text-muted mt-1.5 text-xs leading-relaxed">
              Your app is listed as <span className="text-fg">Stealth Company</span>: the name,
              tagline and description are blurred, and the icon, screenshots, reviews and App Store
              link are withheld. The revenue is verified and ranked exactly the same, and you are
              still credited as the founder. You can turn it off later from the dashboard.
            </p>
          </div>
        </div>
      </label>

      {/*
        Offered here rather than only on the edit screen, where founders had to
        already know it existed. The charge comes after the app verifies, so
        ticking this is not a payment — it decides where the founder is sent
        once their listing is live.
      */}
      {dofollowOffer && (
        <label
          className={
            dofollow
              ? 'border-border-strong bg-surface rounded-card block cursor-pointer border p-4'
              : 'border-border hover:border-border-strong rounded-card block cursor-pointer border border-dashed p-4'
          }
        >
          <div className="flex items-start gap-3">
            <input
              ref={dofollowBox}
              type="checkbox"
              name="dofollow"
              checked={dofollow}
              onChange={(event) => setDofollow(event.target.checked)}
              className="accent-accent mt-0.5 size-4 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-fg text-[13px] font-medium">
                  Dofollow link
                  {dofollowOffer.domainAuthority != null && (
                    <span className="text-muted font-normal">
                      {' '}
                      · Domain Authority {dofollowOffer.domainAuthority}
                    </span>
                  )}
                </span>
                <span className="text-fg text-[13px] font-medium">{dofollowOffer.price}</span>
              </div>
              <p className="text-muted mt-1.5 text-xs leading-relaxed">{dofollowOffer.blurb}</p>
            </div>
          </div>
        </label>
      )}

      {/*
        Shown, but off and unusable, because the marketplace has not opened. A
        founder who wants to sell should learn here that the option is coming
        rather than discover the marketplace page by accident — and the switch
        carries no name, so nothing about it reaches the server.
      */}
      <div className="border-border rounded-card border border-dashed p-4 opacity-70">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="border-border bg-surface-2 mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border px-0.5"
          >
            <span className="bg-muted size-3.5 rounded-full" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-fg text-[13px] font-medium">List for sale</span>
              <span className="border-gold/40 bg-gold-dim text-gold rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-[0.11em] uppercase">
                Coming soon
              </span>
            </div>
            <p className="text-muted mt-1.5 text-xs leading-relaxed">
              The{' '}
              <Link href="/marketplace" className="hover:text-fg underline">
                marketplace
              </Link>{' '}
              is not open yet. Connect your app now and it will already have the revenue history a
              listing needs when it is.
            </p>
          </div>
        </div>
      </div>

      {/*
        Shown from the start when signed out, rather than after a submit that
        can only fail. Signing in first also means nothing typed here is lost
        on the round trip — only the App Store ID survives it.
      */}
      {!isSignedIn && (
        <div className="border-border bg-surface rounded-card border p-4">
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
        <p
          role="alert"
          className="border-red/40 bg-red-dim text-red rounded-card border px-4 py-3 text-sm"
        >
          {submit.error}
        </p>
      )}

      {/*
        Once the draft is validated and only sign-in is missing, this button can
        do nothing but repeat itself. Hiding it leaves one obvious next step
        instead of two competing ones.
      */}
      {isSignedIn && (
        <div className="border-border flex flex-wrap items-center gap-3 border-t pt-6">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {dofollow && dofollowOffer
              ? `Add app + checkout (${dofollowOffer.price})`
              : 'Add app and verify'}
          </Button>
          <p className="text-muted text-xs">
            {submitting
              ? 'Checking the key…'
              : dofollow && dofollowOffer
                ? 'Verified first, paid after — a key that fails is never charged for.'
                : 'Private until the key verifies. Then it goes live.'}
          </p>
        </div>
      )}
    </form>
  )
}

function TextField({
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
      <input id={name} name={name} className={`${input} mt-2`} {...props} />
      {hint && !error && <p className="text-muted mt-1.5 text-xs">{hint}</p>}
      {error && <p className="text-red mt-1.5 text-sm">{error}</p>}
    </div>
  )
}

function TechCheckbox({ slug, name }: { slug: string; name: string }) {
  const [checked, setChecked] = useState(false)
  const box = useCheckedSync(checked)

  return (
    <label
      className={
        checked
          ? 'bg-blue-dim text-blue cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium'
          : 'border-border text-muted hover:border-border-strong hover:text-fg cursor-pointer rounded-md border px-2.5 py-1 text-xs'
      }
    >
      <input
        ref={box}
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
