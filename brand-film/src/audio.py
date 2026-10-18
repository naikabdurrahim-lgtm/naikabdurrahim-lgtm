"""
audio.py — the score.

Everything is synthesised from scratch with numpy: no samples, no downloads,
no licence to clear.  It is written to the same 90 BPM grid the picture is cut
on, so every accent lands on a frame boundary.

Palette:
    pad     detuned sine stack, slow envelopes — the bed
    sub     sine with a pitch drop — weight
    kick    pitch-swept sine + click — pulse
    hat     short noise burst, high-passed — air
    tick    tiny sine blip — the "technical" layer used in scene 06
    whoosh  noise through a sweeping one-pole filter — transitions
    riser   noise with a rising filter + crescendo — anticipation
    impact  sub drop + noise + long tail — scene hits

Output: 48 kHz stereo WAV, exactly 60.000 s.
"""
import argparse
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import DURATION, BPM, OUTPUT, SCENES

SR = 48000
SPB = 60.0 / BPM                       # 0.6667 s per beat
N = int(round(DURATION * SR))          # 2,880,000 samples

# A minor 7 — dark, unresolved enough to sit under picture
PAD_ROOTS = [55.00, 82.41, 110.00, 130.81, 164.81, 196.00]


# ------------------------------------------------------------------ helpers
def _t():
    return np.arange(N, dtype=np.float64) / SR


def env_ar(t, start, dur, attack, release, curve=2.0):
    """Simple attack/release amplitude envelope over the whole timeline."""
    e = np.zeros(N)
    i0 = max(0, int(start * SR))
    i1 = min(N, int((start + dur) * SR))
    if i1 <= i0:
        return e
    a = max(1, int(attack * SR))
    r = max(1, int(release * SR))
    seg = np.ones(i1 - i0)
    n = min(a, len(seg))
    seg[:n] = np.linspace(0, 1, n) ** curve
    n = min(r, len(seg))
    seg[-n:] = np.linspace(1, 0, n) ** curve
    e[i0:i1] = seg
    return e


def env_decay(start, decay, curve=3.0):
    e = np.zeros(N)
    i0 = int(start * SR)
    n = int(decay * SR)
    if i0 >= N:
        return e
    n = min(n, N - i0)
    e[i0:i0 + n] = np.exp(-curve * np.linspace(0, 1, n) ** 0.85)
    return e


def sine(hz, env, phase=0.0, drift=0.0):
    """Sine at a possibly time-varying frequency, windowed by env."""
    idx = np.nonzero(env)[0]
    if idx.size == 0:
        return np.zeros(N)
    a, b = idx[0], idx[-1] + 1
    tt = np.arange(a, b) / SR
    if callable(hz):
        ph = 2 * np.pi * np.cumsum(hz(tt - a / SR)) / SR + phase
    else:
        ph = 2 * np.pi * hz * tt + phase
    out = np.zeros(N)
    out[a:b] = np.sin(ph) * env[a:b]
    return out


def noise(seed):
    rng = np.random.default_rng(seed)
    return rng.normal(0.0, 1.0, N)


