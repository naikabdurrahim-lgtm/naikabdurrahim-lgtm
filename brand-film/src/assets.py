"""
assets.py — asset preparation.

Pulls the selected artwork out of the source PDF once, caches it to
assets/derived/, and hands scenes finished plates at render scale.

Resolution note: the supplied PDF is a *compressed* portfolio — every embedded
image is a 425x425 preview, so 425px is the true ceiling for the artwork. The
film is art-directed around that limit (plates are presented at or near 1:1
inside generous compositions) rather thanGAN-upscaled, which would invent
design detail that is not in the original work.
"""
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

from config import (DERIVED, PORTRAIT_DIR, SRC_PDF, SELECTED, SS, RW, RH,
                    INK, INK2, PAPER, ACCENT)

MAX_NATIVE = 425          # px — hard ceiling of the supplied artwork


# ------------------------------------------------------------- extraction
def ensure_extracted(force=False):
    """Extract every shortlisted artwork from the PDF into assets/derived/."""
    import fitz  # pymupdf
    DERIVED.mkdir(parents=True, exist_ok=True)
    made = []
    doc = fitz.open(str(SRC_PDF))
    for item in SELECTED:
        out = DERIVED / f"{item['key']}__p{item['page']}_x{item['xref']}.png"
        if out.exists() and not force:
            made.append(out)
            continue
        info = doc.extract_image(item["xref"])
        img = Image.open(__import__("io").BytesIO(info["image"])).convert("RGB")
        img.save(out)
        made.append(out)
    doc.close()
    return made


def derived_path(key):
    for item in SELECTED:
        if item["key"] == key:
            return DERIVED / f"{key}__p{item['page']}_x{item['xref']}.png"
    raise KeyError(key)


def vertical_of(key):
    for item in SELECTED:
        if item["key"] == key:
            return item["vertical"]
    return ""


_src_cache = {}


def _src(key):
    if key not in _src_cache:
        p = derived_path(key)
        if not p.exists():
            ensure_extracted()
        im = Image.open(p).convert("RGB")
        _src_cache[key] = im
    return _src_cache[key]


# ----------------------------------------------------------------- plates
_plate_cache = {}


def plate(key, width, radius=0, sharpen=True, border_px=0, border_color=PAPER):
    """
    Artwork plate at `width` in 1x units, returned at render scale.
    radius / border are also 1x units.  Plates are static, so they are cached.
    """
    ck = (key, width, radius, sharpen, border_px, tuple(border_color))
    if ck in _plate_cache:
        return _plate_cache[ck]
    out = _build_plate(key, width, radius, sharpen, border_px, border_color)
    _plate_cache[ck] = out
    return out


def _build_plate(key, width, radius, sharpen, border_px, border_color):
    im = _src(key)
    tw = max(1, int(round(width * SS)))
    if tw > im.width:
        im = im.resize((tw, int(round(im.height * tw / im.width))), Image.LANCZOS)
        if sharpen:
            im = im.filter(ImageFilter.UnsharpMask(
                radius=1.1 * SS, percent=58, threshold=3))
    else:
        im = im.resize((tw, int(round(im.height * tw / im.width))), Image.LANCZOS)
    if border_px:
        b = int(round(border_px * SS))
        canvas = Image.new("RGB", (im.width + b * 2, im.height + b * 2), border_color)
        canvas.paste(im, (b, b))
        im = canvas
    if radius > 0:
        r = int(round(radius * SS))
        m = Image.new("L", im.size, 0)
        from PIL import ImageDraw
        ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width - 1, im.height - 1],
                                            radius=r, fill=255)
        im = im.convert("RGBA")
        im.putalpha(m)
    return im


