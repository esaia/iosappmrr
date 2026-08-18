import { describe, expect, it } from 'vitest'
import { escapeLike } from './utils'

describe('escapeLike', () => {
  it('leaves ordinary search terms alone', () => {
    expect(escapeLike('habit tracker')).toBe('habit tracker')
  })

  it('escapes the wildcard that would otherwise match every row', () => {
    expect(escapeLike('%')).toBe('\\%')
  })

  it('escapes the single-character wildcard', () => {
    expect(escapeLike('a_b')).toBe('a\\_b')
  })

  it('escapes the escape character itself first', () => {
    expect(escapeLike('50\\%')).toBe('50\\\\\\%')
  })
})
