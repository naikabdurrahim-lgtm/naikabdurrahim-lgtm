"""
mux.py — combine the rendered picture with the score.

Video is stream-copied (no re-encode, no quality loss); only the audio is
encoded, to 256 kbps AAC at 48 kHz stereo.
"""
import argparse
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import OUTPUT


def ffmpeg_bin():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", default=str(OUTPUT / "naik-brand-film-60s-silent.mp4"))
    ap.add_argument("--audio", default=str(OUTPUT / "naik-brand-film-score.wav"))
    ap.add_argument("--out", default=str(OUTPUT / "naik-brand-film-60s.mp4"))
    a = ap.parse_args()

    cmd = [ffmpeg_bin(), "-y", "-hide_banner", "-loglevel", "error",
           "-i", a.video, "-i", a.audio,
           "-map", "0:v:0", "-map", "1:a:0",
           "-c:v", "copy",
           "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
           "-movflags", "+faststart",
           "-shortest", a.out]
    print("muxing:", " ".join(os.path.basename(x) for x in (a.video, a.audio)))
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-3000:])
        raise SystemExit(1)
    print("wrote", a.out)


if __name__ == "__main__":
    main()
