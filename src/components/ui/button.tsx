import Link from 'next/link'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/*
 * Same radius as a panel, so a control never reads as a pill dropped onto the
 * page. Each variant presses in on :active — a 1.5% scale, far too small to
 * notice as motion and the thing that makes a control feel physically clicked.
 */
const button = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-card font-medium transition-[transform,background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        /*
         * systemBlue, lifted. The gradient is a two-stop lightening toward the
         * top plus an inset hairline: the same specular trick the glass panels
         * use, which is what keeps a solid fill from reading as flat paint
         * beside them.
         */
        primary: 'glossy bg-accent text-accent-fg hover:brightness-[1.08]',
        /* Glass, so the page shows through a secondary action. */
        secondary:
          'glass border-border text-fg border hover:border-border-strong hover:bg-white/10',
        ghost: 'text-muted hover:bg-white/8 hover:text-fg',
        danger: 'border-red/40 bg-red-dim text-red border hover:border-red/70 hover:bg-red/20',
      },
      size: {
        sm: 'h-8 px-3.5 text-xs',
        md: 'h-10 px-4.5 text-[13px]',
        lg: 'h-11 px-6 text-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof button>

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & VariantProps<typeof button>

export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <Link className={cn(button({ variant, size }), className)} {...props} />
}
