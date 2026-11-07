import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

/**
 * The Admin link must appear for admins and for nobody else.
 *
 * This is not the authorisation boundary — `/admin` and every action under it
 * check the role server-side, so a founder who typed the URL would get nowhere.
 * It is tested because the header is the one place the admin section is
 * *visible*, and a regression here would leak the existence of the section to
 * every signed-in founder while looking completely normal in review.
 *
 * The component is called directly, with the session it reads from the browser
 * stubbed, and its returned element tree is walked. No
 * DOM, no renderer: the question is only whether a link to /admin is present,
 * and answering it structurally keeps the test indifferent to styling.
 */

const useViewer = vi.fn()

vi.mock('@/lib/use-viewer', () => ({ useViewer: () => useViewer() }))

const { HeaderAccount } = await import('./header-account')

/** Every `href` anywhere in a rendered element tree. */
function hrefsIn(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) hrefsIn(child, found)
    return found
  }
  if (!node || typeof node !== 'object') return found

  const element = node as ReactElement<Record<string, unknown>>
  const props = element.props
  if (props && typeof props === 'object') {
    const href = (props as { href?: unknown }).href
    if (typeof href === 'string') found.push(href)
    hrefsIn((props as { children?: unknown }).children, found)
  }
  return found
}

// Both places the account corner is drawn: the header bar and the small-screen rail.
function renderHeaderFor(viewer: unknown) {
  useViewer.mockReturnValue(viewer)
  return [
    ...hrefsIn(HeaderAccount({ variant: 'bar' })),
    ...hrefsIn(HeaderAccount({ variant: 'rail' })),
  ]
}

const profile = (role: 'admin' | 'founder') => ({ handle: 'someone', role })

describe('HeaderAccount admin link', () => {
  beforeEach(() => useViewer.mockReset())

  it('shows it to an admin', () => {
    expect(renderHeaderFor(profile('admin'))).toContain('/admin')
  })

  it('hides it from a signed-in founder', () => {
    const hrefs = renderHeaderFor(profile('founder'))
    expect(hrefs).not.toContain('/admin')
    // Sanity: the header did render, so the assertion above means something.
    expect(hrefs).toContain('/dashboard')
  })

  it('hides it from a visitor who is not signed in', () => {
    const hrefs = renderHeaderFor(null)
    expect(hrefs).not.toContain('/admin')
    expect(hrefs).toContain('/login')
  })

  it('hides it from a role that does not exist yet', () => {
    // A role added to the enum later must not inherit admin navigation by
    // being merely truthy — the check is an equality test, and this locks that.
    const hrefs = renderHeaderFor(profile('moderator' as 'founder'))
    expect(hrefs).not.toContain('/admin')
  })
})

describe('HeaderAccount while the session is being read', () => {
  it('shows nothing rather than a Sign in that flips to a handle', () => {
    expect(renderHeaderFor(undefined)).toEqual([])
  })
})
