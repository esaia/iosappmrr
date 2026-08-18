import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-14 text-center">
      <p className="label">404</p>
      <h1 className="display mt-2 text-4xl font-semibold">No app here</h1>
      <p className="text-muted mt-3">
        This page doesn&apos;t exist, or the app was unlisted by its founder.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <ButtonLink href="/apps">Browse apps</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Home
        </ButtonLink>
      </div>
      <p className="text-muted mt-8 text-sm">
        Looking for your own draft?{' '}
        <Link href="/dashboard" className="text-blue hover:underline">
          Open your dashboard
        </Link>
        .
      </p>
    </div>
  )
}
