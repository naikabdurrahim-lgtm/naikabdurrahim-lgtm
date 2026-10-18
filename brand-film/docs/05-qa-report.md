# 05 · Quality Assurance Report

Distinguishing what was **measured** from what could **not** be checked in this
environment. Run `python src/qa.py` to reproduce every automated result.

---

## 1. Verified — measured on the delivered files

`python src/qa.py` → **17 / 17 checks passed** (`output/naik-brand-film-60s.mp4`
and `output/naik-brand-film-60s-silent.mp4`).

| Check | Required | Measured | Result |
|---|---|---|---|
| Duration | 60.000 s | **60.000 s** | PASS |
| Resolution | 1920 × 1080 | **1920 × 1080** | PASS |
| Frame rate | 30 fps | **30 fps** (30 tbr, 15360 tbn) | PASS |
| Frame count | 1800 | **1800** | PASS |
| Video codec | H.264 | **h264 (High), avc1** | PASS |
| Pixel format | yuv420p | **yuv420p (tv, bt709, progressive)** | PASS |
| Colour metadata | — | bt709 primaries / transfer / matrix | PASS |
| Audio (scored master) | AAC 48 kHz stereo | **aac (LC), 48000 Hz, stereo, 261 kb/s** | PASS |
| Container | MP4, web-optimised | `isom`, `+faststart` (moov at front) | PASS |
| No crushed-to-black frames | outside the closing resolve | min YAVG **21.0** (16 = pure black) | PASS |
| No blown-out frames | — | max YAVG **44.9** (235 = white) | PASS |
| No empty frames mid-film | 0 | **0** frames below threshold | PASS |
| Every 3 s block carries an image | — | **no dead blocks** | PASS |
| Highlights present throughout | — | min YMAX **67** | PASS |

### Picture statistics (measured from the encoded file, not from the source)

- Mean frame luma **YAVG = 33.0** on the limited-range scale (16 = black,
  235 = white). The film is deliberately near-black; this is the intended look,
  not an exposure error.
- The only near-empty frames are **t = 0.00–0.60 s** (the opening inhale, by
  design) and **t = 59.6–60.0 s** (the resolve to black). Both are intentional.
- The lowest highlight peak after the opening is at **t ≈ 43.3 s**, during the
  dissolve into the philosophy scene, where the frame is a soft out-of-focus
  backdrop with no type yet. Measured YAVG there is 36 — the frame is *not*
  dark, it simply has no bright highlight. Not a defect.

### Safe-margin / clipping audit

A layout probe recorded the bounding box of every drawn element across 57
sampled frames (509 content elements) and tested each against the 108 px / 86 px
safe margin.

- **Result: 0 violations.** All type and all artwork plates sit inside the safe area.
- One finding was fixed during production: the Scene 04 headline
  `SOCIAL MEDIA DESIGN` originally ran to x = 1861, past the 1812 right margin.
  Headlines are now **auto-fitted** — measured against the real rendered layers
  and the exact gap the layout uses — so a headline can never clip regardless of
  wording. `LOGO DESIGN` sets at 74 px, `SOCIAL MEDIA DESIGN` at 72 px,
  `SHORT-FORM VIDEO ADS` at 60 px.
- The only elements that cross the margin are the plate **drop-shadows**
  (soft, information-free edges, ~2 px) and the `8+` figure during its first
  1.5 s, while it is deliberately oversized and being cropped by the frame as a
  reveal device. It settles inside the margin by t = 14.6 s and stays there.

### Spelling and glyph coverage

Every non-ASCII character used in the film was checked against the font's cmap
before rendering: `— × · & ' +` are all present in all three families, and
`typography.sanitize()` substitutes a safe fallback for any character a font
cannot draw. Nothing rendered as a missing-glyph box.

Wording was set from strings in `src/config.py` and cross-checked against the
approved script: the name, both role lines, the three service headlines, both
philosophy lines, the tagline, the service line and the handle are all as briefed.

### Audio

