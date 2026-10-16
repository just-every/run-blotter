import type { ReactNode } from 'react'
import { SiteFrame, RunActions, type SiteChromeProps } from './chrome'
import { WorkflowDrawing, LicenceDrawing, UploadDrawing, ReviewDrawing, BillingDrawing } from './diagrams'
import { LineIcon, type IconName } from './icons'
import './landing.css'
import './diagrams.css'

export { SiteHeader, SiteFooter, SiteFrame } from './chrome'

function FeatureSection({ id, title, children, drawing, reverse = false }: { id: string; title: string; children: ReactNode; drawing: ReactNode; reverse?: boolean }) {
  return <section id={id} className={`landing-section landing-section-${id}${reverse ? ' landing-section-reverse' : ''}`} aria-labelledby={`${id}-title`}><div className="landing-section-copy"><h2 id={`${id}-title`}>{title}</h2><p>{children}</p></div>{drawing}</section>
}

const included: { label: string; icon: IconName }[] = [
  { label: 'Job templates', icon: 'document' },
  { label: 'Roles and rates', icon: 'people' },
  { label: 'Agent preparations', icon: 'preparation' },
  { label: 'Client list import', icon: 'upload' },
  { label: 'Practice archive', icon: 'archive' },
  { label: 'Audit log', icon: 'audit' },
]

export function Landing(props: SiteChromeProps) {
  return <SiteFrame {...props}><main className="landing-main site-container">
    <section id="top" className="landing-hero" aria-labelledby="landing-title"><div className="landing-hero-copy">
      <h1 id="landing-title">Every client job,<br className="landing-headline-break" /> on track.</h1>
      <p className="landing-subhead">Roll each BAS forward, collect the client's documents, sign it off and export the time.</p>
      <p className="landing-alternative">100% free, open source alternative to<br className="landing-alternative-break" /> <strong>Karbon</strong>, <strong>Financial Cents</strong> and <strong>TaxDome</strong></p>
      <RunActions /><p className="landing-fine">Free and open source, MIT licensed.</p>
    </div><WorkflowDrawing /></section>
    <FeatureSection id="free" title="100% free." drawing={<LicenceDrawing />}>Free as in code, free as in cost. MIT licensed, and your clients' documents stay in your own account.</FeatureSection>
    <FeatureSection id="upload-link" title="One link for every document." reverse drawing={<UploadDrawing />}>Send a reminder with a private upload link. Your client uploads each file without an account; you accept it or ask again.</FeatureSection>
    <FeatureSection id="review" title="A second pair of eyes, recorded." drawing={<ReviewDrawing />}>The preparer submits. The assigned reviewer signs off with a note, and every decision is in the audit log.</FeatureSection>
    <FeatureSection id="time" title="Time, exported once." reverse drawing={<BillingDrawing />}>Each person's time is recorded at their own rate. Approve an export once and its CSV never changes.</FeatureSection>
    <section id="included" className="landing-included" aria-labelledby="included-title"><h2 id="included-title">Also included</h2><ul className="landing-features">{included.map(feature => <li key={feature.label}><span className="landing-feature-icon"><LineIcon name={feature.icon} /></span><span>{feature.label}</span></li>)}</ul></section>
    <section id="try" className="landing-closing blotter" aria-labelledby="try-title"><h2 id="try-title">Try it on one client.</h2><p>Run next quarter's BAS for one client through Blotter. Keep everything else as it is.</p><RunActions /></section>
  </main></SiteFrame>
}
