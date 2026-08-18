import { describe, expect, it } from 'vitest'
import { parseAppStoreId } from './lookup'

describe('parseAppStoreId', () => {
  it('reads a standard App Store URL', () => {
    expect(parseAppStoreId('https://apps.apple.com/us/app/things-3/id904237743')).toBe('904237743')
  })

  it('ignores query parameters and locale', () => {
    expect(parseAppStoreId('https://apps.apple.com/de/app/bear/id1016366447?mt=8&uo=4')).toBe(
      '1016366447',
    )
  })

  it('reads a bare numeric id', () => {
    expect(parseAppStoreId('904237743')).toBe('904237743')
  })

  it('reads an older itunes.apple.com link', () => {
    expect(parseAppStoreId('https://itunes.apple.com/app/viewSoftware?id=904237743')).toBe(
      '904237743',
    )
  })

  it('trims surrounding whitespace', () => {
    expect(parseAppStoreId('  https://apps.apple.com/app/id904237743  ')).toBe('904237743')
  })

  it('rejects anything without an id', () => {
    expect(parseAppStoreId('https://example.com/my-app')).toBeNull()
    expect(parseAppStoreId('')).toBeNull()
    expect(parseAppStoreId('not an app')).toBeNull()
  })
})
