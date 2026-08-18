import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badge = cva(
  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase leading-4 tracking-wider',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-3 text-muted',
        verified: 'bg-blue-dim text-blue',
        up: 'bg-green-dim text-green',
        down: 'bg-red-dim text-red',
        flag: 'bg-gold-dim text-gold',
        outline: 'border border-border text-muted',
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
