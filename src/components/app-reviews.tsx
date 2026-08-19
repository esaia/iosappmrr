import { Star } from 'lucide-react'
import { ExpandableText } from '@/components/expandable-text'
import { formatCount } from '@/lib/utils'

export type ProfileReview = {
  reviewId: string
  rating: number
  title: string | null
  body: string | null
  author: string | null
  reviewedAt: Date | null
}

/**
 * What the App Store's own reviewers say, beside the revenue they pay for.
 *
 * The histogram earns its place next to the average: 4.6★ built from a wall of
 * fives and a tail of ones is a different app from 4.6★ built from fours, and
 * the single number hides which one you are looking at.
 */
export function AppReviews({
  reviews,
  histogram,
  average,
  total,
  appStoreUrl,
}: {
  reviews: ProfileReview[]
  histogram?: number[] | null
  average?: number | null
  total?: number | null
  appStoreUrl?: string | null
}) {
  if (reviews.length === 0 && !histogram) return null

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="display text-xl font-semibold">Ratings &amp; reviews</h2>
        {appStoreUrl && (
          <a
            href={appStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-fg text-[13px] transition-colors"
          >
            Read on the App Store →
          </a>
        )}
      </div>

      {/*
        Sized against the column rather than the viewport: this block sits in
        the narrower reading column on a profile and at full width elsewhere,
        and the rating summary is just the first card in the same run so
        neither layout leaves a ragged gap beside it.
      */}
      <div className="@container mt-4">
        <ul className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {histogram && (
            <li className="border-border bg-surface rounded-[10px] border p-5">
              <p className="tabular flex items-baseline gap-1.5">
                <span className="text-fg text-3xl font-semibold tracking-tight">
                  {average != null ? average.toFixed(1) : '—'}
                </span>
                <span className="text-muted text-sm">out of 5</span>
              </p>
              {total != null && (
                <p className="text-muted mt-1 text-[11px]">{formatCount(total)} ratings</p>
              )}

              <Histogram counts={histogram} />
            </li>
          )}

          {reviews.map((review) => (
            <li
              key={review.reviewId}
              className="border-border bg-surface rounded-[10px] border p-5"
            >
              <Stars rating={review.rating} />
              {review.title && (
                <h3 className="text-fg mt-2 text-[15px] leading-snug font-semibold">
                  {review.title}
                </h3>
              )}
              {review.body && (
                <div className="mt-1.5 text-[13px]">
                  <ExpandableText text={review.body} lines={5} />
                </div>
              )}
              <p className="text-dim mt-3 text-[11px]">
                {review.author ?? 'App Store customer'}
                {review.reviewedAt && ` · ${review.reviewedAt.toISOString().slice(0, 10)}`}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-dim mt-3 text-[11px] leading-relaxed">
        Written by App Store customers and shown as Apple publishes them. Reviews are for the US
        storefront and refresh daily.
      </p>
    </section>
  )
}

/** Five buckets, 5★ first, drawn against the busiest one rather than the total
 * so a lopsided distribution still shows its shape. */
function Histogram({ counts }: { counts: number[] }) {
  const busiest = Math.max(...counts, 1)

  return (
    <dl className="mt-4 space-y-1.5">
      {counts.map((count, index) => {
        const stars = 5 - index
        return (
          <div key={stars} className="flex items-center gap-2">
            <dt className="text-dim w-8 shrink-0 text-[11px]">
              {stars}
              <span aria-hidden="true"> ★</span>
              <span className="sr-only"> stars</span>
            </dt>
            <dd className="flex flex-1 items-center gap-2">
              <div className="bg-surface-3 h-1.5 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-gold h-full rounded-full"
                  style={{ width: `${Math.round((count / busiest) * 100)}%` }}
                />
              </div>
              <span className="tabular text-dim w-10 shrink-0 text-right text-[11px]">
                {formatCount(count)}
              </span>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <p className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={
            star <= rating ? 'fill-gold text-gold size-3.5' : 'text-surface-3 size-3.5 fill-current'
          }
        />
      ))}
    </p>
  )
}
