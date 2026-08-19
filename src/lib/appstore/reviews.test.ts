import { describe, expect, it } from 'vitest'
import { parseReviewsPage } from './reviews'

/**
 * A cut-down copy of what apps.apple.com embeds: the same nesting, the same
 * string-typed rating, and the same review repeated under two shelves.
 */
function page(data: unknown) {
  return `<html><head></head><body><script type="application/json" id="serialized-server-data">${JSON.stringify(
    data,
  )}</script></body></html>`
}

const olderReview = {
  $kind: 'Review',
  id: '5341194494',
  title: 'The Essential To Do App',
  contents: 'Instead of boosting my productivity, it became the productivity.',
  rating: '4',
  reviewerName: 'Jmw6838',
  date: '2019-12-31T03:59:57.000Z',
}

const newerReview = {
  $kind: 'Review',
  id: '10323177667',
  title: 'Worth It (?)',
  contents: 'Things 3 is expensive.',
  rating: '5',
  reviewerName: 'ORTNPalms',
  date: '2023-09-01T15:41:27.000Z',
}

const ratings = {
  $kind: 'Ratings',
  ratingAverage: 4.8,
  totalNumberOfRatings: 27817,
  ratingCounts: [24780, 1953.9999999999998, 478, 226.99999999999997, 378],
}

const fullPage = page({
  data: [
    { shelves: [{ items: [{ $kind: 'ReviewsContainer', ratings }] }] },
    { shelves: [{ items: [olderReview, newerReview] }] },
    // The store repeats the same reviews under a second shelf.
    { shelves: [{ items: [newerReview] }] },
  ],
})

describe('parseReviewsPage', () => {
  it('reads the reviews the store page carries', () => {
    const result = parseReviewsPage(fullPage)

    expect(result?.reviews).toHaveLength(2)
    expect(result?.reviews[0]).toEqual({
      reviewId: '10323177667',
      rating: 5,
      title: 'Worth It (?)',
      body: 'Things 3 is expensive.',
      author: 'ORTNPalms',
      reviewedAt: new Date('2023-09-01T15:41:27.000Z'),
    })
  })

  it('sorts newest first and keeps one copy of a repeated review', () => {
    const ids = parseReviewsPage(fullPage)?.reviews.map((review) => review.reviewId)
    expect(ids).toEqual(['10323177667', '5341194494'])
  })

  it('rounds the star breakdown Apple sends as floats', () => {
    expect(parseReviewsPage(fullPage)?.histogram).toEqual([24780, 1954, 478, 227, 378])
  })

  it('sorts an undated review last rather than first', () => {
    const undated = { ...newerReview, id: '999', date: undefined }
    const result = parseReviewsPage(page({ items: [undated, olderReview] }))

    expect(result?.reviews.map((review) => review.reviewId)).toEqual(['5341194494', '999'])
    expect(result?.reviews[1].reviewedAt).toBeNull()
  })

  it('returns the reviews it can read and no histogram when the page has none', () => {
    const result = parseReviewsPage(page({ items: [olderReview] }))

    expect(result?.reviews).toHaveLength(1)
    expect(result?.histogram).toBeNull()
  })

  it('skips a review missing the fields that make it a review', () => {
    const result = parseReviewsPage(page({ items: [{ $kind: 'Review', id: '1' }, olderReview] }))

    expect(result?.reviews.map((review) => review.reviewId)).toEqual(['5341194494'])
  })

  it("treats an unrated app's empty breakdown as no breakdown", () => {
    const unrated = { $kind: 'Ratings', ratingCounts: [0, 0, 0, 0, 0] }
    const result = parseReviewsPage(page({ items: [olderReview, unrated] }))

    expect(result?.histogram).toBeNull()
    expect(result?.reviews).toHaveLength(1)
  })

  it('reads an unreviewed app as an empty list, not as a failure', () => {
    // Apple ships the ratings node on every listing, zeroes and all.
    const unrated = { $kind: 'Ratings', ratingCounts: [0, 0, 0, 0, 0] }
    const result = parseReviewsPage(page({ items: [unrated] }))

    expect(result).toEqual({ reviews: [], histogram: null })
  })

  it('returns nothing when the page carries neither reviews nor ratings', () => {
    // No ratings node and no reviews means the shape moved, not that the app is
    // unreviewed — the caller must retry rather than record it as read.
    expect(parseReviewsPage(page({ data: [{ shelves: [] }] }))).toBeNull()
  })

  it('returns nothing rather than throwing on a page it cannot read', () => {
    expect(parseReviewsPage('<html><body>Not the App Store</body></html>')).toBeNull()
    expect(
      parseReviewsPage(
        '<script type="application/json" id="serialized-server-data">{ oops </script>',
      ),
    ).toBeNull()
  })
})
