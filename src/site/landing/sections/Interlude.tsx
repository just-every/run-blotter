import { Check } from '../../parts/type'

/** 10 · Interlude: Harbor Taco Co.'s order window at the Wednesday lunch rush, its tag set as HTML. */
export function Interlude() {
  const set = (name: string, widths: number[], type: string) => widths.map(w => `/site/${name}-${w}.${type} ${w}w`).join(', ')
  return <section className="interlude" aria-label="Wednesday, October 14 at Harbor Taco Co.">
    <figure className="interlude-art">
      <picture>
        <source media="(max-width: 759px)" type="image/avif" srcSet={set('interlude-phone', [470, 940], 'avif')} sizes="100vw" />
        <source media="(max-width: 759px)" type="image/webp" srcSet={set('interlude-phone', [470, 940], 'webp')} sizes="100vw" />
        <source type="image/avif" srcSet={set('interlude', [768, 1152, 1536], 'avif')} sizes="(min-width: 1536px) 1536px, 100vw" />
        <img src="/site/interlude-1536.webp" srcSet={set('interlude', [768, 1152, 1536], 'webp')} sizes="(min-width: 1536px) 1536px, 100vw" width={1536} height={1009} loading="lazy" decoding="async"
          alt="Harbor Taco Co.'s walk-up window on a Raleigh street at lunch: Miguel hands tacos across the counter to the first of four customers in line, under a striped marigold awning." />
      </picture>
      <p className="interlude-tag"><span>Wed Oct 14 ·</span> <span>Harbor Taco Co. ·</span> <span>September closed ·</span> <span>October fee paid <Check /></span></p>
    </figure>
  </section>
}
