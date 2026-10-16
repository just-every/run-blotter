# Fonts

Red Hat Display (headings) and Red Hat Text (body and controls) are self-hosted
variable fonts from the Google Fonts repository. Their SIL Open Font License
1.1 files are alongside the fonts in `red-hat-display/` and `red-hat-text/`.

The shared theme imports `/fonts/fonts.css`. Native auth, setup and route
heads also link that stylesheet; the body font is preloaded by `font-head.ts`.
Every page uses the same files without a request to another origin.

Upstream: https://github.com/google/fonts/tree/main/ofl/redhatdisplay and
https://github.com/google/fonts/tree/main/ofl/redhattext.
