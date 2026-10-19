import { Arrow, Marked } from '../../parts/type'
import { links } from '../../shell/links'
import { HeroCards } from './HeroCards'
import { crops } from './plan'
import { Plate } from './Plate'
import { Modules, WeekStrip } from './WeekStrip'

/** Run Blotter, Try the demo and Read the docs: the hero's and the closing's actions. */
export function Actions({ demo = true }: { demo?: boolean }) {
  return <div className="actions">
    <a className="run-button" href={links.run}><span>Run Blotter</span> <Arrow /></a>
    {demo && <a className="text-link" href={links.demo}>Try the demo</a>}
    <a className="text-link" href={links.docs}>Read the docs</a>
  </div>
}

const desk = crops.desk
const label = 'The firm’s October 2026 wall planner: staff on ladders move client strips onto their days, the extension deadline on Thursday the 15th is ringed in marker, and binders and plants stand at either side.'

/**
 * The approved wall-planner hero. Wide screens: the clean plate with the planner's words and the five record cards
 * set over it where the drawing puts them. Tablets: the planner alone, then the cards. Phones: the week of Oct 12,
 * a crop of the planner around the ringed deadline, the cards as a list and the module binders as a list.
 */
export function Hero() {
  return <section className="hero" aria-labelledby="hero-title">
    <div className="hero-copy site-wrap">
      <h1 id="hero-title">Client work, ahead of <Marked sparks>every deadline.</Marked></h1>
      <p className="hero-sub">Blotter schedules every client{'’'}s recurring work against federal and state deadlines, chases documents and signatures, routes the work through review and collects the fee.</p>
      <p className="hero-alt">100% free, open source alternative to <strong>Karbon</strong>, <strong>TaxDome</strong> and <strong>Canopy</strong></p>
      <Actions />
    </div>
    <div className="hero-wide">
      <Plate crop={desk} name="hero" widths={[768, 1152, 1536]} sizes="(min-width: 1536px) 1536px, 100vw" className="plate-desk" label={label}>
        <HeroCards crop={desk} />
      </Plate>
    </div>
    <div className="hero-narrow">
      <WeekStrip />
      <Plate crop={crops.planner} name="hero-planner" widths={[690, 920]} sizes="(min-width: 760px) 920px, 0px" className="plate-planner" label={label} />
      <Plate crop={crops.phone} name="hero-phone" widths={[405]} sizes="100vw" className="plate-phone" label={label} />
      <div className="hero-list"><HeroCards /></div>
      <Modules />
    </div>
  </section>
}
