import { ImageResponse } from 'next/og'
import { getAppBySlug } from '@/lib/data/apps'
import { formatMrr } from '@/lib/utils'
import { site } from '@/lib/site'

export const alt = 'Verified monthly revenue'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * The share card is the product's best advertisement: an app icon, one verified
 * number, and the badge. Shipped as an image so it survives every platform that
 * strips markup.
 */
export default async function OpengraphImage({ params }: { params: { slug: string } }) {
  const record = await getAppBySlug(params.slug)

  const name = record?.app.name ?? 'App'
  const tagline = record?.app.tagline ?? ''
  const mrr = record?.metrics ? formatMrr(Number(record.metrics.mrrCents)) : null
  const icon = record?.metadata?.iconUrl ?? null

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#0b1020',
        color: '#f2f5fb',
        padding: 72,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        {icon ? (
          <img src={icon} width={120} height={120} style={{ borderRadius: 28 }} alt="" />
        ) : (
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 28,
              background: '#1b4dff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 56,
              fontWeight: 700,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 820 }}>
          <div style={{ fontSize: 60, fontWeight: 700, letterSpacing: -1.5 }}>{name}</div>
          {tagline && (
            <div style={{ fontSize: 28, color: '#b3bcd8', marginTop: 8 }}>
              {tagline.slice(0, 70)}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{ fontSize: 22, color: '#7f89ab', letterSpacing: 4, textTransform: 'uppercase' }}
          >
            Verified MRR
          </div>
          <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>
            {mrr ?? '—'}
            <span style={{ fontSize: 44, color: '#7f89ab', fontWeight: 400 }}>/mo</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: '#17224d',
            color: '#6b8cff',
            padding: '14px 24px',
            borderRadius: 14,
            fontSize: 26,
          }}
        >
          {site.name}
        </div>
      </div>
    </div>,
    size,
  )
}
