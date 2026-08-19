import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { AppRow, AppRowHeader } from '@/components/app-row'
import { getFounderByHandle } from '@/lib/data/apps'
import { formatCount, formatMoney, highResAvatar } from '@/lib/utils'
import { Container } from '@/components/ui/container'

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
    <Container className="py-10 sm:py-14">
      <header className="flex items-start gap-5">
        {founder.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={highResAvatar(founder.avatarUrl) ?? undefined}
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
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {founder.website && (
              <a
                href={founder.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-blue inline-flex items-center gap-1 text-sm hover:underline"
              >
                {founder.website.replace(/^https?:\/\//, '')}
                <ExternalLink className="size-3" />
              </a>
            )}
            {founder.twitter && (
              <a
                href={`https://x.com/${founder.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:text-fg inline-flex items-center gap-1.5 text-sm transition-colors"
                title={`@${founder.twitter} on X`}
              >
                <XMark />@{founder.twitter}
                {founder.twitterFollowers != null && (
                  <span className="text-dim tabular">
                    {formatCount(founder.twitterFollowers)} followers
                  </span>
                )}
              </a>
            )}
          </div>
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
        <div className="border-border bg-surface rounded-card mt-6 overflow-hidden border">
          <AppRowHeader withRank={false} />
          {apps.map((app) => (
            <AppRow key={app.id} app={app} />
          ))}
        </div>
      )}

      {apps.length === 0 && (
        <p className="border-border-strong text-muted rounded-card mt-10 border border-dashed p-10 text-center">
          No live apps yet.
        </p>
      )}
    </Container>
  )
}

/** lucide dropped brand marks, so the X logo lives here. */
function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  )
}
