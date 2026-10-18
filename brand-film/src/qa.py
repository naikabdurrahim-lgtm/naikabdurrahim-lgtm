"""
qa.py — automated delivery checks on the rendered file.

Separates what was actually verified from what could not be checked here.
Run:  python src/qa.py
"""
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import OUTPUT, W, H, FPS, DURATION, NFRAMES


def ffmpeg_bin():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def probe(path):
    """ffmpeg has no ffprobe in this bundle; parse -i output instead."""
    r = subprocess.run([ffmpeg_bin(), "-hide_banner", "-i", path],
                       capture_output=True, text=True)
    return r.stderr


def stream_info(path):
    info = probe(path)
    out = {}
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info)
    if m:
        h, mm, ss = int(m.group(1)), int(m.group(2)), float(m.group(3))
        out["duration"] = h * 3600 + mm * 60 + ss
    vline = re.search(r"Stream #\S+: Video: .*", info)
    if vline:
        v = vline.group(0)
        m = re.search(r"Video: (\w+)", v)
        if m:
            out["vcodec"] = m.group(1)
        m = re.search(r"(\d{3,5})x(\d{3,5})", v)
        if m:
            out["w"], out["h"] = int(m.group(1)), int(m.group(2))
        m = re.search(r"(yuv\w+|rgb\w+|gray)", v)
        if m:
            out["pix_fmt"] = m.group(1)
        m = re.search(r", (\d+(?:\.\d+)?) fps", v)
        if m:
            out["fps"] = float(m.group(1))
        m = re.search(r"(\d+) kb/s", v)
        if m:
            out["vbitrate_kbps"] = int(m.group(1))
    aline = re.search(r"Stream #\S+: Audio: .*", info)
    if aline:
        a = aline.group(0)
        m = re.search(r"Audio: (\w+)", a)
        if m:
            out["acodec"] = m.group(1)
        m = re.search(r"(\d+) Hz", a)
        if m:
            out["ar"] = int(m.group(1))
        m = re.search(r"Hz, (\w+)", a)
        if m:
            out["ach"] = m.group(1)
    m = re.search(r"bitrate: (\d+) kb/s", info)
    if m:
        out["bitrate_kbps"] = int(m.group(1))
    return out


