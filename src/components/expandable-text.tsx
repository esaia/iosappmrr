'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Clamps long copy and offers to expand it.
 *
 * The toggle only appears when the text is actually taller than the clamp —
 * measured after layout rather than guessed from character count, because line
 * count depends on the font and the container width, not on how many characters
 * there are.
 */
export function ExpandableText({ text, lines = 8 }: { text: string; lines?: number }) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const measure = () => {
      // Compare full content height against the clamped box.
      setOverflows(element.scrollHeight > element.clientHeight + 1)
    }

    measure()
    // Re-measure on resize: a narrower column wraps to more lines.
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [text, lines, expanded])

  return (
    <div>
      <p
        ref={ref}
        className="text-muted leading-relaxed whitespace-pre-line"
        style={
          expanded
            ? undefined
            : {
                display: '-webkit-box',
                WebkitLineClamp: lines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
        }
      >
        {text}
      </p>

      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-blue mt-2 text-sm hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}
