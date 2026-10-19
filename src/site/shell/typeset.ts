// Final typesetting for built pages: no line starts with a "·", and IDs, form numbers, dates and times never break
// inside themselves. Only text between tags changes; code, scripts and styles are left as they are.
const KEEP = /\b(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) )?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,4}(?:, \d{4})?(?:–\d{1,2})?\b|\b\d{1,2}:\d{2} (?:am|pm)\b|(?:\b[A-Z]{1,4}|\b\d{1,4})(?:-[A-Z0-9]{1,6})+\b|\b\d+(?:\.\d)? h\b/g
const SKIP = /^<(code|pre|script|style|svg|title)\b/i

// An arrow stays on the line of the word before it, so no wrapped line opens with one.
const glue = (html: string) => html.replace(/([^\s<>]+) (<svg class="arrow"[^]*?<\/svg>)/g, '<span class="nw">$1 $2</span>')

export function typeset(html: string): string {
  let skipping: string | null = null
  return glue(html).split(/(<[^>]+>)/).map(part => {
    if (part.startsWith('<')) {
      const open = SKIP.exec(part)
      if (!skipping && open && !part.endsWith('/>')) skipping = open[1].toLowerCase()
      else if (skipping && part.toLowerCase().startsWith(`</${skipping}`)) skipping = null
      return part
    }
    if (skipping || !part.trim()) return part
    return part.replaceAll(' · ', ' · ').replace(KEEP, match => `<span class="nw">${match}</span>`)
  }).join('')
}
