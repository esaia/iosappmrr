import { describe, expect, it } from 'vitest'
import { monthlyAmountCents } from './stripe'

describe('monthlyAmountCents', () => {
  it('passes a monthly price through unchanged', () => {
    expect(monthlyAmountCents(999, 1, 'month', 1)).toBe(999)
  })

  it('divides an annual price across twelve months', () => {
    expect(monthlyAmountCents(11_988, 1, 'year', 1)).toBe(999)
  })

  it('spreads a quarterly price across three months', () => {
    expect(monthlyAmountCents(2997, 1, 'month', 3)).toBe(999)
  })

  it('scales a weekly price up to a month', () => {
    expect(monthlyAmountCents(299, 1, 'week', 1)).toBe(1296)
  })

  it('multiplies by quantity', () => {
    expect(monthlyAmountCents(999, 5, 'month', 1)).toBe(4995)
  })
})
