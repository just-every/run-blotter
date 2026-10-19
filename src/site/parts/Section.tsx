import type { ReactNode } from 'react'
import { Eyebrow } from './type'

type Layout = 'centred' | 'split' | 'left'

/**
 * One stage of the firm's October: an eyebrow naming the stage, client or group and the dates, the heading in the
 * display face with one marked phrase, the body, then the stage's own drawing. `tone` is the white page, the pale
 * lilac wash (03, 05, 07, 12) or the one dark band (09).
 */
export function Section({ id, eyebrow, title, body, layout = 'centred', tone = 'white', children }: { id: string; eyebrow: ReactNode; title: ReactNode; body?: ReactNode; layout?: Layout; tone?: 'white' | 'wash' | 'night'; children: ReactNode }) {
  return <section id={id} className={`band band-${tone} band-${id}`} aria-labelledby={`${id}-title`}>
    <div className="site-wrap">
      <header className={`band-head head-${layout}`}>
        <div className="band-title"><Eyebrow>{eyebrow}</Eyebrow><h2 id={`${id}-title`}>{title}</h2></div>
        {body && <p className="band-body">{body}</p>}
      </header>
      {children}
    </div>
  </section>
}

/** A white card with a lilac hairline and the soft shadow. */
export function Card({ className = '', children, as: Tag = 'article' }: { className?: string; children: ReactNode; as?: 'article' | 'div' | 'section' }) {
  return <Tag className={`card ${className}`}>{children}</Tag>
}

/** The interpunct between phrases, kept with the phrase before it so no line starts with one. */
export const Dot = () => <span className="dot" aria-hidden="true"> ·</span>
