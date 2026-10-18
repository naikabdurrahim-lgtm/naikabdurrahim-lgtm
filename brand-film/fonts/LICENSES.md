# Font licences

All fonts in this folder are licensed under the **SIL Open Font License 1.1**
(https://openfontlicense.org). They may be used, modified and redistributed
freely, including commercially, provided the licence is retained — which this
file and the upstream packages do.

| File | Family | Upstream | Designer / Publisher |
|---|---|---|---|
| `space-grotesk-500.ttf`, `space-grotesk-700.ttf` | Space Grotesk | `@fontsource/space-grotesk` | Florian Karsten, SIL OFL 1.1 |
| `inter-400.ttf`, `inter-500.ttf`, `inter-600.ttf` | Inter | `@fontsource/inter` | Rasmus Andersson, SIL OFL 1.1 |
| `jetbrains-mono-400.ttf`, `jetbrains-mono-500.ttf` | JetBrains Mono | `@fontsource/jetbrains-mono` | JetBrains, SIL OFL 1.1 |
| `archivo-600.ttf`, `archivo-700.ttf`, `archivo-800.ttf` | Archivo | `@fontsource/archivo` | Omnibus-Type, SIL OFL 1.1 |

The `.ttf` files here are converted from the upstream `.woff2` distributions
using `fontTools` (see `tools/fetch_fonts.sh`). Converting a font is permitted
under the OFL.

To re-download instead of using the committed copies, run `./tools/fetch_fonts.sh`.
