import { IconTile } from '../../parts/icons'
import { Section } from '../../parts/Section'
import { arrows, Check, Marked } from '../../parts/type'

const counts: [string, string][] = [
  ['Clients', '418 · contacts 1,046'], ['Duplicates', '4 merged'], ['Work types', '9 · 6 stages · 14 sub-statuses'],
  ['Schedules', '23 → 23 rules'], ['Future jobs', '340 · 123 closes + 111 payroll + 69 sales tax + 37 Q3 941s'],
  ['Automators', '12, imported paused'], ['Templates', '31 · Gmail mailboxes 9'], ['Client books', '41 · 38 QuickBooks Online + 3 Xero'],
  ['Invoices', '4,817 kept · numbering from 4818'],
]

/** 12 · Every schedule moved, every month kept: one Karbon schedule becoming one Blotter rule, and the counts. */
export function MoveIn() {
  return <Section id="move-in" tone="wash" eyebrow="Moving in · From Karbon · Sat Aug 22 – Thu Oct 1"
    title={<>Every schedule moved, <Marked>every month kept.</Marked></>}
    body="Each Karbon repeating schedule became one rule that holds the months Karbon had already made. All 44 auto-pay clients were ready before October's first charge.">
    <div className="schedule-move">
      <article className="card karbon">
        <h3><IconTile name="calendar" tone="grey" /><span><span className="display">In Karbon · repeating schedule</span><small>Monthly close · 41 clients · work made 3 months ahead</small></span></h3>
        <ul className="month-chips"><li>Oct · 41</li><li>Nov · 41</li><li>Dec · 41</li></ul>
        <p className="muted-note">already made in Karbon</p>
      </article>
      <p className="cutover"><span>Tue Sep 1 · Teresa Alvarez approved cutover</span><svg viewBox="0 0 190 40" aria-hidden="true"><path d="M6 24c40-8 100-10 168-6" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" /><path d="M160 6l20 13-21 14" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg><span className="muted-note">each month claimed once</span></p>
      <article className="card blotter-rule">
        <h3><IconTile name="document" /><span className="display">In Blotter · 1 rule · Monthly close · 12 days after month end</span></h3>
        <ul className="month-chips"><li>Oct · 41 ·<br />from Karbon</li><li>Nov · 41 ·<br />from Karbon</li><li>Dec · 41 ·<br />from Karbon</li><li className="is-new"><b>Jan 2027</b> · 41<br />made Thu Oct 1 <Check /></li></ul>
      </article>
    </div>
    <div className="move-grid">
      <article className="card counts">
        <h3 className="display">Counts matched at cutover</h3>
        <table><tbody>{counts.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{arrows(v)}</td></tr>)}</tbody></table>
      </article>
      <div className="move-side">
        <article className="card autopay">
          <h3 className="display">Auto-pay · 44 clients</h3>
          <p className="autopay-bar"><span style={{ flexGrow: 37 }}>37 moved through Stripe</span><span style={{ flexGrow: 7 }}>7 reauthorized in the portal</span></p>
          <p>Karbon auto-pay off Wed Sep 30 · first Blotter auto-pay Thu Oct 1 <Check /></p>
        </article>
        <figure className="terminal" aria-label="Start Blotter on your computer">
          <span className="terminal-dots" aria-hidden="true"><i /><i /><i /></span>
          <pre><code><span className="prompt" aria-hidden="true">$ </span><span className="nw">npx -y @runeditrun/rer dev</span> <span className="nw">just-every/run-blotter</span>{'\n'}<span className="comment"># clones, installs and starts Blotter on your computer</span></code></pre>
        </figure>
        <p className="also">Also moves in from TaxDome, Canopy, Financial Cents and Double.</p>
      </div>
    </div>
  </Section>
}
