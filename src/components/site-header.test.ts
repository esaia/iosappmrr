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
 * The component is called directly and its returned element tree is walked. No
 * DOM, no renderer: the question is only whether a link to /admin is present,
 * and answering it structurally keeps the test indifferent to styling.
 */

const getCurrentUser = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser: () => getCurrentUser() }))
vi.mock('@/app/auth/actions', () => ({ signOutAction: async () => {} }))

const { SiteHeader } = await import('./site-header')

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

async function renderHeaderFor(user: unknown) {
  getCurrentUser.mockResolvedValue(user)
  return hrefsIn(await SiteHeader())
}

const profile = (role: 'admin' | 'founder') => ({
  id: 'u1',
  email: 'someone@example.com',
  profile: { handle: 'someone', role },
})

describe('SiteHeader admin link', () => {
  beforeEach(() => getCurrentUser.mockReset())

  it('shows it to an admin', async () => {
    expect(await renderHeaderFor(profile('admin'))).toContain('/admin')
  })

  it('hides it from a signed-in founder', async () => {
    const hrefs = await renderHeaderFor(profile('founder'))
    expect(hrefs).not.toContain('/admin')
    // Sanity: the header did render, so the assertion above means something.
    expect(hrefs).toContain('/dashboard')
  })

  it('hides it from a visitor who is not signed in', async () => {
    const hrefs = await renderHeaderFor(null)
    expect(hrefs).not.toContain('/admin')
    expect(hrefs).toContain('/login')
  })

  it('hides it from a role that does not exist yet', async () => {
    // A role added to the enum later must not inherit admin navigation by
    // being merely truthy — the check is an equality test, and this locks that.
    const hrefs = await renderHeaderFor(profile('moderator' as 'founder'))
    expect(hrefs).not.toContain('/admin')
  })
})
