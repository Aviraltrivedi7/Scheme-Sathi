"""Pixel-level alignment audit for scheme-sathi-hero.png.

Asserts the strict-grid contract from gen-images.py's make_hero:
  - shared foot baseline BY for all three family figures
  - left-margin M snap for card 1, card 2 offset, receipt
  - receipt bottom at 540 and right edge clear of the mother's saree skirt
  - right-margin snap for the 92 card (660-M)
  - family cluster extent centered around CX
  - ghost 92 present behind the scene at reduced opacity
  - canvas corners transparent (blends into the page blob)
Run: python verify-hero.py  (exit 0 = all aligned)
"""
from PIL import Image

M, CX, BY = 32, 330, 578
LINE_RGB = (221, 214, 200)
img = Image.open("client/public/images/scheme-sathi-hero.png").convert("RGBA")
# the hero ships at 2x for retina — audit the logical 660 grid
if img.width != 660:
    img = img.resize((660, 660), Image.LANCZOS)
W, H = img.size
failures = []


def check(name, cond, detail):
    print(f"{'PASS' if cond else 'FAIL'} {name} ({detail})")
    if not cond:
        failures.append(name)


def lowest(x):
    for y in range(H - 1, -1, -1):
        if img.getpixel((x, y))[3] > 100:
            return y
    return None


def leftmost(y):
    for x in range(W):
        if img.getpixel((x, y))[3] > 100:
            return x
    return None


def rightmost(y):
    for x in range(W - 1, -1, -1):
        if img.getpixel((x, y))[3] > 100:
            return x
    return None


def topmost(x):
    for y in range(H):
        if img.getpixel((x, y))[3] > 100:
            return y
    return None


# 1) shared baseline: mother / father / child feet
for name, x in [("mother", 252), ("father", 390), ("child", 316)]:
    y = lowest(x)
    check(f"baseline {name}", y is not None and abs(y - BY) <= 2, f"lowest={y}, want {BY}")

# 2) margin snaps (edges land within 2px of the grid after 4x downsample)
l100 = leftmost(100)
check("card1 left edge at M", l100 == M, f"x={l100}, want {M}")
t200 = topmost(200)
check("card2 top at 116", t200 == 116, f"y={t200}, want 116")
l500 = leftmost(500)
check("receipt left edge at M", l500 == M, f"x={l500}, want {M}")
rb = lowest(100)
check("receipt bottom at 540", rb is not None and abs(rb - 540) <= 2, f"y={rb}, want 540")
rr = max((x for y in range(436, 541) for x in range(32, 186) if img.getpixel((x, y))[3] > 100), default=None)
check("receipt right edge at 184", rr is not None and 182 <= rr <= 185,
      f"right={rr}, want 184±2")
gut = [(x, y) for y in range(436, 545) for x in range(186, 195) if img.getpixel((x, y))[3] > 100]
check("receipt clear of saree skirt", not gut, f"blocking pixels={len(gut)} in gap band x[186,194]")

# 3) 92 card right edge at W-M
r150 = rightmost(150)
check("92-card right edge at W-M", r150 is not None and abs(r150 - (W - M)) <= 2, f"x={r150}, want {W - M}")

# 4) family cluster extent centered around CX — torso band below the ghost
#    (x >= 186 excludes the receipt at the left margin; y in [440,576] excludes
#     the ghost "92" whose baseline sits at 434 and the match card at top)
xs = [x for y in range(440, BY - 2) for x in range(186, W) if img.getpixel((x, y))[3] > 100]
lo, hi = (min(xs), max(xs)) if xs else (None, None)
center = (lo + hi) / 2 if xs else None
check("family extent centered near CX", center is not None and 310 <= center <= 345,
      f"center={center}, extent=({lo},{hi})")

# 5) ghost 92 behind the scene — count semi-transparent line-color pixels
#    (the digit gap sits at x=CX, so a single-point sample would miss it)
ghost_ct = 0
for y in range(230, 420):
    for x in range(200, 460):
        px = img.getpixel((x, y))
        if abs(px[3] - 127) < 55 and all(abs(px[i] - LINE_RGB[i]) <= 4 for i in range(3)):
            ghost_ct += 1
check("ghost 92 visible behind scene", ghost_ct > 300, f"ghost pixels={ghost_ct}, want >300")

# 6) corners transparent
for corner in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]:
    check(f"corner {corner} transparent", img.getpixel(corner)[3] == 0, f"alpha={img.getpixel(corner)[3]}")

print()
if failures:
    print(f"{len(failures)} ALIGNMENT FAILURES: {failures}")
    raise SystemExit(1)
print("ALL ALIGNMENT CHECKS PASS")
