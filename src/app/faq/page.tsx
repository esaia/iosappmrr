import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { JsonLd } from '@/components/json-ld'
import { ButtonLink } from '@/components/ui/button'
import { Container, Measure } from '@/components/ui/container'
import { faqSections, type FaqItem } from '@/lib/faq'
import { breadcrumbs, faqPage, graph } from '@/lib/seo'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  alternates: { canonical: '/faq' },
  title: 'FAQ',
  description: `Common questions about ${site.name}: what it costs to list an app, which payment providers can be connected, what a read-only key can do, and what a verified figure does and does not prove.`,
}

/**
 * Every question on one page, in native `<details>` elements.
 *
 * No accordion component and no client JavaScript: `<details>` already opens,
 * closes, announces its state to a screen reader, and — unlike a JS accordion —
 * its closed content is found by the browser's own in-page search. A reader
 * looking for "refund" should hit it whether or not they thought to open the
 * right section first.
 *
 * The answers come from `faqSections()` rather than living in this file, so the
 * FAQPage schema below is built from the same strings the page renders.
 */
export default function FaqPage() {
  const sections = faqSections()
  const items = sections.flatMap((section) => section.items)

  return (
    <>
      <JsonLd
        data={graph(
          faqPage(items),
          // `breadcrumbs` prepends Home itself, so this is only the leaf.
          breadcrumbs([{ name: 'FAQ', path: '/faq' }]),
        )}
      />

      <Container className="py-10 sm:py-16">
        <Measure size="wide" className="mx-auto">
          <p className="label">Questions</p>
          <h1 className="display mt-2 text-4xl font-semibold sm:text-5xl">Everything people ask</h1>
          <p className="text-muted mt-5 text-lg leading-relaxed">
            How listing works, what a connected key can and cannot do, and where the numbers come
            from. If something here is unclear, say so — an answer nobody understands is the same as
            no answer.
          </p>

          {/*
            A jump list rather than a sticky sidebar: at this width a sidebar
            would take room from the answers, which are the page.
          */}
          <nav aria-label="Sections" className="mt-8 flex flex-wrap gap-2">
            {sections.map((section) => (
              <a
                key={section.heading}
                href={`#${slug(section.heading)}`}
                className="border-border bg-surface text-muted hover:text-fg rounded-full border px-3 py-1.5 text-[13px]"
              >
                {section.heading}
              </a>
            ))}
          </nav>

          {sections.map((section) => (
            <section key={section.heading} className="border-border mt-12 border-t pt-8">
              <h2
                id={slug(section.heading)}
                className="display scroll-mt-24 text-2xl font-semibold"
              >
                {section.heading}
              </h2>

              <div className="mt-5 space-y-2">
                {section.items.map((item) => (
                  <Question key={item.question} item={item} />
                ))}
              </div>
            </section>
          ))}

          <div className="border-border bg-surface rounded-card mt-12 border p-6">
            <h2 className="display text-xl font-semibold">Still unanswered?</h2>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              The method page goes through verification step by step, including what it cannot
              prove. Anything beyond that, find me on X at{' '}
              <a
                href={site.x.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue hover:underline"
              >
                @{site.x.handle}
              </a>
              .
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonLink href="/submit">Add your app</ButtonLink>
              <ButtonLink href="/verification" variant="secondary">
                How we verify
              </ButtonLink>
            </div>
          </div>
        </Measure>
      </Container>
    </>
  )
}

function Question({ item }: { item: FaqItem }) {
  return (
    <details className="border-border bg-surface rounded-card group border open:pb-1">
      <summary className="text-fg flex cursor-pointer list-none items-start justify-between gap-4 p-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
        {item.question}
        <ChevronDown
          className="text-muted mt-0.5 size-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="text-muted space-y-3 px-4 pb-4 text-sm leading-relaxed">
        {item.answer.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}

        {item.link && (
          <p>
            {/* An answer can point at another page here or at somewhere off the
                site, and the two are not the same element: a next/link to an
                external URL would prefetch a domain we do not control and open
                it without `rel`. */}
            {item.link.href.startsWith('http') ? (
              <a
                href={item.link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue hover:underline"
              >
                {item.link.label}
              </a>
            ) : (
              <Link href={item.link.href} className="text-blue hover:underline">
                {item.link.label}
              </Link>
            )}
          </p>
        )}
      </div>
    </details>
  )
}

/** Section headings are fixed copy, so this only has to handle words and spaces. */
function slug(heading: string) {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
