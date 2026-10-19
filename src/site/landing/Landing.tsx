import { SiteFooter } from '../shell/SiteFooter'
import { SiteHeader } from '../shell/SiteHeader'
import { Hero } from './hero/Hero'
import { Agent } from './sections/Agent'
import { Billing } from './sections/Billing'
import { Capacity } from './sections/Capacity'
import { Close } from './sections/Close'
import { Closing } from './sections/Closing'
import { Documents } from './sections/Documents'
import { Efile } from './sections/Efile'
import { Interlude } from './sections/Interlude'
import { MoveIn } from './sections/MoveIn'
import { Queue } from './sections/Queue'
import { Schedule } from './sections/Schedule'
import { Signatures } from './sections/Signatures'
import '../styles/base.css'
import '../styles/hero.css'
import '../styles/cards.css'
import '../styles/stages.css'
import '../styles/scenes.css'

/**
 * run-blotter.com's homepage, built from the design desk's approved page (19 Oct 2026, page-s1) in its order:
 * one October at Cardinal Tax & Books, a nine-person firm in Raleigh, Thu Oct 1 – Fri Oct 16, 2026.
 * Painted art appears only in the hero, the interlude and the closing; every other drawing is HTML and CSS.
 */
export function Landing() {
  return <>
    <SiteHeader />
    <main id="main">
      <Hero />
      <Schedule />
      <Documents />
      <Agent />
      <Close />
      <Queue />
      <Capacity />
      <Signatures />
      <Efile />
      <Interlude />
      <Billing />
      <MoveIn />
      <Closing />
    </main>
    <SiteFooter />
  </>
}
