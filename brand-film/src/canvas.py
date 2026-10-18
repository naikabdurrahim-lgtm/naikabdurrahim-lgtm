"""
canvas.py — the drawing surface plus the reveal primitives.

Scenes author in comfortable 1x (1920x1080) coordinates; Canvas scales by the
supersample factor on the way in, so nothing downstream has to think about it.

The reveal primitives (clip-rise, clip-wipe, motion smear) are what make the
type feel directed rather than merely faded.
"""
import numpy as np
from PIL import Image, ImageDraw

from config import W, H, SS, RW, RH

# ------------------------------------------------------------------- grid
M = 108                    # horizontal margin
CW, GUT = 120, 24          # 12-column grid
def col(i):
    """x of column i (fractional allowed)."""
    return M + i * (CW + GUT)
def span(n):
    return n * CW + (n - 1) * GUT
COL_W = span(12)


class Canvas:
    def __init__(self, bg):
        self.img = bg.convert("RGBA") if bg.mode != "RGBA" else bg.copy()

    @property
    def d(self):
        return ImageDraw.Draw(self.img)

    def draw(self):
        return ImageDraw.Draw(self.img)

    def blit(self, layer, x, y, anchor="lt", opacity=1.0, mask=None):
        """Paste a layer using 1x coordinates.  opacity 0..1."""
        if layer is None:
            return
        lw, lh = layer.size
        if anchor == "lt":
            px, py = x, y
        elif anchor == "mm":
            px, py = x - lw / (2 * SS), y - lh / (2 * SS)
        elif anchor == "lm":
            px, py = x, y - lh / (2 * SS)
        elif anchor == "rm":
            px, py = x - lw / SS, y - lh / (2 * SS)
        elif anchor == "rb":
            px, py = x - lw / SS, y - lh / SS
        elif anchor == "lb":
            px, py = x, y - lh / SS
        elif anchor == "ct":
            px, py = x - lw / (2 * SS), y
        else:
            px, py = x, y
        px = int(round(px * SS))
        py = int(round(py * SS))
        lay = layer
        if opacity < 1.0:
            if lay.mode != "RGBA":
                lay = lay.convert("RGBA")
            a = np.asarray(lay).astype(np.float32)
            a[..., 3] *= opacity
            lay = Image.fromarray(a.astype(np.uint8), "RGBA")
        if mask is not None:
            self.img.paste(lay, (px, py), mask)
        elif lay.mode == "RGBA":
            self.img.paste(lay, (px, py), lay)
        else:
            self.img.paste(lay, (px, py))

    def blit_scaled(self, layer, cx, cy, scale=1.0, opacity=1.0, resample=Image.LANCZOS,
                    mask=None):
        """Paste centred on (cx,cy) in 1x units, scaled about its centre."""
        if layer is None:
            return
        w, h = layer.size
        nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
        if (nw, nh) != (w, h):
            layer = layer.resize((nw, nh), resample)
            if mask is not None and mask.size != (nw, nh):
                mask = mask.resize((nw, nh), Image.BILINEAR)
        self.blit(layer, cx, cy, anchor="mm", opacity=opacity, mask=mask)

    def finish(self):
        return self.img.convert("RGB")


# ------------------------------------------------------------- reveal masks
def clip_rise_mask(size, k, soft=10.0):
    """
    Bottom-up reveal with a soft leading edge.  k=0 hides, k=1 shows.
    `soft` is in 1x pixels.
    """
    w, h = size
    if h <= 0:
        return Image.new("L", (max(1, w), 1), 0)
    edge = max(1.0, soft * SS)
    r = np.arange(h, dtype=np.float32).reshape(h, 1)
    a = np.clip((k * (h + edge) - (h - r)) / edge, 0.0, 1.0)
    m = (a * 255).astype(np.uint8)
    return Image.fromarray(np.repeat(m, w, axis=1), "L")


def clip_wipe_mask(size, k, soft=90.0, direction="right"):
    """Horizontal reveal with a soft leading edge (used to 'draw' the wordmark)."""
    w, h = size
    if w <= 0:
        return Image.new("L", (1, max(1, h)), 0)
    edge = max(1.0, soft * SS)
    x = np.arange(w, dtype=np.float32).reshape(1, w)
    if direction == "right":
        a = np.clip((k * (w + edge) - x) / edge, 0.0, 1.0)
    else:
        a = np.clip((k * (w + edge) - (w - 1 - x)) / edge, 0.0, 1.0)
    m = (a * 255).astype(np.uint8)
    return Image.fromarray(np.repeat(m, h, axis=0), "L")


