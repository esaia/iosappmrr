import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/*
 * Tinted rather than filled: each tone is its own colour at low alpha with a
 * hairline of the same colour, which lets a badge sit on glass without becoming
 * the brightest thing in the row. The ring is inset so it costs no layout —
 * badges sit inside dense rows where a real border would shift the baseline.
 */
const badge = cva(
  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase leading-4 tracking-wider',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-3 text-muted ring-1 ring-white/10 ring-inset',
        verified: 'bg-blue-dim text-blue ring-blue/25 ring-1 ring-inset',
        up: 'bg-green-dim text-green ring-green/25 ring-1 ring-inset',
        down: 'bg-red-dim text-red ring-red/25 ring-1 ring-inset',
        flag: 'bg-gold-dim text-gold ring-gold/25 ring-1 ring-inset',
        outline: 'text-muted ring-1 ring-white/12 ring-inset',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />
}
