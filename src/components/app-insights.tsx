import Link from 'next/link'
import {
  Lightbulb,
  Megaphone,
  Sparkles,
  Tag,
  Target,
  Users,
  Code2,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export type Insights = {
  valueProposition: string | null
  problemSolved: string | null
  audience: string | null
  audienceType: 'B2C' | 'B2B' | 'B2B2C' | null
  marketTags: string[]
  marketingChannels: string[]
  additionalInfo: string | null
}

type Tech = { slug: string; name: string }

/**
 * Founder-written context, in contrast with the revenue above it, which is read
 * from the provider. Every card is optional — an app with nothing filled in
 * renders no section at all rather than a grid of empty boxes.
 */
export function AppInsights({ insights, tech }: { insights: Insights; tech: Tech[] }) {
  const {
    valueProposition,
    problemSolved,
    audience,
    audienceType,
    marketTags,
    marketingChannels,
    additionalInfo,
  } = insights

  const hasAnything =
    valueProposition ||
    problemSolved ||
    audience ||
    marketTags.length > 0 ||
    marketingChannels.length > 0 ||
    additionalInfo ||
    tech.length > 0

  if (!hasAnything) return null

  return (
    <section className="border-border bg-surface rounded-card mt-3 border p-5 sm:p-6">
      <h2 className="display text-xl font-semibold">App insights</h2>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {valueProposition && (
          <Card icon={Lightbulb} label="Value proposition">
            <p className="text-fg text-[15px] leading-relaxed font-medium">{valueProposition}</p>
          </Card>
        )}

        {problemSolved && (
          <Card icon={Target} label="Problem solved">
            <p className="text-muted text-sm leading-relaxed">{problemSolved}</p>
          </Card>
        )}

        {(audience || audienceType) && (
          <Card icon={Users} label="Audience">
            {audience && <p className="text-muted text-sm leading-relaxed">{audience}</p>}
            {audienceType && (
              <div className="mt-3">
                <Badge tone="outline">{audienceType}</Badge>
              </div>
            )}
          </Card>
        )}

        {marketTags.length > 0 && (
          <Card icon={Tag} label="Market">
            <div className="flex flex-wrap gap-1.5">
              {marketTags.map((tag) => (
                <Badge key={tag} tone="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {tech.length > 0 && (
          <Card icon={Code2} label="Tech stack">
            <div className="flex flex-wrap gap-1.5">
              {tech.map((tag) => (
                <Link key={tag.slug} href={`/apps?tech=${tag.slug}`}>
                  <Badge tone="outline" className="hover:border-border-strong hover:text-fg">
                    {tag.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {marketingChannels.length > 0 && (
          <Card icon={Megaphone} label="Marketing channels">
            <div className="flex flex-wrap gap-1.5">
              {marketingChannels.map((channel) => (
                <Badge key={channel} tone="outline">
                  {channel}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {additionalInfo && (
          <Card icon={Sparkles} label="Additional info">
            <p className="text-muted text-sm leading-relaxed">{additionalInfo}</p>
          </Card>
        )}
      </div>
    </section>
  )
}

function Card({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="border-border bg-surface-2 rounded-card border p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="border-border bg-surface-3 text-muted flex size-7 shrink-0 items-center justify-center rounded-lg border">
          <Icon className="size-3.5" />
        </span>
        <h3 className="label">{label}</h3>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
}
