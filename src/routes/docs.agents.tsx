import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { HydrationUnit } from '../base/hydration/unit';
import type { AgentCatalog } from '../blotter/agent-door/catalog';
import { AgentDocs } from '../ui/agent-docs';

const catalogue = createServerFn({ method: 'GET' }).handler(async () => {
 const [{ env }, { blotterAgentOptions }, { agentCatalog }] = await Promise.all([
  import('cloudflare:workers'), import('../blotter/agent-door/index'), import('../blotter/agent-door/catalog'),
 ]);
 return JSON.stringify(agentCatalog(blotterAgentOptions(env as unknown as import('../auth.server').Bindings)));
});
export const Route = createFileRoute('/docs/agents')({
 head: () => ({ meta: [{ title: 'Agent catalogue · Blotter' }, { name: 'referrer', content: 'no-referrer' }] }),
 loader: async () => JSON.parse(await catalogue()) as AgentCatalog,
 component: () => <HydrationUnit><AgentDocs catalog={Route.useLoaderData()} /></HydrationUnit>,
});
