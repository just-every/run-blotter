import { Section } from '../../parts/Section'
import { Check, Marked } from '../../parts/type'

const preparers: [string, number][] = [['Priya Shah', 50], ['Marcus Bell', 50], ['Jordan Ellis', 46], ['Lauren Hughes', 38]]

/** 09 · Rejected Tuesday. Accepted Wednesday.: the page's one failure and its recovery, on the one dark band. */
export function Efile() {
  return <Section id="efile" tone="night" eyebrow="E-file · Chen 1040 · Mon Oct 12 – Fri Oct 16" layout="left"
    title={<>Rejected Tuesday. <Marked>Accepted Wednesday.</Marked></>}
    body="The IRS rejected one return over last year's AGI. The agent found the mismatch, Marcus fixed it, and every extended return was accepted.">
    <div className="efile-grid">
      <ol className="efile-timeline">
        <li><b>Mon Oct 12</b> · 11:20 am · reviewed by Dana Kim</li>
        <li><b>5:40 pm</b> · Form 8879 signed by Wei and Lin Chen</li>
        <li><b>6:10 pm</b> · transmitted by Marcus Bell (UltraTax CS)</li>
        <li className="is-rejected"><span className="ring" aria-hidden="true" /><b>Tue Oct 13, 8:02 am</b> · <b>Rejected</b> · IND-031-04 · the primary taxpayer{'’'}s prior-year AGI does not match IRS records</li>
        <li>Reopened to In progress – rework · Marcus Bell · due Thu Oct 15</li>
        <li className="is-agent"><b>8:06 am</b> · <b>agent:</b> The return used $151,320 from the 2024 Form 1040-X filed in March. The original 2024 return on file shows $148,920, and IRS e-file checks against the original.</li>
        <li><b>9:20 am</b> · Marcus set prior-year AGI to $148,920</li>
        <li className="is-done"><b>10:05 am</b> · Dana re-reviewed <Check /></li>
        <li><b>10:15 am</b> · retransmitted</li>
        <li className="is-done"><b>Wed Oct 14, 9:15 am</b> · accepted <Check /> · NC D-400 accepted 11:30 am <Check /></li>
      </ol>
      <article className="tally">
        <h3 className="display">Extended 1040s · due Thu Oct 15</h3>
        <div className="tally-big"><p><b>184</b><span>transmitted</span></p><p><b>184</b><span>accepted <Check /></span></p></div>
        <p className="tally-label">accepted, by preparer</p>
        <ul>{preparers.map(([name, n]) => <li key={name}><span><b>{name}</b> · {n} of {n} <Check /></span><span className="tally-bar" /></li>)}</ul>
        <p className="tally-row"><b>States:</b> NC D-400 171 accepted <Check /> · 9 other states accepted <Check /> · 4 with no state return</p>
        <p className="tally-row"><b>Rejections:</b> 1 · fixed and accepted Wed Oct 14 <Check /></p>
        <p className="tally-foot">Last transmitted Thu Oct 15, 4:40 pm · all accepted Fri Oct 16, 10:05 am · status from UltraTax CS</p>
      </article>
    </div>
  </Section>
}
