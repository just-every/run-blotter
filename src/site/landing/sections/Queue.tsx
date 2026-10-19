import { Icon } from '../../parts/icons'
import { Section } from '../../parts/Section'
import { Arrow, Check, Marked } from '../../parts/type'

/** 06 · Monday, three days to go: every extended return on one board at 7:00 am, before the capacity run. */
export function Queue() {
  return <Section id="queue" layout="left" eyebrow="Work queue · Extended 1040s · Mon Oct 12, 7:00 am"
    title={<>Monday, <Marked>three days</Marked> to go.</>}
    body="Every return on one board, by status and due date, with what each one is waiting on.">
    <div className="board card">
      <p className="board-filters" aria-label="Board filters"><span className="filter">Work type: 1040</span><span className="filter">Due: Thu Oct 15</span><span className="filter">All preparers</span></p>
      <div className="board-columns">
        <section className="lane">
          <h3><Icon name="clock" className="lane-icon icon" /><span className="display">In progress · 21</span></h3>
          <ul className="lane-counts"><li>preparing 15</li><li>transmitted, awaiting acknowledgment 6</li></ul>
          <p className="job tone-marigold">Delgado 1040 · Priya Shah · 3.5 h left</p>
          <p className="job tone-marigold">Brooks 1040 · Priya Shah · 2.5 h left</p>
        </section>
        <section className="lane">
          <h3><Icon name="hourglass" className="lane-icon icon" /><span className="display">Waiting · 17</span></h3>
          <ul className="lane-counts"><li>on client documents 6</li><li>on 8879 signature 11</li></ul>
          <p className="job tone-lilac">Garcia 1040 · Lauren Hughes · 1 document: Form 1098</p>
          <p className="job tone-lilac">Nguyen 1040 · Jordan Ellis · 8879 sent Fri Oct 9</p>
        </section>
        <section className="lane">
          <h3><Icon name="document" className="lane-icon icon" /><span className="display">In review · 15</span></h3>
          <p className="job tone-pale">Chen 1040 · prepared Wed Oct 7 · Marcus Bell <Arrow /> Dana Kim</p>
          <p className="job tone-pale">Ramirez 1040 · MFJ · Priya Shah <Arrow /> Dana Kim</p>
        </section>
        <section className="lane lane-done">
          <h3><Icon name="checkCircle" className="lane-icon icon" /><span className="display">Completed · accepted 131</span></h3>
          <div className="done-stack" role="img" aria-label="131 accepted returns">{Array.from({ length: 9 }, (_, i) => <span key={i} style={{ ['--i' as string]: i }}><Check tone="ink" /></span>)}</div>
        </section>
      </div>
    </div>
    <p className="board-sum">184 extended 1040s = 21 + 17 + 15 + 131 · by preparer: Priya Shah 52 · Marcus Bell 48 · Jordan Ellis 46 · Lauren Hughes 38</p>
  </Section>
}
