'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Download, Loader2, Share2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { site } from '@/lib/site'
import {
  BADGE_SIZE,
  BADGE_SNIPPETS,
  badgeImageUrl,
  badgePrompt,
  badgeSnippets,
  type BadgeSnippet,
  type BadgeTheme,
} from '@/lib/embed-badge'
import {
  SHARE_COLORS,
  SHARE_DEFAULTS,
  SHARE_PERIODS,
  SHARE_THEMES,
  SHARE_VARIANTS,
  shareImageFilename,
  shareImageUrl,
  type ShareOptions,
} from '@/lib/share-image'
import { cn } from '@/lib/utils'

/** lucide dropped brand marks, so the X logo lives here. */
function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  )
}

/**
 * Builds the image a founder posts, and hands it over as a file.
 *
 * Every control here changes one query parameter on a server-rendered PNG, and
 * the preview is that PNG at a quarter size — so what is downloaded is exactly
 * what was on screen, rather than a browser's best effort at screenshotting a
 * div. The download itself goes through `fetch` and a blob so the file lands
 * with a sensible name instead of `route.png`.
 */
export function ShareImageDialog({
  slug,
  url,
  name,
  mrr,
  onClose,
  /** False when the app has one day of history or less: a line needs two points. */
  hasHistory,
}: {
  slug: string
  url: string
  name: string
  /** Formatted, e.g. "$1,240". Absent while an app has no figure yet. */
  mrr?: string
  onClose: () => void
  hasHistory: boolean
}) {
  const [options, setOptions] = useState<ShareOptions>({
    ...SHARE_DEFAULTS,
    variant: hasHistory ? 'chart' : 'badge',
  })
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  /** What the <img> is pointed at, and what has finished painting there. */
  const [previewUrl, setPreviewUrl] = useState(() => shareImageUrl(slug, options))
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Stop the page scrolling behind the dialog.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  const imageUrl = shareImageUrl(slug, options)
  const postText = mrr ? `${name} does ${mrr}/mo in verified revenue` : `${name} on ${site.name}`
  const postUrl = `https://x.com/intent/post?text=${encodeURIComponent(postText)}&url=${encodeURIComponent(url)}`

  /*
   * The preview lags the controls by a beat.
   *
   * Every option is a different URL, and each first request renders a PNG on
   * the server. Clicking along the twelve swatches asked for twelve of them,
   * eleven of which nobody looked at for longer than it took to click again.
   * Waiting for the picking to stop means one render per decision instead.
   */
  useEffect(() => {
    if (imageUrl === previewUrl) return
    const timer = setTimeout(() => setPreviewUrl(imageUrl), 250)
    return () => clearTimeout(timer)
  }, [imageUrl, previewUrl])

  /** True from the first click until the image for the current options paints. */
  const loading = loadedUrl !== imageUrl

  function set<K extends keyof ShareOptions>(key: K, value: ShareOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard is blocked in some contexts; the field is selectable by hand.
    }
  }

  async function download() {
    setDownloading(true)
    setError(null)
    try {
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error(String(response.status))
      const blob = await response.blob()
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = shareImageFilename(slug, options)
      anchor.click()
      // Freed on the next tick: revoking synchronously can beat the download.
      setTimeout(() => URL.revokeObjectURL(href), 1000)
    } catch {
      setError('The image could not be generated. Try again in a moment.')
    } finally {
      setDownloading(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:p-8"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-image-title"
        className="glass border-border relative my-auto w-full max-w-3xl rounded-[14px] border p-6 sm:p-7"
      >
        <button
          ref={closeRef}
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="text-muted hover:text-fg absolute top-5 right-5 transition-colors"
        >
          <X className="size-5" />
        </button>

        <h2 id="share-image-title" className="display pr-8 text-xl font-semibold">
          Share verified revenue
        </h2>

        <label className="label mt-6 block" htmlFor="share-link">
          App link
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="share-link"
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className="border-border bg-surface-2 text-muted rounded-card min-w-0 flex-1 border px-3 py-2 text-[13px]"
          />
          <Button type="button" variant="secondary" onClick={copyLink}>
            {copied ? (
              <Check className="size-3.5 text-[var(--green)]" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        {/* The rhythm through the controls: 16px between one labelled group and
            the next, 8px between a label and the control it names. The gaps used
            to be 24 and 20, which read as more distance than there is — the rule
            above already separates this block from the link. */}
        <div className="border-border mt-5 space-y-4 border-t pt-4">
          <Choice
            label="Image"
            options={SHARE_VARIANTS.map((variant) => ({
              ...variant,
              // A chart of one point is a dot. The card falls back to the badge
              // anyway, so the tab says so rather than offering a dead option.
              disabled: variant.id === 'chart' && !hasHistory,
              title:
                variant.id === 'chart' && !hasHistory ? 'Needs two days of history' : undefined,
            }))}
            value={options.variant}
            onChange={(value) => set('variant', value)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Choice
              label="Theme"
              options={SHARE_THEMES}
              value={options.theme}
              onChange={(value) => set('theme', value)}
            />
            {options.variant === 'chart' && (
              <Choice
                label="Period"
                options={SHARE_PERIODS}
                value={options.period}
                onChange={(value) => set('period', value)}
              />
            )}
          </div>

          {/* The badge's only coloured element is the mark, and that is fixed to
              the site blue — so there is nothing here for a swatch to change. */}
          {options.variant === 'chart' && (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="label">Accent</span>
                <span className="text-muted text-[11px]">
                  {SHARE_COLORS.find((color) => color.id === options.color)!.label}
                </span>
              </div>
              <div
                className={cn(
                  'border-border bg-surface-2 rounded-card mt-2 grid gap-2 border p-2.5',
                  // A grid rather than a flex row: the swatches spread across the
                  // full width instead of bunching at the left, and when the
                  // dialog is too narrow for twelve they wrap into two even rows
                  // rather than one long one and a short remainder.
                  'grid-cols-6 justify-items-center sm:grid-cols-12',
                )}
              >
                {SHARE_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    aria-label={color.label}
                    aria-pressed={color.id === options.color}
                    onClick={() => set('color', color.id)}
                    style={{ background: color.hex }}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full transition-transform',
                      color.id === options.color
                        ? 'ring-fg/70 scale-110 ring-2 ring-offset-2 ring-offset-[var(--bg)]'
                        : 'hover:scale-110',
                    )}
                  >
                    {color.id === options.color && <Check className="size-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* The preview is deliberately smaller than the panel it sits in: it is
            there to show which image is about to be downloaded, not to be read
            off the screen — and a full-width chart pushed the controls above it
            out of view on a laptop. */}
        <div className="border-border bg-surface-2 rounded-card relative mt-5 flex min-h-[140px] items-center justify-center overflow-hidden border p-4">
          {loading && <Loader2 className="text-muted absolute z-10 size-5 animate-spin" />}
          {/* A plain img: this is a generated PNG at an unknown aspect ratio,
              and next/image would want a width and height it cannot know.

              No `key`, deliberately. Remounting the element blanked the panel
              between every choice; pointing the same element at a new URL leaves
              the last image on screen, dimmed, until the new one has decoded. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Preview of the image that will be downloaded"
            className={cn(
              'w-full max-w-sm rounded-[6px] transition-opacity duration-200',
              loading ? 'opacity-40' : 'opacity-100',
            )}
            onLoad={() => setLoadedUrl(previewUrl)}
            onError={() => {
              setLoadedUrl(previewUrl)
              setError('The image could not be generated. Try again in a moment.')
            }}
          />
        </div>

        {error && (
          <p role="alert" className="text-red mt-3 text-[13px]">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-dim text-[11px]">PNG, ready to post.</p>
          <div className="flex items-center gap-2">
            {/* X cannot be handed an image through an intent URL — the file has
                to be attached in the composer. So this posts the link and the
                figure, and the image is the download beside it. */}
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="glass border-border text-fg hover:border-border-strong rounded-card inline-flex h-10 items-center justify-center gap-2 border px-4.5 text-[13px] font-medium transition-colors hover:bg-white/10"
            >
              <XMark />
              Post on X
            </a>
            <Button type="button" onClick={download} disabled={downloading}>
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download image
            </Button>
          </div>
        </div>

        <EmbedSection slug={slug} name={name} theme={options.theme} />
      </div>
    </div>,
    document.body,
  )
}

/** What each snippet is for, said plainly enough to choose between them. */
const SNIPPET_NOTES: Record<BadgeSnippet, string> = {
  html: 'A link and an image. Works anywhere HTML is allowed, and search engines follow it back to your listing.',
  iframe:
    'For site builders that strip image tags. Nothing inside an iframe counts as a link from your page.',
}

/**
 * The badge a founder puts in their own footer.
 *
 * Downloading an image is a one-off — it says what the revenue was on the day
 * it was saved. This is the other half of the dialog: an address rather than a
 * file, pasted once and re-rendered from the live figure every time someone
 * loads the page it sits in.
 *
 * The linked image leads because it is the one that is worth anything to
 * either side. An iframe's contents belong to this origin, so the link inside
 * it is ours; a crawler reading the founder's page sees an embedded document
 * and no link at all. The iframe is offered second, and the note says so.
 */
function EmbedSection({ slug, name, theme }: { slug: string; name: string; theme: BadgeTheme }) {
  const [snippet, setSnippet] = useState<BadgeSnippet>('html')
  /** Which button was last pressed, so only that one says "Copied". */
  const [copied, setCopied] = useState<'code' | 'prompt' | null>(null)
  const code = badgeSnippets(slug, name, theme)[snippet]

  async function copy(what: 'code' | 'prompt') {
    try {
      await navigator.clipboard.writeText(
        what === 'code' ? code : badgePrompt(slug, name, theme, snippet),
      )
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Clipboard is blocked in some contexts; the field is selectable by hand.
    }
  }

  return (
    <div className="border-border mt-6 border-t pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="label">Embed on your site</h3>
        <span className="text-dim text-[11px]">Follows the theme above.</span>
      </div>
      <p className="text-muted mt-2 text-[13px]">
        Paste it once. The figure re-renders from the live number every time the page loads.
      </p>

      {/* The real badge at its real size, from the same URL the snippet carries
          — a founder should be looking at the thing they are about to paste,
          not a drawing of it. */}
      <div className="border-border bg-surface-2 rounded-card mt-3 flex justify-center border p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={badgeImageUrl(slug, theme)}
          alt={`${name} — verified revenue on ${site.shortName}`}
          width={BADGE_SIZE.width}
          height={BADGE_SIZE.height}
          style={{ width: BADGE_SIZE.width, height: BADGE_SIZE.height }}
        />
      </div>

      <div className="mt-4">
        <Choice label="Snippet" options={BADGE_SNIPPETS} value={snippet} onChange={setSnippet} />
      </div>

      <textarea
        readOnly
        rows={snippet === 'html' ? 5 : 3}
        value={code}
        aria-label="Embed code"
        onFocus={(event) => event.currentTarget.select()}
        className="border-border bg-surface-2 text-muted rounded-card mt-2 w-full resize-none border p-3 font-mono text-[12px] leading-relaxed"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-dim max-w-xs text-[11px]">{SNIPPET_NOTES[snippet]}</p>
        <div className="flex items-center gap-2">
          {/* Hardly anyone edits a footer template by hand any more. This is the
              same badge wrapped in instructions for whatever is building the
              site — paste it into Cursor or Claude and the placement is done. */}
          <Button type="button" variant="ghost" onClick={() => copy('prompt')}>
            {copied === 'prompt' ? (
              <Check className="size-3.5 text-[var(--green)]" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {copied === 'prompt' ? 'Copied' : 'Copy prompt'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => copy('code')}>
            {copied === 'code' ? (
              <Check className="size-3.5 text-[var(--green)]" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied === 'code' ? 'Copied' : 'Copy code'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** A segmented control. Every picker in this dialog is one of these. */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { id: T; label: string; disabled?: boolean; title?: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="border-border bg-surface-2 rounded-card mt-2 flex gap-1 border p-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={option.disabled}
            title={option.title}
            aria-pressed={option.id === value}
            onClick={() => onChange(option.id)}
            className={cn(
              'flex-1 rounded-[7px] px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              option.id === value
                ? 'bg-surface-3 text-fg'
                : 'text-muted hover:text-fg disabled:hover:text-muted',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The app page's one share control.
 *
 * There is no native share-sheet handoff and no dropdown any more: both used to
 * sit beside this and offered a subset of what the dialog does. Copying the
 * link, posting to X and building the image are the same task at different
 * lengths, so they belong behind one button rather than three.
 */
export function ShareButton({
  slug,
  url,
  name,
  mrr,
  hasHistory,
}: {
  slug: string
  url: string
  name: string
  mrr?: string
  hasHistory: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border text-muted hover:border-border-strong hover:text-fg inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors"
      >
        <Share2 className="size-3.5" />
        Share
      </button>

      {open && (
        <ShareImageDialog
          slug={slug}
          url={url}
          name={name}
          mrr={mrr}
          hasHistory={hasHistory}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
