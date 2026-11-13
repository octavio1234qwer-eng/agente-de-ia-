"""Descripciones y páginas de venta.

- listing.md (escrito por la fábrica a partir de product.json -> "listing") es la fuente única.
- description.html: versión HTML para Gumroad (Gumroad acepta HTML básico).
- sales_page.html: página de venta independiente (landing) con botón de compra que
  abre el checkout de Gumroad (overlay oficial gumroad.js), lista para subir a cualquier hosting.
"""
from __future__ import annotations

import html
import re
from pathlib import Path

from jinja2 import Template


def render_listing_md(product: dict) -> str:
    L = product["listing"]
    parts = [L["hook"], "", L["problem"], ""]
    parts += ["## Qué incluye", ""] + [f"- {x}" for x in L["includes"]] + [""]
    parts += ["## Para quién es", ""] + [f"- {x}" for x in L["for_who"]] + [""]
    if L.get("not_for"):
        parts += ["## Para quién NO es", ""] + [f"- {x}" for x in L["not_for"]] + [""]
    parts += ["## Cómo funciona", ""] + [f"{i}. {x}" for i, x in enumerate(L["how"], 1)] + [""]
    if L.get("faq"):
        parts += ["## Preguntas frecuentes", ""]
        for q, a in L["faq"]:
            parts += [f"**{q}**", a, ""]
    parts += ["## Formato y entrega", "", L["format"], "",
              "## Garantía y reembolso", "", L.get("refund",
              "Si el archivo no abre o no es lo que describe esta página, escríbenos dentro de los "
              "30 días posteriores a la compra y te damos el reembolso completo.")]
    return "\n".join(parts).strip() + "\n"


def md_to_html(md: str) -> str:
    out, in_ul, in_ol = [], False, False

    def close():
        nonlocal in_ul, in_ol
        if in_ul:
            out.append("</ul>")
        if in_ol:
            out.append("</ol>")
        in_ul = in_ol = False

    for line in md.splitlines():
        esc = html.escape(line)
        esc = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", esc)
        if line.startswith("## "):
            close()
            out.append(f"<h3>{esc[3:]}</h3>")
        elif line.startswith("- "):
            if not in_ul:
                close()
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{esc[2:]}</li>")
        elif re.match(r"^\d+\. ", line):
            if not in_ol:
                close()
                out.append("<ol>")
                in_ol = True
            out.append(f"<li>{re.sub(r'^\d+\. ', '', esc)}</li>")
        elif line.strip():
            close()
            out.append(f"<p>{esc}</p>")
        else:
            close()
    close()
    return "\n".join(out)


SALES_PAGE = Template("""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ p.title }}</title>
<meta name="description" content="{{ p.listing.hook }}">
<meta property="og:title" content="{{ p.title }}">
<meta property="og:description" content="{{ p.listing.hook }}">
<meta property="og:image" content="cover.png">
<style>
  :root { --p: {{ p.brand.primary }}; --a: {{ p.brand.accent }}; --l: {{ p.brand.light }}; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 17px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; color: #222; background: #fff; }
  header { background: var(--p); color: #fff; padding: 56px 20px 40px; }
  .wrap { max-width: 760px; margin: 0 auto; }
  h1 { font-size: clamp(28px, 5vw, 42px); line-height: 1.15; margin: 0 0 12px; }
  header p { font-size: 19px; opacity: .92; margin: 0 0 24px; }
  .cta { display: inline-block; background: var(--a); color: #fff; padding: 15px 28px; border-radius: 10px;
         font-weight: 700; text-decoration: none; font-size: 18px; }
  .cta small { display: block; font-weight: 400; font-size: 13px; opacity: .9; }
  main { padding: 24px 20px 64px; }
  img.cover { width: 100%; border-radius: 12px; margin: -10px 0 16px; box-shadow: 0 8px 30px rgba(0,0,0,.15); }
  h3 { color: var(--p); font-size: 22px; margin: 36px 0 8px; }
  li { margin: 6px 0; }
  .box { background: var(--l); border-left: 4px solid var(--a); padding: 16px 20px; border-radius: 8px; margin: 28px 0; }
  footer { text-align: center; color: #666; font-size: 14px; padding: 24px; border-top: 1px solid #eee; }
</style>
</head>
<body>
<header><div class="wrap">
  <h1>{{ p.title }}</h1>
  <p>{{ p.listing.hook }}</p>
  <a class="cta gumroad-button" href="{{ checkout_url }}" data-gumroad-overlay-checkout="true">
    Comprar por ${{ price }} USD<small>Descarga inmediata · Pago seguro con Gumroad</small></a>
</div></header>
<main><div class="wrap">
  <img class="cover" src="cover.png" alt="Portada de {{ p.title }}">
  {{ body }}
  <div class="box"><strong>Entrega automática:</strong> al completar el pago, Gumroad te envía los archivos por correo y
  quedan disponibles en tu biblioteca para descargarlos cuando quieras.</div>
  <p style="text-align:center"><a class="cta gumroad-button" href="{{ checkout_url }}" data-gumroad-overlay-checkout="true">
    Lo quiero por ${{ price }} USD</a></p>
</div></main>
<footer>{{ p.author }} · {{ year }}</footer>
<script src="https://gumroad.com/js/gumroad.js"></script>
</body>
</html>
""")


def write(product: dict, pdir: Path, dist: Path, checkout_url: str | None = None) -> dict:
    md = render_listing_md(product)
    (pdir / "listing.md").write_text(md, encoding="utf-8")
    body = md_to_html(md)
    dist.mkdir(parents=True, exist_ok=True)
    (dist / "description.html").write_text(body, encoding="utf-8")
    url = checkout_url or product.get("gumroad", {}).get("url") or "#"
    page = SALES_PAGE.render(p=product, body=body, checkout_url=url,
                             price=product["price_cents"] // 100, year=2026)
    (dist / "sales_page.html").write_text(page, encoding="utf-8")
    return {"listing_md": pdir / "listing.md", "description_html": dist / "description.html",
            "sales_page": dist / "sales_page.html"}
