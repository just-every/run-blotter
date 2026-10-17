import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { contractPageHtml } from '../base/contract-page'
import type { RunData, SiteBuild, SiteContext } from '../base/run-site'
import { identity } from '../identity'
import { Landing, SiteFrame } from './landing'
import { DocsPage } from './docs/DocsPage'
import { docs } from './docs/content'
import { RunPage } from './RunPage'
import run from './run.json'

const title = 'Blotter — job workflow for bookkeeping and accounting practices'
const description = 'Recurring client jobs, document requests with private upload links, reviewer sign-off and time exported for your own billing. Free and open source, MIT licensed.'

function pageHtml(pageTitle: string, summary: string, content: ReactNode, styles: string[]) {
  return '<!doctype html>' + renderToStaticMarkup(<html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{pageTitle}</title>
      <meta name="description" content={summary} />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="stylesheet" href="/fonts/fonts.css" />
      <link rel="stylesheet" href="/rer-theme.css" />
      {styles.map(href => <link key={href} rel="stylesheet" href={href} />)}
    </head>
    <body>{content}</body>
  </html>)
}

// Entirely static: repository Markdown, React markup and local assets become
// HTML/CSS at build time. The output has no client scripts or external loads.
export function sitePages({ styles, contract }: SiteContext): SiteBuild {
  const data: RunData = run
  return {
    pages: [
      { path: '/', html: pageHtml(title, description, <Landing />, styles) },
      { path: '/run', html: pageHtml(run.page.title, run.page.description, <RunPage />, styles) },
      ...(contract ? [{ path: '/contract', html: contractPageHtml(identity, data, contract) }] : []),
      ...docs.map(doc => ({ path: doc.path, html: pageHtml(`${doc.title} · Blotter`, doc.description, <DocsPage page={doc} />, styles) })),
      { path: '/404', html: pageHtml('Page not found · Blotter', 'This page is not part of the Blotter site.', <SiteFrame><main id="main" className="site-container docs-main"><div className="docs-prose"><h1>Page not found</h1><p><a href="/">Go to the homepage</a> or <a href="/docs">read the docs</a>.</p></div></main></SiteFrame>, styles) },
    ],
    assets: ['rer-theme.css', 'fonts', 'brand', 'favicon.svg'],
  }
}
