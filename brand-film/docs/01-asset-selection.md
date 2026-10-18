# 01 · Asset Selection Report

**Source:** `part 2 protfolio 2026-compressed.pdf` (8 pages, 1400 pt wide, pages 1 038–8 685 pt tall)
**Copied to:** `assets/source-portfolio.pdf`

---

## A. What was actually supplied — and what that means

| Fact | Consequence |
|---|---|
| The brief described a ZIP archive; a **single compressed PDF** was delivered. | Everything below is based on that PDF plus the two files already in the GitHub repo. |
| **All 163 embedded images are 425 × 425 JPEG previews.** There are no high-resolution masters, no SVGs, no transparent PNGs, no video, and no layered files in the archive. | **425 px is the hard resolution ceiling for the artwork.** The film is art-directed around that limit instead of pretending otherwise. |
| One 52 × 52 PNG (a UI icon) was the only non-JPEG. | Not used. |
| No portrait photograph exists in the PDF. The PDF's copy is **97 × 125 px**. | A **612 × 720 px** photograph was recovered from the base64 payload embedded inside `naik-profile-banner.svg`, and is used as a stand-in. See "Portrait" below. |
| `naik-profile-banner.svg` (1 500 × 500, vector) is the only resolution-independent identity asset. | Its palette, grid, crop-mark and swatch motifs were extracted and rebuilt natively for 16:9 — see `docs/02-creative-direction.md`. |

### Disclosed limitation
**I could not visually view any image in this environment.** Selection was therefore made
from *measured* properties, not from looking. Every judgement below is reproducible from
`tools/inspect_assets.py`, `tools/select.py` and `tools/analyze.py`. A contact sheet of the
14 chosen files is at `stills/_CONTACT_assets.png` — please confirm the subject matter
before final sign-off, because I can verify that an image is strong, but not what it depicts.

---

## B. Inventory method

1. **Extract** — every embedded image pulled out with PyMuPDF, byte-hashed, deduplicated.
   Result: 163 images, **163 unique** (no duplicates, no alternate versions, no corrupt files).
2. **Locate** — each image mapped to its placement rectangle, then assigned to the
   **section heading it sits under** (found by extracting text blocks with font size ≥ 20 pt
   and matching by y-position). This is what makes the credits truthful: the film labels
   each piece with the vertical it actually belongs to.
3. **Measure** — per image:
   - `sd` luminance standard deviation (contrast)
   - `color` Hasler–Süsstrunk colourfulness
   - `edge` mean edge energy (detail / density)
   - `focus` centre-detail ÷ overall-detail (compositional focus)
   - `b_std` standard deviation of the outer 10 % border (background cleanliness)
   - `ncol` quantised colour count, `top%` largest single-colour share
   - dominant 5-colour palette
4. **Score** — `0.26·sd + 0.24·color + 0.20·edge + 0.18·focus + 0.12·cleanliness`, normalised to 100.
5. **Select** — highest scorers, then deliberately spread across project verticals so the
   film shows range rather than eight variations of one restaurant campaign.

### Sections found in the PDF

| Page | Section headings | Images |
|---|---|---|
| 1 | cover + CV (About, Education, Skills, Contact, Contents) | 23 |
| 2 | Resturent | 24 |
| 3 | Resturent · Resturent Treands · Hotel · Travel Agency | 53 |
| 4 | Marketing Agency | 21 |
| 5 | Online Training | 4 |
| 6 | Cargo services | 18 |
| 7 | Home Decoretor | 6 |
| 8 | Shoping Mall · Ocation | 14 |

---

## C. Ranked shortlist

Score is the composite quality metric above. *Scene* is where the asset is used.

