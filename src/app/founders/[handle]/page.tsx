import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { AppRow, AppRowHeader } from '@/components/app-row'
import { getFounderByHandle } from '@/lib/data/apps'
import { formatMoney } from '@/lib/utils'

export const revalidate = 600

type Params = { params: Promise<{ handle: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params
  const record = await getFounderByHandle(handle)
  if (!record) return { title: 'Founder not found' }
  return {
    title: `${record.founder.name ?? `@${record.founder.handle}`} — iOS apps`,
    description: `Verified App Store revenue for apps built by ${record.founder.name ?? handle}.`,
    alternates: { canonical: `/founders/${handle}` },
  }
}

export default async function FounderPage({ params }: Params) {
  const { handle } = await params
  const record = await getFounderByHandle(handle)
  if (!record) notFound()

  const { founder, apps } = record
  const totalMrr = apps.reduce((sum, app) => sum + app.mrrCents, 0)

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex items-start gap-5">
        {founder.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={founder.avatarUrl}
            alt=""
            className="squircle size-16 object-cover"
            width={64}
            height={64}
          />
        ) : (
          <span className="squircle bg-surface-2 flex size-16 items-center justify-center">
            <span className="display text-muted text-2xl font-semibold">
              {(founder.name ?? founder.handle).charAt(0).toUpperCase()}
            </span>
          </span>
        )}

        <div className="min-w-0">
          <h1 className="display text-3xl font-semibold">{founder.name ?? `@${founder.handle}`}</h1>
          <p className="text-muted text-sm">@{founder.handle}</p>
          {founder.bio && <p className="text-muted mt-2">{founder.bio}</p>}
          {founder.website && (
            <a
              href={founder.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-blue mt-2 inline-flex items-center gap-1 text-sm hover:underline"
            >
              {founder.website.replace(/^https?:\/\//, '')}
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </header>

      <dl className="border-border mt-8 flex gap-10 border-y py-5">
        <div>
          <dt className="label">Verified MRR</dt>
          <dd className="display tabular mt-1 text-2xl font-semibold">{formatMoney(totalMrr)}</dd>
        </div>
        <div>
          <dt className="label">Apps</dt>
          <dd className="display tabular mt-1 text-2xl font-semibold">{apps.length}</dd>
        </div>
      </dl>

      {apps.length > 0 && (
        <div className="border-border bg-surface mt-6 overflow-hidden rounded-[10px] border">
          <AppRowHeader withRank={false} />
          {apps.map((app) => (
            <AppRow key={app.id} app={app} />
          ))}
        </div>
      )}

      {apps.length === 0 && (
        <p className="border-border-strong text-muted mt-10 rounded-[10px] border border-dashed p-10 text-center">
          No live apps yet.
        </p>
      )}
    </div>
  )
}
