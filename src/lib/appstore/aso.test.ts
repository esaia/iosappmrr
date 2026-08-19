import { describe, expect, it } from 'vitest'
import { asoBand, scoreListing } from './aso'
import type { AppStoreApp } from './lookup'

const NOW = new Date('2026-08-19T00:00:00Z').getTime()
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000)

/** A listing doing everything right, so each test can spoil one thing at a time. */
function listing(overrides: Partial<AppStoreApp> = {}): AppStoreApp {
  return {
    appStoreId: '1234567890',
    name: 'Habit Tracker - Habitix',
    bundleId: 'com.example.habitix',
    sellerName: 'Example',
    description: `${'Keep the promises you make to yourself with a tracker that stays out of the way. '.repeat(30)}\n- Streaks\n- Reminders`,
    iconUrl: 'https://example.test/icon.png',
    screenshotUrls: Array.from({ length: 8 }, (_, i) => `https://example.test/${i}.png`),
    priceCents: 0,
    currency: 'USD',
    hasInAppPurchases: null,
    averageRating: 4.8,
    ratingCount: 12_000,
    version: '2.1.0',
    primaryGenre: 'Productivity',
    genres: ['Productivity', 'Lifestyle'],
    contentRating: '4+',
    releasedAt: daysAgo(700),
    updatedInStoreAt: daysAgo(10),
    fileSizeBytes: 42_000_000,
    supportedDevices: [],
    minimumOsVersion: '17.0',
    website: null,
    appStoreUrl: null,
    ...overrides,
  }
}

const signal = (app: AppStoreApp, key: string) =>
  scoreListing(app, NOW).signals.find((s) => s.key === key)!

describe('scoreListing', () => {
  it('scores a well-built listing in the strong band', () => {
    const { total, signals } = scoreListing(listing(), NOW)
    expect(total).toBeGreaterThanOrEqual(85)
    expect(asoBand(total)).toBe('strong')
    expect(signals).toHaveLength(6)
  })

  it('leaves an empty listing with almost nothing', () => {
    const empty = listing({
      name: 'App',
      description: null,
      iconUrl: null,
      screenshotUrls: [],
      averageRating: null,
      ratingCount: null,
      primaryGenre: null,
      genres: [],
      updatedInStoreAt: null,
    })
    // Not exactly zero: a three-letter name still spends part of the title budget.
    expect(scoreListing(empty, NOW).total).toBeLessThanOrEqual(2)
  })

  it('keeps the weights summing to 100', () => {
    const weights = scoreListing(listing(), NOW).signals.reduce((sum, s) => sum + s.weight, 0)
    expect(weights).toBe(100)
  })

  it('rewards keywords past the brand name', () => {
    const brandOnly = signal(listing({ name: 'Habitix' }), 'title')
    const descriptive = signal(listing({ name: 'Habit Tracker - Habitix' }), 'title')
    expect(descriptive.score).toBeGreaterThan(brandOnly.score)
  })

  it('penalises a title Apple would truncate', () => {
    const long = signal(
      listing({ name: 'Habit Tracker & Daily Routine Builder - Habitix' }),
      'title',
    )
    expect(long.score).toBeLessThan(1)
    expect(long.detail).toContain('cut off')
  })

  it('separates rating quality from rating volume', () => {
    const fewGreat = signal(listing({ averageRating: 5, ratingCount: 3 }), 'ratings')
    const manyGreat = signal(listing({ averageRating: 5, ratingCount: 50_000 }), 'ratings')
    const manyPoor = signal(listing({ averageRating: 3.2, ratingCount: 50_000 }), 'ratings')

    expect(manyGreat.score).toBeGreaterThan(fewGreat.score)
    expect(manyGreat.score).toBeGreaterThan(manyPoor.score)
  })

  it('gives no credit for ratings an app does not have', () => {
    const none = signal(listing({ averageRating: null, ratingCount: null }), 'ratings')
    expect(none.score).toBe(0)
    expect(none.detail).toBe('No ratings yet')
  })

  it('gives full marks to a release inside the last month', () => {
    expect(signal(listing({ updatedInStoreAt: daysAgo(29) }), 'freshness').score).toBe(1)
  })

  it('gives nothing to a listing abandoned for nine months', () => {
    expect(signal(listing({ updatedInStoreAt: daysAgo(300) }), 'freshness').score).toBe(0)
  })

  it('treats an unpublished release date as unknown, not recent', () => {
    const unknown = signal(listing({ updatedInStoreAt: null }), 'freshness')
    expect(unknown.score).toBe(0)
    expect(unknown.detail).toContain('No release date')
  })

  it('flags a gallery below the five that fill it', () => {
    const thin = signal(listing({ screenshotUrls: ['https://example.test/1.png'] }), 'screenshots')
    expect(thin.score).toBeLessThan(0.5)
    expect(thin.detail).toContain('under the 5')
  })

  it('credits a second category as a second browse surface', () => {
    const one = signal(listing({ genres: ['Productivity'] }), 'presentation')
    const two = signal(listing({ genres: ['Productivity', 'Lifestyle'] }), 'presentation')
    expect(two.score).toBeGreaterThan(one.score)
  })

  it('quotes the opening sentence a shopper actually sees', () => {
    const detail = signal(
      listing({ description: 'Track habits without the guilt. More text.' }),
      'description',
    ).detail
    expect(detail).toContain('Track habits without the guilt')
  })

  it('never returns a score outside 0–100', () => {
    for (const app of [listing(), listing({ ratingCount: 10_000_000, averageRating: 5 })]) {
      const { total } = scoreListing(app, NOW)
      expect(total).toBeGreaterThanOrEqual(0)
      expect(total).toBeLessThanOrEqual(100)
    }
  })
})

describe('asoBand', () => {
  it('bands a score by how much work it needs', () => {
    expect(asoBand(90)).toBe('strong')
    expect(asoBand(75)).toBe('strong')
    expect(asoBand(74)).toBe('fair')
    expect(asoBand(45)).toBe('fair')
    expect(asoBand(44)).toBe('weak')
    expect(asoBand(0)).toBe('weak')
  })
})
