import { describe, expect, it } from 'vitest'
import { VERDICTS, buildPrompt, verdictBlurb, verdictLabel, verdictSchema } from './vibecode'

/*
 * The prompt is the whole product here: it decides what a model publishes on a
 * founder's page. These tests pin the two properties that matter — that a draft
 * has to be complete before it is stored, and that earnings never reach the
 * model.
 */
describe('verdictSchema', () => {
  const valid = {
    verdict: 'kinda' as const,
    headline: 'The timer is easy; the sound library is the work',
    reasoning:
      'A metronome is a scheduler and an audio buffer, both of which are standard iOS APIs. The listening feature depends on pitch detection tuned against real instruments, which is where the years went.',
    rebuildable: ['Tap tempo and visual beat'],
    moat: ['Pitch detection tuned on real recordings'],
  }

  it('accepts a complete draft', () => {
    expect(verdictSchema.parse(valid)).toEqual(valid)
  })

  it('rejects an unknown verdict', () => {
    expect(() => verdictSchema.parse({ ...valid, verdict: 'maybe' })).toThrow()
  })

  it('rejects an empty rebuildable list, which would render a headless column', () => {
    expect(() => verdictSchema.parse({ ...valid, rebuildable: [] })).toThrow()
  })

  it('rejects a headline too long for its single line', () => {
    expect(() => verdictSchema.parse({ ...valid, headline: 'x'.repeat(120) })).toThrow()
  })

  it('has a label and a blurb for every verdict', () => {
    for (const verdict of VERDICTS) {
      expect(verdictLabel[verdict]).toBeTruthy()
      expect(verdictBlurb[verdict]).toBeTruthy()
    }
  })
})

describe('buildPrompt', () => {
  const input = {
    name: 'Ledgerly',
    tagline: 'Bookkeeping that finishes itself',
    description: 'Automatic bookkeeping for freelancers.',
    category: 'Finance',
    tech: ['Swift', 'RevenueCat'],
    hasInAppPurchases: true,
    releasedAt: '2024-02-01',
  }

  it('includes the facts the assessment needs', () => {
    const prompt = buildPrompt(input)
    expect(prompt).toContain('Ledgerly')
    expect(prompt).toContain('Finance')
    expect(prompt).toContain('Swift, RevenueCat')
  })

  it('labels the description as marketing copy rather than fact', () => {
    expect(buildPrompt(input)).toContain('marketing copy')
  })

  it('omits absent fields instead of writing null into the prompt', () => {
    const sparse = buildPrompt({
      ...input,
      tagline: null,
      category: null,
      tech: [],
      description: null,
      releasedAt: null,
    })
    expect(sparse).not.toContain('null')
    expect(sparse).not.toContain('Tagline:')
  })

  /*
   * Rebuild difficulty is a property of the product, not of its earnings. If a
   * revenue figure ever reaches the prompt, verdicts start tracking the number:
   * expensive apps get called defensible and small ones get called disposable,
   * which is precisely the judgement this section must not make.
   */
  it('never mentions revenue', () => {
    const prompt = buildPrompt(input).toLowerCase()
    // Word boundaries, not substrings: the stack legitimately contains
    // "RevenueCat", which is the provider's name and not an earnings figure.
    for (const term of [
      /\bmrr\b/,
      /\barr\b/,
      /\brevenue\b/,
      /\bearns\b/,
      /\bsubscribers\b/,
      /\$\d/,
    ]) {
      expect(prompt).not.toMatch(term)
    }
  })
})
