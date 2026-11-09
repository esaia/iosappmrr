import { AppsList, appsMetadata } from './apps-list'

// The unfiltered list only. Any query string is rewritten by the middleware to
// /apps-view/[key], so this page never reads `searchParams` and stays cached.
export const revalidate = 86400

export const metadata = appsMetadata({})

export default function AppsPage() {
  return <AppsList filters={{}} />
}
