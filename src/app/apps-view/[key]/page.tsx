import { notFound } from 'next/navigation'
import { decodeAppsKey } from '@/lib/apps-filters'
import { AppsList, appsMetadata } from '../../apps/apps-list'

/*
 * A filtered, sorted, searched or paged /apps. Reached only through the
 * middleware's rewrite of `/apps?…`, so the address bar keeps the public URL.
 *
 * No views are built ahead of time; each one renders on its first visit and is
 * then served from the cache until the daily revalidation, instead of running a
 * function for every request as reading `searchParams` did.
 */
export const revalidate = 86400

export function generateStaticParams() {
  return []
}

type Params = { params: Promise<{ key: string }> }

export async function generateMetadata({ params }: Params) {
  const filters = decodeAppsKey((await params).key)
  if (!filters) notFound()
  return appsMetadata(filters)
}

export default async function AppsViewPage({ params }: Params) {
  const filters = decodeAppsKey((await params).key)
  if (!filters) notFound()
  return <AppsList filters={filters} />
}
