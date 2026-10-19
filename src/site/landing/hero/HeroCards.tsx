import { Check, Arrow, NoWrap } from '../../parts/type'
import { IconTile } from '../../parts/icons'
import { cardBoxes, type Crop } from './plan'
import { placed, scaled } from './Plate'

/** Over the wide plate a card covers the drawn card it replaces; in the narrow list it flows. */
function slot(key: keyof typeof cardBoxes, crop?: Crop) {
  if (!crop) return undefined
  const box = cardBoxes[key]
  return placed(crop, box.x, box.y, box.w, undefined, { minHeight: `${(box.h / crop.w * 100).toFixed(3)}cqw`, fontSize: scaled(13.4, crop) })
}

/** The hero's five record cards: the same records the page follows, set as HTML. */
export function HeroCards({ crop }: { crop?: Crop }) {
  return <>
    <article className="hero-card tone-lilac" data-card="extended" style={slot('extended', crop)}>
      <IconTile name="document" />
      <div><h3>Extended 1040s</h3><p>due <NoWrap>Thu Oct 15</NoWrap></p>
        <ul className="ticks"><li><Check tone="ink" /> 184 transmitted</li><li><Check /> 184 accepted</li></ul></div>
    </article>
    <article className="hero-card tone-coral" data-card="chen" style={slot('chen', crop)}>
      <IconTile name="warning" tone="coral" />
      <div><h3>Chen 1040</h3><p>rejected <NoWrap>IND-031-04</NoWrap><br /><NoWrap>Tue Oct 13</NoWrap></p>
        <ul className="steps"><li><Arrow /> prior-year AGI fixed</li><li><Arrow /> accepted <NoWrap>Wed Oct 14</NoWrap> <Check /></li></ul></div>
    </article>
    <article className="hero-card tone-mint" data-card="signature" style={slot('signature', crop)}>
      <IconTile name="file" tone="mint" />
      <div><h3>Form 8879</h3><p>Ramirez, MFJ<br />Maria signed <NoWrap>Mon Oct 12</NoWrap><br />Luis passed KBA on retry<br /><NoWrap>Tue Oct 13</NoWrap> <Check /></p></div>
    </article>
    <article className="hero-card tone-sky" data-card="payroll" style={slot('payroll', crop)}>
      <IconTile name="tax" tone="sky" />
      <div><h3>Q3 Form 941</h3><p>37 payroll clients<br />due <NoWrap>Sat Oct 31</NoWrap> <Arrow /> <NoWrap>Mon Nov 2</NoWrap></p></div>
    </article>
    <article className="hero-card tone-marigold" data-card="week" style={slot('week', crop)}>
      <IconTile name="people" tone="marigold" />
      <div><h3>Week of Oct 12</h3><p>Priya Shah booked 46 of 40 h<br /><Arrow /> 6 h to Marcus Bell <Check /></p></div>
    </article>
  </>
}
