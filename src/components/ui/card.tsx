import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('border-border bg-surface rounded-[10px] border', className)} {...props} />
  )
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex items-start justify-between gap-4 p-4 pb-0', className)} {...props} />
  )
}

export function CardBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-4', className)} {...props} />
}

/**
 * The label/value pair that appears under every card and in every stat row.
 * Tiny uppercase key, bold figure — the site's most repeated unit.
 */
export function Stat({
  label,
  value,
  tone,
  className,
}: {
  label: string
  value: React.ReactNode
  tone?: 'up' | 'down'
  className?: string
}) {
  return (
    <div className={className}>
      <p className="label">{label}</p>
      <p
        className={cn(
          'tabular mt-0.5 text-sm font-bold',
          tone === 'up' ? 'text-green' : tone === 'down' ? 'text-red' : 'text-fg',
        )}
      >
        {value}
      </p>
    </div>
  )
}
