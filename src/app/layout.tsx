import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { SquircleDefs } from '@/components/squircle-defs'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { site } from '@/lib/site'
import './globals.css'

/**
 * One typeface for the entire interface — headlines, body, and figures alike.
 *
 * 800 is here for one thing: the MRR column. A mono face keeps its weights
 * close together by design, and at 13px the jump from 500 to 700 was not enough
 * to make the figure read as the thing the row is about.
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-jetbrains-mono',
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
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.shortName} - ${site.tagline}`,
    description: site.description,
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
    <html lang="en" className={jetbrainsMono.variable} suppressHydrationWarning>
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
      </body>
    </html>
  )
}
