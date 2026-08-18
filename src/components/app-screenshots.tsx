'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

/**
 * App Store screenshots, full width. Portrait phone captures are tall and thin,
 * so they scroll horizontally rather than shrinking to thumbnails — a screenshot
 * you cannot read is not worth the bytes.
 */
export function AppScreenshots({ urls, appName }: { urls: string[]; appName: string }) {
  const [zoomed, setZoomed] = useState<string | null>(null)

  if (urls.length === 0) return null

  return (
    <section className="border-border bg-surface mt-3 rounded-[10px] border p-5 sm:p-6">
      <div className="flex items-baseline gap-3">
        <h2 className="display text-xl font-semibold">Screenshots</h2>
        <span className="text-muted text-[11px]">From the App Store listing</span>
      </div>

      <div className="-mx-5 mt-4 flex gap-3 overflow-x-auto px-5 pb-2 sm:-mx-6 sm:px-6">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setZoomed(url)}
            className="border-border hover:border-border-strong shrink-0 overflow-hidden rounded-[10px] border transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${appName} screenshot ${i + 1}`}
              loading="lazy"
              className="h-[380px] w-auto"
            />
          </button>
        ))}
      </div>

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${appName} screenshot`}
          onClick={() => setZoomed(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
        >
          <button
            type="button"
            aria-label="Close"
            className="text-muted hover:text-fg absolute top-5 right-5"
            onClick={() => setZoomed(null)}
          >
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomed}
            alt={`${appName} screenshot, enlarged`}
            className="max-h-full w-auto rounded-xl"
          />
        </div>
      )}
    </section>
  )
}
