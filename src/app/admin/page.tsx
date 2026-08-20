import Link from 'next/link'
import { AlertTriangle, Gift, Megaphone } from 'lucide-react'
import { Card, CardBody, Stat } from '@/components/ui/card'
import { getAdminOverview, listAdminActions } from '@/lib/data/admin'
import { timeAgo } from '@/lib/utils'

export default async function AdminOverviewPage() {
  /*
   * Two queries, not a dozen. Every count on this page comes back in one
   * statement, including the sponsor-slot setting — see `getAdminOverview`.
   */
  const [overview, recent] = await Promise.all([getAdminOverview(), listAdminActions(8)])
  const slots = overview.sponsorSlots
  const sponsorsBooked = overview.activeSponsors

  return (
    <div className="space-y-6">
      {/*
        Two things can be quietly wrong at any moment: a payment that was taken
        without granting anything, and a revenue sync that stopped. Both are
        invisible on the public site, so they lead here rather than sitting in a
        list someone has to think to open.
      */}
      {(overview.stuckCheckouts > 0 || overview.failingConnections > 0) && (
        <div className="border-gold/40 bg-gold-dim rounded-card border p-4">
          <div className="text-gold flex items-center gap-2">
            <AlertTriangle className="size-4" />
            <h2 className="text-sm font-medium">Needs a look</h2>
          </div>
          <ul className="text-fg mt-2 space-y-1 text-[13px]">
            {overview.stuckCheckouts > 0 && (
              <li>
                {overview.stuckCheckouts} checkout{overview.stuckCheckouts === 1 ? '' : 's'} never
                settled. Run{' '}
                <code className="bg-surface-2 rounded px-1 py-0.5 text-[12px]">
                  npm run paddle:reconcile
                </code>{' '}
                first — it checks Paddle for the payment.{' '}
                <Link href="/admin/purchases?status=pending" className="text-blue hover:underline">
                  Review them
                </Link>
              </li>
            )}
            {overview.failingConnections > 0 && (
              <li>
                {overview.failingConnections} revenue connection
                {overview.failingConnections === 1 ? '' : 's'} are failing, so those apps are no
                longer refreshing.{' '}
                <Link href="/admin/apps" className="text-blue hover:underline">
                  See which
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody>
            <Stat label="Apps" value={overview.apps.total} />
            <p className="text-muted mt-1 text-[11px]">
              {overview.apps.live} live · {overview.apps.draft} draft · {overview.apps.hidden}{' '}
              hidden
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat label="Users" value={overview.users} />
            <p className="text-muted mt-1 text-[11px]">
              {overview.admins} admin{overview.admins === 1 ? '' : 's'}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat label="Sponsor slots" value={`${sponsorsBooked}/${slots}`} />
            <p className="text-muted mt-1 text-[11px]">
              {Math.max(0, slots - sponsorsBooked)} available to sell
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat label="Dofollow links" value={overview.activeDofollow} />
            <p className="text-muted mt-1 text-[11px]">{overview.activeGifts} granted as gifts</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <QuickLink
          href="/admin/apps"
          icon={<Gift className="size-4" />}
          title="Gift a dofollow link or a rail slot"
          blurb="Grant either upgrade to any app without a payment. Gifts are recorded alongside sales and can be withdrawn the same way."
        />
        <QuickLink
          href="/admin/settings"
          icon={<Megaphone className="size-4" />}
          title="Add sponsor slots"
          blurb="Change how many rail spots are on sale. Takes effect immediately, with no deploy."
        />
      </div>

      <section>
        <h2 className="label">Recent admin activity</h2>
        {recent.length === 0 ? (
          <p className="text-muted mt-2 text-[13px]">Nothing yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {recent.map((entry) => (
              <li key={entry.id} className="text-[13px]">
                <span className="text-fg">{entry.summary}</span>{' '}
                <span className="text-dim">
                  — @{entry.actorHandle}, {timeAgo(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/admin/activity"
          className="text-blue mt-3 inline-block text-[13px] hover:underline"
        >
          Full log →
        </Link>
      </section>
    </div>
  )
}

function QuickLink({
  href,
  icon,
  title,
  blurb,
}: {
  href: string
  icon: React.ReactNode
  title: string
  blurb: string
}) {
  return (
    <Link
      href={href}
      className="border-border bg-surface hover:border-border-strong rounded-card block border p-4 transition-colors"
    >
      <div className="text-fg flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <p className="text-muted mt-1.5 text-[13px] leading-relaxed">{blurb}</p>
    </Link>
  )
}
