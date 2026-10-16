// Shared by route documents and native auth/setup pages. All fonts are local.
export const fontLinks = [
  { rel: 'preload', href: '/fonts/red-hat-text/RedHatText.ttf', as: 'font', type: 'font/ttf', crossOrigin: 'anonymous' },
  { rel: 'stylesheet', href: '/fonts/fonts.css' },
] as const
export const fontHead = fontLinks.map(link => `<link ${Object.entries(link).map(([name, value]) => `${name.toLowerCase()}="${value}"`).join(' ')}>`).join('')
