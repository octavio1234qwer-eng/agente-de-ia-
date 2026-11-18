"""Portadas y miniaturas generadas con Pillow (sin imágenes de terceros: cero riesgo de derechos).

Genera:
  cover.png      1280x720  (portada de la página de Gumroad)
  thumbnail.png  600x600   (miniatura cuadrada para Discover)
  ebook_cover.png 1200x1800 (portada vertical para el PDF, solo ebooks)
"""
from __future__ import annotations

import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .builders.common import font_path


def _hex(c: str) -> tuple[int, int, int]:
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def _font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(font_path(bold=bold), size)


def _fit(draw, text, max_w, max_lines, start, min_size=20, bold=True):
    size = start
    while size >= min_size:
        f = _font(size, bold)
        avg = f.getlength("abcdefghijklmnopqrstuvwxyz") / 26
        lines = textwrap.wrap(text, max(6, int(max_w / avg)), break_long_words=False,
                              break_on_hyphens=False)
        if len(lines) <= max_lines and all(draw.textlength(l, font=f) <= max_w for l in lines):
            return f, lines
        size -= 2
    f = _font(min_size, bold)
    return f, textwrap.wrap(text, int(max_w / (f.getlength("a") or 10)),
                            break_long_words=False)[:max_lines]


def _motif(draw, w, h, accent, light, kind):
    """Elemento gráfico abstracto según el tipo de producto."""
    if kind == "spreadsheet":
        x0, y0, cw, ch = int(w * 0.62), int(h * 0.18), int(w * 0.055), int(h * 0.07)
        for r in range(8):
            for col in range(5):
                fill = accent if (r == 0) else (light if (r + col) % 2 else None)
                draw.rectangle([x0 + col * cw, y0 + r * ch, x0 + (col + 1) * cw, y0 + (r + 1) * ch],
                               outline=light, width=2, fill=fill)
    elif kind == "printable":
        x0, y0 = int(w * 0.64), int(h * 0.16)
        for k in range(7):
            yy = y0 + k * int(h * 0.09)
            draw.rounded_rectangle([x0, yy, x0 + int(w * 0.04), yy + int(w * 0.04)], 6,
                                   outline=light, width=3)
            draw.line([x0 + int(w * 0.06), yy + int(w * 0.03), int(w * 0.93), yy + int(w * 0.03)],
                      fill=light, width=3)
            if k < 3:
                draw.line([x0 + 8, yy + int(w * 0.022), x0 + int(w * 0.017), yy + int(w * 0.033),
                           x0 + int(w * 0.034), yy + 6], fill=accent, width=6)
    else:  # ebook: barras ascendentes
        portrait = h > w
        base = int(h * (0.88 if portrait else 0.82))
        for k in range(6):
            bh = int(h * ((0.04 + 0.035 * k) if portrait else (0.12 + 0.09 * k)))
            x = int(w * 0.62) + k * int(w * 0.055)
            draw.rectangle([x, base - bh, x + int(w * 0.04), base], fill=accent if k == 5 else light)


def render(product: dict, out_dir: Path) -> dict[str, Path]:
    b = product.get("brand", {})
    primary, accent = _hex(b.get("primary", "#1F4E5F")), _hex(b.get("accent", "#E07A2F"))
    light = _hex(b.get("light", "#F4EFE6"))
    kind = product["type"]
    out_dir.mkdir(parents=True, exist_ok=True)
    results = {}

    def landscape(w, h, name):
        img = Image.new("RGB", (w, h), primary)
        d = ImageDraw.Draw(img)
        _motif(d, w, h, accent, light, kind)
        d.rectangle([0, h - 14, w, h], fill=accent)
        pad = int(w * 0.06)
        tag_f = _font(int(h * 0.04))
        tag = product.get("cover_tag", kind.upper())
        tw = d.textlength(tag, font=tag_f)
        d.rounded_rectangle([pad, int(h * 0.1), pad + tw + 30, int(h * 0.1) + int(h * 0.07)], 10,
                            fill=accent)
        d.text((pad + 15, int(h * 0.1) + int(h * 0.012)), tag, font=tag_f, fill=(255, 255, 255))
        f, lines = _fit(d, product.get("cover_title", product["title"]), int(w * 0.52), 4,
                        int(h * 0.1))
        y = int(h * 0.24)
        for line in lines:
            d.text((pad, y), line, font=f, fill=(255, 255, 255))
            y += int(f.size * 1.15)
        sf, slines = _fit(d, product.get("cover_subtitle", product.get("subtitle", "")),
                          int(w * 0.52), 3, int(h * 0.045), bold=False)
        y += int(h * 0.03)
        for line in slines:
            d.text((pad, y), line, font=sf, fill=light)
            y += int(sf.size * 1.3)
        p = out_dir / name
        img.save(p, optimize=True)
        return p

    results["cover"] = landscape(1280, 720, "cover.png")

    # Miniatura cuadrada
    img = Image.new("RGB", (600, 600), primary)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 520, 600, 600], fill=accent)
    f, lines = _fit(d, product.get("cover_title", product["title"]), 520, 5, 64)
    y = 60
    for line in lines:
        d.text((40, y), line, font=f, fill=(255, 255, 255))
        y += int(f.size * 1.15)
    tf = _font(30)
    d.text((40, 538), product.get("cover_tag", kind.upper()), font=tf, fill=(255, 255, 255))
    results["thumbnail"] = out_dir / "thumbnail.png"
    img.save(results["thumbnail"], optimize=True)

    if kind == "ebook":
        img = Image.new("RGB", (1200, 1800), primary)
        d = ImageDraw.Draw(img)
        _motif(d, 1200, 1800, accent, light, kind)
        d.rectangle([0, 0, 1200, 24], fill=accent)
        f, lines = _fit(d, product.get("cover_title", product["title"]), 1040, 5, 120)
        y = 220
        for line in lines:
            d.text((80, y), line, font=f, fill=(255, 255, 255))
            y += int(f.size * 1.12)
        sf, slines = _fit(d, product.get("subtitle", ""), 1040, 4, 50, bold=False)
        y += 40
        for line in slines:
            d.text((80, y), line, font=sf, fill=light)
            y += int(sf.size * 1.3)
        d.text((80, 1680), product.get("author", ""), font=_font(44), fill=(255, 255, 255))
        results["ebook_cover"] = out_dir / "ebook_cover.png"
        img.save(results["ebook_cover"], optimize=True)
    return results
