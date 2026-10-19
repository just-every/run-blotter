import { Icon, IconTile, type IconName } from '../../parts/icons'
import { Section } from '../../parts/Section'
import { Check, Marked } from '../../parts/type'

const lines: { date: string; who: string; amount: string; icon: IconName; answer: string; judgment?: boolean }[] = [
  { date: 'Sep 3', who: 'Restaurant Depot', amount: '$1,284.60', icon: 'file', answer: 'Restaurant Depot: Food and paper goods · receipt attached' },
  { date: 'Sep 11', who: 'Venmo · Carlos M.', amount: '$400.00', icon: 'chat', answer: 'Venmo, Carlos M.: Weekend line cook, paid per shift', judgment: true },
  { date: 'Sep 18', who: 'Amazon', amount: '$236.18', icon: 'cart', answer: 'Amazon: Order uploaded · two prep tables and gloves' },
  { date: 'Sep 24', who: 'Zelle in', amount: '$1,150.00', icon: 'bank', answer: 'Zelle in: Catering, Oakwood block party' },
]

const footer: { icon: IconName; text: string; done?: boolean }[] = [
  { icon: 'calendar', text: 'Wed Oct 7 · 9 of 12 answered' },
  { icon: 'chat', text: 'Thu Oct 8 · reminder text on the last 3' },
  { icon: 'checkCircle', text: 'Fri Oct 9 · 12 of 12 answered', done: true },
  { icon: 'document', text: 'Mon Oct 12 · Dana Kim: contractor, W-9 requested, track for 1099-NEC' },
  { icon: 'list', text: 'Priya categorized all 12 in QuickBooks' },
  { icon: 'checkCircle', text: 'September close signed off Mon Oct 12, 4:10 pm', done: true },
]

/** 04 · Twelve lines, twelve exact questions: the read-only ledger wired line by line to the client's answers. */
export function Agent() {
  return <Section id="agent" eyebrow="Agent · Harbor Taco Co. · Mon Oct 5 – Mon Oct 12"
    title={<>Twelve lines, twelve <Marked>exact questions.</Marked></>}
    body="The agent read September in QuickBooks and asked about each uncategorized line. Priya approved the questions, and the judgment call went to Dana.">
    <div className="agent-board">
      <span className="agent-panel panel-ledger" aria-hidden="true" />
      <span className="agent-panel panel-answers" aria-hidden="true" />
      <header className="ledger-head">
        <IconTile name="document" />
        <div><h3 className="display"><span className="nowrap">Harbor Taco Co. ·</span> <span className="nowrap">QuickBooks Online</span></h3><p>September · read only · synced <span className="nowrap">Mon Oct 5, 7:02 am</span></p></div>
        <p className="ledger-total">12 uncategorized lines · $3,418.40</p>
      </header>
      <article className="card agent-card">
        <h3><IconTile name="sparkle" /><span className="display">Agent · <span className="nowrap">Mon Oct 5, 7:40 am</span></span></h3>
        <ol>
          <li>Read 12 lines and August for comparison</li>
          <li>Drafted 12 questions, one per line, each linked to its transaction</li>
          <li>9:58 am · Priya Shah approved, edited 1</li>
          <li>10:05 am · sent to Miguel Torres in the portal</li>
        </ol>
      </article>
      <header className="answers-head"><IconTile name="chat" /><h3 className="display">Miguel Torres · answers</h3></header>
      {lines.map((line, i) => [
        <p key={`l${i}`} className="ledger-line" style={{ gridRow: i + 2 }}><span>{line.date} · {line.who}</span><b>{line.amount}</b></p>,
        <span key={`w${i}`} className="ledger-wire" style={{ gridRow: i + 2 }} aria-hidden="true" />,
        <p key={`a${i}`} className={`answer${line.judgment ? ' is-judgment' : ''}`} style={{ gridRow: i + 2 }}>
          <IconTile name={line.icon} tone={line.judgment ? 'marigold' : 'mint'} />
          <span>{line.answer}{line.judgment && <em className="judgment">judgment: for the reviewer</em>}</span>
          {!line.judgment && <Check />}
        </p>,
      ])}
      <p className="ledger-line ledger-more" style={{ gridRow: 6 }}><span>+ 8 more</span><b>$347.62</b></p>
      <p className="answers-more" style={{ gridRow: 6 }}>+ 8 more · all answered <Check /></p>
    </div>
    <ol className="agent-footer">{footer.map(step => <li key={step.text} className={`card${step.done ? ' is-done' : ''}`}>
      <span className={`icon-tile tone-${step.done ? 'mint' : 'lilac'}`}><Icon name={step.icon} /></span><span>{step.text}{step.done && <> <Check /></>}</span>
    </li>)}</ol>
  </Section>
}
