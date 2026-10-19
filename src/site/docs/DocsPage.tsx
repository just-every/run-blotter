import { SiteFooter } from '../shell/SiteFooter'
import { SiteHeader } from '../shell/SiteHeader'
import { links } from '../shell/links'
import { Arrow } from '../parts/type'
import { docs, type DocPage } from './content'
import '../styles/base.css'
import '../styles/docs.css'

/** /docs and each guide: the repository's Markdown in the homepage's look, with the guide list beside it. */
export function DocsPage({ page }: { page: DocPage }) {
  const position = docs.indexOf(page)
  const previous = position > 0 ? docs[position - 1] : undefined
  const next = docs[position + 1]
  const index = position === 0
  return <>
    <SiteHeader current="docs" />
    <main id="main" className="docs site-wrap">
      <nav className="docs-nav" aria-label="Documentation">
        <p className="eyebrow">Blotter docs</p>
        <ul>
          <li><a href="/docs" aria-current={index ? 'page' : undefined}>Overview</a></li>
          {docs.slice(1).map(doc => <li key={doc.path}><a href={doc.path} aria-current={page.path === doc.path ? 'page' : undefined}>{doc.title}</a></li>)}
        </ul>
        <a className="run-button docs-run" href={links.run}><span>Run Blotter</span> <Arrow /></a>
      </nav>
      <div className="docs-content">
        <article className="docs-prose" aria-labelledby="doc-title">
          <header className="docs-heading">
            <p className="eyebrow">{index ? 'Documentation' : `Guide ${position} of ${docs.length - 1}`}</p>
            <h1 id="doc-title">{page.title}</h1>
          </header>
          <div dangerouslySetInnerHTML={{ __html: page.html }} />
        </article>
        {index && <ol className="docs-cards">{docs.slice(1).map((doc, i) => <li key={doc.path}><a className="card" href={doc.path}><span className="docs-card-num">{i + 1}</span><b className="display">{doc.title}</b><span>{doc.description}</span></a></li>)}</ol>}
        <nav className="docs-pager" aria-label="More documentation">
          {previous ? <a className="card" href={previous.path}><span>Previous</span>{previous.title}</a> : <span />}
          {next ? <a className="card is-next" href={next.path}><span>Next</span>{next.title}</a> : <span />}
        </nav>
        <p className="docs-source"><a href={`${links.source}/blob/main/${page.source}`}>Read this page in the source</a></p>
      </div>
    </main>
    <SiteFooter />
  </>
}
