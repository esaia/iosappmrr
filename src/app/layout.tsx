import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SquircleDefs } from '@/components/squircle-defs'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { site } from '@/lib/site'
import './globals.css'

/**
 * Two faces from one family: words in the sans, figures in the mono.
 *
 * The site ran on a single monospace for everything, which gave it a terminal's
 * identity and cost it a paragraph's readability — an app's description is
 * prose, and prose set on a fixed pitch is slower to read at every length. The
 * split keeps what the mono was actually earning: money, counts, versions and
 * dates still land on a fixed pitch, so a column of figures is a column.
 *
 * Geist and Geist Mono are drawn on the same skeleton, so the two never read as
 * two typefaces sharing a page — which is the usual failure of a pairing.
 *
 * Both are loaded as variable fonts: one file each, every weight available, and
 * no more picking weights up front. The old face needed an 800 to make the MRR
 * column stand out, because a mono keeps its weights close together by design;
 * a grotesk separates 500 from 700 on its own.
 */
const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  /*
   * Every relative URL in every page's metadata — canonicals, og:image, the
   * manifest — is resolved against this. Set NEXT_PUBLIC_SITE_URL in production
   * or they all resolve against localhost and silently point nowhere.
   */
  metadataBase: new URL(site.url),
  title: {
    default: `${site.shortName} - ${site.tagline}`,
    template: `%s · ${site.shortName}`,
  },
  description: site.description,
  applicationName: site.shortName,
  /*
   * Deliberately no `alternates.canonical` here. Metadata is inherited, so a
   * canonical on the layout would make every page that does not set its own
   * claim to be the home page. Each page declares its own.
   */
  openGraph: {
    type: 'website',
    siteName: site.name,
    url: site.url,
    locale: 'en_US',
    title: `${site.shortName} - ${site.tagline}`,
    description: site.description,
    /*
     * A real screenshot, served from `public/`, rather than the card this used
     * to generate at request time.
     *
     * It is inherited, so it covers every route that does not draw a card of
     * its own — the home page, the leaderboard, the FAQ, the legal pages. App,
     * founder and category pages still generate theirs, and should: those carry
     * a figure, and a figure is the reason the link gets clicked.
     *
     * Sized explicitly because several scrapers lay the card out before they
     * have fetched the image, and one that has to guess falls back to the small
     * summary card.
     */
    images: [
      {
        url: '/featured.png',
        width: 1200,
        height: 630,
        alt: `${site.shortName} - ${site.tagline}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.shortName} - ${site.tagline}`,
    description: site.description,
    // Named again rather than inherited: X reads the `twitter:` tags first and
    // only falls back to `og:` when they are absent.
    images: ['/featured.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Uncapped, so a result can carry a real snippet and a large thumbnail
      // instead of the conservative default Google picks on its own.
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  /*
   * Search Console's meta-tag method. Left unset locally and in preview; adding
   * the token as an env var avoids a commit whose only content is a token, and
   * avoids claiming ownership of the production domain from a preview build.
   */
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  // Stops iOS Safari turning bare figures in the revenue tables into phone links.
  formatDetection: { telephone: false, address: false, email: false },
}

/**
 * One theme colour, because the site has one theme. `colorScheme: 'dark'` is
 * what stops the browser painting form controls and scrollbars light against it.
 */
export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <SquircleDefs />
        <a
          href="#main"
          className="focus:bg-accent focus:text-accent-fg sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </div>
        {/* Page views and visitors, counted by Vercel — no cookies, no client state. */}
        <Analytics />
      </body>
    </html>
  )
}
