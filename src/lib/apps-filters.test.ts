import { describe, expect, it } from 'vitest'
import { appsHref, decodeAppsKey, encodeAppsKey, normalizeAppsFilters } from './apps-filters'

const keyOf = (query: string) => encodeAppsKey(normalizeAppsFilters(new URLSearchParams(query)))

describe('apps filters', () => {
  it('sends defaults and noise to the bare list', () => {
    expect(keyOf('')).toBeNull()
    expect(keyOf('sort=mrr&page=1')).toBeNull()
    expect(keyOf('utm_source=x&sort=bogus&category=Not%20A%20Slug')).toBeNull()
  })

  it('gives the same view the same key whatever the parameter order', () => {
    expect(keyOf('tech=swift&sort=growth')).toBe(keyOf('sort=growth&tech=swift&ref=hn'))
  })

  it('round-trips searches with characters that mean something in a path', () => {
    const key = keyOf('q=%20a%2Fb%26c%25d%3F%20ünï%20&page=3')!
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeAppsKey(key)).toEqual({ q: 'a/b&c%d? ünï', page: 3 })
  })

  it('refuses keys it would not have produced', () => {
    expect(decodeAppsKey('not base64!')).toBeNull()
    // "sort=mrr" encodes to a key, but normalises to the bare list.
    expect(decodeAppsKey(btoa('sort=mrr'))).toBeNull()
    expect(decodeAppsKey(btoa('page=2&sort=growth'))).toBeNull()
  })

  it('links in canonical form', () => {
    expect(appsHref({})).toBe('/apps')
    expect(appsHref({ page: 2, sort: 'newest' })).toBe('/apps?sort=newest&page=2')
  })
})
