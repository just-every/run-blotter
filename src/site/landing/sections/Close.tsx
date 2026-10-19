import { Section } from '../../parts/Section'
import { Arrow, Check, keepTail, Marked } from '../../parts/type'

const tick = <span className="tick"><Check tone="raspberry" /><i>PS</i></span>
const timeline: [string, string, boolean?][] = [
  ['8:12 am', 'statement in'], ['10:40 am', 'rec tied'], ['11:02 am', 'variance question sent'], ['1:15 pm', 'answer and receipt'],
  ['2:30 pm', 'submitted for review'], ['3:05 pm', 'Dana’s note: reclass the sensor'], ['3:20 pm', 'Priya reclassed it in QuickBooks'],
  ['3:41 pm', 'Signed off by Dana Kim · note: sensor reclassed to equipment', true],
]

/** 05 · Tied out, ticked and signed off: one September workpaper, ticked, questioned and signed. */
export function Close() {
  return <Section id="close" tone="wash" layout="split" eyebrow="Close · Bright Smile Dental · September · Fri Oct 9"
    title={<>Tied out, ticked <span className="nowrap">and <Marked>signed off.</Marked></span></>}
    body="Priya tied the bank rec, the one big change came back with a receipt, and Dana signed off with a note.">
    <div className="workpapers">
      <span className="paper-corner left" aria-hidden="true"><b>Harbor Taco Co.</b></span>
      <span className="paper-corner right top" aria-hidden="true"><b>Rivera Landscaping LLC</b></span>
      <span className="paper-corner right" aria-hidden="true"><b>Oak & Iron Fitness</b></span>
      <article className="workpaper">
        <h3 className="display">September close · Bright Smile Dental · QuickBooks Online · preparer Priya Shah <Arrow /> reviewer Dana Kim</h3>
        <section className="wp-block">
          <h4>Bank rec</h4>
          <table className="rec">
            <tbody>
              <tr><th scope="row">Checking ••4417 statement</th><td>$84,210.55</td><td>{tick}</td></tr>
              <tr><th scope="row">− outstanding checks</th><td>$2,940.00</td><td>{tick}</td></tr>
              <tr><th scope="row">+ deposits in transit</th><td>$1,215.30</td><td>{tick}</td></tr>
              <tr className="total"><th scope="row">= <b>$82,485.85</b> · <span className="nowrap">ties to QuickBooks <Check tone="ink" /> <span className="foot">^</span></span></th><td /><td>{tick}</td></tr>
            </tbody>
          </table>
        </section>
        <section className="wp-block">
          <h4>Variance</h4>
          <p>Supplies $6,120.00 vs August $2,480.00 · +147%</p>
          <p><Arrow /> asked Dr. Hannah Lee <Arrow /> new X-ray sensor $3,640.00, receipt <Check tone="raspberry" /></p>
          <p className="after">Supplies $2,480.00 · <span className="nowrap">Equipment +$3,640.00 <Check tone="raspberry" /></span></p>
          <p className="dana-note"><span className="nowrap">equipment, not</span> <span className="nowrap">supplies <Arrow /> reclass</span> <b>DK</b></p>
        </section>
        <p className="legend"><span><Check tone="raspberry" /> agreed to statement</span><span><i>^</i> footed</span></p>
      </article>
    </div>
    <ol className="close-timeline">{timeline.map(([time, text, done]) => <li key={time} className={done ? 'is-done' : undefined}><b>{time}</b><span>{keepTail(text)}{done && <> <Check tone="ink" /></>}</span></li>)}</ol>
    <p className="pill-done">September closes · 41 of 41 signed off by Mon Oct 12, 4:10 pm <Check /></p>
  </Section>
}
