/**
 * The knobs on the share-image dialog, and the URL they build.
 *
 * Deliberately free of any server import: the dialog is a client component and
 * needs these lists, while the route that renders the PNG reads Node built-ins
 * for its fonts. Both sides import from here, so an option can never exist in
 * the picker without the renderer accepting it.
 *
 * Everything is an id rather than a value — a colour is `violet`, not
 * `#8b5cf6`. The renderer draws SVG, and a hex arriving from a query string is
 * a string being interpolated into markup. Looking it up in this table means
 * the worst a tampered URL can do is fail to match and fall back.
 */

export const SHARE_VARIANTS = [
  { id: 'chart', label: 'Revenue chart' },
  { id: 'badge', label: 'Badge' },
] as const

export type ShareVariant = (typeof SHARE_VARIANTS)[number]['id']

export const SHARE_THEMES = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
] as const

export type ShareTheme = (typeof SHARE_THEMES)[number]['id']

/**
 * Windows the chart can cover. Anything longer than a year is not offered
 * because the history table is read a year at a time.
 */
export const SHARE_PERIODS = [
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '12m', label: '12 months', days: 365 },
] as const

export type SharePeriod = (typeof SHARE_PERIODS)[number]['id']

/** The site's own blue leads, because it is what the card looks like unchanged. */
export const SHARE_COLORS = [
  { id: 'blue', label: 'IosAppMRR blue', hex: '#0a84ff' },
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { id: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { id: 'sky', label: 'Sky', hex: '#0ea5e9' },
  { id: 'cyan', label: 'Cyan', hex: '#22b8cf' },
  { id: 'teal', label: 'Teal', hex: '#14b8a6' },
  { id: 'emerald', label: 'Emerald', hex: '#2fb872' },
  { id: 'lime', label: 'Lime', hex: '#84cc16' },
  { id: 'amber', label: 'Amber', hex: '#f0a92e' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
  { id: 'pink', label: 'Pink', hex: '#ec4899' },
] as const

export type ShareColor = (typeof SHARE_COLORS)[number]['id']

export type ShareOptions = {
  variant: ShareVariant
  theme: ShareTheme
  period: SharePeriod
  color: ShareColor
}

export const SHARE_DEFAULTS: ShareOptions = {
  variant: 'chart',
  theme: 'dark',
  period: '30d',
  color: 'blue',
}

/** Narrows a query-string value to a known id, or falls back to the default. */
function pick<T extends string>(options: readonly { id: T }[], value: string | null, fallback: T) {
  return options.some((option) => option.id === value) ? (value as T) : fallback
}

export function parseShareOptions(params: URLSearchParams): ShareOptions {
  return {
    variant: pick(SHARE_VARIANTS, params.get('variant'), SHARE_DEFAULTS.variant),
    theme: pick(SHARE_THEMES, params.get('theme'), SHARE_DEFAULTS.theme),
    period: pick(SHARE_PERIODS, params.get('period'), SHARE_DEFAULTS.period),
    color: pick(SHARE_COLORS, params.get('color'), SHARE_DEFAULTS.color),
  }
}

export function periodDays(period: SharePeriod) {
  return SHARE_PERIODS.find((option) => option.id === period)!.days
}

export function colorHex(color: ShareColor) {
  return SHARE_COLORS.find((option) => option.id === color)!.hex
}

export function shareImageUrl(slug: string, options: ShareOptions) {
  const params = new URLSearchParams({ variant: options.variant, theme: options.theme })
  /*
   * A badge carries neither a series nor an accent — its mark is always the site
   * blue — so either one in its URL would be a second address for identical
   * bytes, and a second cache entry to fill.
   */
  if (options.variant === 'chart') {
    params.set('period', options.period)
    params.set('color', options.color)
  }
  return `/api/share/${slug}?${params}`
}

export function shareImageFilename(slug: string, options: ShareOptions) {
  const parts = [slug, options.variant, options.variant === 'chart' ? options.period : null]
  return `${parts.filter(Boolean).join('-')}.png`
}
