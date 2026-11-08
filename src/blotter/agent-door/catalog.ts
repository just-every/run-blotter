import { capabilitySet, offers } from '../../modules/agent-door/capabilities.mjs';
import { registry, describeTool } from '../../modules/agent-door/registry.ts';
import type { AgentDoorOptions } from '../../modules/agent-door/index.ts';

// Project declarations only. In particular, never resolve a target, classify a
// record, read a resource or execute a tool to produce public documentation.
export function agentCatalog(options: AgentDoorOptions) {
 const capabilities = capabilitySet(options.capabilities);
 const tools = registry(options).filter(tool => tool.exposure !== 'invoke').map(describeTool);
 const resourceTemplates = offers(options.capabilities, 'resources')
  ? [...options.resources ?? []].sort((a,b) => a.uriTemplate.localeCompare(b.uriTemplate)).map(({uriTemplate,name,description,mimeType}) => ({uriTemplate,name,...(description ? {description} : {}),...(mimeType ? {mimeType} : {})}))
  : [];
 return { name: options.name, specialist: options.specialist, capabilities, tools, resourceTemplates };
}
export type AgentCatalog = ReturnType<typeof agentCatalog>;
