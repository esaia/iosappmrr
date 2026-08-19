import { cn } from '@/lib/utils'

/**
 * Every panel on the site is a piece of glass. The material itself lives in
 * globals.css; what this adds is the border and the radius.
 *
 * The material is deliberately flat-lit — no diagonal highlight sweep. Across a
 * wide panel a sweep stops reading as light on glass and starts reading as a
 * gradient painted on the panel, which is a different and worse thing.
 */
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('glass border-border rounded-card border', className)} {...props} />
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex items-start justify-between gap-4 p-5 pb-0', className)} {...props} />
  )
}

export function CardBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-5', className)} {...props} />
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