def one_pole_sweep(x, env, f_lo=0.02, f_hi=0.55, nchunks=48, mode="lp"):
    """
    One-pole filter whose cutoff is swept by chunking.  Cheap, and the chunk
    cross-fades keep it smooth.
    """
    idx = np.nonzero(env)[0]
    if idx.size == 0:
        return np.zeros(N)
    a, b = idx[0], idx[-1] + 1
    seg = x[a:b].copy()
    L = seg.size
    step = max(1, L // nchunks)
    out = np.zeros(L + step)
    w = np.zeros(L + step)
    for i in range(0, L, step):
        u = i / max(1, L - 1)
        f = f_lo + (f_hi - f_lo) * u
        f = float(np.clip(f, 0.002, 0.95))
        sl = seg[i:i + step]
        if mode == "lp":
            y = _lp(sl, f)
        else:
            y = _hp(sl, f)
        out[i:i + sl.size] += y * np.hanning(max(2, sl.size))[:sl.size]
        w[i:i + sl.size] += np.hanning(max(2, sl.size))[:sl.size]
    w = np.maximum(w, 1e-6)
    res = np.zeros(N)
    res[a:a + L] = (out[:L] / w[:L])
    return res


def _lp(x, f):
    """Single-pole low-pass, forward-backward for zero phase smear."""
    y = np.empty_like(x)
    acc = 0.0
    for i in range(x.size):
        acc += f * (x[i] - acc)
        y[i] = acc
    return y


def _hp(x, f):
    return x - _lp(x, f)


def tail(x, delays=(0.11, 0.19, 0.27, 0.41), gains=(0.42, 0.30, 0.20, 0.12)):
    """Cheap feedback-free reverb: a few delayed, decaying copies."""
    out = x.copy()
    for d, g in zip(delays, gains):
        k = int(d * SR)
        if k < N:
            out[k:] += x[:-k] * g
    return out


# -------------------------------------------------------------- instruments
def pad(start, dur, gain=0.16, roots=PAD_ROOTS, detune=0.35):
    out = np.zeros(N)
    e = env_ar(_t(), start, dur, attack=1.6, release=2.6, curve=1.6)
    for i, f in enumerate(roots):
        for d in (-detune, detune):
            trem = 1.0 + 0.06 * np.sin(2 * np.pi * (0.07 + 0.02 * i) * _t())
            out += sine(f + d, e * trem, phase=i * 0.7)
    return out * gain / max(1, len(roots))


def kick(start, gain=0.85, f0=118.0, f1=44.0, decay=0.34):
    e = env_decay(start, decay, curve=4.2)
    tt = np.maximum(_t() - start, 0.0)
    k = np.exp(-tt / 0.055)
    hz = lambda x: f1 + (f0 - f1) * np.exp(-x / 0.045)
    body = sine(hz, e)
    click = noise(int(start * 1000) + 7) * env_decay(start, 0.02, curve=9.0)
    return (body * 0.92 + click * 0.10) * gain * k


def sub(start, gain=0.9, f0=70.0, f1=38.0, decay=0.9):
    e = env_decay(start, decay, curve=3.0)
    tt = np.maximum(_t() - start, 0.0)
    hz = lambda x: f1 + (f0 - f1) * np.exp(-x / 0.28)
    return sine(hz, e) * gain


def hat(start, gain=0.16, decay=0.045):
    e = env_decay(start, decay, curve=9.0)
    n = noise(int(start * 1000) + 31) * e
    return _hp(n, 0.55) * gain


def tick(start, hz=2100.0, gain=0.10, decay=0.035):
    e = env_decay(start, decay, curve=11.0)
    return sine(hz, e) * gain


def whoosh(start, dur=1.1, gain=0.22):
    e = env_ar(_t(), start, dur, attack=dur * 0.62, release=dur * 0.38, curve=1.4)
    n = noise(int(start * 1000) + 91)
    return one_pole_sweep(n, e, f_lo=0.015, f_hi=0.42, mode="lp") * e * gain


def riser(start, dur=1.8, gain=0.14):
    e = env_ar(_t(), start, dur, attack=dur * 0.92, release=dur * 0.08, curve=2.6)
    n = noise(int(start * 1000) + 53)
    return one_pole_sweep(n, e, f_lo=0.06, f_hi=0.62, mode="hp") * e * gain


def impact(start, gain=0.95):
    body = sub(start, gain=1.0, f0=88.0, f1=30.0, decay=1.5)
    e = env_decay(start, 0.55, curve=5.0)
    crash = one_pole_sweep(noise(int(start * 1000) + 17), e,
                           f_lo=0.5, f_hi=0.08, mode="lp") * e
    return tail(body * 0.85 + crash * 0.35) * gain


# --------------------------------------------------------------------- mix
def build():
    L = np.zeros(N)
    R = np.zeros(N)
    b = lambda n: n * SPB            # beat -> seconds

    def add(x, pan=0.0):
        nonlocal L, R
        gl = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2) / 1.0
        gr = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2) / 1.0
        L[:] = L + x * (gl * 0.7071 + 0.2929)
        R[:] = R + x * (gr * 0.7071 + 0.2929)

    # ---- continuous bed
    add(pad(0.0, 19.5, gain=0.15), pan=0.0)                 # scenes 1–3
    add(pad(18.6, 11.0, gain=0.17, roots=[55.0, 82.41, 110.0, 130.81, 164.81]), pan=0.0)
    add(pad(28.4, 16.0, gain=0.18, roots=[49.0, 73.42, 98.0, 116.54, 146.83]), pan=0.0)
    add(pad(42.6, 10.4, gain=0.19, roots=[55.0, 82.41, 110.0, 130.81, 164.81]), pan=0.0)
    add(pad(51.6, 8.6, gain=0.20, roots=[55.0, 82.41, 110.0, 130.81, 164.81, 220.0]), pan=0.0)

    # ---- scene 01 : anticipation
    add(sub(b(0.0), gain=0.55, f0=64, f1=34, decay=1.4))
    add(tick(b(3), hz=1750, gain=0.055))
    add(tick(b(6), hz=2350, gain=0.055))
    add(riser(3.85, 1.75, gain=0.10))                        # into the name
    add(whoosh(5.45, 0.85, gain=0.16), pan=-0.25)            # hand-off to 02

    # ---- scene 02 : identity
    add(impact(b(9), gain=0.55))
    for n in (13, 17):
        add(kick(b(n), gain=0.52))
    for n in (12, 14, 15, 16, 18):
        add(hat(b(n) + SPB / 2, gain=0.075), pan=0.35)
    add(sub(b(9), gain=0.45, f0=58, f1=32, decay=1.8))

    # ---- scene 03 : experience
    add(impact(b(19.5), gain=0.78))
    add(kick(b(20), gain=0.62))
    add(kick(b(24), gain=0.62))
    for n in (21, 22, 23, 25, 26, 27):
        add(hat(b(n) + SPB / 2, gain=0.08), pan=0.35)
    add(whoosh(18.4, 0.95, gain=0.16), pan=0.2)

    # ---- scene 04 : showcase — full pulse
    for n in np.arange(28.5, 43.4, 1.0):
        if abs((n - 28.5) % 2.0) < 1e-6:
            add(kick(b(n), gain=0.72))
        else:
            add(hat(b(n), gain=0.085), pan=0.4)
        add(hat(b(n) + SPB / 2, gain=0.055), pan=-0.4)
    for n in (28.5, 33.5, 38.5):                             # the three beats
        add(impact(b(n), gain=0.42))
        add(whoosh(b(n) - 0.42, 0.8, gain=0.14), pan=0.3)

    # ---- scene 05 : static -> motion
    add(whoosh(b(43.5) + 0.1, 1.2, gain=0.20), pan=-0.2)
    for n in np.arange(43.5, 55.4, 1.0):
        if abs((n - 43.5) % 2.0) < 1e-6:
            add(kick(b(n), gain=0.70))
        else:
            add(hat(b(n), gain=0.085), pan=0.4)
    add(riser(31.2, 1.5, gain=0.11))                         # the print lifts
    add(whoosh(31.35, 1.0, gain=0.17), pan=0.15)
    add(impact(b(50), gain=0.45))                            # "MOTION"

    # ---- scene 06 : technology — ticking layer
    for n in np.arange(55.5, 64.4, 0.5):
        add(tick(b(n), hz=1500 + 700 * ((n * 2) % 3), gain=0.055),
            pan=(-0.5 if (n * 2) % 2 == 0 else 0.5))
    for n in (55.5, 59.5, 63.5):
        add(kick(b(n), gain=0.62))
    add(whoosh(36.6, 1.0, gain=0.15), pan=-0.3)

    # ---- scene 07 : philosophy — everything drops away
    add(sub(b(64.5), gain=0.5, f0=60, f1=33, decay=2.4))
    add(tick(b(70), hz=990, gain=0.05))
    add(tick(b(74), hz=1320, gain=0.045))

    # ---- scene 08 : signature — rebuild and resolve
    add(impact(b(78), gain=0.85))
    for n in (78, 82, 86):
        add(kick(b(n), gain=0.72))
    for n in np.arange(78.0, 90.0, 1.0):
        add(hat(b(n) + SPB / 2, gain=0.055), pan=0.35)
    add(whoosh(51.7, 1.0, gain=0.16), pan=0.2)
    add(riser(56.2, 1.1, gain=0.08))
    add(sub(b(87.75), gain=0.85, f0=76, f1=31, decay=2.6))    # final hit
    add(whoosh(58.2, 0.9, gain=0.12), pan=-0.15)

    # ---- master
    def master(x, drive=1.35, ceiling=0.92):
        y = np.tanh(x * drive) / np.tanh(drive)
        m = np.max(np.abs(y))
        if m > 0:
            y = y / m * ceiling
        return y

    L = master(L)
    R = master(R)

    # 4 ms fade in, clean 0.35 s fade out to match the picture's resolve
    fi = int(0.004 * SR)
    L[:fi] *= np.linspace(0, 1, fi)
    R[:fi] *= np.linspace(0, 1, fi)
    fo = int(0.35 * SR)
    w = np.linspace(1, 0, fo) ** 1.4
    L[-fo:] *= w
    R[-fo:] *= w

    st = np.stack([L, R], axis=1)
    return st


def write_wav(path, st):
    import wave
    st_i = np.clip(st, -1.0, 1.0)
    pcm = (st_i * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUTPUT / "naik-brand-film-score.wav"))
    a = ap.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    st = build()
    write_wav(a.out, st)
    rms = float(np.sqrt(np.mean(st ** 2)))
    peak = float(np.max(np.abs(st)))
    print(f"wrote {a.out}")
    print(f"  duration {st.shape[0]/SR:.3f}s  sr {SR}  ch {st.shape[1]}")
    print(f"  peak {20*np.log10(max(peak,1e-9)):.2f} dBFS   rms {20*np.log10(max(rms,1e-9)):.2f} dBFS")


if __name__ == "__main__":
    main()
