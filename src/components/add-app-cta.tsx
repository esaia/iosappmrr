import Link from 'next/link'
import { ArrowRight, Plus } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'

/**
 * Closing call to action. Sits above the footer on app pages, where a reader
 * who just finished studying someone else's numbers is most likely to add theirs.
 */
export function AddAppCta() {
  return (
    <section className="border-border bg-surface mt-8 rounded-[10px] border p-6 text-center sm:p-10">
      <h2 className="display text-2xl font-semibold sm:text-3xl">Add your own app</h2>
      <p className="text-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
        Connect RevenueCat or App Store Connect once. Your revenue is read straight from the
        provider and refreshed daily — never typed in by hand.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <ButtonLink href="/submit" size="lg">
          <Plus className="size-4" />
          Add app
        </ButtonLink>
        <Link
          href="/verification"
          className="text-muted hover:text-fg inline-flex items-center gap-1 px-3 py-2 text-[13px] transition-colors"
        >
          How verification works
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  )
}
