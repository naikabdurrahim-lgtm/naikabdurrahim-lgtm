"""
typography.py — type setting for the film.

PIL has no letter-spacing and no auto-fit, so both are implemented here.
All authoring happens in 1x (1920x1080) units; the Type object multiplies by
the supersample factor internally and always returns render-scale layers.
"""
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

from config import F, SS

# characters that must survive the font file, with fallbacks if they do not
_SPECIALS = {
    "×": "x", "·": ".", "—": "-", "–": "-",
    "’": "'", "‘": "'", "“": '"', "”": '"',
    "…": "...", "•": ".", "®": "", "≥": ">=",
}


class Type:
    def __init__(self, scale=SS):
        self.scale = scale
        self._fonts = {}      # (path, px) -> ImageFont
        self._cmaps = {}      # path -> set(codepoints)
        self._layers = {}     # render params -> cached RGBA image

    # ---------------------------------------------------------- font lookup
    def path(self, family, weight):
        fam = F[family]
        if weight in fam:
            return fam[weight]
        # nearest available weight
        return fam[min(fam.keys(), key=lambda w: abs(w - weight))]

    def font(self, family, weight, size):
        """size is in 1x units."""
        px = max(1, int(round(size * self.scale)))
        p = self.path(family, weight)
        key = (str(p), px)
        if key not in self._fonts:
            self._fonts[key] = ImageFont.truetype(str(p), px)
        return self._fonts[key]

    # ----------------------------------------------------------- glyph safe
    def _cmap(self, path):
        path = str(path)
        if path not in self._cmaps:
            try:
                self._cmaps[path] = set(TTFont(path, fontNumber=0).getBestCmap().keys())
            except Exception:
                self._cmaps[path] = set()
        return self._cmaps[path]

    def sanitize(self, text, family, weight):
        """Swap any character the font cannot draw for a safe substitute."""
        cm = self._cmap(self.path(family, weight))
        if not cm:
            return text
        out = []
        for ch in text:
            if ord(ch) in cm or ord(ch) < 128:
                out.append(ch)
            else:
                out.append(_SPECIALS.get(ch, "?"))
        return "".join(out)

    # ------------------------------------------------------------ measuring
    def width(self, text, family, weight, size, tracking=0.0):
        f = self.font(family, weight, size)
        text = self.sanitize(text, family, weight)
        if not text:
            return 0
        w = sum(f.getlength(c) for c in text) / self.scale + tracking * (len(text) - 1)
        return float(w)

    def measure(self, text, family, weight, size, tracking=0.0):
        f = self.font(family, weight, size)
        text = self.sanitize(text, family, weight)
        if not text:
            return (0.0, 0.0)
        w = sum(f.getlength(c) for c in text) / self.scale + tracking * (len(text) - 1)
        asc, desc = f.getmetrics()
        return (float(w), (asc + desc) / self.scale)

    # ------------------------------------------------------------ rendering
    def layer(
        self,
        text,
        family="body",
        weight=400,
        size=48,
        tracking=0.0,
        color=(255, 255, 255),
        opacity=255,
        stroke_w=0,
        stroke_color=(0, 0, 0),
        upper=False,
        pad=None,
        outline_only=False,
    ):
        """Render a string to a tightly-cropped RGBA image at render scale."""
        if upper:
            text = text.upper()
        text = self.sanitize(text, family, weight)
        if not text:
            return Image.new("RGBA", (1, 1), (0, 0, 0, 0))

        ck = (text, family, weight, size, tracking, tuple(color), int(opacity),
              stroke_w, tuple(stroke_color), outline_only)
        if ck in self._layers:
            return self._layers[ck]
        f = self.font(family, weight, size)
        asc, desc = f.getmetrics()
        wx = sum(f.getlength(c) for c in text) + tracking * (len(text) - 1) * self.scale
        sw = int(stroke_w * self.scale)
        p = int(round(max(4 * self.scale, sw * 2 + 3 * self.scale)) if pad is None else pad * self.scale)

        iw = int(wx) + p * 2
        ih = asc + desc + p * 2
        img = Image.new("RGBA", (max(1, iw), max(1, ih)), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)

        fill = tuple(color) + (0 if outline_only else int(opacity),)
        sfill = tuple(stroke_color) + (int(opacity),)

        x = float(p)
        y = float(p)
        origin = "la"   # left, ascender (PIL "s" is baseline, not ascender)
        for ch in text:
            if stroke_w > 0:
                d.text((x, y), ch, font=f, fill=fill, anchor=origin,
                       stroke_width=sw, stroke_fill=sfill)
            else:
                d.text((x, y), ch, font=f, fill=fill, anchor=origin)
            x += f.getlength(ch) + tracking * self.scale

        self._layers[ck] = img
        return img

    # ------------------------------------------------------------- helpers
    def fit_size(self, text, family, weight, max_w, start, tracking=0.0, min_size=10):
        """Largest size <= `start` whose tracked width fits inside max_w."""
        size = start
        while size > min_size and self.width(text, family, weight, size, tracking) > max_w:
            size -= 1
        return size

    def wrap(self, text, family, weight, size, max_w, tracking=0.0):
        """Greedy word wrap using real measured widths."""
        words, lines, cur = text.split(), [], ""
        for w_ in words:
            trial = (cur + " " + w_).strip()
            if self.width(trial, family, weight, size, tracking) <= max_w or not cur:
                cur = trial
            else:
                lines.append(cur)
                cur = w_
        if cur:
            lines.append(cur)
        return lines

    def word_layer(
        self,
        words,
        family="display",
        weight=700,
        size=90,
        tracking=0.0,
        color=(255, 255, 255),
        gap=None,
    ):
        """Per-word layers for staggered animation.  Returns list of RGBA."""
        if gap is None:
            gap = size * 0.28
        return [
            self.layer(w, family, weight, size, tracking, color)
            for w in words
        ]


# module-level singleton, configured once by render.py
T = Type()
