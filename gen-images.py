"""Generate the three Scheme Sathi images (mark, hero, pwa-icon).

Palette is the EXACT :root token set from client/src/index.css — the parity
is asserted by server/brandImages.test.ts, so this script can never drift
from the page again:
- paper #f7f3eb, paper-deep #eee7da, saffron #d9822b, saffron-deep #b8651e,
  emerald #2a856b, coral #c65a4a, ink #1f2e49, ink-soft #526075,
  line #ddd6c8, white #fffdf9
"""
from PIL import Image, ImageDraw, ImageFilter
import random

# ── client/src/index.css :root tokens (keep in sync — test-enforced) ──
PAPER = (247, 243, 235, 255)         # --paper
PAPER_DEEP = (238, 231, 218, 255)    # --paper-deep   #eee7da
SAFFRON = (217, 130, 43, 255)       # --saffron      #d9822b
SAFFRON_DEEP = (184, 101, 30, 255)  # --saffron-deep #b8651e
EMERALD = (42, 133, 107, 255)       # --emerald      #2a856b
CORAL = (198, 90, 74, 255)          # --coral        #c65a4a
INK = (31, 46, 73, 255)             # --ink          #1f2e49
INK_SOFT = (82, 96, 117, 255)       # --ink-soft     #526075
LINE = (221, 214, 200, 255)         # --line         #ddd6c8
WHITE = (255, 253, 249, 255)        # --white        #fffdf9

SS = 4  # supersample factor for crisp edges


def s(x):
    return int(round(x * SS))


def mix(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1[:3], c2[:3])) + (255,)


