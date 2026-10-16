export type IconName = 'document' | 'file' | 'person' | 'people' | 'preparation' | 'upload' | 'archive' | 'audit'

export function LineIcon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`landing-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'document' && <><path d="M5 2h9l5 5v15H5zM14 2v6h5M8 11h8M8 14h8M8 17h6" /></>}
    {name === 'file' && <path d="M6 3h8l5 5v13H6zM14 3v6h5" />}
    {name === 'person' && <><circle cx="12" cy="7" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2z" /></>}
    {name === 'people' && <><circle cx="8" cy="7" r="3" /><circle cx="18" cy="7" r="2.5" /><path d="M1 21v-2a7 7 0 0 1 14 0v2zM17 13c4 0 6 3 6 7" /></>}
    {name === 'preparation' && <><path d="M5 2h12l2 3v17H5zM9 7h6M9 12h6M9 17h4" /></>}
    {name === 'upload' && <path d="M12 16V2M7 7l5-5 5 5M3 13v9h18v-9" />}
    {name === 'archive' && <><path d="M3 7h18v15H3zM2 3h20v4H2z" /><rect x="9" y="11" width="6" height="4" rx="1" /></>}
    {name === 'audit' && <><path d="M13 22H3V2h10l5 5v5M13 2v6h5M17 17l6 6" /><circle cx="13" cy="13" r="5" /></>}
  </svg>
}
