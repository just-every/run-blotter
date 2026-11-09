import { createFileRoute } from '@tanstack/react-router';
import { HydrationUnit } from '../base/hydration/unit';
import { AgentActivity } from '../ui/agent-activity';

export const Route = createFileRoute('/agent-activity')({
 head: () => ({ meta: [{ title: 'Agent activity · Blotter' }, { name: 'referrer', content: 'no-referrer' }] }),
 component: () => <HydrationUnit><AgentActivity /></HydrationUnit>,
});
