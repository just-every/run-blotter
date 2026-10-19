import { Check } from '../../parts/type'

const week: { day: string; n: number; tile?: string; tone?: string }[] = [
  { day: 'Mon', n: 12, tile: 'Harbor Taco', tone: 'marigold' },
  { day: 'Tue', n: 13, tile: 'Wilson 1065', tone: 'lilac' },
  { day: 'Wed', n: 14, tile: 'Garcia 1040', tone: 'marigold' },
  { day: 'Thu', n: 15 },
  { day: 'Fri', n: 16, tile: 'All accepted', tone: 'mint' },
  { day: 'Sat', n: 17 },
]

/** Phones: the planner's header strip and the week of Oct 12, as the wall shows it. */
export function WeekStrip() {
  return <section className="week-strip" aria-label="The firm's planner, week of October 12, 2026">
    <p className="planner-head"><span className="planner-month">October 2026</span><span className="planner-line">Extensions done. September closed. Fees collected.</span></p>
    <ol>{week.map(d => <li key={d.n} className={d.n === 15 ? 'is-deadline' : undefined}>
      <span className="week-day">{d.day}</span><span className="planner-num">{d.n}</span>
      {d.n === 15 ? <span className="week-ring">Extension deadline</span> : d.tile ? <span className={`week-tile tone-${d.tone}`}>{d.tile} <Check tone="ink" /></span> : null}
    </li>)}</ol>
  </section>
}

/** Phones and tablets: the module binders as a list. */
export function Modules() {
  const modules = ['Clients', 'Work queues', 'Client portal', 'QuickBooks & Xero', 'Signatures & KBA', 'Reviewer sign-off', 'Invoices & payments']
  return <ul className="hero-modules" aria-label="What Blotter holds">{modules.map(m => <li key={m}>{m}</li>)}</ul>
}
