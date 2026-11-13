"""Convierte un manuscrito en Markdown sencillo a un ebook PDF maquetado.

Sintaxis admitida:
  # Capítulo  (salto de página)      ## Sección      ### Subsección
  párrafos, - viñetas, 1. listas numeradas, > Consejo: recuadro destacado,
  tablas con | col | col |, **negritas**, *cursivas*, y ---pagina--- para salto manual.
"""
from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib.colors import white
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A5
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (KeepTogether, ListFlowable, ListItem, PageBreak, Paragraph,
                                SimpleDocTemplate, Spacer, Table, TableStyle)
from reportlab.platypus.tableofcontents import TableOfContents

from .common import palette, register_fonts


def _inline(text: str) -> str:
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    return text


class _Doc(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and getattr(flowable, "_toc_level", None) is not None:
            self.notify("TOCEntry", (flowable._toc_level, flowable.getPlainText(), self.page))


def build(product: dict, manuscript: Path, out: Path, cover_png: Path | None = None) -> Path:
    register_fonts()
    c = palette(product)
    base = ParagraphStyle("base", fontName="Serif", fontSize=10.2, leading=15, textColor=c["text"],
                          spaceAfter=6)
    st = {
        "h1": ParagraphStyle("h1", parent=base, fontName="Sans-Bold", fontSize=19, leading=24,
                             textColor=c["primary"], spaceBefore=6, spaceAfter=12),
        "h2": ParagraphStyle("h2", parent=base, fontName="Sans-Bold", fontSize=13, leading=17,
                             textColor=c["primary"], spaceBefore=10, spaceAfter=5),
        "h3": ParagraphStyle("h3", parent=base, fontName="Sans-Bold", fontSize=10.5, leading=14,
                             textColor=c["accent"], spaceBefore=6, spaceAfter=3),
        "p": base,
        "tip": ParagraphStyle("tip", parent=base, fontName="Sans", fontSize=9.4, leading=13.5,
                              textColor=c["text"]),
        "cell": ParagraphStyle("cell", parent=base, fontName="Sans", fontSize=8.4, leading=11,
                               spaceAfter=0),
        "cellh": ParagraphStyle("cellh", parent=base, fontName="Sans-Bold", fontSize=8.4,
                                leading=11, textColor=white, spaceAfter=0),
        "title": ParagraphStyle("title", parent=base, fontName="Sans-Bold", fontSize=24,
                                leading=30, alignment=TA_CENTER, textColor=c["primary"]),
        "subtitle": ParagraphStyle("subtitle", parent=base, fontName="Serif", fontSize=12,
                                   leading=17, alignment=TA_CENTER),
    }
    width = A5[0] - 32 * mm
    story: list = []

    if cover_png and cover_png.exists():
        from reportlab.platypus import Image
        story += [Image(str(cover_png), width=A5[0] - 20 * mm, height=(A5[0] - 20 * mm) * 1.5),
                  PageBreak()]
    story += [Spacer(1, 40 * mm), Paragraph(_inline(product["title"]), st["title"]), Spacer(1, 6 * mm),
              Paragraph(_inline(product.get("subtitle", "")), st["subtitle"]), Spacer(1, 30 * mm),
              Paragraph(f"{product.get('author', '')} · Edición {product.get('version', '1.0')}",
                        st["subtitle"]), PageBreak()]
    legal = product.get("legal", "")
    if legal:
        story += [Paragraph("Aviso", st["h2"]), Paragraph(_inline(legal), st["tip"]), PageBreak()]

    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle("toc1", fontName="Sans", fontSize=10, leading=15,
                                      leftIndent=0, textColor=c["text"])]
    story += [Paragraph("Contenido", st["h1"]), toc, PageBreak()]

    lines = manuscript.read_text(encoding="utf-8").splitlines()
    i, first_h1 = 0, True
    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip():
            i += 1
            continue
        if line.strip() == "---pagina---":
            story.append(PageBreak())
        elif line.startswith("# "):
            if not first_h1:
                story.append(PageBreak())
            first_h1 = False
            para = Paragraph(_inline(line[2:]), st["h1"])
            para._toc_level = 0
            story.append(para)
        elif line.startswith("## "):
            story.append(Paragraph(_inline(line[3:]), st["h2"]))
        elif line.startswith("### "):
            story.append(Paragraph(_inline(line[4:]), st["h3"]))
        elif line.startswith("> "):
            block = []
            while i < len(lines) and lines[i].startswith("> "):
                block.append(lines[i][2:])
                i += 1
            t = Table([[Paragraph(_inline(" ".join(block)), st["tip"])]], colWidths=[width])
            t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), c["light"]),
                                   ("LINEBEFORE", (0, 0), (0, -1), 3, c["accent"]),
                                   ("LEFTPADDING", (0, 0), (-1, -1), 8),
                                   ("TOPPADDING", (0, 0), (-1, -1), 6),
                                   ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
            story += [Spacer(1, 3), KeepTogether(t), Spacer(1, 6)]
            continue
        elif line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [x.strip() for x in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", x) for x in cells):
                    rows.append(cells)
                i += 1
            data = [[Paragraph(_inline(x), st["cellh" if r == 0 else "cell"]) for x in row]
                    for r, row in enumerate(rows)]
            t = Table(data, colWidths=[width / len(rows[0])] * len(rows[0]), repeatRows=1)
            t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), c["primary"]),
                                   ("GRID", (0, 0), (-1, -1), 0.4, c["primary"]),
                                   ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, c["light"]]),
                                   ("VALIGN", (0, 0), (-1, -1), "TOP")]))
            story += [Spacer(1, 3), t, Spacer(1, 8)]
            continue
        elif re.match(r"^(- |\d+\. )", line):
            numbered = bool(re.match(r"^\d+\. ", line))
            items = []
            while i < len(lines) and re.match(r"^(- |\d+\. )", lines[i]):
                txt = re.sub(r"^(- |\d+\. )", "", lines[i])
                items.append(ListItem(Paragraph(_inline(txt), st["p"]), leftIndent=12))
                i += 1
            story.append(ListFlowable(items, bulletType="1" if numbered else "bullet",
                                      bulletFontName="Sans", bulletFontSize=8, leftIndent=12,
                                      bulletColor=c["accent"]))
            continue
        else:
            para = [line.strip()]
            while i + 1 < len(lines) and lines[i + 1].strip() and not re.match(
                    r"^(#|>|\||- |\d+\. |---pagina---)", lines[i + 1]):
                i += 1
                para.append(lines[i].strip())
            story.append(Paragraph(_inline(" ".join(para)), st["p"]))
        i += 1

    def _footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Sans", 7.5)
        canvas.setFillColor(c["primary"])
        canvas.drawString(16 * mm, 9 * mm, product["title"][:70])
        canvas.drawRightString(A5[0] - 16 * mm, 9 * mm, str(doc.page))
        canvas.restoreState()

    out.parent.mkdir(parents=True, exist_ok=True)
    doc = _Doc(str(out), pagesize=A5, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=16 * mm,
               bottomMargin=18 * mm, title=product["title"], author=product.get("author", ""),
               subject=product.get("subtitle", ""))
    doc.multiBuild(story, onLaterPages=_footer)
    return out