def diag_wipe_mask(size, k, soft=140.0, angle=28.0):
    """Diagonal reveal — used for artwork plates."""
    import math
    w, h = size
    if w <= 0 or h <= 0:
        return Image.new("L", (max(1, w), max(1, h)), 0)
    edge = max(1.0, soft * SS)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    a_r = math.radians(angle)
    proj = xx * math.cos(a_r) + yy * math.sin(a_r)
    pmax = w * math.cos(a_r) + h * math.sin(a_r)
    a = np.clip((k * (pmax + edge) - proj) / edge, 0.0, 1.0)
    return Image.fromarray((a * 255).astype(np.uint8), "L")


def column_wipe_mask(k, cols=8, stagger=0.42, soft=30.0, size=(RW, RH)):
    """
    Scene transition: vertical bands wipe across, staggered.  Returns an L mask
    (255 = incoming scene).
    """
    w, h = size
    m = np.zeros((1, w), dtype=np.float32)
    for c in range(cols):
        x0 = c * w / cols
        x1 = (c + 1) * w / cols
        denom = max(1e-6, 1 - stagger)
        kc = (k - stagger * (c / max(1, cols - 1))) / denom
        kc = float(np.clip(kc, 0, 1))
        edge = max(1.0, soft * SS)
        xs = np.arange(w, dtype=np.float32)
        a = np.clip((kc * (w / cols + edge) - (xs - x0)) / edge, 0, 1)
        m = np.maximum(m, a * ((xs >= x0 - 1) & (xs < x1 + 1)))
    return Image.fromarray((np.repeat(m, h, axis=0) * 255).astype(np.uint8), "L")


def push_mask(k, size=(RW, RH), direction="up", soft=40.0):
    """Push transition mask (bands of the frame slide together)."""
    w, h = size
    yy = np.arange(h, dtype=np.float32).reshape(h, 1)
    edge = max(1.0, soft * SS)
    if direction == "up":
        a = np.clip((k * (h + edge) - yy) / edge, 0, 1)
    else:
        a = np.clip((k * (h + edge) - (h - 1 - yy)) / edge, 0, 1)
    return Image.fromarray((np.repeat(a, w, axis=1) * 255).astype(np.uint8), "L")


# -------------------------------------------------------------- text motion
def reveal_text(c, layer, x, y, k, rise=16.0, soft=12.0, anchor="lt", opacity=None):
    """Rise + clip reveal.  The workhorse for typographic entrances."""
    if layer is None or k <= 0:
        return
    k = float(np.clip(k, 0, 1))
    m = clip_rise_mask(layer.size, k, soft)
    yy = y + rise * (1 - k)
    c.blit(layer, x, yy, anchor=anchor, mask=m,
           opacity=1.0 if opacity is None else opacity)


def reveal_words(c, layers, x, y, size, tracking, k_list, leading=None,
                 rise=18.0, soft=14.0, max_w=None, gap=None):
    """
    Lay out and reveal a list of word layers left-to-right with per-word
    progress.  Returns the x position after the last word.
    """
    gap = size * 0.30 if gap is None else gap
    cx = x
    for i, lay in enumerate(layers):
        k = k_list[i] if i < len(k_list) else 0.0
        if k <= 0:
            cx += lay.width / SS + gap
            continue
        reveal_text(c, lay, cx, y, k, rise=rise, soft=soft, anchor="lt")
        cx += lay.width / SS + gap
    return cx


def motion_smear(c, layer, x, y, k, dist=90.0, samples=5, anchor="lt", opacity=1.0):
    """
    Cheap, convincing directional motion blur: draw the layer several times
    along the travel axis with decreasing alpha.  Used once, on 'MOTION'.
    """
    if layer is None or k <= 0:
        return
    k = float(np.clip(k, 0, 1))
    d = dist * (1 - k)
    for i in range(samples):
        t = i / max(1, samples - 1)
        c.blit(layer, x - d * t, y, anchor=anchor, opacity=opacity * (0.16 + 0.16 * t))
    c.blit(layer, x, y, anchor=anchor, opacity=opacity * k)


def centred_line(c, layer, cy, k=None, rise=16.0, soft=12.0):
    if layer is None:
        return
    if k is None:
        c.blit(layer, W / 2, cy, anchor="mm")
    else:
        reveal_text(c, layer, W / 2 - layer.width / (2 * SS), cy, k,
                    rise=rise, soft=soft, anchor="lt")
