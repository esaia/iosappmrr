import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Money is stored in cents everywhere. These are the only two places it becomes
 * a string, so a figure looks the same on every surface of the site.
 */
export function formatMrr(cents: number, currency = 'USD') {
  const dollars = cents / 100
  const abs = Math.abs(dollars)

  const compact =
    abs >= 1_000_000
      ? `${trimZero(dollars / 1_000_000)}M`
      : abs >= 1_000
        ? `${trimZero(dollars / 1_000)}K`
        : Math.round(dollars).toString()

  return `${symbolFor(currency)}${compact}`
}

export function formatMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function trimZero(n: number) {
  const rounded = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10
  return rounded.toString()
}

function symbolFor(currency: string) {
  return { USD: '$', EUR: '€', GBP: '£' }[currency] ?? `${currency} `
}

export function formatCount(n: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n)
}

/** Signed percentage, e.g. "+12.4%". Returns null when there is no baseline. */
export function formatGrowth(pct: number | null | undefined) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null
  const rounded = Math.round(pct * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** "4m ago", "3h ago", "2d ago" — used wherever we show sync freshness. */
export function timeAgo(date: Date | string | null | undefined) {
  if (!date) return null
  const then = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 2_592_000) return `${Math.floor(seconds / 86_400)}d ago`
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Percent change against a baseline. Returns null when there is no baseline, or
 * when the baseline is zero — "up from nothing" is not a percentage.
 */
export function percentChange(from: string | number | null, to: number): number | null {
  if (from === null) return null
  const baseline = Number(from)
  if (!Number.isFinite(baseline) || baseline <= 0) return null
  return ((to - baseline) / baseline) * 100
}

/**
 * Escapes LIKE wildcards in user input. Without this a query of "%" matches
 * every row, turning the search box into a full-table scan on request.
 * Backslash is Postgres's default LIKE escape character.
 */
export function escapeLike(input: string) {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/**
 * Upgrades an X avatar to a usable resolution.
 *
 * X hands out the `_normal` variant in OAuth metadata, which is 48px and looks
 * soft at any real size. The same object is served at 400px by swapping the
 * suffix. Other hosts are returned untouched.
 */
export function highResAvatar(url: string | null | undefined) {
  if (!url) return url ?? null
  if (!url.includes('pbs.twimg.com')) return url
  return url.replace(/_(normal|bigger|mini)\.(jpg|jpeg|png|gif|webp)$/i, '_400x400.$2')
}
