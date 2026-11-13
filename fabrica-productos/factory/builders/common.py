from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.fonts import addMapping
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_DIR = Path("/usr/share/fonts/truetype")
_FONTS = {
    "Sans": "dejavu/DejaVuSans.ttf",
    "Sans-Bold": "dejavu/DejaVuSans-Bold.ttf",
    "Serif": "dejavu/DejaVuSerif.ttf",
    "Serif-Bold": "dejavu/DejaVuSerif-Bold.ttf",
}
_registered = False


def register_fonts() -> None:
    """Registra fuentes TrueType con soporte completo de acentos y ñ."""
    global _registered
    if _registered:
        return
    for name, rel in _FONTS.items():
        path = FONT_DIR / rel
        if not path.exists():
            raise FileNotFoundError(f"Falta la fuente {path}. Instala fonts-dejavu.")
        pdfmetrics.registerFont(TTFont(name, str(path)))
    for fam in ("Sans", "Serif"):  # para que <b> e <i> funcionen dentro de los párrafos
        addMapping(fam, 0, 0, fam)
        addMapping(fam, 1, 0, f"{fam}-Bold")
        addMapping(fam, 0, 1, fam)
        addMapping(fam, 1, 1, f"{fam}-Bold")
    _registered = True


def font_path(bold: bool = False, serif: bool = False) -> str:
    key = ("Serif" if serif else "Sans") + ("-Bold" if bold else "")
    return str(FONT_DIR / _FONTS[key])


def palette(product: dict) -> dict:
    p = product.get("brand", {})
    return {
        "primary": HexColor(p.get("primary", "#1F4E5F")),
        "accent": HexColor(p.get("accent", "#E07A2F")),
        "light": HexColor(p.get("light", "#F4EFE6")),
        "text": HexColor(p.get("text", "#222222")),
    }
