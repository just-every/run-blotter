import type { ReactNode } from 'react'

/** The check mark the desk draws after every done state; text-sized, never a font glyph. */
export function Check({ tone = 'green' }: { tone?: 'green' | 'ink' | 'mint' | 'raspberry' | 'pistachio' }) {
  return <svg className={`check tone-${tone}`} viewBox="0 0 16 16" aria-hidden="true"><path d="m2.6 8.6 3.6 3.4 7.2-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

/** The arrow inside running text (no font in the set carries U+2192). The accessible text is "to". */
export function Arrow() {
  return <svg className="arrow" viewBox="0 0 18 12" role="img" aria-label="to"><path d="M1.5 6h14M11 1.5 15.5 6 11 10.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

/** Tracked deep-lilac caps naming the stage, the client or group and the dates. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>
}

/** One phrase of a heading under the hand-drawn marigold marker line. */
export function Marked({ children, sparks = false }: { children: ReactNode; sparks?: boolean }) {
  return <span className={`marked${sparks ? ' sparks' : ''}`}>{children}</span>
}

/** Keeps a date, time, ID or amount on one line. */
export function NoWrap({ children }: { children: ReactNode }) {
  return <span className="nowrap">{children}</span>
}

/** Text with "→" drawn as the arrow, since none of the page's fonts carries U+2192. */
export function arrows(text: string): ReactNode {
  const parts = text.split('→')
  return parts.length === 1 ? text : parts.map((part, i) => <span key={i}>{i > 0 && <Arrow />}{part}</span>)
}
