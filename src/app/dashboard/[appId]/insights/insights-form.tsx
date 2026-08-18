'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { saveInsightsAction, type InsightsState } from './actions'

type Values = {
  valueProposition: string
  problemSolved: string
  audience: string
  audienceType: string
  marketTags: string
  marketingChannels: string
  additionalInfo: string
}

const field =
  'border-border bg-surface-2 text-fg placeholder:text-dim focus:border-border-strong w-full rounded-[10px] border px-3 py-2 text-[13px] focus:outline-none'

export function InsightsForm({ appId, initial }: { appId: string; initial: Values }) {
  const [state, action] = useActionState<InsightsState, FormData>(saveInsightsAction, {})

  return (
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="appId" value={appId} />

      <Field
        label="Value proposition"
        hint="One sentence. What the app promises the person who installs it."
      >
        <textarea
          name="valueProposition"
          rows={2}
          maxLength={280}
          defaultValue={initial.valueProposition}
          placeholder="Track your height journey, predict your adult height, and build daily habits."
          className={field}
        />
      </Field>

      <Field label="Problem solved" hint="What was broken or missing before this existed.">
        <textarea
          name="problemSolved"
          rows={2}
          maxLength={280}
          defaultValue={initial.problemSolved}
          placeholder="Provide tools and insights to help users build healthy habits."
          className={field}
        />
      </Field>

      <Field label="Audience" hint="Who it is for.">
        <input
          name="audience"
          maxLength={200}
          defaultValue={initial.audience}
          placeholder="Individuals looking to optimise their growth journey"
          className={field}
        />
      </Field>

      <Field label="Audience type">
        <select name="audienceType" defaultValue={initial.audienceType} className={field}>
          <option value="">Not specified</option>
          <option value="B2C">B2C</option>
          <option value="B2B">B2B</option>
          <option value="B2B2C">B2B2C</option>
        </select>
      </Field>

      <Field label="Market" hint="Comma separated, up to 12.">
        <input
          name="marketTags"
          defaultValue={initial.marketTags}
          placeholder="Health & Fitness, AI, Mobile Apps"
          className={field}
        />
      </Field>

      <Field label="Marketing channels" hint="Comma separated, up to 12.">
        <input
          name="marketingChannels"
          defaultValue={initial.marketingChannels}
          placeholder="App store optimization, Content marketing, TikTok, Meta Ads"
          className={field}
        />
      </Field>

      <Field label="Additional info" hint="Anything else worth knowing.">
        <textarea
          name="additionalInfo"
          rows={2}
          maxLength={400}
          defaultValue={initial.additionalInfo}
          placeholder="Backed by science; uses data from trusted health organisations."
          className={field}
        />
      </Field>

      {state.error && <p className="text-red text-[13px]">{state.error}</p>}
      {state.saved && <p className="text-green text-[13px]">Saved. Your app page is updated.</p>}

      <Submit />
    </form>
  )
}

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Saving…' : 'Save insights'}
    </Button>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {hint && <span className="text-dim mt-1 block text-[11px]">{hint}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  )
}
