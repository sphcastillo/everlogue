# Local fonts

These original font files come from https://github.com/google/fonts/tree/main/ofl
(downloaded 2026-10-12). Each family includes its SIL Open Font License.

- `DMSans[opsz,wght].ttf`: `ofl/dmsans`
- `Inter[opsz,wght].ttf`: `ofl/inter`
- `PlayfairDisplay-Italic[wght].ttf`: `ofl/playfairdisplay`
- `InstrumentSerif-Italic.ttf`: `ofl/instrumentserif`
- `DMMono-Medium.ttf`: `ofl/dmmono`

The root layout loads these with `next/font/local`, keeping the existing CSS
variables, font families, and required weights/styles. Commit the binary files
and licenses together with the layout change; no font download occurs at build
or runtime. Full upstream character coverage is retained.

This avoids the Google Fonts URL parsing failure tracked in
https://github.com/vercel/next.js/issues/99114 without patching Next.js or changing
bundlers. Updating a font is an explicit asset update rather than a build-time
network dependency.
