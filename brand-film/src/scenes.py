"""
scenes.py — the eight scenes.

Each function receives (lt, f, gi) where:
    lt = local time inside the scene in seconds (may be < 0 during a
         transition's pre-roll, or > scene length during its tail)
    f  = absolute frame index
    gi = global time in seconds
and returns an RGB PIL image at render scale.

Timing is authored in seconds relative to scene start and is fully
deterministic — no randomness anywhere in the picture.
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from config import (W, H, SS, RW, RH, FPS,
                    INK, INK2, INK3, PAPER, PAPER_DIM, ACCENT, ACCENT_L,
                    BLUE, VIOLET, CORAL, AMBER, SKY, GREY_1, GREY_2,
                    NAME, NAME_SHORT, ROLE_L1, ROLE_L2, TAGLINE,
                    SERVICE_LINE, LOCATION, HANDLE, SHOWCASE)
from typography import T
from canvas import (Canvas, col, span, M, COL_W, clip_rise_mask, clip_wipe_mask,
                    diag_wipe_mask, reveal_text, motion_smear)
from layers import (ground, frame_border, crop_marks, rule, vrule, pill,
                    soft_shadow, fast_blur, radial)
import assets as A
from ease import *


# ------------------------------------------------------------------ helpers
def eyebrow(c, text, x, y, k, color=GREY_1, size=14, tracking=4.0, dot=True):
    if k <= 0:
        return
    lay = T.layer(text, "mono", 500, size, tracking=tracking, color=color)
    if dot:
        d = c.draw()
        s = 5
        d.rectangle([(x - 20) * SS, (y + 5) * SS, (x - 20 + s) * SS, (y + 5 + s) * SS],
                    fill=tuple(ACCENT) + (int(230 * k),))
    c.blit(lay, x, y, anchor="lt", opacity=k)


def grow_rule(c, cx, y, width, k, color=ACCENT, lw=2, op=210):
    if k <= 0:
        return
    ww = width * clamp01(k)
    d = c.draw()
    d.line([(cx - ww / 2) * SS, y * SS, (cx + ww / 2) * SS, y * SS],
           fill=tuple(color) + (int(op),), width=max(1, int(lw * SS)))


def words_row(c, words, x, y, family, weight, size, tracking, color,
              ks, rise=18.0, gap=None, soft=14.0):
    """Lay out words left-to-right from x, revealing each with its own k."""
    gap = size * 0.30 if gap is None else gap
    cx = x
    for i, w in enumerate(words):
        lay = T.layer(w, family, weight, size, tracking=tracking, color=color)
        k = ks[i] if i < len(ks) else 0.0
        if k > 0:
            reveal_text(c, lay, cx, y, k, rise=rise, soft=soft)
        cx += lay.width / SS + gap
    return cx - x


def words_centred(c, words, cx, y, family, weight, size, tracking,
                  colors=None, ks=None, rise=18.0, gap=None, soft=14.0):
    """Centred row of words, each revealed independently.  Returns total width."""
    gap = size * 0.30 if gap is None else gap
    colors = colors or [PAPER] * len(words)
    layers = [T.layer(w, family, weight, size, tracking=tracking, color=cc)
              for w, cc in zip(words, colors)]
    total = sum(l.width / SS for l in layers) + gap * (len(layers) - 1)
    x = cx - total / 2
    for i, l in enumerate(layers):
        k = 1.0 if ks is None else (ks[i] if i < len(ks) else 0.0)
        if k > 0:
            reveal_text(c, l, x, y, k, rise=rise, soft=soft)
        x += l.width / SS + gap
    return total


def plate_shadowed(c, key, cx, cy, size, opacity=1.0, border=0, radius=0,
                   shadow=True, shadow_op=1.0, scale=1.0, mask=None):
    """Artwork plate + soft drop shadow + hairline frame + registration marks."""
    p = A.plate(key, size, radius=radius, border_px=border)
    if scale != 1.0:
        p = p.resize((max(1, int(p.width * scale)), max(1, int(p.height * scale))),
                     Image.LANCZOS)
    if shadow:
        sh = soft_shadow(p.size, radius=int(2 * SS), blur=int(30 * SS),
                         opacity=int(120 * shadow_op), dy=int(16 * SS))
        c.blit(sh, cx, cy, anchor="mm", opacity=shadow_op)
    if mask is not None:
        c.blit(p, cx, cy, anchor="mm", opacity=opacity, mask=mask)
    else:
        c.blit(p, cx, cy, anchor="mm", opacity=opacity)
    return p


def plate_marks(c, cx, cy, w, h, k, color=ACCENT_L, op=150, gap=26, size=16):
    if k <= 0:
        return
    kk = float(clamp01(k))
    d = c.draw()
    crop_marks(d, cx, cy, w, h, size=int(size * (0.7 + 0.3 * kk)),
               color=color, op=int(op * kk), lw=1, gap=gap)


def plate_frame(c, cx, cy, w, h, k, color=PAPER, op=42):
    if k <= 0:
        return
    d = c.draw()
    d.rectangle([(cx - w / 2) * SS, (cy - h / 2) * SS,
                 (cx + w / 2) * SS, (cy + h / 2) * SS],
                outline=tuple(color) + (int(op * k),), width=max(1, int(1 * SS)))


def grid_columns(c, k, ys=(170, 910), xs=(4, 8), color=PAPER, op=16):
    """The Swiss grid made visible for a beat."""
    for xi in xs:
        kc = exp_step(0.0, 1.0, k, out_quint)
        lay_w = max(1, int(1 * SS))
        d = c.draw()
        x = col(xi)
        hgt = (ys[1] - ys[0]) * kc
        d.line([x * SS, ys[0] * SS, x * SS, (ys[0] + hgt) * SS],
               fill=tuple(color) + (int(op * kc),), width=lay_w)


# ==========================================================================
# SCENE 01 — THE SIGNATURE  (0.00 – 6.00)
# ==========================================================================
def scene_01(lt, f, gi):
    img = ground(gi, grid_alpha=0.085, drift=1.0)
    c = Canvas(img)
    d = c.draw()

    # architectural frame
    kf = exp_step(0.30, 1.15, lt, out_cubic)
    if kf > 0:
        frame_border(d, inset=54, color=PAPER, op=int(22 * kf), lw=1, corners=34)

    # portfolio label + rule
    kl = exp_step(0.55, 1.60, lt, out_cubic)
    if kl > 0:
        lab = T.layer("PORTFOLIO — 2026", "mono", 500, 15, tracking=4.0, color=GREY_1)
        c.blit(lab, M, 152, anchor="lt", opacity=kl)
        lw_ = T.width("PORTFOLIO — 2026", "mono", 500, 15, tracking=4.0)
        kw = exp_step(0.80, 1.85, lt, out_quint)
        d.line([M * SS, 186 * SS, (M + lw_ * kw) * SS, 186 * SS],
               fill=tuple(ACCENT) + (int(200 * kl),), width=max(1, int(2 * SS)))

    # ---- outline wordmark, drawn left to right
    kwm = exp_step(1.60, 3.70, lt, in_out_quint)
    kwm_scale = 1.06 - 0.06 * exp_step(1.60, 3.70, lt, out_cubic)
    wm = T.layer(NAME_SHORT, "display", 700, 300, tracking=14.0,
                 color=PAPER, stroke_w=3.2, stroke_color=PAPER, outline_only=True)
    # settle up and shrink once the solid name arrives
    kset = exp_step(3.80, 5.20, lt, in_out_cubic)
    cy = lerp(548, 424, kset)
    sc = lerp(kwm_scale, 0.78, kset)
    wm_x = W / 2 - wm.width / (2 * SS)
    wm_y = cy - wm.height / (2 * SS)
    if kwm > 0:
        m = clip_wipe_mask(wm.size, kwm, soft=110.0, direction="right")
        c.blit_scaled(wm, W / 2, cy, scale=sc, mask=m if kwm < 0.999 else None)

    # ---- solid name, word by word
    words = NAME.split()
    ks = [exp_step(3.95 + i * 0.12, 5.00 + i * 0.12, lt, out_quint) for i in range(len(words))]
    words_centred(c, words, W / 2, 566, "display", 700, 96, tracking=8.0,
                  ks=ks, rise=22.0, gap=size_gap(96))

    # ---- emerald rule
    kr = exp_step(4.95, 5.80, lt, out_quint)
    grow_rule(c, W / 2, 700, 540, kr, ACCENT, lw=2, op=200)

    return c.finish()


def size_gap(size):
    return size * 0.34


# ==========================================================================
# SCENE 02 — THE CREATIVE IDENTITY  (6.00 – 13.00)
# ==========================================================================
def scene_02(lt, f, gi):
    img = ground(gi, grid_alpha=0.085, drift=1.0)
    c = Canvas(img)
    d = c.draw()

    kf = exp_step(0.0, 0.7, lt, out_cubic)
    if kf > 0:
        frame_border(d, inset=54, color=PAPER, op=int(18 * kf), lw=1, corners=34)

    # ---------------- portrait
    pim, hires = A.portrait(720, aspect=0.75)
    pcx, pcy = 1415, 540
    if pim is not None:
        kp = exp_step(0.00, 0.95, lt, out_quint)
        drift = -12 * clamp01(lt / 7.0)
        sh = soft_shadow(pim.size, radius=int(3 * SS), blur=int(34 * SS),
                         opacity=150, dy=int(20 * SS))
        cy = pcy + drift
        if kp > 0:
            c.blit(sh, pcx, cy, anchor="mm", opacity=kp * 0.9)
            m = clip_rise_mask(pim.size, kp, soft=26.0)
            sc = lerp(1.045, 1.0, kp)
            c.blit_scaled(pim, pcx, cy, scale=sc, mask=m if kp < 0.999 else None)
            plate_frame(c, pcx, cy, pim.width / SS, pim.height / SS, kp, PAPER, 46)
            km = exp_step(0.55, 1.20, lt, out_back)
            plate_marks(c, pcx, cy, pim.width / SS, pim.height / SS, km,
                        ACCENT_L, 160, gap=28, size=17)
        # caption under the portrait
        kcap = exp_step(1.30, 2.05, lt, out_cubic)
        cap = T.layer(LOCATION, "mono", 500, 13, tracking=3.4, color=GREY_1)
        c.blit(cap, pcx, 936 + drift, anchor="mm", opacity=kcap)

    # ---------------- type block
    tx = M
    eyebrow(c, "IDENTITY", tx, 356, exp_step(0.35, 1.05, lt, out_cubic), GREY_1)

    w1 = ROLE_L1.split()
    ks1 = [exp_step(0.65 + i * 0.10, 1.75 + i * 0.10, lt, out_quint) for i in range(len(w1))]
    words_row(c, w1, tx, 412, "display", 700, 88, tracking=-1.5, color=PAPER,
              ks=ks1, rise=24, gap=size_gap(88))

    w2 = ROLE_L2.split()
    ks2 = [exp_step(0.95 + i * 0.10, 2.05 + i * 0.10, lt, out_quint) for i in range(len(w2))]
    words_row(c, w2, tx, 520, "display", 700, 88, tracking=-1.5, color=ACCENT_L,
              ks=ks2, rise=24, gap=size_gap(88))

    kr = exp_step(1.55, 2.20, lt, out_quint)
    if kr > 0:
        d.line([tx * SS, 646 * SS, (tx + 340 * kr) * SS, 646 * SS],
               fill=tuple(ACCENT) + (int(190 * kr),), width=max(1, int(2 * SS)))

    ksk = exp_step(1.80, 2.60, lt, out_cubic)
    skills = "BRANDING · SOCIAL MEDIA · VIDEO EDITING · MOTION GRAPHICS"
    lay = T.layer(skills, "mono", 400, 15, tracking=3.0, color=PAPER_DIM)
    c.blit(lay, tx, 676, anchor="lt", opacity=ksk)

    return c.finish()


# ==========================================================================
# SCENE 03 — THE EXPERIENCE  (13.00 – 19.00)
# ==========================================================================
def scene_03(lt, f, gi):
    img = ground(gi, grid_alpha=0.085, drift=1.0)
    c = Canvas(img)
    d = c.draw()

    kf = exp_step(0.0, 0.7, lt, out_cubic)
    if kf > 0:
        frame_border(d, inset=54, color=PAPER, op=int(18 * kf), lw=1, corners=34)

    # ---- the figure: starts oversized and settles back into place
    fig = T.layer("8+", "arch", 800, 340, tracking=-6.0, color=PAPER)
    kf2 = exp_step(0.00, 1.55, lt, out_expo)
    fx, fy = M + 8, 322
    sc = lerp(2.45, 1.0, kf2)
    if kf2 > 0:
        c.blit_scaled(fig, fx + fig.width / (2 * SS), fy + fig.height / (2 * SS),
                      scale=sc, opacity=clamp01(exp_step(0.0, 0.45, lt, out_quad)))

    # ---- vertical divider
    kv = exp_step(1.10, 2.05, lt, out_quint)
    if kv > 0:
        vrule(d, col(4.0), 322, 322 + 300 * kv, PAPER, op=int(46 * kv), lw=1)

    # ---- right-hand block
    rx = col(4.6)
    eyebrow(c, "THE PRACTICE", rx, 328, exp_step(1.15, 1.80, lt, out_cubic), ACCENT_L)
    l1 = ["YEARS", "OF", "DESIGN"]
    ks1 = [exp_step(1.35 + i * 0.10, 2.45 + i * 0.10, lt, out_quint) for i in range(3)]
    words_row(c, l1, rx, 386, "display", 700, 62, tracking=-1.0, color=PAPER,
              ks=ks1, rise=20, gap=size_gap(62))
    l2 = ["EXPERIENCE"]
    ks2 = [exp_step(1.85, 2.95, lt, out_quint)]
    words_row(c, l2, rx, 466, "display", 700, 62, tracking=-1.0, color=PAPER,
              ks=ks2, rise=20, gap=size_gap(62))

    ksk = exp_step(2.30, 3.10, lt, out_cubic)
    tools = "PHOTOSHOP · ILLUSTRATOR · ADOBE XD · FIGMA"
    lay = T.layer(tools, "mono", 400, 15, tracking=3.0, color=GREY_1)
    c.blit(lay, rx, 566, anchor="lt", opacity=ksk)

    # ---- measured scale: eight ticks, lighting in sequence
    sx, sy = M + 8, 648
    sw_ = 430
    kbase = exp_step(2.00, 3.10, lt, out_quint)
    if kbase > 0:
        d.line([sx * SS, sy * SS, (sx + sw_ * kbase) * SS, sy * SS],
               fill=tuple(PAPER) + (int(34 * kbase),), width=max(1, int(1 * SS)))
    for i in range(8):
        k = exp_step(2.00 + i * 0.075, 2.65 + i * 0.075, lt, out_quint)
        x = sx + i * (sw_ / 7.0)
        lit = k
        d.line([x * SS, sy * SS, x * SS, (sy + 26 * (0.45 + 0.55 * lit)) * SS],
               fill=tuple(ACCENT) + (int(230 * lit + 40 * kbase),),
               width=max(1, int(3 * SS)))

    return c.finish()


# ==========================================================================
# SCENE 04 — THE PORTFOLIO SHOWCASE  (19.00 – 29.00)
# ==========================================================================
_S4_LAYOUT = [
    # plate centre x, plate centre y, plate size, text x, text y, text align
    dict(px=1345, py=520, ps=620, tx=M,      ty=452, align="l", dir=+1),
    dict(px=600,  py=520, ps=620, tx=1078,   ty=452, align="l", dir=-1),
    dict(px=960,  py=452, ps=600, tx=W / 2,  ty=846, align="c", dir=0),
]


def _beat(i, lt, c, ghost_key):
    """One portfolio beat.  Returns nothing; draws into c."""
    lay = _S4_LAYOUT[i]
    item = SHOWCASE[i]
    dur = 10.0 / 3.0
    t0 = i * dur
    l = lt - t0

    # ghost depth layer
    if ghost_key:
        gk = clamp01(exp_step(-0.4, 0.9, l, out_cubic)) * (1 - exp_step(dur - 0.5, dur, l, in_quad))
        if gk > 0:
            bg = A.blurred_backdrop(ghost_key, 1180, blur=30, darken=0.58)
            c.blit(bg, W / 2 + lay["dir"] * -40, 540, anchor="mm", opacity=0.30 * gk)

    kin = exp_step(0.00, 0.95, l, out_quint)
    kout = 1.0 if i == 2 else (1 - exp_step(dur - 0.60, dur, l, in_out_cubic))
    op = kin * kout
    if op <= 0.001:
        return

    slide = (1 - kin) * 46 * lay["dir"] - (1 - kout) * 46 * lay["dir"]
    px = lay["px"] + slide
    py = lay["py"]

    # plate
    kp = exp_step(0.05, 1.05, l, out_quint)
    plate_shadowed(c, item["asset"], px, py, lay["ps"], opacity=op, shadow_op=op)
    p = A.plate(item["asset"], lay["ps"])
    if kp < 0.999:
        m = diag_wipe_mask(p.size, kp, soft=150.0, angle=26.0)
        c.blit(p, px, py, anchor="mm", mask=m)
    plate_frame(c, px, py, lay["ps"], lay["ps"], op * exp_step(0.35, 0.9, l, out_cubic),
                PAPER, 44)
    km = exp_step(0.30, 1.00, l, out_back)
    plate_marks(c, px, py, lay["ps"], lay["ps"], km * op, ACCENT_L, 165, gap=24, size=16)

    # headline — auto-fitted so it can never cross the safe margin.
    # Measured with the *real rendered layers* and the exact gap the layout will
    # use, so this check cannot drift from what is actually drawn.
    words = item["head"].split()
    is_c = (lay["align"] == "c")
    avail = (W - 2 * M) if is_c else ((1035 - 60 - M) if i == 0 else ((W - M) - 1078))
    size = 74 if i < 2 else 60
    while size > 40:
        g_try = (size * 0.30) if is_c else size_gap(size)
        _lays = [T.layer(w, "display", 700, size, tracking=-1.2, color=PAPER)
                 for w in words]
        total = sum(l.width / SS for l in _lays) + g_try * (len(_lays) - 1)
        if total <= avail:
            break
        size -= 1
    ks = [exp_step(0.35 + j * 0.075, 1.30 + j * 0.075, l, out_quint)
          for j in range(len(words))]
    if lay["align"] == "c":
        words_centred(c, words, lay["tx"], lay["ty"], "display", 700, size,
                      tracking=-1.2, ks=ks, rise=20, gap=size_gap(size))
        grow_rule(c, lay["tx"], lay["ty"] + 78, 200,
                  exp_step(1.05, 1.65, l, out_quint) * op, ACCENT, 2, 200)
        kcap = exp_step(1.35, 1.95, l, out_cubic) * op
        cap = T.layer(f"SELECTED WORK — {A.vertical_of(item['asset'])}",
                      "mono", 400, 14, tracking=3.2, color=GREY_1)
        c.blit(cap, lay["tx"], lay["ty"] + 104, anchor="mm", opacity=kcap)
    else:
        gap = size_gap(size)
        words_row(c, words, lay["tx"], lay["ty"], "display", 700, size,
                  tracking=-1.2, color=PAPER, ks=ks, rise=20, gap=gap)
        grow_rule(c, lay["tx"] + 2, lay["ty"] + 96, 190,
                  exp_step(1.05, 1.65, l, out_quint) * op, ACCENT, 2, 200)
        kcap = exp_step(1.35, 1.95, l, out_cubic) * op
        cap = T.layer(f"SELECTED WORK — {A.vertical_of(item['asset'])}",
                      "mono", 400, 14, tracking=3.2, color=GREY_1)
        c.blit(cap, lay["tx"], lay["ty"] + 122, anchor="lt", opacity=kcap)

    # index
    kidx = exp_step(0.15, 0.85, l, out_cubic) * op
    idx = T.layer(f"0{i + 1} / 03", "mono", 500, 13, tracking=3.0, color=GREY_2)
    c.blit(idx, W - M, 152, anchor="rb", opacity=kidx)


def scene_04(lt, f, gi):
    img = ground(gi, grid_alpha=0.075, drift=1.0)
    c = Canvas(img)
    d = c.draw()

    kf = exp_step(-0.3, 0.6, lt, out_cubic)
    if kf > 0:
        frame_border(d, inset=54, color=PAPER, op=int(16 * kf), lw=1, corners=34)

    # grid columns sweep in
    kg = exp_step(-0.35, 0.55, lt, out_quint)
    if kg > 0:
        for xi in (4, 8):
            hgt = 740 * kg
            d.line([col(xi) * SS, 170 * SS, col(xi) * SS, (170 + hgt) * SS],
                   fill=tuple(PAPER) + (int(15 * kg),), width=max(1, int(1 * SS)))

    dur = 10.0 / 3.0
    idx = int(lt // dur)
    for i in (idx - 1, idx, idx + 1):
        if 0 <= i < len(SHOWCASE):
            _beat(i, lt, c, SHOWCASE[(i + 1) % len(SHOWCASE)]["asset"])

    # running footer
    kft = exp_step(0.2, 1.0, lt, out_cubic)
    ft = T.layer("PORTFOLIO — SELECTED PROJECTS", "mono", 400, 13,
                 tracking=3.4, color=GREY_2)
    c.blit(ft, M, H - 96, anchor="lb", opacity=kft * 0.9)

    return c.finish()


# ==========================================================================
# SCENE 05 — FROM STATIC DESIGN TO MOTION  (29.00 – 37.00)
# ==========================================================================
def scene_05(lt, f, gi):
    img = ground(gi, grid_alpha=0.075, drift=1.0)
    c = Canvas(img)
    d = c.draw()

    kf = exp_step(0.0, 0.7, lt, out_cubic)
    if kf > 0:
        frame_border(d, inset=54, color=PAPER, op=int(16 * kf), lw=1, corners=34)

    headline_px, headline_py = 960, 132
    plate_cx, plate_cy = 930, 500
    ps = 520
    key = "w04"

    # ---------- PHASE A — the print, absolutely static
    kA = exp_step(-0.15, 0.85, lt, out_quint)
    kB = exp_step(2.40, 4.00, lt, out_cubic)
    kC = exp_step(4.85, 5.75, lt, in_out_cubic)

    if kA > 0 and kC < 1:
        opA = kA * (1 - kC)
        # paper-bordered print
        pp = A.plate(key, ps, border_px=20, border_color=PAPER)
        sh = soft_shadow(pp.size, radius=int(2 * SS), blur=int(30 * SS),
                         opacity=int(115 * (1 + 0.5 * kB)), dy=int((14 + 34 * kB) * SS))
        c.blit(sh, plate_cx, plate_cy, anchor="mm", opacity=opA)
        sc = lerp(1.0, 1.06, kB)
        c.blit_scaled(pp, plate_cx, plate_cy, scale=sc, opacity=opA)
        plate_marks(c, plate_cx, plate_cy, pp.width / SS, pp.height / SS,
                    exp_step(0.45, 1.15, lt, out_back) * opA, PAPER, 90, gap=22, size=15)

        # motion echoes — the same artwork, trailing
        if kB > 0:
            plain = A.plate(key, ps)
            for j, (dx, dy, o, bl) in enumerate(
                    [(30, 20, 0.50, 0.0), (58, 39, 0.30, 7.0), (86, 58, 0.16, 15.0)]):
                ke = exp_step(2.65 + j * 0.10, 3.75 + j * 0.10, lt, out_quint)
                if ke <= 0:
                    continue
                im = plain
                if bl > 0:
                    im = fast_blur(im, bl * SS, downscale=4)
                c.blit_scaled(im, plate_cx + dx * ke, plate_cy + dy * ke,
                              scale=sc, opacity=o * ke * (1 - kC))

    # ---------- PHASE C — parallax planes
    if kC > 0:
        planes = [("w05", 0.42, 300, 600, 452, 9.0),
                  ("w04", 1.00, 500, 960, 500, 0.0),
                  ("w06", 0.92, 290, 1330, 610, 0.0)]
        drift = (lt - 5.0) * 20.0
        for j, (pk, po, psz, cx, cy, bl) in enumerate(planes):
            depth = (j - 1) * 1.0
            x = cx - drift * (0.45 + 0.55 * abs(depth))
            im = A.plate(pk, psz)
            if bl > 0:
                im = fast_blur(im, bl * SS, downscale=4)
            sh = soft_shadow(im.size, radius=int(2 * SS), blur=int(28 * SS),
                             opacity=int(110 * po), dy=int(16 * SS))
            c.blit(sh, x, cy, anchor="mm", opacity=po * kC)
            c.blit(im, x, cy, anchor="mm", opacity=po * kC)
            plate_frame(c, x, cy, psz, psz, po * kC * 0.7, PAPER, 40)

    # ---------- headline
    k1 = exp_step(2.15, 3.35, lt, out_quint)
    words1 = ["FROM", "STATIC", "DESIGN"]
    ks1 = [exp_step(2.15 + j * 0.085, 3.35 + j * 0.085, lt, out_quint)
           for j in range(len(words1))]
    words_centred(c, words1, headline_px, headline_py, "display", 700, 62,
                  tracking=1.0, ks=ks1, rise=18, gap=size_gap(62))

    k2 = exp_step(4.15, 5.30, lt, out_quint)
    words2 = ["TO", "MOTION"]
    cols = [PAPER, ACCENT_L]
    gap = size_gap(96)
    layers = [T.layer(w, "display", 700, 96 if w == "MOTION" else 62,
                      tracking=(2.0 if w == "MOTION" else 4.0), color=cc)
              for w, cc in zip(words2, cols)]
    total = sum(l.width / SS for l in layers) + gap * (len(layers) - 1)
    x = W / 2 - total / 2
    for j, l in enumerate(layers):
        kj = exp_step(4.15 + j * 0.12, 5.35 + j * 0.12, lt, out_quint)
        if kj <= 0:
            x += l.width / SS + gap
            continue
        if words2[j] == "MOTION":
            motion_smear(c, l, x, 838, kj, dist=120, samples=5, anchor="lt")
        else:
            reveal_text(c, l, x, 866, kj, rise=18)
        x += l.width / SS + gap

    # technical readout
    kro = exp_step(5.10, 5.90, lt, out_cubic)
    ro = T.layer("MOTION GRAPHICS · PARALLAX · 30 FPS", "mono", 400, 13,
                 tracking=3.4, color=GREY_2)
    c.blit(ro, M, H - 96, anchor="lb", opacity=kro)

    return c.finish()


# ==========================================================================
# SCENE 06 — CREATIVE THINKING × TECHNOLOGY  (37.00 – 43.00)
# ==========================================================================
def scene_06(lt, f, gi):
    img = ground(gi, grid_alpha=0.06, drift=1.0)
    c = Canvas(img)
    d = c.draw()

    kf = exp_step(0.0, 0.7, lt, out_cubic)
    if kf > 0:
        frame_border(d, inset=54, color=PAPER, op=int(16 * kf), lw=1, corners=34)

    # ---- technical grid, drifting
    kg = exp_step(-0.2, 0.9, lt, out_cubic)
    kge = 1 - exp_step(5.35, 6.0, lt, in_out_cubic)
    if kg > 0:
        a = kg * kge
        off = (gi * 14) % 120
        x = M - 120 + off
        while x < W - M + 120:
            vrule(d, x, 150, 930, BLUE, op=int(13 * a), lw=1)
            x += 120
        y = 150 + off
        while y < 930:
            rule(d, M, y, W - M, BLUE, op=int(9 * a), lw=1)
            y += 120
        # one brighter scan line
        sy = 150 + ((gi * 0.42) % 1.0) * 780
        rule(d, M, sy, W - M, ACCENT_L, op=int(46 * a), lw=1)

    # ---- technical frame with artwork inside
    fx, fy, fsz = 1400, 545, 330
    kfr = exp_step(0.25, 1.25, lt, out_quint)
    ang = lerp(-7.0, 5.0, exp_step(0.0, 6.0, lt, in_out_cubic))
    if kfr > 0:
        inner = A.plate("w11", fsz)
        sh = soft_shadow(inner.size, radius=int(2 * SS), blur=int(28 * SS),
                         opacity=120, dy=int(16 * SS))
        rot_sh = sh.rotate(ang, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
        rot_in = inner.rotate(ang, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
        c.blit(rot_sh, fx, fy, anchor="mm", opacity=kfr * 0.85)
        c.blit(rot_in, fx, fy, anchor="mm", opacity=kfr)
        # corner ticks around the rotated frame
        half = rot_in.width / (2 * SS)
        plate_marks(c, fx, fy, rot_in.width / SS, rot_in.height / SS,
                    exp_step(0.75, 1.45, lt, out_back) * kfr, ACCENT_L, 170,
                    gap=16, size=15)

    # ---- readouts
    kro = exp_step(1.05, 1.75, lt, out_cubic)
    rows = [
        "GRID — 12 COL / 24 PT",
        "SNAP — ON",
        "MODE — VECTOR",
        f"X {int(960 + math.sin(gi * 0.9) * 210):04d}  Y {int(540 + math.cos(gi * 0.7) * 180):04d}",
    ]
    for i, r in enumerate(rows):
        lay = T.layer(r, "mono", 400, 13, tracking=3.0,
                      color=(ACCENT_L if i == 3 else GREY_1))
        c.blit(lay, 1078, 372 + i * 26, anchor="lt", opacity=kro)

    # ---- type
    eyebrow(c, "SYSTEM", M, 372, exp_step(0.35, 1.05, lt, out_cubic), ACCENT_L)

    ks1 = [exp_step(0.55 + j * 0.085, 1.65 + j * 0.085, lt, out_quint) for j in range(2)]
    words_row(c, ["CREATIVE", "THINKING"], M, 428, "display", 700, 56,
              tracking=-0.6, color=PAPER, ks=ks1, rise=20, gap=size_gap(56))

    kx = exp_step(1.25, 2.20, lt, out_quint)
    if kx > 0:
        xl = T.layer("×", "display", 700, 46, tracking=0.0, color=ACCENT)
        spin = lerp(0.0, 180.0, exp_step(0.6, 5.6, lt, in_out_cubic))
        xl = xl.rotate(spin, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
        c.blit(xl, M + 4, 512, anchor="lt", opacity=kx)

    ks2 = [exp_step(1.65, 2.75, lt, out_quint)]
    words_row(c, ["TECHNOLOGY"], M, 552, "display", 700, 56,
              tracking=-0.6, color=PAPER, ks=ks2, rise=20, gap=size_gap(56))

    ksk = exp_step(2.35, 3.15, lt, out_cubic)
    lay = T.layer("AI-ASSISTED WORKFLOWS · DESIGN SYSTEMS · PRODUCTION",
                  "mono", 400, 14, tracking=3.0, color=PAPER_DIM)
    c.blit(lay, M, 664, anchor="lt", opacity=ksk)

    return c.finish()


# ==========================================================================
# SCENE 07 — THE PHILOSOPHY  (43.00 – 52.00)
# ==========================================================================
def scene_07(lt, f, gi):
    img = ground(gi, grid_alpha=0.05, drift=0.6)
    c = Canvas(img)

    # quiet blurred artwork as texture only
    bg = A.blurred_backdrop("w09", 1920, blur=34, darken=0.66, cover=True)
    kbg = exp_step(-0.4, 1.4, lt, out_cubic)
    drift = (lt - 4.5) * 9.0
    c.blit_scaled(bg, W / 2, H / 2 + 40, scale=1.06 + 0.05 * clamp01(lt / 9.0),
                  opacity=0.55 * kbg)

    # vertical rule drawing down
    kv = exp_step(0.40, 2.05, lt, out_cubic)
    if kv > 0:
        d = c.draw()
        vrule(d, M, 402, 402 + 200 * kv, ACCENT, op=int(190 * kv), lw=2)

    eyebrow(c, "PHILOSOPHY", M + 26, 372, exp_step(0.55, 1.45, lt, out_cubic), ACCENT_L)

    # line 1
    l1 = ["DESIGN", "IS", "MORE", "THAN", "AESTHETIC."]
    ks1 = [exp_step(0.95 + j * 0.165, 2.55 + j * 0.165, lt, out_cubic)
           for j in range(len(l1))]
    cols1 = [PAPER] * 5
    cols1[4] = PAPER
    words_row(c, l1, M + 26, 424, "display", 500, 60, tracking=-0.4,
              color=PAPER, ks=ks1, rise=14, gap=size_gap(60))

    # line 2 — the three nouns carry the accent
    l2 = ["IT'S", "ABOUT", "STORIES,", "SOLUTIONS", "&", "VALUE."]
    ks2 = [exp_step(2.55 + j * 0.165, 4.15 + j * 0.165, lt, out_cubic)
           for j in range(len(l2))]
    gap = size_gap(60)
    x = M + 26
    for j, w in enumerate(l2):
        colr = ACCENT_L if w in ("STORIES,", "SOLUTIONS", "VALUE.") else PAPER
        lay = T.layer(w, "display", 500, 60, tracking=-0.4, color=colr)
        k = ks2[j]
        if k > 0:
            reveal_text(c, lay, x, 508, k, rise=14, soft=16)
        x += lay.width / SS + gap

    # quiet tail
    kt = exp_step(6.2, 7.4, lt, out_cubic)
    tail = T.layer("ABDUR RAHIM NAIK — GRAPHIC DESIGNER", "mono", 400, 13,
                   tracking=3.4, color=GREY_2)
    c.blit(tail, M + 26, 626, anchor="lt", opacity=kt)

    return c.finish()


# ==========================================================================
# SCENE 08 — THE BRAND SIGNATURE  (52.00 – 60.00)
# ==========================================================================
def scene_08(lt, f, gi):
    img = ground(gi, grid_alpha=0.06, drift=0.7)
    c = Canvas(img)
    d = c.draw()

    # closing backdrop settles
    bg = A.blurred_backdrop("w13", 1920, blur=40, darken=0.72, cover=True)
    kbg = exp_step(-0.3, 1.2, lt, out_cubic) * (1 - exp_step(6.2, 7.6, lt, in_out_cubic))
    c.blit_scaled(bg, W / 2, H / 2, scale=1.10 - 0.04 * clamp01(lt / 8.0),
                  opacity=0.42 * kbg)

    kf = exp_step(0.55, 1.55, lt, out_cubic)
    if kf > 0:
        frame_border(d, inset=54, color=PAPER, op=int(22 * kf), lw=1, corners=34)

    # outline wordmark — callback to scene 01
    wm = T.layer(NAME_SHORT, "display", 700, 300, tracking=14.0,
                 color=PAPER, stroke_w=3.2, stroke_color=PAPER, outline_only=True)
    kwm = exp_step(0.90, 3.05, lt, in_out_quint)
    if kwm > 0:
        m = clip_wipe_mask(wm.size, kwm, soft=110.0, direction="right")
        sc = lerp(1.05, 1.0, kwm)
        c.blit_scaled(wm, W / 2, 380, scale=sc, mask=m if kwm < 0.999 else None)

    # solid name
    words = NAME.split()
    ks = [exp_step(2.40 + i * 0.10, 3.45 + i * 0.10, lt, out_quint)
          for i in range(len(words))]
    words_centred(c, words, W / 2, 545, "display", 700, 84, tracking=6.0,
                  ks=ks, rise=20, gap=size_gap(84))

    grow_rule(c, W / 2, 652, 520, exp_step(3.85, 4.75, lt, out_quint), ACCENT, 2, 200)

    # tagline
    kt = exp_step(4.05, 5.35, lt, out_quint)
    tl = T.layer(TAGLINE, "body", 500, 30, tracking=1.4, color=ACCENT_L)
    if kt > 0:
        reveal_text(c, tl, W / 2 - tl.width / (2 * SS), 700, kt, rise=12, soft=14)

    # service line
    ksv = exp_step(4.85, 5.95, lt, out_cubic)
    sl = T.layer(SERVICE_LINE, "mono", 400, 15, tracking=4.0, color=PAPER_DIM)
    c.blit(sl, W / 2, 772, anchor="mm", opacity=ksv)

    # handle
    kh = exp_step(5.45, 6.35, lt, out_cubic)
    hl = T.layer(HANDLE, "mono", 400, 13, tracking=3.4, color=GREY_2)
    c.blit(hl, W / 2, 826, anchor="mm", opacity=kh)

    # colour swatches — his own banner motif
    for i, cc in enumerate([ACCENT, BLUE, VIOLET, AMBER]):
        k = exp_step(5.75 + i * 0.085, 6.45 + i * 0.085, lt, out_back)
        if k <= 0:
            continue
        x = M + i * 38
        y = 900
        s = 24 * k
        d.rectangle([x * SS, (y + (24 - s) / 2) * SS,
                     (x + s) * SS, (y + (24 - s) / 2 + s) * SS],
                    fill=tuple(cc) + (int(235 * k),))
        d.rectangle([x * SS, y * SS, (x + 24) * SS, (y + 24) * SS],
                    outline=tuple(PAPER) + (int(38 * k),), width=max(1, int(1 * SS)))

    # resolve to black on the final beat
    kb = exp_step(7.72, 8.0, lt, in_out_quad)
    if kb > 0:
        black = Image.new("RGBA", c.img.size, (0, 0, 0, 255))
        c.img = Image.blend(c.img, black, kb)

    return c.finish()


SCENES = [scene_01, scene_02, scene_03, scene_04, scene_05,
          scene_06, scene_07, scene_08]
