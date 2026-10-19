import { links } from './links'

/** The lockup: the approved smiling day tile ringed in marigold, and the wordmark in the display face. */
export function Brand({ size = 40 }: { size?: number }) {
  return <a className="site-brand" href={links.home} aria-label="Blotter home">
    <img src="/brand/mark.svg" alt="" width={size} height={size} />
    <span>Blotter</span>
  </a>
}
