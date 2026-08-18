import { cn } from '@/lib/utils'

/**
 * App Store icons are superellipses, so we clip them to the real shape rather
 * than approximating with a border radius. Falls back to the app's initial when
 * metadata hasn't been fetched yet.
 */
/** Stable hue per app, so the placeholder never changes between renders. */
function hueFor(name: string) {
  let hash = 2_166_136_261
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i)
    hash = Math.imul(hash, 16_777_619)
  }
  return (hash >>> 0) % 360
}

export function AppIcon({
  src,
  name,
  size = 56,
  className,
}: {
  src?: string | null
  name: string
  size?: number
  className?: string
}) {
  const hue = hueFor(name)

  return (
    <span
      className={cn(
        'squircle relative inline-flex shrink-0 items-center justify-center',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: src
          ? 'var(--surface-2)'
          : `linear-gradient(155deg, hsl(${hue} 70% 62%), hsl(${(hue + 40) % 360} 72% 48%))`,
      }}
    >
      {src ? (
        // Apple's CDN serves these; next/image would need a remote pattern per
        // region, and these are already served at exactly the size we ask for.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <span
          className="display font-semibold text-white/95"
          style={{ fontSize: size * 0.42 }}
          aria-hidden="true"
        >
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span className="squircle pointer-events-none absolute inset-0 ring-1 ring-white/8 ring-inset" />
    </span>
  )
}
