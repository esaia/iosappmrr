import type { Metadata } from 'next'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to submit an iOS app and connect its revenue.',
  robots: { index: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-14">
      <h1 className="display text-3xl font-semibold">Sign in</h1>
      <p className="text-muted mt-2">
        Founders sign in to submit an app and connect its revenue. Browsing needs no account.
      </p>
      <LoginForm next={next ?? '/dashboard'} />
    </div>
  )
}
