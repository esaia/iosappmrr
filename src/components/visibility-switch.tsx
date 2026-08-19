'use client'

import { useActionState } from 'react'
import { setPurchaseVisibilityAction, type BillingActionState } from '@/app/account/actions'

/**
 * A show/hide switch for one live sponsor slot.
 *
 * Sponsor slots only. A dofollow link has nothing worth switching: it is a
 * one-time purchase of an attribute on one link, and a founder who wants it off
 * wants it not to have been bought — a toggle there would offer a decision
 * nobody has a reason to make, on something they cannot get a refund for by
 * flicking it.
 *
 * A slot is different. It is recurring, it is visible on every page, and
 * wanting out of the rails for a fortnight without losing the slot is an
 * ordinary thing to want.
 *
 * Lives here rather than beside either screen because both the billing tab and
 * the app's own upgrade card offer it, and a founder who switched a slot off in
 * one place must not find it still reading "on" in the other. One component,
 * one action, one answer.
 *
 * Its own form and action state, so a page showing several purchases reports a
 * failure against the row that was touched rather than as one shared message.
 * There is no confirm step: nothing is lost, the row keeps its status, and
 * switching back costs nothing.
 */
export function VisibilitySwitch({
  purchaseId,
  hidden,
  className,
}: {
  purchaseId: string
  hidden: boolean
  className?: string
}) {
  const [state, run, pending] = useActionState<BillingActionState, FormData>(
    setPurchaseVisibilityAction,
    {},
  )

  const shown = !hidden

  return (
    <form action={run} className={className}>
      <input type="hidden" name="purchaseId" value={purchaseId} />
      {/* Posts the opposite of where the row stands, so the click carries the
          intent rather than the current value. */}
      <input type="hidden" name="hidden" value={shown ? 'true' : 'false'} />
      {/*
        A plain button rather than a switch: the label names what the click
        does — "Temporary hide", then "Show" once it is off — so the toggle
        beside it is decoration and is hidden from assistive tech, which would
        otherwise read the state and the action as if they were the same thing.
      */}
      <button
        type="submit"
        disabled={pending}
        className="group inline-flex items-center gap-2.5 disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={
            shown
              ? 'bg-green/80 relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors'
              : 'bg-surface-3 group-hover:bg-border-strong relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors'
          }
        >
          <span
            className={
              shown
                ? 'bg-bg size-3 translate-x-3.5 rounded-full transition-transform'
                : 'bg-muted size-3 translate-x-0.5 rounded-full transition-transform'
            }
          />
        </span>
        <span className={shown ? 'text-muted text-xs' : 'text-dim text-xs'}>
          {pending ? 'Saving…' : shown ? 'Temporary hide' : 'Show'}
        </span>
      </button>

      {state.error && (
        <p role="alert" className="text-red mt-1.5 text-xs">
          {state.error}
        </p>
      )}
    </form>
  )
}