| # | File (`assets/derived/`) | From | Vertical (real) | Score | Palette | Scene | Purpose |
|---|---|---|---|---|---|---|---|
| 1 | `w01__p3_x42.png` | p.3 | Restaurant | 71.5 | `#e50e08` red / white / `#67211b` | S4 · beat 02 | Hero plate — Social Media Design |
| 2 | `w02__p6_x136.png` | p.6 | Cargo Services | 67.3 | `#520203` / white / `#9a451c` | S4 · beat 01 | Hero plate — Logo Design |
| 3 | `w03__p3_x78.png` | p.3 | Travel Agency | 66.9 | `#0084e9` blue / `#323543` navy | S4 · beat 03 | Hero plate — Video / Ad frames |
| 4 | `w13__p2_x15.png` | p.2 | Restaurant | 65.1 | `#500302` / `#9e0e16` / cream | S8 | Closing backdrop texture |
| 5 | `w14__p3_x80.png` | p.3 | Travel Agency | 65.2 | — | bench | Spare |
| 6 | `w04__p2_x3.png` | p.2 | Restaurant | 64.8 | `#ffc90f` amber / `#556436` olive / near-black | S5 | The "static print" that becomes motion |
| 7 | `w05__p3_x49.png` | p.3 | Restaurant Trends | 64.3 | `#fee025` / `#854518` | S5 | Parallax back plane |
| 8 | `w06__p3_x71.png` | p.3 | Hotel | 63.7 | `#eca902` amber / `#6e4c1a` | S5 | Parallax front plane |
| 9 | `w07__p6_x125.png` | p.6 | Cargo Services | 63.3 | `#b7edf8` cyan / `#f7fcfe` | bench | Spare |
| 10 | `w08__p3_x60.png` | p.3 | Restaurant Trends | 62.9 | `#fe0002` / black / `#ccc677` | bench | Highest colourfulness (164) — spare |
| 11 | `w10__p8_x161.png` | p.8 | Shopping Mall | 61.6 | `#4e140c` / `#f8f1f0` | bench | Spare |
| 12 | `w09__p4_x104.png` | p.4 | Marketing Agency | 60.9 | `#85512d` / `#fff8e7` | S7 | Philosophy backdrop (blurred) |
| 13 | `w12__p7_x141.png` | p.7 | Home Decor | 54.9 | — | bench | Spare |
| 14 | `w11__p5_x114.png` | p.5 | Online Training | 51.1 | `#010104` / `#1028a6` blue | S6 | Inside the technical frame (dark + blue suits the system scene) |

**Bench (not used):** w07, w08, w10, w12, w14 — held as swaps. Per the brief, the archive
was not force-fitted: five strong pieces beat fourteen mediocre ones.

---

## D. Portrait

- **No portrait photograph exists in the PDF.** The one on page 1 is 97 × 125 px.
- Recovered `assets/derived/portrait_embedded.jpg` — **612 × 720 px** — from the base64
  payload inside `naik-profile-banner.svg`. Verified programmatically as a photograph of a
  person (13.3 % skin-tone pixels in YCbCr, concentrated in the upper-centre; bbox
  x 77–573, y 127–719, centroid 300, 313).
- Displayed at **540 × 720** on screen (a 1.0× crop, so it is not upscaled), with a
  subject-aware crop that holds the face in the upper third — the crop is re-detected
  automatically if you drop in a new photo.
- **Drop-in slot:** put any `.jpg/.png/.webp` into `assets/portrait/`. The largest file in
  that folder wins and is used automatically on the next render. No code change needed.
- Treatment is a **colour grade only** (mild desaturation, shadows toward navy, highlights
  toward warm white). Facial identity is preserved; nothing is redrawn, replaced or
  re-ages. A stronger duotone is available but deliberately switched off.

---

## E. Integrity notes

- No client names, case-study outcomes, awards or statistics were invented.
- Every artwork is credited on screen with the **actual section heading it sits under** in
  your PDF (e.g. "SELECTED WORK — CARGO SERVICES"), never a made-up client.
- All artwork is presented **uncropped and undistorted** — only scale, position, parallax
  offset, shadow and grade are applied. No logo was redrawn, re-coloured or "improved".
- The artwork was **not** AI-upscaled. GAN upscaling would hallucinate letterforms and
  details that are not in your original files, which would misrepresent the work. Instead
  the compositions present plates at or near 1:1.
