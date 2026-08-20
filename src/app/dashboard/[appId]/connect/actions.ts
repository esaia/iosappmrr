'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { connectProvider, disconnectProvider } from '@/lib/data/connections'
import { getOwnedApp } from '@/lib/data/mutations'
import { isConnectable } from '@/lib/providers'

export type ConnectState = {
  error?: string
  fieldErrors?: Record<string, string>
  connected?: {
    mrrCents: number
    currency: string
    /** What an installs-only connection has to show for itself instead of MRR. */
    installs?: number | null
    installsOnly?: boolean
  }
}

export async function connectProviderAction(
  _previous: ConnectState,
  formData: FormData,
): Promise<ConnectState> {
  const user = await requireUser('/dashboard')

  const appId = String(formData.get('appId') ?? '')
  const provider = String(formData.get('provider') ?? '')
  const installsOnly = formData.get('installsOnly') === 'on'

  if (!isConnectable(provider)) return { error: 'That provider cannot be connected.' }

  // Ownership is checked here, not in the UI — a form post is not a permission.
  const app = await getOwnedApp(appId, user.id)
  if (!app) return { error: 'App not found.' }

  const credentials = Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => !['appId', 'provider', 'installsOnly', '$ACTION_ID'].includes(key))
      .map(([key, value]) => [key, String(value)]),
  )

  const result = await connectProvider({
    appId,
    founderId: user.id,
    provider,
    credentials,
    installsOnly,
  })

  // Generic when a field is already carrying the detail — see the note in
  // `submitAppAction`. The same sentence in two places reads as two faults.
  if (!result.ok) {
    return {
      error: result.fieldErrors ? 'Check the highlighted fields.' : result.error,
      fieldErrors: result.fieldErrors,
    }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/apps/${app.slug}`)

  return {
    connected: {
      mrrCents: result.metrics.mrrCents,
      currency: result.metrics.currency,
      installs: result.metrics.installs ?? null,
      installsOnly,
    },
  }
}

export async function disconnectProviderAction(formData: FormData) {
  const user = await requireUser('/dashboard')

  const appId = String(formData.get('appId') ?? '')
  const provider = String(formData.get('provider') ?? '')

  if (!isConnectable(provider)) return
  const app = await getOwnedApp(appId, user.id)
  if (!app) return

  await disconnectProvider(appId, provider)

  revalidatePath('/dashboard')
  revalidatePath(`/apps/${app.slug}`)
  redirect(`/dashboard/${appId}/connect`)
}
