/**
 * A listing whose founder chose not to name the app.
 *
 * The person stays visible — they are the one whose provider key is being read,
 * and the verified figure means nothing if nobody stands behind it. What is
 * withheld is which app earned it: the name, the icon, the store link and the
 * screenshots, all of which identify it as surely as the name does.
 *
 * The placeholder is a real string rather than an empty one because it is what
 * gets rendered under the blur, and it is masked in the query rather than in a
 * component so the real name never reaches the browser at all.
 */
export const ANONYMOUS_NAME = 'Stealth Company'

/*
 * Stand-ins for the founder's own copy, which names the app as reliably as the
 * title does — "Daily Affirmations delivers…" gives the game away in the first
 * line. Generic on purpose: they are what sits under the blur, so they need the
 * shape of a tagline and a description and none of the content.
 */
export const ANONYMOUS_TAGLINE = 'A quiet listing from a founder building in stealth'

export const ANONYMOUS_DESCRIPTION =
  'The founder has kept this listing private for now, so the name, the artwork and the copy that would identify the app are withheld. Everything else on this page is real: the revenue below is read straight from the payment provider and verified daily, exactly as it is for every other app on the site.'

export const ANONYMOUS_NOTE = 'This app has chosen to remain anonymous'
