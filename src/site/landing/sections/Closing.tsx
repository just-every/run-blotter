import { Check, Marked } from '../../parts/type'
import { Actions } from '../hero/Hero'

const tags = ['184 of 184 extended returns accepted', 'September · 41 of 41 closes signed off', '212 of 212 documents in', 'October fees · 58 recurring + 184 return invoices paid']

/** 13 · Friday, all caught up.: the firm's front steps at 5:30 pm on Fri Oct 16, its four tags, and the way in. */
export function Closing() {
  const set = (name: string, widths: number[], type: string) => widths.map(w => `/site/${name}-${w}.${type} ${w}w`).join(', ')
  return <section className="closing" aria-labelledby="closing-title">
    <figure className="closing-art">
      <picture>
        <source media="(max-width: 759px)" type="image/avif" srcSet={set('closing-phone', [560], 'avif')} sizes="100vw" />
        <source media="(max-width: 759px)" type="image/webp" srcSet={set('closing-phone', [560], 'webp')} sizes="100vw" />
        <source type="image/avif" srcSet={set('closing', [768, 1152, 1536], 'avif')} sizes="(min-width: 1536px) 1536px, 100vw" />
        <img src="/site/closing-1536.webp" srcSet={set('closing', [768, 1152, 1536], 'webp')} sizes="(min-width: 1536px) 1536px, 100vw" width={1536} height={722} loading="lazy" decoding="async"
          alt="Cardinal Tax & Books' bungalow in Oakwood at 5:30 pm on Friday: three staff walk down the front steps with their coats, under maples in autumn, a lit window behind them." />
      </picture>
      <ul className="porch-tags">{tags.map(tag => <li key={tag}><span>{tag} <Check /></span></li>)}</ul>
    </figure>
    <div className="closing-copy site-wrap">
      <h2 id="closing-title">Friday, <Marked>all caught up.</Marked></h2>
      <p>100% free and open source. MIT licensed.</p>
      <Actions demo={false} />
    </div>
  </section>
}
