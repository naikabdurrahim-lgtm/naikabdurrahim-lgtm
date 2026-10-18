# Abdur Rahim Naik — Personal Brand Film

A 60-second, 1920 × 1080, 30 fps brand film built from your real portfolio work.

```
60.000 s · 1920 × 1080 · 30 fps · H.264 High · yuv420p · stereo 48 kHz
```

---

## Quick start

```bash
cd brand-film
./bootstrap.sh                 # one time: creates .venv + installs dependencies
source .venv/bin/activate

python src/render.py --stills  # 33 review frames -> stills/   (about 45 s)
python src/audio.py            # original score -> output/     (about 45 s)
make all                       # full render + both masters
```

`make` targets: `all`, `stills`, `score`, `video`, `final`, `silent`, `qa`, `clean`.

---

## What is in the box

| Path | What it is |
|---|---|
| `output/naik-brand-film-60s.mp4` | **final film, with the original score** — H.264 High, 7.8 Mbps, 60.4 MB |
| `output/naik-brand-film-60s-silent.mp4` | **final film, no audio** — lighter carrier (4.3 Mbps, 32.1 MB) for your own licensed track |
| `output/naik-brand-film-score.wav` | the score alone (48 kHz stereo, 11.5 MB) |
| `stills/_CONTACT_frames.png` | 16 key frames on one sheet — the fastest way to review |
| `stills/_CONTACT_assets.png` | the 14 selected artworks, labelled with their real project vertical |
| `stills/s*.png` | individual review frames, one per beat |
| `docs/01-asset-selection.md` | inventory, scoring method, ranked shortlist, limitations |
| `docs/02-creative-direction.md` | palette, type, grid, motion language |
| `docs/03-storyboard.md` | timecoded, beat-aligned shot-by-shot spec |
| `docs/04-audio-and-licensing.md` | score breakdown + licensing notes |
| `docs/05-qa-report.md` | verified checks and what could not be verified |
| `src/` | the editable project (see below) |

---

## The editable project

```
src/
  config.py      every number: canvas, palette, timecodes, easing grid, asset shortlist
  ease.py        the animation curves
  typography.py  text setting (letter-spacing, auto-fit, wrapping)
  canvas.py      1x authoring surface + reveal primitives (clip-rise, wipe, motion smear)
  layers.py      ground, dot field, blobs, grain, vignette, frames, crop marks
  assets.py      PDF extraction, plate building, portrait handling
  scenes.py      the eight scenes
  render.py      pipeline + scene transitions + ffmpeg encode
  audio.py       the synthesised score
  qa.py          automated delivery checks
```

Everything is deterministic: the same command always produces the same frames.

---

## Common changes

### Change the text
Edit `src/config.py` — name, role lines, tagline, service line and handle are all at the top.
`SELECTED` maps asset keys to source pages; `SHOWCASE` maps the three Scene 04 beats to
headlines and assets. Re-render.

```python
NAME     = "ABDUR RAHIM NAIK"
ROLE_L1  = "GRAPHIC DESIGNER"
ROLE_L2  = "TECH ENTHUSIAST"
TAGLINE  = "IDEAS INTO VISUALS. VISUALS INTO EXPERIENCES."
SERVICE_LINE = "GRAPHIC DESIGN · MOTION GRAPHICS · CREATIVE PRODUCTION"
```

Scene-specific wording lives in `src/scenes.py` (e.g. the philosophy lines at ~line 600).

### Swap a portfolio image
1. Pick a replacement from the bench (`w07`, `w08`, `w10`, `w12`, `w14`) or add a new entry
   to `SELECTED` in `src/config.py` with its `page` and `xref`.
2. Point the scene at the new key — for Scene 04, change `SHOWCASE[i]["asset"]`.
3. `python src/render.py --stills` to check, then `make all`.

### Add your high-resolution portrait
Drop any `.jpg` / `.png` / `.webp` into `assets/portrait/`. The largest file there wins and
is used automatically — no code change, no re-crop needed. Face position is detected and
held in the upper third. The 612 × 720 stand-in is used until you do.

### Change the accent colour
`ACCENT` and `ACCENT_L` in `src/config.py`. Everything that uses the accent — rules,
registration marks, emphasised words, blobs, swatches — follows.

### Change the pace
`SCENES` in `src/config.py` holds the eight `(id, start, end)` timecodes. Internal event
timings are per scene in `src/scenes.py` and are relative to scene start.

---

## Rendering notes

- Frames are rendered at **2× (3840 × 2160)** and downsampled with Lanczos for the finish on
  hairlines and small type. Expect ~1.5–1.7 fps on two cores — about **20–28 minutes** for the film.
- Set `SS = 1` in `src/config.py` for a fast draft (about 4 minutes, visibly softer).
- Preview without the film pass: `python src/render.py --stills --fast`.
- Single frame: `python src/render.py --frame 900`.

---

## Licensing (short version)

- **Score:** synthesised from scratch in `src/audio.py`. Original work, no samples, no
  downloads, nothing to clear. Yours.
- **Fonts:** Space Grotesk, Inter, JetBrains Mono, Archivo — all SIL Open Font License 1.1.
  See `fonts/LICENSES.md`.
- **Artwork:** your own, used with your permission for this film.
- Nothing in this project comes from a paid stock or music library.

Full notes: `docs/04-audio-and-licensing.md`.
