import { Leaderboard, leaderboardMetadata } from './leaderboard'

/*
 * Cached, not rendered per request. The other sorts (`?sort=growth`) are their
 * own cached pages under `/leaderboard/by/[sort]`, which the middleware rewrites
 * the query-string URL to, so reading the sort never makes this route dynamic.
 */
export const revalidate = 86400

export const metadata = leaderboardMetadata('mrr')

export default function LeaderboardPage() {
  return <Leaderboard sort="mrr" />
}
