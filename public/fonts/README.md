# Fonts

Two static cuts of [JetBrains Mono][1], the interface typeface, vendored here
for one reason: the Open Graph card routes in `src/lib/og/card.tsx` render with
Satori, which needs the font as bytes at request time.

They live in `public/` rather than beside the renderer because `public/` is the
one directory guaranteed to ship whole — reading them from anywhere else in
`src/` would need an output-tracing hint to survive a deployment.

`.woff`, not `.woff2`: Satori reads ttf, otf, and woff only.

This is not how the site itself loads its type. Every page gets JetBrains Mono
through `next/font/google` in the root layout, which serves a subsetted woff2.
Nothing here is requested by a browser.

Licensed under the SIL Open Font License 1.1 — see `OFL.txt`, which the licence
requires be distributed with the files.

[1]: https://github.com/JetBrains/JetBrainsMono
