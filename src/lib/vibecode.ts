import 'server-only'
import { z } from 'zod'

/**
 * "Can I vibecode it?" — a model's read on how hard an app would be to rebuild
 * with AI coding tools.
 *
 * The framing is rebuild *difficulty*, not replacement. Every app here belongs
 * to a founder who connected real revenue to prove it earns, and answering
 * "yes, AI kills this" beneath their verified MRR would punish them for the
 * transparency the site asks for. So the model is required to name what
 * protects the app as well as what is easy to copy, and the verdict speaks
 * about the software rather than the business.
 *
 * Nothing about revenue is sent to the model. Rebuild difficulty is a property
 * of what the app does, not of what it earns, and letting the figure into the
 * prompt would produce verdicts that track the number rather than the product.
 */

export const VERDICTS = ['yes', 'kinda', 'not_really'] as const
export type Verdict = (typeof VERDICTS)[number]

/** Bumped when the prompt changes, so stale rows can be found and re-run. */
export const PROMPT_VERSION = 2

export const DEFAULT_MODEL = 'gpt-4o-mini'

export const verdictLabel: Record<Verdict, string> = {
  yes: 'Yes',
  kinda: 'Kinda',
  not_really: 'Not really',
}

/** What each verdict is claiming, in the app page's own words. */
export const verdictBlurb: Record<Verdict, string> = {
  yes: 'The core is reproducible with AI coding tools',
  kinda: 'A rough version is reachable; the hard parts are not',
  not_really: 'The difficulty is not in the code',
}

export const verdictSchema = z.object({
  verdict: z.enum(VERDICTS),
  headline: z.string().min(8).max(90),
  reasoning: z.string().min(40).max(600),
  rebuildable: z.array(z.string().min(3).max(120)).min(1).max(4),
  moat: z.array(z.string().min(3).max(120)).min(1).max(4),
})

export type VibecodeDraft = z.infer<typeof verdictSchema>

export type VibecodeInput = {
  name: string
  tagline: string | null
  description: string | null
  category: string | null
  tech: string[]
  /** Platform facts that bear on difficulty — not revenue. */
  hasInAppPurchases: boolean | null
  releasedAt: string | null
}

export function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY)
}

const SYSTEM = `You assess how hard an iOS app would be to rebuild using AI coding assistants.

You are writing for a directory of indie iOS apps whose founders have connected
their real revenue to prove it. Your job is an honest engineering read, not a
prediction that anyone's business is doomed.

Rules:
- Judge the SOFTWARE, not the business. "Could a competent developer with AI
  tools reproduce the core experience?" is the question.
- Always name what is genuinely hard to copy: App Store ranking and reviews,
  years of user data, licensed content, hardware or HealthKit integrations,
  offline sync, ML models trained on proprietary data, brand and audience.
- Never mention revenue, pricing, or how much the app earns. You are not told it.
- Never tell the reader to build a clone, and never address the founder.
- Be specific to THIS app. Generic statements that would apply to any app are
  failures.
- Plain language. No marketing voice, no hedging filler, no em-dashes.

Verdicts:
- "yes": the core experience is mostly UI over standard APIs; a weekend build
  gets you something recognisable.
- "kinda": a demo is reachable, but the parts that make it good (sync, ML,
  content, polish) are real work.
- "not_really": the code is the easy part; the difficulty lives in data,
  licensing, hardware, regulation, or distribution.

The headline is a CLAIM ABOUT DIFFICULTY, not a description of the app. It must
say what is easy and what is not. Never restate what the app does.
  Good: "The widget is an afternoon; writing 5,000 affirmations is not"
  Good: "Trivial to draw, nearly impossible to license the recipes"
  Bad:  "Glow offers custom widgets and curated content"   (describes, claims nothing)
  Bad:  "This app would be moderately difficult to rebuild" (says nothing specific)

Each "moat" entry must be something a competitor CANNOT OBTAIN BY WRITING CODE:
a content library someone wrote, licensed material, App Store ranking and
reviews, years of user data, a hardware or platform integration, a trained
model, an existing audience. Features are not moats.
  Good: "Thousands of affirmations written and tested over years"
  Good: "Top-20 ranking in Health & Fitness search"
  Bad:  "User engagement and retention strategies"  (consultant-speak, not a thing)
  Bad:  "Custom themes and personalisation"          (that is just more code)

Each "rebuildable" entry names a concrete piece of the product, not a category
of work. "Push notification scheduling" is concrete. "The frontend" is not.`

export function buildPrompt(input: VibecodeInput) {
  const facts = [
    `Name: ${input.name}`,
    input.tagline && `Tagline: ${input.tagline}`,
    input.category && `App Store category: ${input.category}`,
    input.tech.length && `Known stack: ${input.tech.join(', ')}`,
    input.hasInAppPurchases !== null &&
      `In-app purchases: ${input.hasInAppPurchases ? 'yes' : 'no'}`,
    input.releasedAt && `First released: ${input.releasedAt}`,
    // The App Store description is marketing copy, so it is labelled as such —
    // otherwise the model treats promises about the product as facts.
    input.description &&
      `App Store description (marketing copy, treat claims with scepticism):\n${input.description.slice(0, 2000)}`,
  ].filter(Boolean)

  return `Assess this iOS app.\n\n${facts.join('\n')}`
}

const responseFormat = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'vibecode_verdict',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['verdict', 'headline', 'reasoning', 'rebuildable', 'moat'],
      properties: {
        verdict: { type: 'string', enum: [...VERDICTS] },
        headline: {
          type: 'string',
          description: 'One line, under 90 characters, specific to this app.',
        },
        reasoning: { type: 'string', description: 'Two or three sentences.' },
        rebuildable: {
          type: 'array',
          items: { type: 'string' },
          description: '1-4 short phrases naming what is straightforward to reproduce.',
        },
        moat: {
          type: 'array',
          items: { type: 'string' },
          description: '1-4 short phrases naming what is genuinely hard to copy.',
        },
      },
    },
  },
}

/**
 * Asks the model for one verdict.
 *
 * Throws rather than returning a fallback: a verdict that quietly degrades to
 * filler would be published beside someone's app as though a model had actually
 * considered it. A caller that cannot get an answer should store nothing.
 */
export async function draftVerdict(
  input: VibecodeInput,
  { model = DEFAULT_MODEL, signal }: { model?: string; signal?: AbortSignal } = {},
): Promise<VibecodeDraft> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set.')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      // Low but not zero: identical phrasing across every app on the site reads
      // as a template, which is exactly what this section must not look like.
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildPrompt(input) },
      ],
      response_format: responseFormat,
    }),
    signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`OpenAI returned ${response.status}: ${detail.slice(0, 300)}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned no content.')

  // Structured outputs make malformed JSON unlikely, not impossible — a refusal
  // or a truncated response still lands here.
  return verdictSchema.parse(JSON.parse(content))
}
