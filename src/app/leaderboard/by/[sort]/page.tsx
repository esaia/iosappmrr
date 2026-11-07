import { notFound } from 'next/navigation'
import type { AppSort } from '@/lib/data/apps'
import { Leaderboard, leaderboardMetadata, SORTS } from '../../leaderboard'

// Reached through the middleware's rewrite of `/leaderboard?sort=…`; see the bare page.
export const revalidate = 86400
export const dynamicParams = false

const OTHER_SORTS = SORTS.filter((option) => option.value !== 'mrr')

export function generateStaticParams() {
  return OTHER_SORTS.map((option) => ({ sort: option.value }))
}

type Params = { params: Promise<{ sort: string }> }

export async function generateMetadata({ params }: Params) {
  const { sort } = await params
  return leaderboardMetadata(sort as AppSort)
}

export default async function LeaderboardBySortPage({ params }: Params) {
  const { sort } = await params
  if (!OTHER_SORTS.some((option) => option.value === sort)) notFound()
  return <Leaderboard sort={sort as AppSort} />
}
