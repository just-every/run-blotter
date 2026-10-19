// Line icons for the homepage cards: 24 px grid, round 1.8 px strokes in currentColor.
const paths = {
  document: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M9.5 11h6M9.5 14.5h6M9.5 18h4" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="15" rx="2.5" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /><path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01" strokeWidth="2.6" /></>,
  chart: <><path d="M5 20v-5M10 20V10M15 20v-7M20 20V5" strokeWidth="3.2" /></>,
  file: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M9.5 13h6M9.5 16.5h6" /></>,
  home: <><path d="M4 11 12 4l8 7" /><path d="M6 9.5V20h12V9.5M10 20v-5.5h4V20" /></>,
  chat: <><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /></>,
  sparkle: <><path d="M10 4.5 11.6 9.4 16.5 11 11.6 12.6 10 17.5 8.4 12.6 3.5 11 8.4 9.4z" /><path d="M17.5 3v4M15.5 5h4M18 15.5v4M16 17.5h4" /></>,
  checkCircle: <><circle cx="12" cy="12" r="8.5" /><path d="m8.3 12.2 2.5 2.5 5-5.2" /></>,
  list: <><path d="M9 7h11M9 12h11M9 17h11" /><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" strokeWidth="2.8" /></>,
  shield: <><path d="M12 3.5 19 6v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" /></>,
  ribbon: <><circle cx="12" cy="9.5" r="5" /><path d="m9 13.8-1.6 6.7L12 18l4.6 2.5-1.6-6.7" /></>,
  hash: <><path d="M9.5 4 8 20M16 4l-1.5 16M5 9h15M4 15h15" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  hourglass: <><path d="M7 3.5h10M7 20.5h10M8 3.5c0 4.5 4 5.5 4 8.5s-4 4-4 8.5M16 3.5c0 4.5-4 5.5-4 8.5s4 4 4 8.5" /></>,
  warning: <><path d="M12 4 21 19.5H3z" /><path d="M12 10v4.5M12 17.2h.01" /></>,
  people: <><circle cx="8.5" cy="8.5" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M3.5 19c.5-3.4 2.4-5.5 5-5.5s4.5 2.1 5 5.5M14 14c2.6-.4 5 1.3 6.2 4.6" /></>,
  tax: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3v2.5h6V3M8.5 10h7M8.5 13.5h7M8.5 17h4" /></>,
  cart: <><path d="M3 4.5h2.5L8 15h10l2-7.5H6.5" /><circle cx="9.5" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>,
  bank: <><path d="M3.5 9 12 4.5 20.5 9zM5 20h14M6.5 11.5v6M10 11.5v6M14 11.5v6M17.5 11.5v6" /></>,
  send: <><path d="m4 11.5 16-7-5 16-3.5-6.5z" /><path d="m11.5 14 8.5-9.5" /></>,
} as const

export type IconName = keyof typeof paths

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return <svg className={className ?? 'icon'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

/** A pale rounded tile holding an icon, as the desk's cards lead their titles. */
export function IconTile({ name, tone = 'lilac' }: { name: IconName; tone?: 'lilac' | 'mint' | 'marigold' | 'grey' | 'coral' | 'sky' }) {
  return <span className={`icon-tile tone-${tone}`}><Icon name={name} /></span>
}
