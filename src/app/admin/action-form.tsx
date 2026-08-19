'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import type { AdminState } from './actions'

const field =
  'border-border bg-surface-2 text-fg placeholder:text-dim focus:border-border-strong w-full rounded-[10px] border px-2.5 py-1.5 text-[12px] focus:outline-none'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

/**
 * One admin action as a self-contained form.
 *
 * Every mutation on these screens is the same shape — a few fixed values, an
 * optional note, one button, and a result to read — so it is written once here
 * rather than repeated per row. Each form owns its own action state, which is
 * what lets a table of twenty apps report results independently instead of
 * showing one shared message that belongs to whichever row was touched last.
 */
export function ActionForm({
  action,
  fields,
  label,
  variant = 'secondary',
  /** Ask for a free-text reason before the action can be submitted. */
  note,
  /** Ask for a number of days; blank means no expiry. */
  duration,
  /** Require a second click, for anything that takes something away. */
  confirm,
  className,
}: {
  action: (state: AdminState, formData: FormData) => Promise<AdminState>
  fields: Record<string, string>
  label: string
  variant?: Variant
  note?: string | false
  duration?: boolean
  confirm?: boolean
  className?: string
}) {
  const [state, formAction] = useActionState<AdminState, FormData>(action, {})
  const needsInput = Boolean(note) || duration
  /*
   * Anything that asks a question, or takes something away, starts closed: the
   * first click reveals the inputs and turns the button into the real submit.
   * A bare button submits immediately.
   *
   * Per-form rather than per-page, so arming one row cannot leave another row's
   * destructive button armed by accident.
   */
  const [armed, setArmed] = useState(!confirm && !needsInput)

  /*
   * Collapse back once the action reports success, so a confirmed destructive
   * step does not sit there still armed with its reason box open, inviting a
   * second run of something that already happened.
   *
   * Keyed on the identity of the result rather than on `state.ok` being truthy:
   * `useActionState` hands back the same object until the next submission, so a
   * plain truthiness check would slam the form shut the instant the admin
   * re-armed it for a second, deliberate go.
   */
  const handled = useRef<AdminState | null>(null)
  useEffect(() => {
    if (state.ok && handled.current !== state) {
      handled.current = state
      setArmed(!confirm && !needsInput)
    }
  }, [state, confirm, needsInput])

  return (
    <form action={formAction} className={className}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {armed && needsInput && (
        <div className="mb-2 flex flex-wrap gap-2">
          {note && (
            <input
              name="note"
              placeholder={note}
              autoComplete="off"
              className={`${field} min-w-[12rem] flex-1`}
            />
          )}
          {duration && (
            <input
              name="days"
              inputMode="numeric"
              placeholder="Days (blank = forever)"
              autoComplete="off"
              className={`${field} w-44`}
            />
          )}
        </div>
      )}

      {armed ? (
        <div className="flex gap-2">
          <Submit label={confirm ? `${label} — confirm` : label} variant={variant} />
          {(confirm || needsInput) && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setArmed(false)}>
              Cancel
            </Button>
          )}
        </div>
      ) : (
        <Button type="button" size="sm" variant={variant} onClick={() => setArmed(true)}>
          {label}
        </Button>
      )}

      {state.error && (
        <p role="alert" className="text-red mt-1.5 text-[12px]">
          {state.error}
        </p>
      )}
      {state.ok && <p className="text-green mt-1.5 text-[12px]">{state.ok}</p>}
    </form>
  )
}

function Submit({ label, variant }: { label: string; variant: Variant }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? 'Working…' : label}
    </Button>
  )
}
