// The run site (run-blotter.com) `rer build --site` writes: the homepage with its Run action, /run, the docs from
// docs/*.md, /contract from CONTRACT.md, and the not-found page. Every Run page string and command is in run.json;
// nothing here reads installation data. The pages are static HTML and CSS; /run carries Base's Copy script.
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { contractPageHtml } from '../base/contract-page'
import type { EditionIdentity } from '../base/identity'
import { runPageHtml, siteNotFoundHtml, type RunData, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity } from '../identity'
import { DocsPage } from './docs/DocsPage'
import { docs } from './docs/content'
import { Landing } from './landing/Landing'
import { typeset } from './shell/typeset'
import { run } from './run'

const title = 'Blotter — Client work, ahead of every deadline'
const description = 'Blotter schedules every client’s recurring work against federal and state deadlines, chases documents and signatures, routes the work through review and collects the fee. 100% free, open source alternative to Karbon, TaxDome and Canopy.'
const share = `${identity.runSite}/site/share.jpg`

// Base's shared /run, /contract and not-found pages read the site's tokens and draw no floor art.
const site: EditionIdentity = { ...identity, theme: '/site/theme.css', band: undefined }
// Base's Run page prints British "licence"; Blotter is a US product, so its /run says "license".
const usSpelling = (html: string) => html.replaceAll(`${run.licence} licence<`, `${run.licence} license<`)

function page(pageTitle: string, summary: string, body: ReactElement, styles: string[]) {
  return '<!doctype html>' + typeset(renderToStaticMarkup(<html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{pageTitle}</title>
      <meta name="description" content={summary} />
      <meta name="theme-color" content="#ffffff" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Blotter" />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={summary} />
      <meta property="og:image" content={share} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="icon" href="/favicon.ico" sizes="32x32" />
      <link rel="icon" type="image/svg+xml" href="/favicon-32.svg" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="preload" href="/fonts/roboto-serif/roboto-serif-display.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="stylesheet" href="/fonts/fonts.css" />
      <link rel="stylesheet" href="/site/theme.css" />
      {styles.map(href => <link key={href} rel="stylesheet" href={href} />)}
    </head>
    <body>{body}</body>
  </html>))
}

export function sitePages({ styles, contract }: SiteContext): SiteBuild {
  const data: RunData = run
  return {
    pages: [
      { path: '/', html: page(title, description, <Landing />, styles) },
      { path: '/run', html: usSpelling(runPageHtml(site, data, contract)) },
      ...(contract ? [{ path: '/contract', html: contractPageHtml(site, data, contract) }] : []),
      ...docs.map(doc => ({ path: doc.path, html: page(doc.path === '/docs' ? 'Blotter docs' : `${doc.title} · Blotter docs`, doc.description, <DocsPage page={doc} />, styles) })),
      { path: '/404', html: siteNotFoundHtml(site, data, contract) },
    ],
    assets: ['fonts', 'brand', 'site', 'favicon.ico', 'favicon-32.svg', 'apple-touch-icon.png'],
  }
}
