import { Brand } from './Brand'
import { links } from './links'

/** The header on every run-site page: the lockup at left; Docs, Contract and Source at right, on one row at every width. */
export function SiteHeader({ current }: { current?: 'docs' }) {
  return <header className="site-header">
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="site-wrap site-header-row">
      <Brand />
      <nav aria-label="Site">
        <a href={links.docs} aria-current={current === 'docs' ? 'page' : undefined}>Docs</a>
        <a href={links.contract}>Contract</a>
        <a href={links.source}>Source</a>
      </nav>
    </div>
  </header>
}
