# Fonts

Static cuts of [Geist and Geist Mono][1], the interface typefaces, vendored here
for one reason: the Open Graph card, share card and badge routes in
`src/lib/og/` render with Satori, which needs the fonts as bytes at request
time.

Both families, because the site uses both — Geist for words, Geist Mono for
figures — and a card that set an app's name in the mono would stop looking like
the page it is advertising. Regular and bold of each; nothing here needs a
weight the cards do not draw.

They live in `public/` rather than beside the renderer because `public/` is the
one directory guaranteed to ship whole — reading them from anywhere else in
`src/` would need an output-tracing hint to survive a deployment.

`.ttf`: Satori reads ttf, otf, and woff, but not woff2.

This is not how the site itself loads its type. Every page gets both families
through `next/font/google` in the root layout, which serves subsetted variable
woff2 files. Nothing here is requested by a browser.

Licensed under the SIL Open Font License 1.1 — see `OFL.txt`, which the licence
requires be distributed with the files. One copy covers both families; they are
released together under the same notice.

[1]: https://github.com/vercel/geist-font
