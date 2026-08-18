import { describe, expect, it } from 'vitest'
import { parseMetadata } from './polar'

/*
 * parseMetadata decides whether a webhook is allowed to grant a paid upgrade
 * and to which listing, so anything short of a complete, well-typed triple has
 * to be rejected. Polar types metadata values as string | number | boolean,
 * which means a malformed or partially-populated object is reachable.
 */
describe('parseMetadata', () => {
  const valid = { kind: 'dofollow', appId: 'app-1', profileId: 'user-1' }

  it('accepts a complete dofollow triple', () => {
    expect(parseMetadata(valid)).toEqual(valid)
  })

  it('accepts a complete sponsor triple', () => {
    const sponsor = { ...valid, kind: 'sponsor' }
    expect(parseMetadata(sponsor)).toEqual(sponsor)
  })

  it('rejects an unknown kind', () => {
    expect(parseMetadata({ ...valid, kind: 'free-stuff' })).toBeNull()
  })

  it('rejects a missing app id', () => {
    expect(parseMetadata({ kind: 'dofollow', profileId: 'user-1' })).toBeNull()
  })

  it('rejects a missing profile id', () => {
    expect(parseMetadata({ kind: 'dofollow', appId: 'app-1' })).toBeNull()
  })

  it('rejects a numeric app id rather than coercing it', () => {
    expect(parseMetadata({ ...valid, appId: 12345 })).toBeNull()
  })

  it('rejects empty and absent metadata', () => {
    expect(parseMetadata({})).toBeNull()
    expect(parseMetadata(null)).toBeNull()
    expect(parseMetadata(undefined)).toBeNull()
  })

  it('ignores extra keys rather than passing them through', () => {
    expect(parseMetadata({ ...valid, amountCents: 0 })).toEqual(valid)
  })
})
