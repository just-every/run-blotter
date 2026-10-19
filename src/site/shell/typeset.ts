// Final typesetting for built pages: no line starts with a "·", "+", "–", "—" or "→"; IDs, form numbers, hyphenated
// words and number ranges, dates and times never break inside themselves, and an amount stays with the short word that
// leads into it. Only text between tags changes; blocks of code, scripts and styles are left as they are, and inline
// code only gains the keep-together spans (its text, as copied, is unchanged).
const KEEP = /\b(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) )?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,4}(?:, \d{4})?(?:–\d{1,2})?\b|\b\d{1,2}:\d{2} (?:am|pm)\b|\(?\b[\w$]+(?:[-–][\w$]+)+\b\)?|\b\d+(?:\.\d)? h\b|\b(?:a|an|or|and|of|to|by|at) [−-]?\$[\d,]+(?:\.\d\d)?/g
const SKIP = /^<(pre|script|style|svg|title)\b/i

// An arrow or a check stays on the line of the word before it, with a separator that follows it, so no wrapped line
// opens with one (a line may break after an inline svg even before a no-break space).
const glue = (html: string) => html.replace(/(<span class="nw">[^<]*<\/span>|[^\s<>]+) (<svg class="(?:arrow|check)\b[^"]*"[^]*?<\/svg>)( [·+–])?/g, '<span class="nw">$1 $2$3</span>')

export function typeset(html: string): string {
  let skipping: string | null = null, code = false
  return glue(html.split(/(<[^>]+>)/).map(part => {
    if (part.startsWith('<')) {
      const open = SKIP.exec(part)
      if (!skipping && open && !part.endsWith('/>')) skipping = open[1].toLowerCase()
      else if (skipping && part.toLowerCase().startsWith(`</${skipping}`)) skipping = null
      else if (!skipping && /^<\/?code\b/i.test(part)) code = part[1] !== '/'
      return part
    }
    if (skipping || !part.trim()) return part
    return (code ? part : part.replace(/ ([·+–—→]) /g, ' $1 ')).replace(KEEP, match => `<span class="nw">${match}</span>`)
  }).join(''))
}
