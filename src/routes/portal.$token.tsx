import { createFileRoute } from '@tanstack/react-router'
import { HydrationUnit } from '../base/hydration/unit'
import { Portal } from '../ui/portal'

// The client upload page. It holds no session; the link's secret authorises it.
export const Route = createFileRoute('/portal/$token')({
  head: () => ({ meta: [{ name: 'referrer', content: 'no-referrer' }, { name: 'robots', content: 'noindex' }] }),
  component: () => { const { token } = Route.useParams(); return <HydrationUnit><Portal token={token} /></HydrationUnit> },
})
