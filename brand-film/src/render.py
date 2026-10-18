"""
render.py — the film pipeline.

Renders every frame at 2x (3840x2160), downsamples to 1920x1080 with Lanczos,
applies the film pass (grain + vignette) at delivery resolution, and pipes
straight into ffmpeg for H.264 encoding.  Nothing is written to disk except
the final MP4 and any stills you ask for.

    python src/render.py                 # full 60s render
    python src/render.py --stills        # 12 review frames, fast
    python src/render.py --frame 900     # one frame, for debugging
"""
import argparse
import math
import os
import subprocess
import sys
import time

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import (W, H, SS, RW, RH, FPS, NFRAMES, SCENES, OUTPUT, STILLS, INK)
from typography import T
from canvas import column_wipe_mask, push_mask
from layers import film_pass, radial
from ease import *
import assets as A
import scenes as S

# ------------------------------------------------------- transition design
# scene index -> (style, duration in seconds).  The cut point sits in the
# middle of the window, so scenes overlap and hand over to each other.
TRANSITIONS = {
    1: ("push",     0.72),
    2: ("columns",  0.80),
    3: ("columns",  0.78),
    4: ("dissolve", 0.74),
    5: ("columns",  0.80),
    6: ("dissolve", 0.95),
    7: ("dissolve", 0.85),
}


def _shift(img, dx, dy):
    """Offset a full-frame image, filling the gap with the film's black."""
    if dx == 0 and dy == 0:
        return img
    out = Image.new(img.mode, img.size, (0, 0, 0, 255) if img.mode == "RGBA" else (0, 0, 0))
    out.paste(img, (int(dx), int(dy)))
    return out


def _flash(img, amount):
    if amount <= 0.001:
        return img
    g = radial(700, (16, 185, 129), strength=0.55, power=1.9).resize(
        (RW, int(RH * 1.2)), Image.BILINEAR)
    out = img.copy()
    lay = g.copy()
    a = lay.split()[3].point(lambda v: int(v * amount))
    lay.putalpha(a)
    out.paste(lay, (0, (RW and int(-RH * 0.1))), lay)
    return out


def composite_transition(prev, cur, style, k):
    """Blend the outgoing and incoming scene according to the style."""
    if style == "push":
        np_ = _shift(prev, 0, -90 * k * SS)
        nc = _shift(cur, 0, 90 * (1 - k) * SS)
        m = push_mask(k, direction="up")
        return Image.composite(nc, np_, m)
    if style == "columns":
        np_ = _shift(prev, -34 * k * SS, 0)
        nc = _shift(cur, 34 * (1 - k) * SS, 0)
        m = column_wipe_mask(k, cols=9, stagger=0.40)
        return Image.composite(nc, np_, m)
    # dissolve with a soft emerald exposure bump at the midpoint
    if k >= 1:
        return cur
    out = Image.blend(prev, cur, float(k))
    return _flash(out, math.sin(math.pi * clamp01(k)) * 0.16)


def scene_at(t):
    """Index of the scene that owns global time t."""
    for i, (_, a, b) in enumerate(SCENES_T):
        if a <= t < b:
            return i
    return len(SCENES_T) - 1


SCENES_T = SCENES  # (id, start, end)


def render_frame(f, fast=False):
    """Return frame `f` as an RGB PIL image at delivery resolution."""
    t = f / FPS
    i = scene_at(t)
    sid, a, b = SCENES_T[i]

    img = S.SCENES[i](t - a, f, t)

    # hand-off to the previous / next scene
    if i > 0:
        style, dur = TRANSITIONS[i]
        if t < a + dur / 2:
            k = exp_step(a - dur / 2, a + dur / 2, t, in_out_cubic)
            prev = S.SCENES[i - 1](t - SCENES_T[i - 1][1], f, t)
            img = composite_transition(prev, img, style, k)

    if fast:
        return img.resize((W, H), Image.BILINEAR)
    return film_pass(img.resize((W, H), Image.LANCZOS), f)


# ------------------------------------------------------------------ export
def ffmpeg_bin():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def encode(frames_iter, out_path, audio=None, log_every=60):
    """Stream frames into ffmpeg -> H.264 MP4."""
    cmd = [
        ffmpeg_bin(), "-y", "-hide_banner", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
        "-r", str(FPS), "-i", "-",
    ]
    if audio:
        cmd += ["-i", audio]
    cmd += [
        "-c:v", "libx264", "-preset", "slow", "-crf", "16",
        "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0",
        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
        "-movflags", "+faststart",
    ]
    if audio:
        cmd += ["-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
                "-shortest"]
    else:
        cmd += ["-an"]
    cmd += [out_path]

    p = subprocess.Popen(cmd, stdin=subprocess.PIPE,
                         stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    t0 = time.time()
    n = 0
    try:
        for img in frames_iter:
            p.stdin.write(img.tobytes())
            n += 1
            if n % log_every == 0:
                el = time.time() - t0
                r = n / el
                print(f"  {n}/{NFRAMES} frames  {r:5.1f} fps  "
                      f"eta {max(0, (NFRAMES - n)) / max(r, 0.01):6.1f}s", flush=True)
        p.stdin.close()
    except BrokenPipeError:
        pass
    err = p.stderr.read().decode("utf-8", "ignore")
    rc = p.wait()
    if rc != 0:
        print("FFMPEG ERROR:\n" + err[-3000:])
        raise SystemExit(1)
    print(f"  encoded {n} frames in {time.time() - t0:.1f}s")
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frame", type=int, default=None)
    ap.add_argument("--stills", action="store_true")
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--end", type=int, default=NFRAMES)
    ap.add_argument("--out", default=str(OUTPUT / "naik-brand-film-60s.mp4"))
    ap.add_argument("--audio", default=None)
    ap.add_argument("--fast", action="store_true", help="skip film pass (preview only)")
    args = ap.parse_args()

    A.ensure_extracted()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    STILLS.mkdir(parents=True, exist_ok=True)

    if args.frame is not None:
        img = render_frame(args.frame, fast=args.fast)
        p = STILLS / f"frame_{args.frame:04d}.png"
        img.save(p)
        print("wrote", p)
        return

    if args.stills:
        marks = [0, 60, 120, 165, 210, 240, 300, 345, 375, 420, 465, 510,
                 555, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140,
                 1200, 1260, 1320, 1380, 1440, 1500, 1560, 1620, 1740, 1799]
        for f in marks:
            t = f / FPS
            sid, a, b = SCENES_T[scene_at(t)]
            img = render_frame(f, fast=args.fast)
            p = STILLS / f"s{int(t):02d}_{t:05.2f}_{sid}.png"
            img.save(p)
            print("wrote", p.name)
        return

    def gen():
        for f in range(args.start, args.end):
            yield render_frame(f, fast=args.fast)

    print(f"rendering frames {args.start}..{args.end} -> {args.out}")
    encode(gen(), args.out, audio=args.audio,
           log_every=60 if (args.end - args.start) > 300 else 30)
    print("done:", args.out)


if __name__ == "__main__":
    import math
    main()
