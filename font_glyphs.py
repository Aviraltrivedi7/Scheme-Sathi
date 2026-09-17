"""Render text with the app's self-hosted brand fonts in gen-images.py.

The @fontsource woff2 files are the SAME fonts the page ships, so art type
matches page type exactly. woff2 is decompressed once with fontTools+brotli
and re-saved as a plain sfnt buffer, which PIL's FreeType engine renders
with real antialiasing and correct glyph counters (holes) — outline-tracing
pens cannot do either reliably.
"""
import io
import os
from PIL import ImageFont
from fontTools.ttLib import TTFont

_TTF_CACHE: dict[str, bytes] = {}
_FONT_CACHE: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def _ttf_bytes(css_dir: str, woff2: str) -> bytes:
    key = f"{css_dir}/{woff2}"
    if key not in _TTF_CACHE:
        root = os.getcwd()
        while not os.path.isfile(os.path.join(root, "package.json")):
            parent = os.path.dirname(root)
            if parent == root:
                raise FileNotFoundError(f"package.json not found above {root}")
            root = parent
        path = os.path.join(root, "node_modules", "@fontsource", css_dir, "files", woff2)
        if not os.path.isfile(path):
            raise FileNotFoundError(path)
        font = TTFont(path)
        font.flavor = None  # strip woff2 → plain sfnt
        buf = io.BytesIO()
        font.save(buf)
        _TTF_CACHE[key] = buf.getvalue()
    return _TTF_CACHE[key]


def brand_font(css_dir: str, woff2: str, px: int) -> ImageFont.FreeTypeFont:
    key = (css_dir, px)
    if key not in _FONT_CACHE:
        buf = io.BytesIO(_ttf_bytes(css_dir, woff2))
        _FONT_CACHE[key] = ImageFont.truetype(buf, px)
    return _FONT_CACHE[key]


def serif_font(px: int) -> ImageFont.FreeTypeFont:
    """DM Serif Display 400 — the page's display/heading face."""
    return brand_font("dm-serif-display", "dm-serif-display-latin-400-normal.woff2", px)


def sans_font(px: int) -> ImageFont.FreeTypeFont:
    """Plus Jakarta Sans 700 — the page's label/eyebrow face."""
    return brand_font("plus-jakarta-sans", "plus-jakarta-sans-latin-700-normal.woff2", px)
