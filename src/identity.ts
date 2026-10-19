// This edition's identity: what its installed Lobby and its run site say.
// The name and colour are the ones setup saves in src/branding.json; replace
// the purpose and tagline with the product's own when it has one.
import type { EditionIdentity } from './base/identity'
import branding from './branding.json'
import site from '../deploy-site.json'

export const identity: EditionIdentity = {
  product: branding.name,
  deployment: branding.name,
  purpose: '{deployment} keeps client jobs, document requests, reviews and billable time together.',
  tagline: 'Free, open source workflow for small bookkeeping and accounting practices: recurring jobs, client uploads, review sign-off and time for billing.',
  signInPath: '/signin',
  // The run site `rer deploy --site` publishes (deploy-site.json).
  runSite: `https://${site.domain}`,
  // An installed instance serves the Lobby at /.
  installedHome: 'lobby',
  theme: '/rer-theme.css',
  mark: '/brand/mark.svg',
  fonts: '/fonts/fonts.css',
  accentColor: branding.primaryColor,
}
