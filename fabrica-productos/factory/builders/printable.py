"""Genera imprimibles (planners, formatos, listas) en tamaño carta a partir de JSON.

Tipos de página admitidos:
  text       -> {"type":"text","title":..,"paragraphs":[..]}
  grid       -> tabla vacía para llenar: {"type":"grid","title":..,"columns":[..],"rows":[..] | "row_count":n,
                "col_widths":[..] opcional, "fill": [[..]] contenido prellenado opcional}
  checklist  -> listas por sección con casillas: {"type":"checklist","title":..,"sections":{"Frutas":["",..]} ,
                "blank_lines": n}
  repeat     -> {"type":"repeat","times":n,"page":{...}} repite una página (p. ej. 4 semanas)
"""
from __future__ import annotations

import json
import textwrap
from pathlib import Path

from reportlab.lib.colors import white
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas

from .common import palette, register_fonts

W, H = LETTER
M = 14 * mm


def _header(cv: Canvas, c: dict, title: str, product: dict, page_no: int) -> float:
    cv.setFillColor(c["primary"])
    cv.rect(0, H - 22 * mm, W, 22 * mm, stroke=0, fill=1)
    cv.setFillColor(white)
    cv.setFont("Sans-Bold", 17)
    cv.drawString(M, H - 14 * mm, title)
    label = product.get("short_name", product["title"])[:60]
    if cv.stringWidth(title, "Sans-Bold", 17) + cv.stringWidth(label, "Sans", 8) + 12 * mm < W - 2 * M:
        cv.setFont("Sans", 8)
        cv.drawRightString(W - M, H - 14 * mm, label)
    cv.setFillColor(c["primary"])
    cv.setFont("Sans", 7)
    cv.drawRightString(W - M, 8 * mm, f"{page_no}")
    cv.drawString(M, 8 * mm, "Uso personal. Prohibida su reventa o redistribución.")
    return H - 30 * mm


def _wrap(cv, text, x, y, width_chars, font="Sans", size=8.5, leading=11):
    cv.setFont(font, size)
    for line in textwrap.wrap(text, width_chars) or [""]:
        cv.drawString(x, y, line)
        y -= leading
    return y


def _text(cv, c, page, product, n):
    y = _header(cv, c, page["title"], product, n)
    cv.setFillColor(c["text"])
    for para in page["paragraphs"]:
        if para.startswith("## "):
            y -= 4
            cv.setFillColor(c["primary"])
            y = _wrap(cv, para[3:], M, y, 80, "Sans-Bold", 11.5, 15)
            cv.setFillColor(c["text"])
        else:
            y = _wrap(cv, para, M, y, 105, "Sans", 9.6, 13.4) - 5


def _grid(cv, c, page, product, n):
    y = _header(cv, c, page["title"], product, n)
    if page.get("subtitle"):
        cv.setFillColor(c["text"])
        y = _wrap(cv, page["subtitle"], M, y, 110, "Sans", 8.5, 11) - 4
    cols = page["columns"]
    rows = page.get("rows") or [""] * page.get("row_count", 10)
    widths = page.get("col_widths") or [1] * len(cols)
    total = sum(widths)
    avail = W - 2 * M
    xs = [M]
    for w in widths:
        xs.append(xs[-1] + avail * w / total)
    head_h = 9 * mm
    bottom = 14 * mm
    row_h = min(page.get("max_row_h", 30) * mm, (y - head_h - bottom) / len(rows))
    cv.setFillColor(c["accent"])
    cv.rect(M, y - head_h, avail, head_h, stroke=0, fill=1)
    cv.setFillColor(white)
    cv.setFont("Sans-Bold", 8.5)
    for i, col in enumerate(cols):
        cv.drawCentredString((xs[i] + xs[i + 1]) / 2, y - head_h + 3.2 * mm, col)
    y -= head_h
    fill = page.get("fill", [])
    for r, label in enumerate(rows):
        if r % 2:
            cv.setFillColor(c["light"])
            cv.rect(M, y - row_h, avail, row_h, stroke=0, fill=1)
        cv.setFillColor(c["primary"])
        cv.setFont("Sans-Bold", 8.5)
        if label:
            cv.drawString(xs[0] + 2 * mm, y - 5 * mm, label)
        if r < len(fill):
            cv.setFillColor(c["text"])
            for ci, txt in enumerate(fill[r]):
                if txt:
                    chars = max(8, int((xs[ci + 1] - xs[ci]) / 4.4))
                    _wrap(cv, txt, xs[ci] + 2 * mm, y - 5 * mm - (0 if ci else 4 * mm), chars,
                          "Sans", 7.4, 9.2)
        y -= row_h
    cv.setStrokeColor(c["primary"])
    cv.setLineWidth(0.5)
    top = y + row_h * len(rows) + head_h
    for x in xs:
        cv.line(x, top, x, y)
    for k in range(len(rows) + 1):
        yy = y + row_h * k
        cv.line(M, yy, W - M, yy)
    if page.get("footer_note"):
        cv.setFillColor(c["text"])
        _wrap(cv, page["footer_note"], M, y - 6 * mm, 110, "Sans", 8, 10)