| Check | Measured |
|---|---|
| Duration | **60.000 s** |
| Sample rate / channels | **48 000 Hz, stereo, 16-bit** |
| Peak | **−0.72 dBFS** (no clipping) |
| RMS | −17.5 dBFS (crest ≈ 18 dB — sparse and cinematic by design) |
| NaN / digital silence | none |
| Dynamic arc | quiet opening → impacts at 6 / 13 / 19 / 52 / 58 s → drop at 43–52 s |

---

## 2. Verified by construction (not by measurement)

- **Deterministic timing.** No randomness anywhere in the picture; the audio uses
  fixed seeds. The same command always produces byte-identical frames.
- **Asset integrity.** All 14 plates are drawn from the original PDF bytes at
  their native 425 px, only scaled, positioned, parallaxed, framed and graded.
  No crop, no recolour, no redraw, no AI upscaling that could invent detail.
- **No invented claims.** No client names, awards, outcomes or statistics. Every
  artwork is credited with the real section heading it sits under in the PDF.
- **Portrait.** A colour grade only — no face replacement, no reshaping, no
  regeneration. The subject-aware crop preserves the original framing intent.

---

## 3. Could NOT be verified in this environment — please check

This is the honest list. **I have no vision capability in this session: I could
not look at a single frame, image or the finished video.**

| Item | Why it could not be checked | What to do |
|---|---|---|
| **Is the artwork the right subject matter?** | I scored images by measured contrast, colour, detail and composition, and labelled them with the PDF section they sit under — but I cannot see what they depict. | Open `stills/_CONTACT_assets.png` (14 images, labelled by key and vertical) and confirm. Swapping takes one line in `src/config.py`. |
| **Does it actually look good?** | Aesthetic judgement is unavailable to me. Everything reported above is a measurement. | Open `output/naik-brand-film-60s.mp4`. `stills/_CONTACT_frames.png` gives 16 key frames at a glance. |
| **Is the portrait framed well?** | The 612 × 720 stand-in was cropped by skin-tone detection, not by eye. | Drop your high-res file in `assets/portrait/` and re-render — the crop is re-detected automatically. |
| **Does the music fit your taste?** | Synthesised to a spec, not auditioned. | It is one command to swap: see `docs/04-audio-and-licensing.md`. |
| **Legibility of thin type on a dark ground** | Measured contrast is high (type is 244 luma on a 6 luma ground, ≈ 40:1). | Confirm on a phone screen, which is where most viewers will see it. |
| **Colour on a wide-gamut / HDR display** | Rendered and tagged Rec. 709 SDR; no HDR display available here. | Standard SDR delivery — safe for YouTube, Instagram and Behance. |

---

## 4. Known, deliberate characteristics (not defects)

1. **The film is dark by design.** Mean luma is 33/235. That is the brief's
   "near-black and warm white", not underexposure.
2. **The first 0.6 s is nearly empty.** An intentional inhale before the wordmark
   starts drawing at 1.6 s.
3. **The last 0.28 s resolves to black** so the score can end cleanly.
4. **Artwork is soft when shown large.** The archive only contains 425 px
   previews. Plates are presented at or near 1:1 inside generous compositions
   rather than AI-upscaled, which would fabricate design detail.
5. **Encode choice.** Measured against the CRF 16 master: the delivered
   **CRF 21 / 7.8 Mbps** master scores **SSIM 0.9324, PSNR 40.87 dB**; a
   121 MB / 16 Mbps version scored SSIM 0.9387 — a 0.006 difference for double
   the size — and a 28.5 MB / 3.8 Mbps version scored SSIM 0.9287. The 7.8 Mbps
   file was chosen as the balance. The silent carrier is lighter
   (**CRF 22, ≈4.3 Mbps**) because its job is to carry your own music track.

---

## 5. The one factual risk I am obliged to flag

**Scene 03 states "8+ YEARS OF DESIGN EXPERIENCE".** Your own portfolio PDF
(page 1) says *"2+ years of experience"* and lists SSC 2021 with a diploma
expected in 2026 — which does not leave room for eight years.

You explicitly chose to keep "8+" as briefed, so **the delivered film says 8+**.
I am recording the contradiction here so the decision is yours and on the record.
If you ever want it changed, edit `src/scenes.py` (Scene 03, the `fig` layer and
the `l1` word list) and re-render — about 30 minutes, or 5 minutes at `SS = 1`.
