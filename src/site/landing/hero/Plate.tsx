import type { CSSProperties, ReactNode } from 'react'
import { arrows, Check } from '../../parts/type'
import { days, tiles, weekdays, type Crop } from './plan'

const pct = (value: number, of: number) => `${(value / of * 100).toFixed(3)}%`
/** A size given in the drawing's pixels, scaled with the crop's width and never under the page's 11 px floor. */
const size = (px: number, crop: Crop) => `max(11px, ${(px / crop.w * 100).toFixed(3)}cqw)`
const inside = (crop: Crop, x: number, y: number, w = 0, h = 0) => x >= crop.x && y >= crop.y && x + w <= crop.x + crop.w && y + h <= crop.y + crop.h

function at(crop: Crop, x: number, y: number, w?: number, h?: number, extra: CSSProperties = {}): CSSProperties {
  return { left: pct(x - crop.x, crop.w), top: pct(y - crop.y, crop.h), ...(w ? { width: pct(w, crop.w) } : {}), ...(h ? { height: pct(h, crop.h) } : {}), ...extra }
}

function Clock() {
  return <svg className="clock" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 4.8V8l2.2 1.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
}

/** One crop of the clean hero plate with the planner's words set over it at the drawing's positions. */
export function Plate({ crop, name, sizes, widths, className, children, label }: { crop: Crop; name: string; sizes: string; widths: number[]; className: string; children?: ReactNode; label: string }) {
  const set = (type: string) => widths.map(w => `/site/${name}-${w}.${type} ${w}w`).join(', ')
  const header = inside(crop, 380, 324, 820, 52)
  return <figure className={`plate ${className}`} style={{ aspectRatio: `${crop.w} / ${crop.h}` }}>
    <picture>
      <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
      <img src={`/site/${name}-${widths[widths.length - 1]}.webp`} srcSet={set('webp')} sizes={sizes} width={crop.w} height={crop.h} alt={label} loading={className.includes('desk') ? 'eager' : 'lazy'} decoding="async" />
    </picture>
    <div className="plate-words">
      {header && <p className="planner-head" style={at(crop, 392, 330, 808, 46)}>
        <span className="planner-month" style={{ fontSize: size(35, crop) }}>October 2026</span>
        <span className="planner-line" style={{ fontSize: size(19, crop) }}>Extensions done. <span>September closed.</span> <span>Fees collected.</span> <svg className="smile" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="8.6" cy="10" r="1.3" fill="currentColor" /><circle cx="15.4" cy="10" r="1.3" fill="currentColor" /><path d="M7.8 14.2q4.2 3.8 8.4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></span>
      </p>}
      {inside(crop, 380, 384, 0, 26) && <p className="planner-days" style={at(crop, crop.x > 375 ? crop.x : 375, 384, Math.min(crop.x + crop.w, 1210) - Math.max(crop.x, 375), 28)}>
        {weekdays.filter(([, x]) => x > crop.x + 20 && x < crop.x + crop.w - 20).map(([day, x]) => <span key={day} style={{ left: pct(x - Math.max(crop.x, 375), Math.min(crop.x + crop.w, 1210) - Math.max(crop.x, 375)), fontSize: size(15, crop) }}>{day}</span>)}
      </p>}
      {days.filter(([, x, y]) => inside(crop, x, y, 24, 20)).map(([n, x, y]) => <span key={n} className="planner-num" style={at(crop, x, y, undefined, undefined, { fontSize: size(19, crop) })}>{n}</span>)}
      {inside(crop, 845, 495, 110, 90) && <span className="planner-ring" style={at(crop, 852, 500, 100, 84)}>
        <b style={{ fontSize: size(29, crop) }}>15</b><span style={{ fontSize: size(17, crop) }}>Extension<br />deadline</span>
      </span>}
      {tiles.filter(t => inside(crop, t.x, t.y, t.w, t.h)).map(t => <span key={t.label} className={`planner-tile is-${t.state}${t.plain ? ' is-plain' : ''}`} title={t.state === 'scheduled' ? 'Scheduled' : 'Done'}
        style={at(crop, t.x, t.y, t.w, t.h, { fontSize: size(t.size ?? 15, crop), ...(t.rot ? { transform: `rotate(${t.rot}deg)` } : {}) })}>
        <span>{arrows(t.label)}</span>{t.plain ? null : t.state === 'done' ? <Check tone="ink" /> : <Clock />}
      </span>)}
      {children}
    </div>
  </figure>
}

export const placed = at
export const scaled = size
