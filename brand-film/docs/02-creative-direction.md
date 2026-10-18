# 02 · Creative Direction & Visual Identity System

## The idea

**"The grid is the signature."**

The film is built as one continuous architectonic space — a dark, precise, measured room —
in which the work is exhibited rather than animated at the viewer. Everything that moves
moves because it has somewhere to go, and everything that stays still is still on purpose.
The two moments of stillness (the print in Scene 05, the philosophy in Scene 07) are what
make the motion around them mean something.

Nothing in the film is a template. The palette, the grid, the crop marks, the swatch motif
and the outlined `NAIK` wordmark were **reverse-engineered from your own
`naik-profile-banner.svg`** and rebuilt for 16:9, so the film is an extension of an identity
you already own rather than a new one invented for 60 seconds.

---

## Colour system

| Role | Value | Source | Use |
|---|---|---|---|
| Ink (deepest) | `#070A14` | — | frame ground |
| Ink | `#0B1020` | **your banner background** | base |
| Raised surface | `#12182A` | — | cards, insets |
| Warm white | `#F4F1EA` | brief | all primary type |
| Muted white | `#C4C0B8` | — | secondary type |
| **Accent** | `#10B981` | **your banner emerald** | rules, marks, one headline |
| Accent light | `#34D399` | **your tagline colour** | emphasised words |

**Supporting swatches** — `#3B82F6` blue, `#8B5CF6` violet, `#FF6B5E` coral, `#FF9A00` amber,
`#31A8FF` sky. These are **all taken from your banner**, and are used only as *data* colour:
grid lines, readouts, the closing swatches. They are never decoration, and never more than
one is on screen at a time.

**Unity across differently-coloured projects:** every artwork plate is presented on the same
near-black field, inside the same hairline frame with the same emerald registration marks.
The projects keep their own colour; the *system* around them is constant. That is what makes
a red restaurant post and a blue travel ad belong to the same film.

---

## Typography

Three families, strictly one job each.

| Family | Weight(s) | Job |
|---|---|---|
| **Space Grotesk** | 500 / 700 | all display type — headlines, the wordmark |
| **Inter** | 400 / 500 / 600 | tagline, supporting copy |
| **JetBrains Mono** | 400 / 500 | technical labels, captions, readouts, verticals |
| Archivo | 800 | one figure only: the `8+` in Scene 03 |

Rules that keep it coherent:
- Display type is **tight-tracked** (−0.4 to −1.5); labels are **wide-tracked** (+3 to +4).
  The contrast between the two does the hierarchy work.
- Every label is uppercase mono at 13–15 px with +3 tracking and a 5 px emerald square bullet.
- Leading is 1.2–1.4 em on display lines; nothing is ever condensed to fit.
- **No type is ever stretched.** Widths are measured with real metrics and auto-fitted.

Fonts are fetched from npm (`@fontsource/*`) and converted to TTF by
`tools/fetch_fonts.sh`. All four families are SIL OFL — see `fonts/LICENSES.md`.

---

## Grid & composition

- 12 columns · 120 px wide · 24 px gutter · 108 px side margins · 86 px top/bottom.
- Critical type never crosses the margins; only decorative grid lines and the frame do.
- The grid is *made visible* in Scenes 04 and 06 (hairline column rules) and then removed —
  the system shows itself and gets out of the way.
- Layouts rotate: left/right (S02), figure + column (S03), right/left/centre (S04 three beats),
  centred stack (S05), left/right (S06), left-aligned block (S07), centred lockup (S08).
  **No two consecutive scenes share a layout.**

---

## Motion language

| Principle | Implementation |
|---|---|
| Everything decelerates | `out_quint` / `out_expo` / `out_cubic` dominate. Almost nothing eases in. |
| Stagger, don't fade | Words, ticks and echoes arrive 0.075–0.165 s apart. |
| Reveals are masked, not opacity-faded | clip-rise, clip-wipe (wordmark), 26° diagonal wipe (plates). |
| Depth by parallax, not by 3D | foreground/background planes move at 0.45 / 1.0 / 1.55 × rate. |
| One push per transition | 90 px push, 9-column wipe, or dissolve — three styles, used consistently. |
| Curves are hand-picked | see `src/ease.py`; no linear ramps anywhere in the picture. |

Supersampled 2× (3840 × 2160) and downsampled with Lanczos, which is what gives the
hairlines and small mono type their finish. Motion blur is simulated once, honestly — a
5-sample directional smear on the word `MOTION`, which is a real motion blur approximation
rather than a filter.

**Deliberately excluded:** glitch, lens flares, liquid transitions, particles, lens blur
abuse, constant movement, and fake 3D extrusion.

---

## Texture & finish

- **Dot field** — 26 px grid, 1.35 px dots at 5–8.5 % — from your banner's `dots` pattern.
  Drifts 3 px/s horizontally for parallax.
- **Three soft radial blobs** (emerald / violet / coral at 30 / 16 / 10 %) drifting on
 独立 sine paths — the only "lighting" in the film.
- **Film grain** — animated per frame at delivery resolution, added *after* the downscale so
  it sits at 1920 × 1080 like real grain. Amount 5/255.
- **Vignette** — 0.40, gamma 1.7.
- **Architectural frame** — 1 px hairline at 54 px inset with 34 px corner accents.
- **Registration marks** — 15–17 px L-shaped ticks in emerald around every artwork plate.

---

## What carries the story

1. The **outlined `NAIK` wordmark** — drawn on in Scene 01, drawn on again in Scene 08.
2. The **emerald rule** — the recurring punctuation between a headline and its meaning.
3. The **dot field and frame** — continuous across all eight scenes, so the film is one room.
4. The **colour swatches** — closing on your own banner motif.
