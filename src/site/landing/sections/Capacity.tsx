import { IconTile } from '../../parts/icons'
import { Section } from '../../parts/Section'
import { Arrow, Check, Marked } from '../../parts/type'

// Hours booked against each person's own week; Ben works 24 h, so his track ends at 24.
const staff: { name: string; booked: number; of: number; note: string; over?: number }[] = [
  { name: 'Priya Shah', booked: 40, over: 6, of: 40, note: '46 of 40 h → 40 of 40' },
  { name: 'Marcus Bell', booked: 34, of: 40, note: '34 of 40 h → 40 of 40' },
  { name: 'Jordan Ellis', booked: 39, of: 40, note: '39 of 40 h' },
  { name: 'Lauren Hughes', booked: 38, of: 40, note: '38 of 40 h' },
  { name: 'Dana Kim', booked: 36, of: 40, note: '36 of 40 h (review)' },
  { name: 'Aisha Grant', booked: 32, of: 40, note: '32 of 40 h (payroll: Q3 941 prep)' },
  { name: 'Ben Okafor', booked: 24, of: 24, note: '24 of 24 h (part time)' },
]

/** 07 · Overbooked at 7:30. Balanced by 8.: the week's hours, the agent's two options, the manager's choice. */
export function Capacity() {
  return <Section id="capacity" tone="wash" layout="split" eyebrow="Capacity · Week of Mon Oct 12"
    title={<>Overbooked at 7:30. <Marked>Balanced by 8.</Marked></>}
    body="The agent found Priya six hours over, with two returns that could move. Teresa approved the plan, and both returns made the deadline.">
    <div className="capacity-grid">
      <div className="card capacity-chart">
        <p className="cap-scale" aria-hidden="true"><span>40 h</span></p>
        <ul>{staff.map(s => <li key={s.name} className={s.over ? 'is-over' : undefined}>
          <span className="cap-name">{s.name}</span>
          <span className="cap-track" style={{ ['--of' as string]: s.of, ['--booked' as string]: s.booked, ['--over' as string]: s.over ?? 0 }}><span className="cap-bar" />{s.over ? <span className="cap-over" /> : null}{s.of < 40 && <span className="cap-end" aria-hidden="true">24 h</span>}</span>
          <span className="cap-note">{s.note.split(' → ').map((part, i) => <span key={part}>{i > 0 && <> <Arrow /> </>}{part}</span>)}</span>
        </li>)}</ul>
      </div>
      <article className="card capacity-agent">
        <h3><IconTile name="sparkle" /><span><span className="display">Agent · Mon Oct 12, 7:30 am</span><small>Priya Shah booked 46 of 40 h · 2 returns can move without changing a deadline</small></span></h3>
        <div className="options">
          <section className="option is-picked"><h4><span className="radio"><Check tone="ink" /></span>Option A</h4><p>Delgado 1040 (3.5 h) + Brooks 1040 (2.5 h) <Arrow /> Marcus Bell · 34 <Arrow /> 40 of 40 · prepares 1040s · reviewer stays Dana Kim</p></section>
          <section className="option"><h4><span className="radio" />Option B</h4><p>Both to Lauren Hughes <Arrow /> 44 of 40 · overbooked</p></section>
        </div>
        <p className="done-row"><span className="check-dot"><Check tone="mint" /></span><span>7:52 am · Teresa Alvarez approved A · Marcus notified <Check /></span></p>
        <div className="done-pair">
          <p className="done-row"><span className="check-dot"><Check tone="mint" /></span><span>Delgado 1040<br />accepted Wed Oct 14 <Check /></span></p>
          <p className="done-row"><span className="check-dot"><Check tone="mint" /></span><span>Brooks 1040<br />accepted Thu Oct 15 <Check /></span></p>
        </div>
      </article>
    </div>
  </Section>
}
