import Link from 'next/link'
import {
  Banknote,
  BookOpen,
  Briefcase,
  Camera,
  Clapperboard,
  Code2,
  Compass,
  Dumbbell,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  Library,
  ListChecks,
  Music,
  Navigation,
  Newspaper,
  PenTool,
  Share2,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Sun,
  UtensilsCrossed,
  Plane,
  Radio,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

/**
 * Icons are keyed by slug rather than stored on the category, so adding one is
 * a code change and a missing entry degrades to a neutral mark rather than a
 * blank space.
 */
const ICONS: Record<string, LucideIcon> = {
  ai: Sparkles,
  productivity: ListChecks,
  'health-fitness': HeartPulse,
  finance: Banknote,
  'photo-video': Camera,
  'developer-tools': Code2,
  education: GraduationCap,
  utilities: Wrench,
  social: Share2,
  games: Gamepad2,
  entertainment: Clapperboard,
  lifestyle: Compass,
  travel: Plane,
  music: Music,
  business: Briefcase,
  shopping: ShoppingBag,
  'food-drink': UtensilsCrossed,
  news: Newspaper,
  sports: Dumbbell,
  navigation: Navigation,
  weather: Sun,
  books: BookOpen,
  reference: Library,
  medical: Stethoscope,
  'graphics-design': PenTool,
  'magazines-newspapers': Radio,
}

export function CategoryPills({
  categories,
}: {
  categories: { slug: string; name: string; appCount: number }[]
}) {
  if (categories.length === 0) return null

  return (
    <section className="mt-14 text-center">
      <h2 className="display text-xl font-semibold sm:text-2xl">Browse by category</h2>

      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        {categories.map((category) => {
          const Icon = ICONS[category.slug] ?? Sparkles
          return (
            <Link
              key={category.slug}
              href={`/categories/${category.slug}`}
              className="border-border text-muted hover:border-border-strong hover:text-fg inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] transition-colors"
            >
              <Icon className="text-dim size-3.5" />
              {category.name}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