# supersampled canvas helpers ------------------------------------------------
class Art:
    """Supersampled drawing surface: draw at 4x, downsample once at the end.

    `out` lets the hero ship at 2x its logical size for retina crispness —
    all draw coordinates stay in the 660-logical grid either way.
    """

    def __init__(self, size, out=None):
        self.size = size
        self.out = out or size
        self.img = Image.new("RGBA", (s(size), s(size)), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    def rrect(self, box, radius=0, fill=None, outline=None, width=2):
        self.d.rounded_rectangle(
            [s(v) for v in box], radius=s(radius),
            fill=fill, outline=outline, width=s(width),
        )

    def poly(self, pts, fill=None, outline=None, width=2):
        self.d.polygon([(s(x), s(y)) for x, y in pts], fill=fill, outline=outline, width=s(width) if outline else None)

    def ellipse(self, box, fill=None, outline=None, width=2):
        self.d.ellipse([s(v) for v in box], fill=fill, outline=outline, width=s(width) if outline else None)

    def line(self, pts, fill, width, joint="curve"):
        self.d.line([(s(x), s(y)) for x, y in pts], fill=fill, width=s(round(width)), joint=joint)

    def arc(self, box, start, end, fill, width):
        self.d.arc([s(v) for v in box], start=start, end=end, fill=fill, width=s(width))

    def pieslice(self, box, start, end, fill):
        self.d.pieslice([s(v) for v in box], start=start, end=end, fill=fill)

    def soft_shadow(self, box, radius=12, blur=10, alpha=46, dy=3):
        """Soft ink shadow behind a card — offset dy down, gaussian-blurred."""
        lay = Image.new("RGBA", (s(self.size), s(self.size)), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lay)
        ld.rounded_rectangle(
            [s(box[0]), s(box[1] + dy), s(box[2]), s(box[3] + dy)],
            radius=s(radius), fill=INK[:3] + (alpha,),
        )
        lay = lay.filter(ImageFilter.GaussianBlur(blur * SS))
        self.img.alpha_composite(lay)

    def paste(self, img, box):
        """Paste an RGBA layer inside the supersampled canvas."""
        if img.mode != "RGBA":
            img = img.convert("RGBA")
        # draw as composite at supersample scale
        scaled = img.resize((s(box[2] - box[0]), s(box[3] - box[1])), Image.LANCZOS)
        self.img.alpha_composite(scaled, (s(box[0]), s(box[1])))

    def finish(self):
        return self.img.resize((self.out, self.out), Image.LANCZOS)


# ── 1. Brand mark: paper document + emerald check, on transparent bg ──
def make_mark(size=124):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Document with folded corner
    m = size * 0.12
    doc = [m, m * 0.8, size - m, size - m]
    d.rounded_rectangle(doc, radius=size * 0.12, fill=WHITE, outline=INK, width=max(2, size // 40))
    # Folded corner (top-right)
    fold = size * 0.22
    x1, y1 = size - m - fold, m * 0.8
    d.polygon([(x1, y1), (size - m, y1), (size - m, y1 + fold)], fill=PAPER_DEEP)
    d.line([(x1, y1), (size - m, y1 + fold)], fill=INK, width=max(2, size // 40))
    # Text lines (schemes made clear)
    lw = size // 42
    for i, w in enumerate([0.62, 0.5, 0.56]):
        yy = m * 0.8 + size * (0.28 + i * 0.13)
        d.rounded_rectangle(
            [m + size * 0.14, yy, m + size * 0.14 + size * w, yy + lw * 1.6],
            radius=lw,
            fill=SAFFRON if i == 0 else LINE,
        )
    # Emerald check badge bottom-right
    bx, by, br = size * 0.76, size * 0.76, size * 0.17
    d.ellipse([bx - br, by - br, bx + br, by + br], fill=EMERALD)
    cw = size // 26
    d.line([(bx - br * 0.45, by), (bx - br * 0.05, by + br * 0.42)], fill=WHITE, width=cw)
    d.line([(bx - br * 0.05, by + br * 0.42), (bx + br * 0.5, by - br * 0.32)], fill=WHITE, width=cw)
    return img


# ── 2. PWA icon: saffron rounded square + white document-check ──
def make_pwa_icon(size=512):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Full-bleed saffron background with slight corner rounding (maskable-safe:
    # keep logo inside the center 80% safe zone)
    d.rounded_rectangle([0, 0, size, size], radius=size * 0.22, fill=SAFFRON)
    # Subtle paper texture dots
    for gx in range(6):
        for gy in range(6):
            x = size * (0.08 + gx * 0.17)
            y = size * (0.08 + gy * 0.17)
            r = size * 0.012
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 28))
    # Central document card
    m = size * 0.26
    d.rounded_rectangle([m, m * 0.8, size - m, size - m * 0.6], radius=size * 0.07, fill=WHITE)
    # Text lines
    lw = size // 90
    for i, w in enumerate([0.34, 0.27, 0.3]):
        yy = m * 0.7 + size * (0.13 + i * 0.08)
        d.roundedrectangle = None  # no-op guard against typos
        d.rounded_rectangle(
            [m + size * 0.05, yy, m + size * 0.05 + size * w, yy + lw * 1.4],
            radius=lw,
            fill=SAFFRON if i == 0 else LINE,
        )
    # Big emerald check
    cx, cy = size * 0.5, size * 0.66
    cw = size // 22
    pts = [
        ((cx - size * 0.11, cy), (cx - size * 0.02, cy + size * 0.09)),
        ((cx - size * 0.02, cy + size * 0.09), (cx + size * 0.14, cy - size * 0.08)),
    ]
    for (x1, y1), (x2, y2) in pts:
        d.line([(x1, y1), (x2, y2)], fill=EMERALD, width=cw)
        for px, py in ((x1, y1), (x2, y2)):
            d.ellipse([px - cw / 2, py - cw / 2, px + cw / 2, py + cw / 2], fill=EMERALD)
    return img


# ── 3. Hero: flat editorial illustration on a TRANSPARENT background ──
# The page paints its own paper-deep organic blob behind the art
# (.hero-art-wrap::before). Every element below sits on a strict grid so the
# presentation shot reads as deliberately composed, not floating stickers:
#   - outer margin M on all anchored edges (cards, 92-card, receipt)
#   - CX canvas center: family cluster + sparkle trail axis
#   - BY shared foot baseline: mother, father and child all stand on it
#   - typography rendered in the app's real fonts (DM Serif Display digits,
#     Plus Jakarta Sans labels) via PIL FreeType — same faces the page ships.
def make_hero(size=660, out=None):
    art = Art(size, out=out)
    from font_glyphs import serif_font, sans_font

    EMERALD_DEEP = mix(EMERALD, INK, 0.30)
    EMERALD_LIGHT = mix(EMERALD, WHITE, 0.30)
    SKIN_M = (224, 172, 133, 255)
    SKIN_F = (232, 184, 145, 255)
    SKIN_C = (238, 197, 158, 255)

    M = 32    # outer margin — every anchored element snaps to it
    CX = 330  # canvas center — family cluster + sparkle trail axis
    BY = 578  # shared foot baseline

    def text(pos, label, font, fill):
        art.d.text((s(pos[0]), s(pos[1])), label, font=font, fill=fill, anchor="ls")

    def tw(label, font):
        return art.d.textlength(label, font=font) / SS

    # face: neck + head + hair cap over the top only (eyes/smile stay clear)
    def face(cx, cy, r, skin, bun=False):
        art.line([(cx, cy + r * 0.9), (cx, cy + r * 1.9)], fill=skin, width=max(3, round(r * 0.45)))
        if bun:  # bun peeks from behind the head, mother only
            art.ellipse([cx + r * 0.6, cy - r * 0.5, cx + r * 1.25, cy + r * 0.15], fill=INK)
        art.ellipse([cx - r, cy - r, cx + r, cy + r], fill=skin)
        art.pieslice([cx - r * 1.05, cy - r * 1.05, cx + r * 1.05, cy + r * 0.15], start=180, end=360, fill=INK)
        ey = cy + r * 0.28
        er = max(2, round(r * 0.09))
        art.ellipse([cx - r * 0.42 - er, ey - er, cx - r * 0.42 + er, ey + er], fill=INK)
        art.ellipse([cx + r * 0.42 - er, ey - er, cx + r * 0.42 + er, ey + er], fill=INK)
        art.arc([cx - r * 0.3, cy + r * 0.32, cx + r * 0.3, cy + r * 0.82], start=25, end=155, fill=INK, width=max(2, round(r * 0.09)))

    # ── 1) Ghost "92" backdrop (50% line-color, dead center) ──
    ghost = Image.new("RGBA", (s(size), s(size)), (0, 0, 0, 0))
    gd = ImageDraw.Draw(ghost)
    f_ghost = serif_font(s(300))
    gw = gd.textlength("92", font=f_ghost)
    gd.text((s(CX) - gw / 2, s(434)), "92", font=f_ghost, fill=LINE, anchor="ls")
    ghost.putalpha(ghost.getchannel("A").point(lambda a: int(a * 0.5)))
    art.img.alpha_composite(ghost)

    # ── 2) Ground shadow under the family ──
    shadow = Image.new("RGBA", (s(size), s(size)), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse([s(180), s(566), s(482), s(590)], fill=INK)
    shadow.putalpha(shadow.getchannel("A").point(lambda a: int(a * 0.08)))
    art.img.alpha_composite(shadow)

    # ── 3) Mini scheme cards — cascade, both snap to left margin M ──
    def mini_card(x, y, w, h, label):
        art.soft_shadow([x, y, x + w, y + h], radius=9, blur=8, alpha=42, dy=2)
        art.rrect([x, y, x + w, y + h], radius=9, fill=WHITE, outline=INK, width=2)
        f = sans_font(s(8))
        chip_w = tw(label, f) + 10
        art.rrect([x + 12, y + 12, x + 12 + chip_w, y + 28], radius=5, fill=SAFFRON)
        text((x + 17, y + 24), label, f, WHITE)
        art.rrect([x + 12, y + 44, x + w - 12, y + 50], radius=3, fill=LINE)
        art.rrect([x + 12, y + 58, x + w - 24, y + 64], radius=3, fill=LINE)
        ccx, ccy = x + w - 30, y + h - 30
        art.ellipse([ccx - 13, ccy - 13, ccx + 13, ccy + 13], fill=EMERALD)
        art.line([(ccx - 5, ccy), (ccx - 1, ccy + 5)], fill=WHITE, width=4)
        art.line([(ccx - 1, ccy + 5), (ccx + 7, ccy - 4)], fill=WHITE, width=4)

    mini_card(M, 56, 148, 116, "SCHOLARSHIP")          # [32,56]
    mini_card(M + 48, 116, 148, 116, "PENSION")        # [80,116]

    # ── 4) "92" match card — right edge snaps to 660-M ──
    hx, hy_, hw, hh = 388, 48, 240, 204                  # [388,48]-[628,252]
    art.soft_shadow([hx, hy_, hx + hw, hy_ + hh], radius=12, blur=10, alpha=46, dy=3)
    art.rrect([hx, hy_, hx + hw, hy_ + hh], radius=12, fill=WHITE, outline=INK, width=2.5)
    f_chip = sans_font(s(10))
    chip_w = tw("YOUR MATCH", f_chip) + 16
    art.rrect([hx + 16, hy_ + 16, hx + 16 + chip_w, hy_ + 34], radius=5, fill=SAFFRON)
    text((hx + 24, hy_ + 30), "YOUR MATCH", f_chip, WHITE)
    art.rrect([hx + 16, hy_ + 52, hx + hw - 16, hy_ + 59], radius=3.5, fill=LINE)
    art.rrect([hx + 16, hy_ + 66, hx + hw - 60, hy_ + 73], radius=3.5, fill=LINE)
    text((hx + 18, hy_ + 152), "92", serif_font(s(96)), INK)  # the editorial hook
    bcx, bcy = hx + 172, hy_ + 117                       # emerald check badge
    art.ellipse([bcx - 27, bcy - 27, bcx + 27, bcy + 27], fill=EMERALD)
    art.line([(bcx - 10, bcy), (bcx - 2, bcy + 9)], fill=WHITE, width=6)
    art.line([(bcx - 2, bcy + 9), (bcx + 12, bcy - 8)], fill=WHITE, width=6)
    track_x1, track_x2, track_y = hx + 16, hx + hw - 16, hy_ + 166
    art.rrect([track_x1, track_y, track_x2, track_y + 7], radius=3.5, fill=LINE)
    art.rrect([track_x1, track_y, track_x1 + round((track_x2 - track_x1) * 0.92), track_y + 7], radius=3.5, fill=SAFFRON)
    text((hx + 18, hy_ + 192), "STRONG MATCH", sans_font(s(11)), EMERALD)

    # ── 5) Sparkles + sun arc + dotted connectors ──
    def sparkle(x, y, r, color):
        art.poly([(x, y - r), (x + r * 0.4, y - r * 0.4), (x + r, y), (x + r * 0.4, y + r * 0.4),
                  (x, y + r), (x - r * 0.4, y + r * 0.4), (x - r, y), (x - r * 0.4, y - r * 0.4)], fill=color)
    sparkle(CX, 76, 6, SAFFRON)
    sparkle(CX, 116, 5, CORAL)
    sparkle(CX, 158, 4, EMERALD)
    sparkle(196, 340, 4, SAFFRON)
    sparkle(464, 340, 4, EMERALD)
    # corner sparkle burst — top-left mini-card zone echo
    sparkle(28, 44, 5, SAFFRON)
    sparkle(38, 28, 3.5, CORAL)
    sparkle(16, 58, 3, EMERALD)
    # sun arc rising behind the match card — echoes the saffron ring in CSS
    art.arc([hx - 150, hy_ - 120, hx + 90, hy_ + 120], start=200, end=330,
            fill=mix(SAFFRON, WHITE, 0.35), width=3)
    # dotted connector: cards → family flow (story reads left-to-right)
    def dots(x1, y1, x2, y2, n, color):
        for i in range(1, n):
            t = i / n
            art.ellipse([x1 + (x2 - x1) * t - 2, y1 + (y2 - y1) * t - 2,
                         x1 + (x2 - x1) * t + 2, y1 + (y2 - y1) * t + 2], fill=color)
    dots(200, 200, 240, 386, 5, mix(SAFFRON, INK, 0.15))       # pension card → family
    dots(470, 266, 430, 330, 4, mix(EMERALD, INK, 0.15))        # 92-card → father

    # ── 6) Benefit receipt — bottom-left, left edge snaps to M ──
    rx, ry = M, 436                                       # [32,436]-[184,540]
    art.soft_shadow([rx, ry, rx + 152, ry + 104], radius=10, blur=10, alpha=46, dy=3)
    art.rrect([rx, ry, rx + 152, ry + 104], radius=10, fill=WHITE, outline=INK, width=2)
    f_paid = sans_font(s(8))
    paid_w = tw("BENEFIT", f_paid)
    art.rrect([rx + 12, ry + 10, rx + 24 + paid_w, ry + 24], radius=5, fill=EMERALD)
    text((rx + 18, ry + 20), "BENEFIT", f_paid, WHITE)
    text((rx + 14, ry + 66), "2,500", serif_font(s(34)), INK)  # the payout amount
    f_rec = sans_font(s(8))
    rec_w = tw("RECEIVED", f_rec)
    art.rrect([rx + 14, ry + 76, rx + 26 + rec_w, ry + 90], radius=5, fill=EMERALD_LIGHT)
    text((rx + 20, ry + 86), "RECEIVED", f_rec, mix(EMERALD, INK, 0.35))
    ccx, ccy = rx + 123, ry + 44                           # rupee coin
    art.ellipse([ccx - 15, ccy - 15, ccx + 15, ccy + 15], fill=SAFFRON)
    art.line([(ccx - 8, ccy - 6), (ccx + 8, ccy - 6)], fill=WHITE, width=3)
    art.line([(ccx - 5, ccy + 3), (ccx + 6, ccy + 3)], fill=WHITE, width=3)
    art.line([(ccx - 3, ccy - 9), (ccx - 3, ccy + 9)], fill=WHITE, width=3)

    # ── 7) Family — all three stand on baseline BY ──
    # Father (center 408, head r25 @303, kurta + placket + shoes)
    fx = 408
    art.poly([(373, 340), (443, 340), (456, 542), (360, 542)], fill=SAFFRON)
    art.rrect([360, 528, 456, 548], radius=18, fill=SAFFRON)  # hem band
    art.poly([(396, 340), (420, 340), (408, 360)], fill=SAFFRON_DEEP)  # collar
    art.line([(408, 362), (408, 446)], fill=SAFFRON_DEEP, width=3)      # placket
    for by_ in (378, 398, 418):                                          # kurta buttons
        art.ellipse([405.5, by_ - 2.5, 410.5, by_ + 2.5], fill=SAFFRON_DEEP)
    art.line([(382, 350), (370, 420)], fill=SAFFRON_DEEP, width=3)       # sleeve seams
    art.line([(434, 350), (446, 420)], fill=SAFFRON_DEEP, width=3)
    art.line([(390, 546), (388, 572)], fill=INK, width=12)
    art.line([(426, 546), (428, 572)], fill=INK, width=12)
    art.rrect([376, 566, 404, BY], radius=5, fill=INK)
    art.rrect([412, 566, 440, BY], radius=5, fill=INK)
    face(fx, 303, 25, SKIN_F)

    # Mother (center 252, head r25 @303, emerald saree + pallu)
    art.poly([(232, 418), (272, 418), (320, 572), (188, 572)], fill=EMERALD)  # skirt
    art.rrect([188, 556, 320, BY], radius=20, fill=EMERALD)                    # hem band
    art.rrect([188, 556, 320, 563], radius=6, fill=EMERALD_DEEP)               # hem border
    art.line([(240, 424), (212, 566)], fill=EMERALD_DEEP, width=3)             # pleats
    art.line([(252, 424), (252, 568)], fill=EMERALD_DEEP, width=3)
    art.line([(264, 424), (292, 566)], fill=EMERALD_DEEP, width=3)
    art.poly([(222, 340), (282, 340), (274, 414), (230, 414)], fill=EMERALD)  # blouse
    art.line([(230, 344), (270, 410)], fill=EMERALD_LIGHT, width=14, joint="curve")  # pallu
    art.line([(230, 341), (270, 407)], fill=EMERALD_DEEP, width=2)            # pallu border
    art.rrect([232, 416, 272, 426], radius=5, fill=EMERALD_DEEP)              # waist fold
    face(252, 303, 25, SKIN_M, bun=True)
    art.ellipse([250, 299, 254, 303], fill=CORAL)  # bindi

    # Child (center 330, head r23 @386) — coral backpack, cheering in a V
    art.rrect([296, 410, 314, 464], radius=8, fill=CORAL)            # backpack
    art.rrect([296, 410, 314, 418], radius=4, fill=mix(CORAL, INK, 0.25))  # backpack flap
    art.rrect([306, 404, 354, 470], radius=10, fill=WHITE, outline=INK, width=2)  # shirt
    art.poly([(322, 404), (338, 404), (330, 416)], fill=CORAL)       # collar
    art.rrect([306, 404, 313, 470], radius=5, fill=CORAL)            # front placket band
    art.rrect([308, 468, 352, 494], radius=6, fill=CORAL)            # shorts
    face(330, 386, 23, SKIN_C)
    art.line([(312, 416), (297, 392), (289, 374)], fill=SKIN_C, width=10, joint="curve")
    art.ellipse([284, 369, 296, 381], fill=SKIN_C)
    art.line([(348, 416), (363, 392), (371, 374)], fill=SKIN_C, width=10, joint="curve")
    art.ellipse([364, 369, 376, 381], fill=SKIN_C)
    art.line([(320, 494), (318, 570)], fill=SKIN_C, width=9)
    art.line([(340, 494), (342, 570)], fill=SKIN_C, width=9)
    art.rrect([300, 564, 328, BY], radius=5, fill=INK)
    art.rrect([332, 564, 360, BY], radius=5, fill=INK)

    # Inner arms — parents' hands rest ON the child's shoulders
    art.line([(278, 352), (302, 392), (314, 424)], fill=SKIN_M, width=13, joint="curve")
    art.ellipse([308, 418, 322, 432], fill=SKIN_M)
    art.line([(378, 352), (356, 394), (346, 424)], fill=SKIN_F, width=13, joint="curve")
    art.ellipse([340, 418, 354, 432], fill=SKIN_F)
    # Outer arms hanging at each parent's side
    art.line([(226, 352), (214, 396), (224, 438)], fill=SKIN_M, width=13, joint="curve")
    art.ellipse([218, 432, 232, 446], fill=SKIN_M)
    art.line([(438, 352), (446, 398), (436, 440)], fill=SKIN_F, width=13, joint="curve")
    art.ellipse([430, 434, 444, 448], fill=SKIN_F)

    return art.finish()


mark = make_mark(124)
mark.save("client/public/images/scheme-sathi-mark.png")
hero = make_hero(660, out=1320)  # 2x for retina crispness
hero.save("client/public/images/scheme-sathi-hero.png")
icon = make_pwa_icon(512)
icon.save("client/public/images/scheme-sathi-pwa-icon.png")
print("saved 3 images")