def plate_masked(key, width, mask, sharpen=True):
    """Artwork resized to fit inside an arbitrary alpha mask."""
    im = plate(key, width, sharpen=sharpen).convert("RGBA")
    mw, mh = mask.size
    im = im.resize((mw, mh), Image.LANCZOS)
    out = Image.new("RGBA", (mw, mh), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def blurred_backdrop(key, width, blur=26, darken=0.55, tint=INK2, cover=False):
    """
    Heavily blurred, darkened artwork used only as texture behind type.
    cover=True returns an exactly RW x RH image (centre-cropped) so the
    per-frame paste stays cheap.  Cached: it never changes.
    """
    ck = (key, width, blur, darken, tint, cover)
    if ck in _bd_cache:
        return _bd_cache[ck]
    out = _build_backdrop(key, width, blur, darken, tint, cover)
    _bd_cache[ck] = out
    return out


_bd_cache = {}


def _build_backdrop(key, width, blur, darken, tint, cover):
    im = _src(key).convert("RGB")
    tw = int(round(width * SS))
    th = int(round(im.height * tw / im.width))
    # blur small, then scale up: same look, ~16x cheaper
    sw, sh = max(1, tw // 4), max(1, th // 4)
    im = im.resize((sw, sh), Image.BILINEAR)
    im = im.filter(ImageFilter.GaussianBlur(max(0.6, blur * SS / 4.0)))
    im = im.resize((tw, th), Image.BICUBIC)
    a = np.asarray(im).astype(np.float32)
    a = a * (1 - darken) + np.array(tint, dtype=np.float32) * darken
    im = Image.fromarray(a.astype(np.uint8), "RGB")
    if cover:
        if im.width < RW or im.height < RH:
            sc = max(RW / im.width, RH / im.height)
            im = im.resize((int(im.width * sc) + 2, int(im.height * sc) + 2),
                           Image.BICUBIC)
        l = (im.width - RW) // 2
        t = (im.height - RH) // 2
        im = im.crop((l, t, l + RW, t + RH))
    return im


# --------------------------------------------------------------- portrait
_PORTRAIT_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff")


def find_portrait():
    """Prefer a dropped hi-res portrait; fall back to the SVG-embedded photo."""
    if PORTRAIT_DIR.exists():
        cands = [p for p in sorted(PORTRAIT_DIR.iterdir())
                 if p.suffix.lower() in _PORTRAIT_EXTS and not p.name.startswith(".")]
        if cands:
            # largest file wins — usually the highest resolution
            cands.sort(key=lambda p: p.stat().st_size, reverse=True)
            return cands[0], True
    fb = DERIVED / "portrait_embedded.jpg"
    if fb.exists():
        return fb, False
    return None, False


def face_center(im, min_skin=0.02):
    """
    Locate the subject by skin-tone likelihood in YCbCr.  Returns (cx, cy)
    in pixels, or the geometric centre if nothing convincing is found.
    """
    a = np.asarray(im.convert("RGB").resize((160, 200)), dtype=np.float32)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    Y = 0.299 * R + 0.587 * G + 0.114 * B
    Cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B
    Cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B
    m = ((R > 95) & (G > 40) & (B > 20) & (R > G) & (R > B) &
         ((R - np.minimum(G, B)) > 15) & (np.abs(R - G) > 15) &
         (Cr > 135) & (Cr <= 180) & (Cb > 85) & (Cb <= 135) & (Y > 80))
    if m.mean() < min_skin:
        return (im.width / 2, im.height / 2)
    ys, xs = np.nonzero(m)
    h, w = m.shape
    # weight toward the upper region where a face sits
    wy = np.clip(1.2 - ys / h, 0.15, 1.0)
    cx = float((xs * wy).sum() / wy.sum())
    cy = float((ys * wy).sum() / wy.sum())
    return (cx / w * im.width, cy / h * im.height)


def portrait(height, aspect=0.80, grade=True):
    """
    Cropped, graded portrait at render scale.  `height` is 1x units.
    Returns (RGBA image, is_hires) or (None, False) if no portrait exists.

    The crop is subject-aware: the face is detected and held in the upper
    third so the framing survives a change of source resolution.
    """
    path, hires = find_portrait()
    if path is None:
        return None, False
    im = Image.open(path).convert("RGB")
    src_w, src_h = im.width, im.height

    tw = max(1, int(round(height * aspect * SS)))
    th = max(1, int(round(height * SS)))

    # face position in the ORIGINAL image, then carried through any scaling
    fx, fy = face_center(im)

    scale = max(tw / src_w, th / src_h)
    if abs(scale - 1.0) > 1e-3:
        im = im.resize((max(1, int(round(src_w * scale))),
                        max(1, int(round(src_h * scale)))), Image.LANCZOS)
    w, h = im.width, im.height
    fx *= scale
    fy *= scale

    # hold the face near the upper third; keep the window inside the frame
    left = float(np.clip(fx - tw / 2, 0, max(0, w - tw)))
    top = float(np.clip(fy - th * 0.38, 0, max(0, h - th)))
    im = im.crop((int(left), int(top), int(left) + tw, int(top) + th))

    if grade:
        im = grade_portrait(im)
    return im.convert("RGBA"), hires


def grade_portrait(im, sat=0.82, split=0.20, lift=1.03):
    """
    A colour grade, not a restyle: mild desaturation, shadows pulled toward
    the film's navy, highlights toward warm white.  Facial identity, structure
    and skin tone are preserved — nothing is replaced or redrawn.
    """
    a = np.asarray(im).astype(np.float32)
    lum = (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2])[..., None]
    a = lum + (a - lum) * sat
    shadow = np.array(INK2, dtype=np.float32)
    high = np.array(PAPER, dtype=np.float32)
    w = (lum / 255.0) ** 1.25
    graded = a * (1 - split) + (shadow * (1 - w) + high * w) * split
    graded = np.clip(graded * lift, 0, 255)
    return Image.fromarray(graded.astype(np.uint8), "RGB")


def duotone(im, dark=INK2, light=PAPER, accent=ACCENT, accent_mix=0.18):
    """Optional stronger treatment — off by default, available in config."""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    lum = (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2])[..., None] / 255.0
    d = np.array(dark, dtype=np.float32)
    l = np.array(light, dtype=np.float32)
    ac = np.array(accent, dtype=np.float32)
    base = d + (l - d) * lum
    m = np.clip(1 - np.abs(lum - 0.45) * 3.2, 0, 1)
    out = base * (1 - accent_mix * m) + ac * (accent_mix * m)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
