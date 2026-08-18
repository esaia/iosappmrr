import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { percentChange } from '@/lib/utils'

/**
 * Rebuilds the `app_metrics` row for one app from its snapshot history.
 *
 * Every leaderboard, card, and sort reads `app_metrics` rather than aggregating
 * `revenue_snapshots`, so this is the single place daily figures are turned
 * into the numbers the site displays. Called after each successful sync and by
 * the seed script.
 */
export async function recomputeAppMetrics(appId: string) {
  const [row] = await db.execute<{
    mrr_cents: string | null
    active_subscriptions: number | null
    data_as_of: string | null
    providers: string[] | null
    mrr_30d_ago: string | null
    mrr_90d_ago: string | null
    sparkline: string[] | null
  }>(sql`
    with daily as (
      -- One total per day: providers are summed, never double-counted.
      select
        captured_on,
        sum(mrr_cents)::bigint as mrr_cents,
        sum(active_subscriptions) as active_subscriptions
      from revenue_snapshots
      where app_id = ${appId}
      group by captured_on
    ),
    latest as (
      select * from daily order by captured_on desc limit 1
    )
    select
      (select mrr_cents from latest) as mrr_cents,
      (select active_subscriptions from latest) as active_subscriptions,
      (select captured_on from latest) as data_as_of,
      (
        select array_agg(distinct provider::text)
        from revenue_snapshots
        where app_id = ${appId}
          and captured_on = (select captured_on from latest)
      ) as providers,
      -- Nearest snapshot at or before the comparison date, so a gap in the
      -- history shifts the baseline instead of erasing the growth figure.
      (
        select mrr_cents from daily
        where captured_on <= (select captured_on from latest) - interval '30 days'
        order by captured_on desc limit 1
      ) as mrr_30d_ago,
      (
        select mrr_cents from daily
        where captured_on <= (select captured_on from latest) - interval '90 days'
        order by captured_on desc limit 1
      ) as mrr_90d_ago,
      (
        select array_agg(mrr_cents order by captured_on)
        from (
          select captured_on, mrr_cents from daily
          order by captured_on desc limit 180
        ) recent
      ) as sparkline
  `)

  if (!row || row.mrr_cents === null) {
    await db.execute(sql`delete from app_metrics where app_id = ${appId}`)
    return null
  }

  const mrrCents = Number(row.mrr_cents)
  const metrics = {
    mrrCents,
    arrCents: mrrCents * 12,
    activeSubscriptions: row.active_subscriptions,
    growth30d: percentChange(row.mrr_30d_ago, mrrCents),
    growth90d: percentChange(row.mrr_90d_ago, mrrCents),
    sparkline: (row.sparkline ?? []).map(Number),
    dataAsOf: row.data_as_of,
    providers: row.providers ?? [],
  }

  await db.execute(sql`
    insert into app_metrics (
      app_id, mrr_cents, arr_cents, active_subscriptions,
      growth_30d, growth_90d, sparkline, data_as_of, providers, updated_at
    ) values (
      ${appId}, ${metrics.mrrCents}, ${metrics.arrCents}, ${metrics.activeSubscriptions},
      ${metrics.growth30d}, ${metrics.growth90d},
      ${JSON.stringify(metrics.sparkline)}::jsonb, ${metrics.dataAsOf},
      ${JSON.stringify(metrics.providers)}::jsonb, now()
    )
    on conflict (app_id) do update set
      mrr_cents = excluded.mrr_cents,
      arr_cents = excluded.arr_cents,
      active_subscriptions = excluded.active_subscriptions,
      growth_30d = excluded.growth_30d,
      growth_90d = excluded.growth_90d,
      sparkline = excluded.sparkline,
      data_as_of = excluded.data_as_of,
      providers = excluded.providers,
      updated_at = now()
  `)

  return metrics
}
