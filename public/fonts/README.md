# Fonts

Every font is self-hosted from the Google Fonts repository under the SIL Open
Font License 1.1; each licence is alongside its font.

- Red Hat Display and Red Hat Text (`red-hat-display/`, `red-hat-text/`):
  variable fonts, the app's headings, body and controls, and the run site's body.
  Upstream: https://github.com/google/fonts/tree/main/ofl/redhatdisplay and
  https://github.com/google/fonts/tree/main/ofl/redhattext.
- Roboto Serif (`roboto-serif/`): the run site's display face, the heavy
  condensed headline with small serifs. `roboto-serif-display.woff2` is an
  instance of the variable font at opsz 144 and GRAD 0, keeping width 50–100 and
  weight 500–900, subset to Latin with punctuation.
  Upstream: https://github.com/google/fonts/tree/main/ofl/robotoserif.
- Kalam (`kalam/`): the run site's marker hand, for planner tiles, ticks and
  notes, Regular and Bold subset to Latin.
  Upstream: https://github.com/google/fonts/tree/main/ofl/kalam.

The shared theme imports `/fonts/fonts.css`. Native auth, setup and route
heads also link that stylesheet; the body font is preloaded by `font-head.ts`.
Every page uses the same files without a request to another origin.
