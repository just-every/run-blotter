import type { AgentCatalog } from '../blotter/agent-door/catalog';

const style = `
.agent-docs{max-width:1120px;margin:auto;padding:32px 24px 64px;min-width:0}
.agent-docs h1{font-size:clamp(36px,5vw,60px);margin:24px 0 16px}
.agent-docs nav{display:flex;flex-wrap:wrap;gap:12px 24px;margin:24px 0}
.agent-docs section{margin-top:32px;min-width:0}
.agent-docs article,.agent-docs .boundary{border:1px solid var(--bl-line,#d6d1e3);border-radius:12px;padding:20px;margin:16px 0;min-width:0}
.agent-docs .boundary{background:var(--bl-lilac-pale,#f6f2fc)}
.agent-docs h3{margin:0 0 8px;overflow-wrap:anywhere}
.agent-docs dl{display:grid;grid-template-columns:130px minmax(0,1fr);gap:8px 16px;margin:16px 0}
.agent-docs dt{font-weight:600}.agent-docs dd{margin:0;overflow-wrap:anywhere}
.agent-docs pre{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;max-width:100%;font:14px/1.6 var(--bl-font-mono,monospace);margin:12px 0}
.agent-docs code{font-size:14px}.agent-docs summary{font-size:15px}
.agent-docs li{margin:8px 0}.agent-docs a{overflow-wrap:anywhere}
@media(max-width:600px){.agent-docs{padding:24px 16px 48px}.agent-docs article,.agent-docs .boundary{padding:16px}.agent-docs dl{grid-template-columns:1fr;gap:4px}.agent-docs dd{margin-bottom:8px}}
`;

export function AgentDocs({ catalog }: { catalog: AgentCatalog }) {
 return <main className="agent-docs">
  <style>{style}</style>
  <a href="/">Blotter installation</a>
  <header><h1>Agent catalogue</h1><p>Specialist role: <strong>{catalog.specialist}</strong></p>
   <p>Public declarations for this installation’s MCP door. Company policy and current native authority govern every call. This catalogue grants no access and contains no client records.</p>
  </header>
  <nav aria-label="Catalogue sections"><a href="#authority">Authority</a><a href="#tools">Tools by job</a><a href="#resources">Resource templates</a><a href="#capabilities">Capabilities</a></nav>
  <section id="authority" className="boundary" aria-labelledby="authority-title"><h2 id="authority-title">Preparation only</h2>
   <p>Agents read permitted context and prepare internal proposals. Named people separately approve native effects. A proposal does not send a message, change work, charge money or file a return.</p>
   <p>Declared classes describe possible policy evaluation. They are not a computed classification for a particular client or a promise that a call is authorized. This page shows the registry under complete policies; an unset or paused policy can withhold MCP discovery.</p>
  </section>
  <section id="tools" aria-labelledby="tools-title"><h2 id="tools-title">Tools by job</h2>
   {catalog.tools.map(tool => <article key={tool.name} data-tool={tool.name} aria-labelledby={`tool-${tool.name}`}>
    <h3 id={`tool-${tool.name}`}>{tool.title}</h3><p><code data-field="name">{tool.name}</code></p><p data-field="description">{tool.description}</p>
    <dl><dt>Declared classes</dt><dd data-field="classes">{tool._meta['com.runeditrun/classes'].join(', ')}</dd><dt>Required scope</dt><dd><code data-field="scope">{tool._meta['com.runeditrun/scope']}</code></dd><dt>Operation</dt><dd>{tool.annotations.readOnlyHint ? 'Read permitted context' : 'Prepare an internal proposal'}</dd></dl>
    <details><summary>Input schema for {tool.name}</summary><pre tabIndex={0} role="region" aria-label={`Input schema for ${tool.name}`} data-field="inputSchema">{JSON.stringify(tool.inputSchema,null,2)}</pre></details>
    <details><summary>Output schema for {tool.name}</summary><pre tabIndex={0} role="region" aria-label={`Output schema for ${tool.name}`} data-field="outputSchema">{JSON.stringify(tool.outputSchema,null,2)}</pre></details>
   </article>)}
  </section>
  <section id="resources" aria-labelledby="resources-title"><h2 id="resources-title">Resource templates</h2>
   {catalog.resourceTemplates.length ? <ul>{catalog.resourceTemplates.map(resource => <li key={resource.uriTemplate}><code data-resource-template>{resource.uriTemplate}</code> — {resource.name}</li>)}</ul> : <p>No resource templates are exposed by the declared CORE subset. Internal record links do not enable resource reads.</p>}
  </section>
  <section id="capabilities" aria-labelledby="capabilities-title"><h2 id="capabilities-title">Capabilities and unavailable families</h2>
   <p>Declared CORE capabilities: <span data-capabilities>{catalog.capabilities.declared.join(', ')}</span>.</p>
   <p>Optional families are unavailable in this installation:</p><ul>{catalog.capabilities.refused.map(name => <li key={name} data-unavailable={name}><code>{name}</code> — not enabled</li>)}</ul>
   <p>Other families remain outside the declared subset:</p><ul>{catalog.capabilities.unscoped.map(name => <li key={name} data-unscoped={name}><code>{name}</code> — unavailable</li>)}</ul>
   <p>This includes custom events and subscriptions, multiple sponsors, outbound mail and resource refresh. No provider activation, person-only effect or custody hold is released. Discovery instructions, specialist prompts, computed-class fixture documentation and full conformance remain outside this catalogue.</p>
  </section>
 </main>;
}
