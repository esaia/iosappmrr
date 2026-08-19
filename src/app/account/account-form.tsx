'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateProfileAction, type ProfileState } from './actions'

const field =
  'border-border bg-surface-2 text-fg placeholder:text-dim focus:border-border-strong w-full rounded-[10px] border px-3 py-2 text-[13px] focus:outline-none'

export function AccountForm({
  email,
  initial,
}: {
  email: string | null
  initial: { handle: string; name: string; bio: string; website: string; twitter: string }
}) {
  const [state, action] = useActionState<ProfileState, FormData>(updateProfileAction, {})

  return (
    <form action={action} className="mt-4 space-y-5">
      <Field
        label="Handle"
        hint="Lowercase letters and numbers. This is your public URL, so changing it breaks old links."
        error={state.fieldErrors?.handle}
      >
        <div className="flex items-center gap-2">
          <span className="text-muted text-[13px]">/founders/</span>
          <input
            name="handle"
            defaultValue={initial.handle}
            maxLength={24}
            required
            className={field}
          />
        </div>
      </Field>

      <Field label="Name" error={state.fieldErrors?.name}>
        <input name="name" defaultValue={initial.name} maxLength={80} className={field} />
      </Field>

      <Field
        label="Bio"
        hint="280 characters, shown on your founder page."
        error={state.fieldErrors?.bio}
      >
        <textarea
          name="bio"
          defaultValue={initial.bio}
          rows={3}
          maxLength={280}
          className={field}
        />
      </Field>

      <Field label="Website" error={state.fieldErrors?.website}>
        <input
          name="website"
          type="url"
          defaultValue={initial.website}
          placeholder="https://"
          className={field}
        />
      </Field>

      <Field
        label="X handle"
        /*
         * Said plainly, because the number beside your name on every app page
         * comes from here and a founder who edits this field will wonder why it
         * vanished. It is read with your own token at sign-in, so there is no
         * way to refresh it from a text box.
         */
        hint="Follower count is only read when you sign in with X. Editing this clears it until you next do."
        error={state.fieldErrors?.twitter}
      >
        <div className="flex items-center gap-2">
          <span className="text-muted text-[13px]">@</span>
          <input
            name="twitter"
            defaultValue={initial.twitter}
            maxLength={15}
            placeholder="username"
            className={field}
          />
        </div>
      </Field>

      <div>
        <p className="text-muted text-[13px] font-medium">Email</p>
        <p className="text-dim mt-1 text-[13px]">{email ?? 'Not set'}</p>
        <p className="text-muted mt-1 text-xs">
          Set by whoever you signed in with, and never shown publicly.
        </p>
      </div>

      {state.error && (
        <p
          role="alert"
          className="border-red/40 bg-red-dim text-red rounded-[10px] border px-4 py-3 text-sm"
        >
          {state.error}
        </p>
      )}

      <Save saved={state.saved} />
    </form>
  )
}

function Save({ saved }: { saved?: boolean }) {
  const { pending } = useFormStatus()

  return (
    <div className="flex items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Save profile
      </Button>
      {/* Only once the write has landed — a tick that survives the next edit
          would be claiming something it cannot know. */}
      {saved && !pending && (
        <span className="text-green inline-flex items-center gap-1 text-xs">
          <Check className="size-3.5" />
          Saved
        </span>
      )}
    </div>
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
      <span className="text-fg text-[13px] font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <span className="text-muted mt-1.5 block text-xs">{hint}</span>}
      {error && <span className="text-red mt-1.5 block text-xs">{error}</span>}
    </label>
  )
}