def frame_stats(path):
    """Per-frame luma stats (YAVG / YMAX) straight off the encoded file."""
    cmd = [ffmpeg_bin(), "-hide_banner", "-loglevel", "info", "-i", path,
           "-vf", "signalstats,metadata=print", "-an", "-f", "null", "-"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    frames, cur = {}, None
    for line in r.stderr.splitlines():
        m = re.search(r"frame:(\d+)\s+pts:\d+\s+pts_time:([\d.]+)", line)
        if m:
            cur = int(m.group(1))
            frames[cur] = {"t": float(m.group(2))}
            continue
        m = re.search(r"signalstats\.(YAVG|YMAX|YMIN)=([\d.]+)", line)
        if m and cur is not None:
            frames[cur][m.group(1)] = float(m.group(2))
    return [frames[i] for i in sorted(frames)]


def black_runs(path, thresh=0.06):
    """Unintended black segments via ffmpeg's blackdetect filter."""
    cmd = [ffmpeg_bin(), "-hide_banner", "-i", path,
           "-vf", f"blackdetect=d=0.35:pix_th=0.10", "-an", "-f", "null", "-"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    out = []
    for m in re.finditer(r"black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)",
                         r.stderr):
        out.append((float(m.group(1)), float(m.group(2)), float(m.group(3))))
    return out


def check(label, ok, detail=""):
    mark = "PASS" if ok else "FAIL"
    print(f"  [{mark}] {label:<44} {detail}")
    return ok


def main():
    paths = {
        "with score": OUTPUT / "naik-brand-film-60s.mp4",
        "silent": OUTPUT / "naik-brand-film-60s-silent.mp4",
    }
    results = []
    for tag, p in paths.items():
        if not p.exists():
            print(f"\n{tag}: MISSING ({p})")
            continue
        i = stream_info(str(p))
        print(f"\n=== {tag}: {p.name}  ({p.stat().st_size/1e6:.2f} MB) ===")
        d = i.get("duration", 0)
        results.append(check("duration == 60.000 s", abs(d - DURATION) < 0.05,
                             f"{d:.3f}s"))
        results.append(check("resolution 1920x1080",
                             i.get("w") == W and i.get("h") == H,
                             f"{i.get('w')}x{i.get('h')}"))
        results.append(check("frame rate 30 fps", abs(i.get("fps", 0) - FPS) < 0.01,
                             f"{i.get('fps')} fps"))
        results.append(check("video codec h264",
                             "h264" in i.get("vcodec", ""), i.get("vcodec")))
        results.append(check("pixel format yuv420p",
                             i.get("pix_fmt") == "yuv420p", i.get("pix_fmt")))
        if tag == "with score":
            results.append(check("audio aac 48 kHz stereo",
                                 i.get("acodec") == "aac" and i.get("ar") == 48000
                                 and i.get("ach") in ("stereo", "2"),
                                 f"{i.get('acodec')} {i.get('ar')} Hz {i.get('ach')}"))

    # picture content checks on the silent master
    p = paths["silent"]
    if p.exists():
        print(f"\n=== picture content: {p.name} ===")
        ys = frame_stats(str(p))
        results.append(check("frame count == 1800", len(ys) == NFRAMES, f"{len(ys)}"))
        if ys:
            # signalstats reports limited-range Y: 16 = black, 235 = white
            yavg = [d.get("YAVG", 0) for d in ys]
            mn, mx = min(yavg), max(yavg)
            mean = sum(yavg) / len(yavg)
            # the last 0.45 s resolves to black by design; exclude it
            body = yavg[:-14]
            results.append(check("no crushed-to-black frames outside the resolve",
                                 min(body) > 18.0,
                                 f"min YAVG {min(body):.1f} (16 = pure black)"))
            results.append(check("no blown-out frames", mx < 200,
                                 f"max YAVG {mx:.1f} (235 = white)"))
            dead = []
            for sec in range(0, 60, 3):
                blk = yavg[sec * FPS:(sec + 3) * FPS]
                if blk and sum(blk) / len(blk) < 18.0:
                    dead.append(f"{sec}-{sec+3}s")
            results.append(check("every 3 s block carries an image", not dead,
                                 "dead: " + ", ".join(dead) if dead else "none"))
            print(f"  [INFO] mean frame luma YAVG = {mean:.1f} "
                  f"(film is intentionally near-black; 16 = black, 235 = white)")
        # Content check.  blackdetect is the wrong instrument for a film that is
        # deliberately near-black, so measure per-frame peak luma instead: every
        # frame must carry something visible.
        empty = [d["t"] for d in ys
                 if d.get("YMAX", 0) < 60 and 0.7 < d["t"] < DURATION - 0.45]
        allowed = 0
        results.append(check("no unintended empty frames", len(empty) <= allowed,
                             f"{len(empty)} empty frames mid-film "
                             f"(allowed {allowed})"))
        if empty:
            print(f"  [INFO] near-empty frames at t = "
                  f"{', '.join(f'{t:.2f}s' for t in empty[:12])}"
                  f"{' ...' if len(empty) > 12 else ''}")
        peaks = [d.get("YMAX", 0) for d in ys[21:-14]]
        results.append(check("highlights present across the film",
                             min(peaks) > 60,
                             f"min YMAX = {min(peaks):.0f} "
                             f"(soft, out-of-focus moments legitimately sit lowest)"))

    json.dump({"checked": len(results)}, open(OUTPUT / "qa-summary.json", "w"))
    print(f"\n{sum(results)}/{len(results)} automated checks passed.")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
