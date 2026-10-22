import { createFileRoute } from '@tanstack/react-router'
import { HydrationUnit } from '../base/hydration/unit'
import { ClientAccount } from '../ui/client-account'

// PORTAL-002: the signed-in client portal. Its session is a server-side cookie, separate from staff sign-in.
export const Route = createFileRoute('/client')({
  head: () => ({ meta: [{ name: 'referrer', content: 'no-referrer' }, { name: 'robots', content: 'noindex' }] }),
  component: () => <HydrationUnit><ClientAccount /></HydrationUnit>,
})
