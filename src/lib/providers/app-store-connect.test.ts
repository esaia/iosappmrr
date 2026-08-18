import { describe, expect, it } from 'vitest'
import { parseSubscriptionReport } from './app-store-connect'

/** Column names and layout follow Apple's SUBSCRIPTION report, version 1_4. */
function report(rows: string[][]) {
  const header = [
    'App Name',
    'Standard Subscription Duration',
    'Customer Price',
    'Customer Currency',
    'Active Standard Price Subscriptions',
    'Active Free Trial Introductory Offer Subscriptions',
  ]
  return [header, ...rows].map((r) => r.join('\t')).join('\n')
}

describe('parseSubscriptionReport', () => {
  it('sums monthly subscriptions at face value', () => {
    const tsv = report([['Focus', '1 Month', '9.99', 'USD', '100', '0']])
    expect(parseSubscriptionReport(tsv)).toEqual({
      mrrCents: 99_900,
      activeSubscriptions: 100,
      currency: 'USD',
    })
  })

  it('normalises annual subscriptions to a monthly figure', () => {
    const tsv = report([['Focus', '1 Year', '59.99', 'USD', '12', '0']])
    // 12 seats x $59.99 / 12 months = $59.99
    expect(parseSubscriptionReport(tsv).mrrCents).toBe(5_999)
  })

  it('normalises weekly subscriptions upward', () => {
    const tsv = report([['Focus', '1 Week', '2.99', 'USD', '10', '0']])
    // 10 x $2.99 x 52/12 = $129.57
    expect(parseSubscriptionReport(tsv).mrrCents).toBe(12_957)
  })

  it('adds up mixed terms across territories', () => {
    const tsv = report([
      ['Focus', '1 Month', '9.99', 'USD', '50', '0'],
      ['Focus', '1 Year', '59.99', 'USD', '24', '0'],
      ['Focus', '6 Months', '34.99', 'USD', '6', '0'],
    ])
    const result = parseSubscriptionReport(tsv)
    // 49950 + round(5999*24/12=11998) + round(3499*6/6=3499)
    expect(result.mrrCents).toBe(49_950 + 11_998 + 3_499)
    expect(result.activeSubscriptions).toBe(80)
  })

  it('counts free trials as seats but not as revenue', () => {
    const tsv = report([['Focus', '1 Month', '9.99', 'USD', '10', '40']])
    const result = parseSubscriptionReport(tsv)
    expect(result.mrrCents).toBe(9_990)
    expect(result.activeSubscriptions).toBe(50)
  })

  it('ignores rows with no active seats', () => {
    const tsv = report([['Focus', '1 Month', '9.99', 'USD', '0', '0']])
    expect(parseSubscriptionReport(tsv).mrrCents).toBe(0)
  })

  it('handles an empty report', () => {
    expect(parseSubscriptionReport('')).toEqual({
      mrrCents: 0,
      activeSubscriptions: 0,
      currency: 'USD',
    })
  })

  it('reads the reported currency', () => {
    const tsv = report([['Focus', '1 Month', '9.99', 'EUR', '10', '0']])
    expect(parseSubscriptionReport(tsv).currency).toBe('EUR')
  })
})
