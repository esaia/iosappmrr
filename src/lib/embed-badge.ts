import { site } from '@/lib/site'

/**
 * The badge a founder puts on their own site, and the two snippets that carry
 * it there.
 *
 * Separate from `share-image` on purpose. That file builds an image to post —
 * downloaded once, at whatever size a timeline gives it. This one builds an
 * embed: a fixed 300×56 block that has to sit in someone else's page for
 * months, load without JavaScript, and keep saying something true while the
 * figure behind it moves.
 *
 * Free of server imports, because the dialog that shows the snippets is a
 * client component and the routes that answer them are not.
 */

export const BADGE_THEMES = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
] as const

export type BadgeTheme = (typeof BADGE_THEMES)[number]['id']

export const BADGE_DEFAULT_THEME: BadgeTheme = 'dark'

/**
 * What the snippets claim, so a browser reserves the right box before the PNG
 * arrives — and what the PNG is actually drawn at.
 *
 * The scale is the whole reason the two differ: a 300px-wide image on a retina
 * display is drawn at 600 device pixels, and one rendered at 300 would be soft
 * exactly where a badge is read. It ships at 2× and is displayed at half.
 */
export const BADGE_SIZE = { width: 300, height: 56 }
export const BADGE_SCALE = 2

export function parseBadgeTheme(value: string | null): BadgeTheme {
  return BADGE_THEMES.some((theme) => theme.id === value)
    ? (value as BadgeTheme)
    : BADGE_DEFAULT_THEME
}

/** The PNG itself. Relative, so the dialog's preview does not cross origins. */
export function badgeImageUrl(slug: string, theme: BadgeTheme) {
  return `/api/badge/${slug}?theme=${theme}`
}

/** The same badge as a page, for the iframe snippet. */
export function badgeEmbedUrl(slug: string, theme: BadgeTheme) {
  return `/embed/${slug}?theme=${theme}`
}

/**
 * Where the badge points.
 *
 * `?ref=badge` is there to be counted, not to route: the app page names itself
 * canonical, so the parameter costs nothing in search and tells us which
 * arrivals came from someone else's footer.
 */
export function badgeTargetUrl(slug: string) {
  return `${site.url}/apps/${slug}?ref=badge`
}

/** What the badge says to a screen reader, and to a crawler reading alt text. */
function badgeAlt(name: string) {
  return `${name} — verified revenue on ${site.shortName}`
}

export const BADGE_SNIPPETS = [
  { id: 'html', label: 'Linked image' },
  { id: 'iframe', label: 'iframe' },
] as const

export type BadgeSnippet = (typeof BADGE_SNIPPETS)[number]['id']

/**
 * The two ways to paste the badge in.
 *
 * The linked image comes first and stays the default. An iframe's contents
 * belong to this origin, so the link inside it is ours and not theirs — a
 * crawler reading the founder's page sees an embedded document, not a link to
 * an app page. The `<a>` is the one that is worth anything to either of us.
 * The iframe is here because some hosts and site builders strip raw `<img>`
 * tags but allow embeds, and a badge that cannot be pasted is not a badge.
 */
export function badgeSnippets(slug: string, name: string, theme: BadgeTheme) {
  const { width, height } = BADGE_SIZE
  const alt = badgeAlt(name)

  /*
   * Short enough to read before pasting.
   *
   * What is gone was all belt-and-braces: `rel="noopener"` is implied by
   * `target="_blank"` in every current browser, and `frameborder` and
   * `scrolling` have been dead attributes for a decade — the embed document
   * hides its own overflow. What is left is the address, the size, and the
   * alt text that is the whole point of the linked-image version.
   *
   * The inline `style` stays. Plenty of sites ship `img { width: 100% }`, and
   * the width attribute loses to it; a badge stretched across a founder's page
   * is worse than four characters of snippet.
   */
  return {
    html:
      `<a href="${badgeTargetUrl(slug)}" target="_blank">\n` +
      `  <img src="${site.url}${badgeImageUrl(slug, theme)}" alt="${alt}"\n` +
      `       width="${width}" height="${height}" style="width:${width}px;height:${height}px">\n` +
      `</a>`,
    iframe:
      `<iframe src="${site.url}${badgeEmbedUrl(slug, theme)}" title="${alt}"\n` +
      `        width="${width}" height="${height}" style="border:0"></iframe>`,
  } satisfies Record<BadgeSnippet, string>
}

/**
 * The same badge, addressed to whatever agent builds the founder's site.
 *
 * Most founders will not open a footer template by hand any more — they will
 * paste this into Cursor, v0, Lovable or Claude and let it do the placement.
 * That paste is where a snippet gets helpfully "improved": the size rounded,
 * the alt text rewritten, the image rehosted, the URL stripped of its `ref`.
 * Saying plainly what must not change is the difference between a badge that
 * still links back in a month and one that is a dead `<img>` on someone's CDN.
 */
export function badgePrompt(slug: string, name: string, theme: BadgeTheme, snippet: BadgeSnippet) {
  const { width, height } = BADGE_SIZE

  return (
    `Add this verified-revenue badge to the footer of my site.\n\n` +
    `Paste the HTML exactly as it is — do not change the URLs, the size or the ` +
    `alt text, and do not rehost the image. It is served live from ` +
    `${site.shortName} and redraws itself whenever the figure changes.\n\n` +
    `${badgeSnippets(slug, name, theme)[snippet]}\n\n` +
    `Put it near the copyright line with room to breathe around it. It is ` +
    `${width}×${height}, needs no JavaScript and no extra CSS, and links to ` +
    `${name}'s listing on ${site.name}, where the revenue is verified.`
  )
}

/** The document the iframe snippet loads: the badge, and nothing else. */
export function badgeEmbedDocument(slug: string, name: string, theme: BadgeTheme) {
  const { width, height } = BADGE_SIZE

  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<title>${escapeHtml(badgeAlt(name))}</title>` +
    `<meta name="robots" content="noindex">` +
    `<style>html,body{margin:0;padding:0;overflow:hidden}` +
    `a{display:block;width:${width}px;height:${height}px}` +
    `img{display:block;width:100%;height:100%}</style></head>` +
    `<body>` +
    // `_blank` rather than `_top`: the badge sits in someone else's page, and
    // replacing the page they are reading is not what clicking a badge means.
    `<a href="${badgeTargetUrl(slug)}" target="_blank" rel="noopener">` +
    `<img src="${badgeImageUrl(slug, theme)}" alt="${escapeHtml(badgeAlt(name))}" ` +
    `width="${width}" height="${height}">` +
    `</a></body></html>`
  )
}

/**
 * An app name reaches this document from the database, and lands inside markup
 * we are writing by hand. Nothing else here is variable.
 */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
