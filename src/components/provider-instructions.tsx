import { ExternalLink } from 'lucide-react'
import type { ProviderStep } from '@/lib/providers/types'

/**
 * How to get the key, above the fields that ask for it.
 *
 * One component for both places a founder can connect a provider — the submit
 * form and the dashboard's connect panel. They used to hold the same markup
 * twice, which is how a step gets fixed in one of them and not the other.
 *
 * The summary carries what the key can and cannot do, because that is the
 * question a founder is actually asking when they are told to paste a secret
 * into a stranger's form. The steps below it are the clicking.
 */
export function ProviderInstructions({
  name,
  instructions,
  steps,
  docsUrl,
}: {
  name: string
  instructions: string
  steps?: readonly ProviderStep[]
  docsUrl: string
}) {
  return (
    <div className="border-border bg-surface-2 rounded-card border p-4">
      <p className="text-muted text-sm leading-relaxed">{instructions}</p>

      {steps && steps.length > 0 && (
        <ol className="text-muted mt-3 space-y-2.5 text-sm leading-relaxed">
          {steps.map((step, index) => (
            <li key={step.text} className="flex gap-2.5">
              {/* The number is its own column rather than a list marker: a step
                  that wraps then lines up under its own first word instead of
                  under the digit. */}
              <span className="text-dim shrink-0 tabular-nums">{index + 1}.</span>
              <span className="min-w-0">
                {step.text}
                {step.permissions && (
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {step.permissions.map((permission) => (
                      <code
                        key={permission}
                        className="border-border bg-surface text-fg rounded-md border px-1.5 py-0.5 text-[11px]"
                      >
                        {permission}
                      </code>
                    ))}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      <a
        href={docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue mt-3 inline-flex items-center gap-1 text-[11px] hover:underline"
      >
        {name} docs
        <ExternalLink className="size-3" />
      </a>
    </div>
  )
}
