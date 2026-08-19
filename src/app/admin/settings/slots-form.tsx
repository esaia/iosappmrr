'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { setSponsorSlotsAction, type AdminState } from '../actions'

export function SlotsForm({ current, min, max }: { current: number; min: number; max: number }) {
  const [state, action] = useActionState<AdminState, FormData>(setSponsorSlotsAction, {})

  return (
    <form action={action} className="mt-4">
      <label className="flex flex-wrap items-end gap-3">
        <span className="block">
          <span className="label">Slots on sale</span>
          <input
            name="slots"
            type="number"
            min={min}
            max={max}
            step={1}
            defaultValue={current}
            className="border-border bg-surface-2 text-fg focus:border-accent/60 focus:ring-accent/25 rounded-card mt-1.5 block w-28 border px-3 py-2 text-[13px] focus:ring-4 focus:outline-none"
          />
        </span>
        <Save />
      </label>

      <p className="text-dim mt-2 text-[12px]">
        {min}–{max}. Set it to {min} to take the rails off sale entirely.
      </p>

      {state.error && (
        <p role="alert" className="text-red mt-2 text-[13px]">
          {state.error}
        </p>
      )}
      {state.ok && <p className="text-green mt-2 text-[13px]">{state.ok}</p>}
    </form>
  )
}

function Save() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </Button>
  )
}