def _checklist(cv, c, page, product, n):
    y0 = _header(cv, c, page["title"], product, n)
    sections = page["sections"]
    blank = page.get("blank_lines", 0)
    col_w = (W - 2 * M - 8 * mm) / 2
    x_cols = [M, M + col_w + 8 * mm]
    col, y = 0, y0
    for name, items in sections.items():
        need = (len(items) + blank) * 6 * mm + 9 * mm
        if y - need < 14 * mm:
            col += 1
            y = y0
            if col > 1:
                cv.showPage()
                y0 = y = _header(cv, c, page["title"] + " (cont.)", product, n)
                col = 0
        x = x_cols[col]
        cv.setFillColor(c["primary"])
        cv.setFont("Sans-Bold", 10)
        cv.drawString(x, y, name.upper())
        cv.setStrokeColor(c["accent"])
        cv.setLineWidth(1.2)
        cv.line(x, y - 1.5 * mm, x + col_w, y - 1.5 * mm)
        y -= 7 * mm
        cv.setLineWidth(0.4)
        cv.setStrokeColor(c["primary"])
        cv.setFillColor(c["text"])
        cv.setFont("Sans", 8.6)
        for item in list(items) + [""] * blank:
            cv.rect(x, y - 0.6 * mm, 3.2 * mm, 3.2 * mm, stroke=1, fill=0)
            if item:
                cv.drawString(x + 5 * mm, y, item)
            cv.line(x + 5 * mm, y - 1.2 * mm, x + col_w, y - 1.2 * mm)
            y -= 6 * mm
        y -= 4 * mm


def _cover(cv, c, page, product, n):
    """Portada: imagen generada por covers.py (si existe) + título, subtítulo y autor."""
    cv.setFillColor(c["primary"])
    cv.rect(0, 0, W, H, stroke=0, fill=1)
    cv.setFillColor(c["accent"])
    cv.rect(0, 0, W, 10 * mm, stroke=0, fill=1)
    cv.setFillColor(white)
    y = H - 70 * mm
    for line in textwrap.wrap(product.get("cover_title", product["title"]), 22):
        cv.setFont("Sans-Bold", 34)
        cv.drawString(M + 6 * mm, y, line)
        y -= 42
    y -= 10
    for line in textwrap.wrap(product.get("subtitle", ""), 58):
        cv.setFont("Sans", 13)
        cv.drawString(M + 6 * mm, y, line)
        y -= 18
    cv.setFont("Sans-Bold", 12)
    cv.drawString(M + 6 * mm, 24 * mm, f"{product.get('author', '')} · Edición {product.get('version', '1.0')}")


RENDER = {"cover": _cover, "text": _text, "grid": _grid, "checklist": _checklist}


def build(product: dict, spec_path: Path, out: Path) -> Path:
    register_fonts()
    c = palette(product)
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    out.parent.mkdir(parents=True, exist_ok=True)
    cv = Canvas(str(out), pagesize=LETTER)
    cv.setTitle(product["title"])
    cv.setAuthor(product.get("author", ""))
    n = 0
    pages = [{"type": "cover", "title": product["title"]}]
    for p in spec["pages"]:
        if p["type"] == "repeat":
            for k in range(p["times"]):
                q = dict(p["page"])
                q["title"] = q["title"].replace("{n}", str(k + 1))
                pages.append(q)
        else:
            pages.append(p)
    for p in pages:
        n += 1
        RENDER[p["type"]](cv, c, p, product, n)
        cv.showPage()
    cv.save()
    return out
