'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Link2, Share2 } from 'lucide-react'

/** lucide dropped brand marks, so the X logo lives here. */
function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  )
}

/**
 * Share control for an app page.
 *
 * On a device with the native share sheet the button hands off to it directly —
 * that is what people expect on a phone. Everywhere else it opens a small menu,
 * because a desktop browser has nothing to hand off to.
 */
export function ShareButton({ url, title, mrr }: { url: string; title: string; mrr?: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [canShareNatively, setCanShareNatively] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Read on the client only: navigator.share does not exist during SSR, and
  // rendering the two variants differently would be a hydration mismatch.
  useEffect(() => {
    setCanShareNatively(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const text = mrr ? `${title} does ${mrr}/mo in verified revenue` : `${title} on TrustMRR iOS`
  const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setOpen(false)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard is blocked in some contexts; leave the menu open so the
      // reader can still select the link by hand.
    }
  }

  async function share() {
    if (canShareNatively) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch {
        // Cancelled, or the sheet refused — fall through to the menu.
      }
    }
    setOpen((value) => !value)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={share}
        aria-expanded={open}
        className="border-border text-muted hover:border-border-strong hover:text-fg inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors"
      >
        {copied ? (
          <Check className="size-3.5 text-[var(--green)]" />
        ) : (
          <Share2 className="size-3.5" />
        )}
        {copied ? 'Copied' : 'Share'}
      </button>

      {open && (
        <div className="glass-raised border-border absolute right-0 z-30 mt-1 w-[170px] overflow-hidden rounded-[14px] border py-1">
          <a
            href={xUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="text-muted hover:bg-surface-2 hover:text-fg flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
          >
            <XMark />
            Share on X
          </a>
          <button
            type="button"
            onClick={copy}
            className="text-muted hover:bg-surface-2 hover:text-fg flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors"
          >
            <Link2 className="size-3.5" />
            Copy link
          </button>
        </div>
      )}
    </div>
  )
}
