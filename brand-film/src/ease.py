"""
ease.py — animation curves.

Hand-tuned easing is most of what separates "assembled from effects" from
"art directed". Nothing here is a linear ramp unless it is meant to be.
"""
import math

def clamp01(x):
    return 0.0 if x < 0.0 else (1.0 if x > 1.0 else x)

def remap(v, a, b, c=0.0, d=1.0, clamp=True):
    """Map v from [a,b] onto [c,d]."""
    if b == a:
        return c
    t = (v - a) / (b - a)
    if clamp:
        t = clamp01(t)
    return c + (d - c) * t

def linear(t):
    return clamp01(t)

def in_quad(t):  t = clamp01(t); return t * t
def out_quad(t): t = clamp01(t); return 1 - (1 - t) * (1 - t)
def in_out_quad(t):
    t = clamp01(t)
    return 2 * t * t if t < 0.5 else 1 - ((-2 * t + 2) ** 2) / 2

def in_cubic(t):  t = clamp01(t); return t ** 3
def out_cubic(t): t = clamp01(t); return 1 - (1 - t) ** 3
def in_out_cubic(t):
    t = clamp01(t)
    return 4 * t ** 3 if t < 0.5 else 1 - ((-2 * t + 2) ** 3) / 2

def out_quart(t): t = clamp01(t); return 1 - (1 - t) ** 4
def in_out_quart(t):
    t = clamp01(t)
    return 8 * t ** 4 if t < 0.5 else 1 - ((-2 * t + 2) ** 4) / 2

def out_quint(t): t = clamp01(t); return 1 - (1 - t) ** 5
def in_quint(t):  t = clamp01(t); return t ** 5
def in_out_quint(t):
    t = clamp01(t)
    return 16 * t ** 5 if t < 0.5 else 1 - ((-2 * t + 2) ** 5) / 2

def out_expo(t):
    t = clamp01(t)
    return 1.0 if t >= 1.0 else 1 - 2 ** (-10 * t)

def in_expo(t):
    t = clamp01(t)
    return 0.0 if t <= 0.0 else 2 ** (10 * t - 10)

def in_out_expo(t):
    t = clamp01(t)
    if t <= 0: return 0.0
    if t >= 1: return 1.0
    if t < 0.5:
        return 2 ** (20 * t - 10) / 2
    return (2 - 2 ** (-20 * t + 10)) / 2

def out_circ(t):
    t = clamp01(t)
    return math.sqrt(max(0.0, 1 - (t - 1) ** 2))

def in_circ(t):
    t = clamp01(t)
    return 1 - math.sqrt(max(0.0, 1 - t * t))

def out_back(t, s=1.70158):
    t = clamp01(t)
    c3 = s + 1
    return 1 + c3 * (t - 1) ** 3 + s * (t - 1) ** 2

def in_out_back(t, s=1.70158):
    t = clamp01(t)
    c2 = s * 1.525
    if t < 0.5:
        return ((2 * t) ** 2 * ((c2 + 1) * 2 * t - c2)) / 2
    return ((2 * t - 2) ** 2 * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2

def out_elastic(t):
    t = clamp01(t)
    if t <= 0: return 0.0
    if t >= 1: return 1.0
    c4 = (2 * math.pi) / 3
    return 2 ** (-10 * t) * math.sin((t * 10 - 0.75) * c4) + 1

def smoothstep(a, b, x):
    t = remap(x, a, b)
    return t * t * (3 - 2 * t)

def smootherstep(a, b, x):
    t = remap(x, a, b)
    return t * t * t * (t * (t * 6 - 15) + 10)

def exp_step(a, b, x, ease=out_quint):
    """Eased 0->1 ramp between times a and b."""
    return ease(remap(x, a, b))

def pulse(t, a, b):
    """0 -> 1 -> 0 across [a,b]. Used for flashes and swells."""
    return math.sin(math.pi * clamp01(remap(t, a, b))) if b > a else 0.0

def stagger(i, start, step=0.06, dur=0.9, ease=out_quint, t=0.0):
    """Progress of element i in a staggered sequence."""
    return ease(remap(t, start + i * step, start + i * step + dur))

def spring(t, dur=0.8, damp=9.0, freq=3.2):
    """Critically-ish damped spring, 0 -> 1."""
    if t <= 0: return 0.0
    t = min(t, dur * 3)
    return 1 - math.exp(-damp * t) * math.cos(freq * math.pi * 2 * t)

def lerp(a, b, t):
    return a + (b - a) * t

def lerp3(a, b, t):
    return (lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t))
