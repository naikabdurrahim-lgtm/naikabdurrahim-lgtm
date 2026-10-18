"""
layers.py — the reusable visual system: background fields, texture, frames.

Everything expensive (gradients, dot fields, noise, vignettes) is generated
once and cached; per-frame work is only compositing and transforms.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from config import RW, RH, W, H, SS

# ------------------------------------------------------------------ caching
_CACHE = {}


def cached(key, fn):
    if key not in _CACHE:
        _CACHE[key] = fn()
    return _CACHE[key]


def clear_cache():
    _CACHE.clear()


# ------------------------------------------------------------------ helpers
def fast_blur(img, radius, downscale=4):
    """Blur via downscale -> blur -> upscale.  Much cheaper at 4K."""
    if radius <= 0:
        return img
    w, h = img.size
    sw, sh = max(1, w // downscale), max(1, h // downscale)
    small = img.resize((sw, sh), Image.BILINEAR)
    small = small.filter(ImageFilter.GaussianBlur(max(0.5, radius / downscale)))
    return small.resize((w, h), Image.BICUBIC)


def vertical_gradient(size, top, bottom, alpha=False):
    key = ("vgrad", size, top, bottom, alpha)
    return cached(key, lambda: _make_vgrad(size, top, bottom, alpha)).copy()


def _make_vgrad(size, top, bottom, alpha=False):
    w, h = size
    a = np.linspace(0.0, 1.0, h, dtype=np.float32).reshape(h, 1)
    top = np.array(top, dtype=np.float32)
    bot = np.array(bottom, dtype=np.float32)
    rows = top + (bot - top) * a                       # (h,3)
    arr = np.repeat(rows[:, None, :], w, axis=1)       # (h,w,3)
    if alpha:
        out = np.dstack([arr, np.full((h, w, 1), 255, dtype=np.uint8)])
        return Image.fromarray(out.astype(np.uint8), "RGBA")
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def radial(size, color, strength=1.0, power=2.0):
    """Soft radial glow on transparent black — pre-rendered small, scaled up."""
    key = ("radial", size, color, strength, power)
    return cached(key, lambda: _make_radial(size, color, strength, power))


def _make_radial(size, color, strength, power):
    s = size if isinstance(size, int) else size[0]
    ax = np.linspace(-1.0, 1.0, s, dtype=np.float32)
    xx, yy = np.meshgrid(ax, ax)
    d = np.sqrt(xx * xx + yy * yy)
    a = np.clip(1.0 - d, 0.0, 1.0) ** power * strength
    arr = np.zeros((s, s, 4), dtype=np.uint8)
    arr[..., 0] = color[0]
    arr[..., 1] = color[1]
    arr[..., 2] = color[2]
    arr[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


# --------------------------------------------------------------- dot field
def dot_field(spacing=26.0, radius=1.35, color=(255, 255, 255), alpha=0.10, bleed=1):
    """Tiled dot grid, oversized so it can be offset for parallax."""
    key = ("dots", spacing, radius, color, alpha, bleed)
    return cached(key, lambda: _make_dots(spacing, radius, color, alpha, bleed))


def _make_dots(spacing, radius, color, alpha, bleed):
    sp = int(round(spacing * SS))
    r = max(1.0, radius * SS)
    tile = Image.new("RGBA", (sp, sp), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    d.ellipse([sp / 2 - r, sp / 2 - r, sp / 2 + r, sp / 2 + r],
              fill=color + (int(alpha * 255),))
    cols = RW // sp + bleed + 2
    rows = RH // sp + bleed + 2
    field = Image.new("RGBA", (cols * sp, rows * sp), (0, 0, 0, 0))
    for i in range(cols):
        for j in range(rows):
            field.paste(tile, (i * sp, j * sp))
    return field


def paste_field(dst, field, dx=0.0, dy=0.0, alpha_mul=1.0):
    """Tile `field` across dst with an integer offset (parallax)."""
    ox = -int(round(dx * SS)) % field.width
    oy = -int(round(dy * SS)) % field.height
    img = field
    if alpha_mul < 1.0:
        img = _multiply_alpha(field, alpha_mul)
    x, y = -ox, -oy
    while y < RH:
        while x < RW:
            dst.paste(img, (x, y), img)
            x += img.width
        x = -ox
        y += img.height


def _multiply_alpha(img, k):
    a = np.asarray(img).astype(np.float32)
    a[..., 3] *= k
    return Image.fromarray(a.astype(np.uint8), "RGBA")


# ------------------------------------------------------------------ ground
def ground(t=0.0, blobs=True, grid=True, base_top=None, base_bot=None,
           grid_alpha=0.10, drift=1.0):
    """
    The film's continuous background: near-black vertical gradient, three very
    soft colour blobs that drift, and the dot field.  Every scene sits on this
    so the whole 60 seconds reads as one space.
    """
    from config import INK, INK2, INK3, ACCENT, VIOLET, CORAL
    top = base_top or INK
    bot = base_bot or (3, 5, 11)
    img = vertical_gradient((RW, RH), top, bot, alpha=True)

    if blobs:
        a = img
        # emerald, low-left — the accent owns this corner
        g1 = radial(700, ACCENT, strength=0.30, power=2.6).resize(
            (int(1900 * SS / 2), int(1900 * SS / 2)), Image.BILINEAR)
        a.paste(g1, (int((-260 + math.sin(t * 0.11) * 26 * drift) * SS),
                     int((440 + math.cos(t * 0.09) * 20 * drift) * SS)), g1)
        # violet, upper-right
        g2 = radial(700, VIOLET, strength=0.16, power=2.8).resize(
            (int(1500 * SS / 2), int(1500 * SS / 2)), Image.BILINEAR)
        a.paste(g2, (int((1180 + math.cos(t * 0.08) * 30 * drift) * SS),
                     int((-320 + math.sin(t * 0.07) * 24 * drift) * SS)), g2)
        # coral, far right, very quiet
        g3 = radial(700, CORAL, strength=0.10, power=3.0).resize(
            (int(1200 * SS / 2), int(1200 * SS / 2)), Image.BILINEAR)
        a.paste(g3, (int((1420 - math.sin(t * 0.06) * 22 * drift) * SS),
                     int((560 + math.cos(t * 0.05) * 18 * drift) * SS)), g3)
        img = a

    if grid:
        f = dot_field(spacing=26.0, radius=1.35, color=(214, 226, 240), alpha=grid_alpha)
        paste_field(img, f, dx=(t * 3.0) % 26, dy=(t * 1.2) % 26)

    return img


# ------------------------------------------------------------------ texture
def grain_tiles(n=10, amount=5.0, seed=7):
    key = ("grain", n, amount, seed)
    return cached(key, lambda: _make_grain(n, amount, seed))


def _make_grain(n, amount, seed):
    rng = np.random.default_rng(seed)
    tiles = []
    for _ in range(n):
        g = rng.normal(0.0, amount, (H, W)).astype(np.float32)
        # slight spatial correlation so it reads as film, not TV static
        g = np.clip(g, -amount * 3, amount * 3)
        tiles.append(g)
    return tiles


def vignette(amount=0.42, radius=0.78):
    key = ("vig", amount, radius)
    return cached(key, lambda: _make_vignette(amount, radius))


def _make_vignette(amount, radius):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = W / 2, H / 2
    d = np.sqrt(((xx - cx) / (W * radius / 2)) ** 2 + ((yy - cy) / (H * radius / 2)) ** 2)
    v = np.clip(d, 0, 1) ** 1.7 * amount
    return (1.0 - v).astype(np.float32)[..., None]


def film_pass(img, frame_idx, grain_amount=5.0, vig=0.40):
    """
    Final 1x pass: animated grain + vignette + a faint warm lift in the
    highlights.  Runs after the supersample downscale so grain sits at
    delivery resolution (which is how real grain behaves).
    """
    arr = np.asarray(img).astype(np.float32)
    tiles = grain_tiles(amount=grain_amount)
    g = tiles[frame_idx % len(tiles)]
    arr += g[..., None]
    arr *= vignette(vig)
    np.clip(arr, 0, 255, out=arr)
    return Image.fromarray(arr.astype(np.uint8), "RGB")


# ------------------------------------------------------------- geometry kit
def rounded_mask(size, radius):
    key = ("rmask", size, radius)
    return cached(key, lambda: _make_rounded(size, radius))


def _make_rounded(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1],
                                        radius=radius, fill=255)
    return m


def soft_shadow(size, radius=8, blur=44, opacity=120, dy=18):
    """Pre-blurred drop shadow for artwork plates."""
    key = ("shadow", size, radius, blur, opacity, dy)
    return cached(key, lambda: _make_shadow(size, radius, blur, opacity, dy))


def _make_shadow(size, radius, blur, opacity, dy):
    w, h = size
    pad = blur * 2
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", (w + pad * 2, h + pad * 2 + dy), (0, 0, 0, 0))
    a = np.asarray(m).astype(np.float32) * (opacity / 255.0)
    sh = Image.fromarray(a.astype(np.uint8), "L")
    black = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    out.paste(black, (pad, pad + dy), sh)
    return out


def crop_marks(d, cx, cy, w, h, size=14, color=(255, 255, 255), op=90, lw=1, gap=0):
    """Registration / crop ticks around a rectangle.  cx,cy = centre."""
    x0 = cx - w / 2 - gap
    y0 = cy - h / 2 - gap
    x1 = cx + w / 2 + gap
    y1 = cy + h / 2 + gap
    c = tuple(color) + (op,)
    sw = max(1, int(lw * SS))
    # corners: L shapes
    segs = [
        ((x0, y0), (x0 + size, y0)), ((x0, y0), (x0, y0 + size)),
        ((x1, y0), (x1 - size, y0)), ((x1, y0), (x1, y0 + size)),
        ((x0, y1), (x0 + size, y1)), ((x0, y1), (x0, y1 - size)),
        ((x1, y1), (x1 - size, y1)), ((x1, y1), (x1, y1 - size)),
    ]
    for a, b in segs:
        d.line([a[0] * SS, a[1] * SS, b[0] * SS, b[1] * SS], fill=c, width=sw)


def ticks_v(d, x, y0, y1, step=12, size=6, color=(255, 255, 255), op=70, lw=1):
    c = tuple(color) + (op,)
    sw = max(1, int(lw * SS))
    y = y0
    while y <= y1:
        d.line([x * SS, y * SS, (x + size) * SS, y * SS], fill=c, width=sw)
        y += step


def frame_border(d, inset=54, color=(255, 255, 255), op=26, lw=1, corners=38):
    """Thin architectural frame with corner accents — used sparingly."""
    c = tuple(color) + (op,)
    sw = max(1, int(lw * SS))
    x0, y0, x1, y1 = inset, inset, W - inset, H - inset
    d.rectangle([x0 * SS, y0 * SS, x1 * SS, y1 * SS], outline=c, width=sw)
    for (px, py, sx, sy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
        d.line([px * SS, py * SS, (px + sx * corners) * SS, py * SS], fill=c, width=sw * 2)
        d.line([px * SS, py * SS, px * SS, (py + sy * corners) * SS], fill=c, width=sw * 2)


def rule(d, x0, y, x1, color=(255, 255, 255), op=60, lw=1):
    c = tuple(color) + (op,)
    d.line([x0 * SS, y * SS, x1 * SS, y * SS], fill=c, width=max(1, int(lw * SS)))


def vrule(d, x, y0, y1, color=(255, 255, 255), op=60, lw=1):
    c = tuple(color) + (op,)
    d.line([x * SS, y0 * SS, x * SS, y1 * SS], fill=c, width=max(1, int(lw * SS)))


def pill(d, x, y, w, h, fill=(255, 255, 255), op=14, outline=None, oop=40, radius=None):
    r = radius if radius is not None else h / 2
    f = tuple(fill) + (op,)
    d.rounded_rectangle([x * SS, y * SS, (x + w) * SS, (y + h) * SS],
                        radius=r * SS, fill=f)
    if outline:
        d.rounded_rectangle([x * SS, y * SS, (x + w) * SS, (y + h) * SS],
                            radius=r * SS, outline=tuple(outline) + (oop,),
                            width=max(1, int(1 * SS)))
