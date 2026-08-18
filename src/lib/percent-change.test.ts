import { describe, expect, it } from 'vitest'
import { percentChange } from './utils'

describe('percentChange', () => {
  it('reports growth', () => {
    expect(percentChange(100_000, 125_000)).toBeCloseTo(25)
  })

  it('reports decline', () => {
    expect(percentChange(100_000, 80_000)).toBeCloseTo(-20)
  })

  it('has no answer without a baseline', () => {
    expect(percentChange(null, 50_000)).toBeNull()
  })

  it('refuses to divide by a zero baseline', () => {
    expect(percentChange(0, 50_000)).toBeNull()
  })

  it('accepts a numeric string, as Postgres returns bigints', () => {
    expect(percentChange('200000', 300_000)).toBeCloseTo(50)
  })
})
