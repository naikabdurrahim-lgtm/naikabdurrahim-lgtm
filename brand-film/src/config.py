"""
config.py — single source of truth for the brand film.

Every number the film depends on lives here: canvas, palette, type system,
scene timecodes and the asset shortlist. Change it here, re-render, done.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # .../brand-film
FONTS = ROOT / "fonts"
ASSETS = ROOT / "assets"
DERIVED = ASSETS / "derived"
PORTRAIT_DIR = ASSETS / "portrait"                     # DROP a hi-res portrait in here
OUTPUT = ROOT / "output"
STILLS = ROOT / "stills"
SRC_PDF = ASSETS / "source-portfolio.pdf"

# ---------------------------------------------------------------- master spec
W, H = 1920, 1080          # delivery resolution
SS = 2                     # supersample factor: render 2x, downsample -> AA
RW, RH = W * SS, H * SS    # render canvas
FPS = 30
DURATION = 60.0
NFRAMES = int(round(DURATION * FPS))   # 1800

# safe margins (at 1x scale) — nothing critical crosses these
MARGIN_X, MARGIN_Y = 108, 86

# ---------------------------------------------------------------- music grid
BPM = 90.0
SPB = 60.0 / BPM          # seconds per beat  = 0.6667
SPBar = SPB * 4           # 2.6667 s
def beat(n):  return n * SPB
def bar(n):   return n * SPBar

# ---------------------------------------------------------------- palette
# Taken from Naik's own naik-profile-banner.svg so the film is an extension of
# his existing identity rather than a new invention.
INK        = (7, 10, 20)      # near-black navy (deepest)
INK2       = (11, 16, 32)     # #0B1020 — his banner background
INK3       = (18, 24, 42)     # raised surface
PAPER      = (244, 241, 234)  # warm white
PAPER_DIM  = (196, 192, 184)
ACCENT     = (16, 185, 129)   # #10B981 emerald — the one accent
ACCENT_L   = (52, 211, 153)   # #34D399 — his tagline colour
ACCENT_D   = (6, 95, 70)
# supporting swatches, used only as data colours, never as decoration
BLUE       = (59, 130, 246)
VIOLET     = (139, 92, 246)
CORAL      = (255, 107, 94)
AMBER      = (255, 154, 0)
SKY        = (49, 168, 255)

GREY_1 = (150, 158, 176)      # muted label
GREY_2 = (96, 104, 122)       # quieter label

# ---------------------------------------------------------------- type system
# Display: Space Grotesk   Body/UI: Inter   Technical: JetBrains Mono
F = {
    "display":     {700: FONTS / "space-grotesk-700.ttf", 500: FONTS / "space-grotesk-500.ttf"},
    "body":        {400: FONTS / "inter-400.ttf", 500: FONTS / "inter-500.ttf", 600: FONTS / "inter-600.ttf"},
    "mono":        {400: FONTS / "jetbrains-mono-400.ttf", 500: FONTS / "jetbrains-mono-500.ttf"},
    "arch":        {600: FONTS / "archivo-600.ttf", 700: FONTS / "archivo-700.ttf", 800: FONTS / "archivo-800.ttf"},
}

# ---------------------------------------------------------------- identity
NAME = "ABDUR RAHIM NAIK"
NAME_SHORT = "NAIK"
ROLE_L1 = "GRAPHIC DESIGNER"
ROLE_L2 = "TECH ENTHUSIAST"
TAGLINE = "IDEAS INTO VISUALS. VISUALS INTO EXPERIENCES."
SERVICE_LINE = "GRAPHIC DESIGN · MOTION GRAPHICS · CREATIVE PRODUCTION"
LOCATION = "GRAPHIC DESIGNER • BANGLADESH"
HANDLE = "BEHANCE.NET/ABDURRAHIMNAIK"

# ---------------------------------------------------------------- scenes
# (id, start, end) in seconds.  Boundaries match the approved script; internal
# events are snapped to the 90 BPM grid wherever it helps the rhythm.
SCENES = [
    ("01_signature",  0.0,  6.0),
    ("02_identity",   6.0, 13.0),
    ("03_experience", 13.0, 19.0),
    ("04_showcase",  19.0, 29.0),
    ("05_motion",    29.0, 37.0),
    ("06_technology",37.0, 43.0),
    ("07_philosophy",43.0, 52.0),
    ("08_signature", 52.0, 60.0),
]

# ---------------------------------------------------------------- asset shortlist
# Selected from the source PDF: ranked by measured contrast, colourfulness,
# detail and compositional cleanliness, then spread across project verticals.
# `vertical` is the section header the artwork actually sat under in the PDF —
# the film credits it with that real label, never an invented client name.
SELECTED = [
    dict(key="w01", page=3, xref=42,  vertical="RESTAURANT"),
    dict(key="w02", page=6, xref=136, vertical="CARGO SERVICES"),
    dict(key="w03", page=3, xref=78,  vertical="TRAVEL AGENCY"),
    dict(key="w04", page=2, xref=3,   vertical="RESTAURANT"),
    dict(key="w05", page=3, xref=49,  vertical="RESTAURANT TRENDS"),
    dict(key="w06", page=3, xref=71,  vertical="HOTEL"),
    dict(key="w07", page=6, xref=125, vertical="CARGO SERVICES"),
    dict(key="w08", page=3, xref=60,  vertical="RESTAURANT TRENDS"),
    dict(key="w09", page=4, xref=104, vertical="MARKETING AGENCY"),
    dict(key="w10", page=8, xref=161, vertical="SHOPPING MALL"),
    dict(key="w11", page=5, xref=114, vertical="ONLINE TRAINING"),
    dict(key="w12", page=7, xref=141, vertical="HOME DECOR"),
    dict(key="w13", page=2, xref=15,  vertical="RESTAURANT"),
    dict(key="w14", page=3, xref=80,  vertical="TRAVEL AGENCY"),
]

# Scene 04 — three beats, one per service line from the script.
SHOWCASE = [
    dict(head="LOGO DESIGN",            asset="w02", caption="IDENTITY SYSTEM"),
    dict(head="SOCIAL MEDIA DESIGN",    asset="w01", caption="CAMPAIGN SERIES"),
    dict(head="SHORT-FORM VIDEO ADS",   asset="w03", caption="MOTION / AD FRAMES"),
]
