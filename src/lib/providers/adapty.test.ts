import { describe, expect, it } from 'vitest'
import { adaptyCredentials, chartValue } from './adapty'
import { ProviderError } from './types'

describe('chartValue', () => {
  it('reads a level from where the window ended', () => {
    expect(chartValue({ value: 14_000, value_from: 400, value_to: 500 }, 'level', 'MRR')).toBe(500)
  })

  it('falls back to the headline value when the chart is not a sum', () => {
    expect(chartValue({ value: 500, default_aggregation: 'last' }, 'level', 'MRR')).toBe(500)
  })

  it('refuses to read a summed chart as a level', () => {
    expect(() => chartValue({ value: 14_000, default_aggregation: 'sum' }, 'level', 'MRR')).toThrow(
      ProviderError,
    )
  })

  it('reads a total from the summed value', () => {
    expect(chartValue({ value: 14_000, value_to: 500 }, 'total', 'revenue')).toBe(14_000)
  })

  it('refuses an empty chart rather than reporting zero', () => {
    expect(() => chartValue({}, 'total', 'revenue')).toThrow(ProviderError)
  })
})

describe('adaptyCredentials', () => {
  it('accepts a secret key', () => {
    expect(adaptyCredentials.safeParse({ secretKey: 'secret_live_aB3dEf9hIj' }).success).toBe(true)
  })

  it('rejects the public SDK key', () => {
    expect(adaptyCredentials.safeParse({ secretKey: 'public_live_aB3dEf9hIj' }).success).toBe(false)
  })
})
