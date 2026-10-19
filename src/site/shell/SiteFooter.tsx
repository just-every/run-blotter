import { Brand } from './Brand'
import { links } from './links'

/** The set-type footer under every page: the mark, the wordmark, one line, and the four links. */
export function SiteFooter() {
  return <footer className="site-footer">
    <div className="site-wrap site-footer-row">
      <div className="site-footer-brand"><Brand size={44} /><span>Free, open source practice management</span></div>
      <nav aria-label="Footer">
        <a href={links.docs}>Docs</a>
        <a href={links.contract}>Contract</a>
        <a href={links.source}>Source</a>
        <a href={links.licence}>MIT licensed</a>
      </nav>
    </div>
  </footer>
}
