import { describe, expect, it } from 'vitest'
import {
  SHARE_COLORS,
  SHARE_DEFAULTS,
  colorHex,
  parseShareOptions,
  shareImageUrl,
} from './share-image'

/**
 * The share image is rendered from a public URL, and its colour ends up inside
 * an SVG string. These tests lock the rule that makes that safe: the query
 * names an option, never a value, and anything unrecognised becomes the
 * default rather than being passed through.
 */
describe('parseShareOptions', () => {
  const parse = (query: string) => parseShareOptions(new URLSearchParams(query))

  it('reads a full set of known ids', () => {
    expect(parse('variant=badge&theme=light&period=7d&color=rose')).toEqual({
      variant: 'badge',
      theme: 'light',
      period: '7d',
      color: 'rose',
    })
  })

  it('falls back for anything it does not recognise', () => {
    expect(parse('')).toEqual(SHARE_DEFAULTS)
    expect(parse('theme=neon&period=decade&variant=poster')).toEqual(SHARE_DEFAULTS)
  })

  it('never lets a colour through as a literal value', () => {
    // The whole point of the id table: a hex in the URL is not a colour.
    const options = parse('color=%23ff0000')
    expect(options.color).toBe(SHARE_DEFAULTS.color)
    expect(colorHex(options.color)).toBe('#0a84ff')
  })

  it('keeps every offered colour resolvable', () => {
    for (const color of SHARE_COLORS) {
      expect(colorHex(color.id)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('shareImageUrl', () => {
  it('round-trips through the parser', () => {
    const options = { variant: 'chart', theme: 'light', period: '12m', color: 'teal' } as const
    const query = shareImageUrl('my-app', options).split('?')[1]
    expect(parseShareOptions(new URLSearchParams(query))).toEqual(options)
  })

  it('leaves the period and the accent off a badge, which uses neither', () => {
    const url = shareImageUrl('my-app', { ...SHARE_DEFAULTS, variant: 'badge', color: 'rose' })
    expect(url).not.toContain('period')
    expect(url).not.toContain('color')
  })
})
