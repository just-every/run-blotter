import type { ReactNode } from 'react'
import run from '../run.json'

export type SiteChromeProps = { sourceUrl?: string }

function SiteBrand() {
  return <a className="site-brand" href="/" aria-label="Blotter home"><img src="/brand/mark.svg" width="24" height="18" alt="" /><span>Blotter</span></a>
}

function SiteLinks({ sourceUrl = run.repository }: SiteChromeProps) {
  return <nav className="site-links" aria-label="Site"><a href="/docs">Docs</a><a href={sourceUrl}>Source</a></nav>
}

export function SiteHeader(props: SiteChromeProps) {
  return <header className="site-header site-container"><SiteBrand /><SiteLinks {...props} /></header>
}

export function SiteFooter(props: SiteChromeProps) {
  return <footer className="site-footer site-container"><div className="site-footer-brand"><SiteBrand /><span className="site-licence">· MIT licensed</span></div><SiteLinks {...props} /></footer>
}

export function SiteFrame({ children, sourceUrl }: SiteChromeProps & { children: ReactNode }) {
  return <div className="site-frame"><SiteHeader sourceUrl={sourceUrl} />{children}<SiteFooter sourceUrl={sourceUrl} /></div>
}

export function RunActions() {
  return <div className="landing-actions"><a className="landing-primary" href="/run">Run Blotter <span aria-hidden="true">→</span></a><a className="landing-docs-link" href="/docs">Read the docs</a></div>
}
