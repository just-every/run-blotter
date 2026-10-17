import { SiteFrame } from '../landing'
import { docs, type DocPage } from './content'
import './docs.css'
import run from '../run.json'

export function DocsPage({ page }: { page: DocPage }) {
  const position = docs.indexOf(page)
  const previous = docs[position - 1]
  const next = docs[position + 1]
  return <SiteFrame>
    <main id="main" className="site-container docs-main">
      <nav className="docs-nav" aria-label="Documentation">
        <a className="docs-home" href="/docs">Documentation</a>
        <ul>{docs.slice(1).map(doc => <li key={doc.path}>
          <a href={doc.path} aria-current={page.path === doc.path ? 'page' : undefined}>{doc.title}</a>
        </li>)}</ul>
        <a className="docs-run" href="/contract">Contract</a>
        <a className="docs-run" href="/run">Run Blotter →</a>
      </nav>
      <div className="docs-content">
        <article className="docs-prose" aria-labelledby="doc-title">
          <header className="docs-heading">
            <p className="docs-eyebrow">Blotter docs</p>
            <h1 id="doc-title">{page.title}</h1>
          </header>
          <div dangerouslySetInnerHTML={{ __html: page.html }} />
        </article>
        <nav className="docs-pager" aria-label="Next documentation page">
          <div>{previous && <a href={previous.path}><span>Previous</span>← {previous.title}</a>}</div>
          <div>{next && <a href={next.path}><span>Next</span>{next.title} →</a>}</div>
        </nav>
        <p className="docs-source"><a href={`${run.repository}/blob/main/${page.source}`}>Read this page in the source</a></p>
      </div>
    </main>
  </SiteFrame>
}
