'use client'

import { useEffect, useRef } from 'react'

/**
 * Keeps a checkbox's DOM state in step with React's across a form action.
 *
 * React resets the form once its action resolves — the same reset the comments
 * around these forms mention for text fields. A controlled checkbox survives it
 * in React's state but not in the DOM: the reset clears the box, React sees no
 * state change, and nothing re-renders to put the tick back. The result is a
 * box that reads unchecked over a setting that was saved as on, which is worse
 * than either being wrong on its own.
 *
 * The effect deliberately has no dependency array. It has to run after every
 * render, because the render that follows the action is the only chance to
 * correct a DOM the reset changed behind React's back.
 */
export function useCheckedSync(checked: boolean) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current && ref.current.checked !== checked) ref.current.checked = checked
  })

  return ref
}
