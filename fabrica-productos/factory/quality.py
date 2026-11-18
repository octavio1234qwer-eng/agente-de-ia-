"""Control de calidad: ningún producto se publica sin pasar esta puerta.

Cada verificación devuelve (nombre, estado, detalle) con estado PASS, WARN o FAIL.
Un solo FAIL bloquea la publicación. Además se exige aprobación humana
(products/<slug>/approval.json) después de leer el reporte.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

from . import originality
from .originality import normalize

ROOT = Path(__file__).resolve().parent.parent
# TODO/XXX en mayúsculas (en español "todo" es una palabra normal); el resto sin distinguir mayúsculas.
PLACEHOLDERS = re.compile(r"\b(?:TODO|TBD|XXX|FIXME)\b|(?i:lorem ipsum|\[insertar|\[nombre del)")
RISKY_CLAIMS = re.compile(
    r"(hazte rico|ganancias garantizadas|garantizad[oa]s? (de|que)|100 ?% (seguro|garantizado)|"
    r"sin ningún esfuerzo|ingresos pasivos garantizados|cura |asesoría (fiscal|legal) oficial|"
    r"aprobad[oa] por el SAT|millonario)", re.I)
EXCEL_ERRORS = ("#REF!", "#NAME?", "#VALUE!", "#DIV/0!", "#N/A", "#NUM!", "Err:")

LIMITS = {
    "local_containment_max": 0.08,   # >8 % de frases de 5 palabras compartidas con otro texto => FAIL
    "self_repetition_max": 0.03,
    "ebook_min_words": 4000,
    "ebook_min_pages": 20,
    "fh_readability_min": 50,        # Fernández-Huerta: 50-60 algo difícil, 60-70 normal
    "avg_sentence_words_max": 26,
    "listing_min_chars": 700,
    "listing_max_chars": 5000,
}


def _syllables(word: str) -> int:
    groups = re.findall(r"[aeiouáéíóúü]+", word.lower())
    count = 0
    for g in groups:
        # diptongos cuentan como una sílaba; hiatos con vocales fuertes, dos
        strong = sum(ch in "aeoáéíóú" for ch in g)
        count += max(1, strong)
    return max(1, count)


def readability(text: str) -> dict:
    clean = re.sub(r"[#>*|]", " ", text)
    sentences = [s for s in re.split(r"[.!?:;]\s+|\n{2,}", clean) if len(s.split()) >= 3]
    words = re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+", clean)
    if not words or not sentences:
        return {"words": 0, "fh": 0, "avg_sentence": 0}
    syl = sum(_syllables(w) for w in words)
    p = 100 * syl / len(words)
    f = len(sentences) / len(words) * 100
    return {"words": len(words), "fh": round(206.84 - 0.60 * p - 1.02 * f, 1),
            "avg_sentence": round(len(words) / len(sentences), 1)}


def _repeated_paragraphs(text: str) -> list[str]:
    seen, dup = set(), []
    for para in (p.strip() for p in text.split("\n\n")):
        if len(para) > 80:
            key = " ".join(normalize(para))
            if key in seen:
                dup.append(para[:60])
            seen.add(key)
    return dup


def check_text(product: dict, text: str) -> list[tuple]:
    out = []
    ph = PLACEHOLDERS.findall(text)
    out.append(("Sin marcadores pendientes", "FAIL" if ph else "PASS", ph[:5] or "ok"))
    risky = RISKY_CLAIMS.findall(text)
    out.append(("Sin promesas engañosas", "FAIL" if risky else "PASS",
                [r if isinstance(r, str) else r[0] for r in risky][:5] or "ok"))
    out.append(("Sin caracteres corruptos", "FAIL" if "�" in text else "PASS", "ok"))
    dup = _repeated_paragraphs(text)
    out.append(("Sin párrafos duplicados", "FAIL" if dup else "PASS", dup or "ok"))
    r = readability(text)
    if product["type"] == "ebook":
        out.append(("Extensión del ebook", "PASS" if r["words"] >= LIMITS["ebook_min_words"] else "FAIL",
                    f"{r['words']} palabras (mínimo {LIMITS['ebook_min_words']})"))
        out.append(("Legibilidad Fernández-Huerta",
                    "PASS" if r["fh"] >= LIMITS["fh_readability_min"] else "WARN", r["fh"]))
        out.append(("Longitud media de oración",
                    "PASS" if r["avg_sentence"] <= LIMITS["avg_sentence_words_max"] else "WARN",
                    f"{r['avg_sentence']} palabras"))
    return out


def check_pdf(path: Path, product: dict) -> list[tuple]:
    from pypdf import PdfReader
    try:
        reader = PdfReader(str(path))
    except Exception as e:  # noqa: BLE001
        return [(f"PDF abre ({path.name})", "FAIL", str(e))]
    pages = len(reader.pages)
    first = (reader.pages[0].extract_text() or "") + (reader.pages[min(1, pages - 1)].extract_text() or "")
    title_ok = normalize(product["title"])[:3] == [w for w in normalize(first) if w in normalize(product["title"])][:3]
    blank = sum(1 for p in reader.pages if len((p.extract_text() or "").strip()) < 15)
    min_pages = LIMITS["ebook_min_pages"] if product["type"] == "ebook" else product.get("min_pages", 1)
    res = [
        (f"PDF abre ({path.name})", "PASS", f"{pages} páginas"),
        ("Número de páginas", "PASS" if pages >= min_pages else "FAIL", f"{pages} (mínimo {min_pages})"),
        ("Título visible en el PDF", "PASS" if title_ok else "WARN", "ok" if title_ok else "revisar"),
    ]
    # La portada en imagen no tiene texto: se permite 1 página "en blanco" por eso.
    res.append(("Páginas sin contenido", "PASS" if blank <= 1 else "WARN", f"{blank}"))
    meta = reader.metadata or {}
    res.append(("Metadatos (título/autor)", "PASS" if meta.get("/Title") else "WARN",
                str(meta.get("/Title", "vacío"))))
    return res


def check_xlsx(path: Path, expected: dict | None = None) -> list[tuple]:
    from openpyxl import load_workbook
    wb = load_workbook(path)
    formulas = sum(1 for ws in wb for row in ws.iter_rows() for c in row
                   if isinstance(c.value, str) and c.value.startswith("="))
    res = [("Excel abre", "PASS", f"{len(wb.sheetnames)} hojas: {', '.join(wb.sheetnames)}"),
           ("Contiene fórmulas", "PASS" if formulas >= 20 else "FAIL", f"{formulas} fórmulas")]
    soffice = shutil.which("soffice")
    if not soffice:
        res.append(("Recalculo sin errores", "WARN", "LibreOffice no disponible; no se recalculó"))
        return res
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([soffice, "--headless", "--calc", "--convert-to", "xlsx", "--outdir", tmp, str(path)],
                       capture_output=True, timeout=180)
        recalc = Path(tmp) / path.name
        if not recalc.exists():
            res.append(("Recalculo sin errores", "FAIL", "LibreOffice no pudo abrir el archivo"))
            return res
        wbv = load_workbook(recalc, data_only=True)
        errors = [f"{ws.title}!{c.coordinate}={c.value}" for ws in wbv for row in ws.iter_rows()
                  for c in row if isinstance(c.value, str) and c.value.startswith(EXCEL_ERRORS)]
        res.append(("Recalculo sin errores", "FAIL" if errors else "PASS",
                    errors[:8] or "LibreOffice recalculó todas las fórmulas"))
        for ref, want in (expected or {}).items():
            sheet, cell = ref.split("!")
            got = wbv[sheet][cell].value
            if isinstance(want, str):
                ok = got == want
            else:
                ok = isinstance(got, (int, float)) and abs(got - want) <= max(0.01, abs(want) * 0.005)
            res.append((f"Valor esperado {ref}", "PASS" if ok else "FAIL", f"obtenido {got}, esperado {want}"))
    return res


def check_images(files: dict) -> list[tuple]:
    res = []
    want = {"cover": (1280, 720), "thumbnail": (600, 600), "ebook_cover": (1200, 1800)}
    for key, path in files.items():
        with Image.open(path) as im:
            ok = im.size == want.get(key, im.size)
            res.append((f"Imagen {key}", "PASS" if ok else "FAIL", f"{im.size[0]}x{im.size[1]}"))
    return res


def check_listing(product: dict, listing_md: str) -> list[tuple]:
    n = len(listing_md)
    res = [("Descripción con extensión adecuada",
            "PASS" if LIMITS["listing_min_chars"] <= n <= LIMITS["listing_max_chars"] else "FAIL",
            f"{n} caracteres")]
    for needle, label in (("incluye", "Sección 'qué incluye'"), ("para quién", "Público objetivo"),
                          ("reembolso", "Política de reembolso"), ("formato", "Formato del archivo")):
        res.append((label, "PASS" if needle in listing_md.lower() else "FAIL", "ok"))
    res.append(("Precio definido", "PASS" if product.get("price_cents", 0) > 0 else "FAIL",
                product.get("price_cents")))
    return res


def check_claims(listing_md: str, built: dict) -> list[tuple]:
    """Lo que promete la descripción debe coincidir con los archivos (p. ej. número de páginas)."""
    from pypdf import PdfReader
    pages = {len(PdfReader(f).pages) for f in built.get("files", []) if f.endswith(".pdf")}
    claimed = {int(n) for n in re.findall(r"(\d+) páginas", listing_md)}
    wrong = sorted(claimed - pages)
    return [("Páginas prometidas = páginas reales", "FAIL" if wrong else "PASS",
             f"promete {sorted(claimed)}, PDF tiene {sorted(pages)}" if claimed else "sin cifras de páginas")]


def check_originality(slug: str) -> list[tuple]:
    o = originality.check(slug)
    w = o["max_local_similarity"]
    res = [
        ("Similitud con otros textos (local)",
         "PASS" if w["containment"] <= LIMITS["local_containment_max"] else "FAIL",
         f"máx {w['containment']:.1%} vs {w['source']}"),
        ("Auto-repetición", "PASS" if o["self_repetition"] <= LIMITS["self_repetition_max"] else "FAIL",
         f"{o['self_repetition']:.1%}"),
    ]
    web = o["web_check"]
    if not web:
        res.append(("Verificación web de frases", "FAIL",
                    "Falta originality.json. Busca entre comillas: " + " | ".join(o["fingerprints"][:3])))
    else:
        res.append(("Verificación web de frases", "PASS" if web.get("matches", 1) == 0 else "FAIL",
                    f"{len(web.get('phrases', []))} frases buscadas el {web.get('checked_at')}, "
                    f"{web.get('matches')} coincidencias"))
    return res, o


def run(slug: str, built: dict) -> dict:
    pdir = ROOT / "products" / slug
    product = json.loads((pdir / "product.json").read_text(encoding="utf-8"))
    checks: list[tuple] = []
    text = originality.product_text(pdir)
    checks += check_text(product, text)
    for f in built.get("files", []):
        f = Path(f)
        if f.suffix == ".pdf":
            checks += check_pdf(f, product)
        elif f.suffix == ".xlsx":
            exp = pdir / "expected_values.json"
            checks += check_xlsx(f, json.loads(exp.read_text()) if exp.exists() else None)
    checks += check_images(built.get("images", {}))
    listing = (pdir / "listing.md").read_text(encoding="utf-8") if (pdir / "listing.md").exists() else ""
    checks += check_listing(product, listing)
    checks += check_claims(listing, built)
    orig_checks, orig = check_originality(slug)
    checks += orig_checks
    status = "FAIL" if any(c[1] == "FAIL" for c in checks) else "PASS"
    approval = pdir / "approval.json"
    report = {
        "slug": slug,
        "version": product.get("version"),
        "status": status,
        "human_approved": approval.exists() and json.loads(approval.read_text()).get("approved") is True,
        "checks": [{"check": c[0], "status": c[1], "detail": c[2]} for c in checks],
        "fingerprints": orig["fingerprints"],
    }
    report["publishable"] = report["status"] == "PASS" and report["human_approved"]
    return report


def to_markdown(report: dict) -> str:
    icon = {"PASS": "✅", "WARN": "⚠️", "FAIL": "❌"}
    lines = [f"# Reporte de calidad: {report['slug']} v{report['version']}", "",
             f"**Resultado automático:** {report['status']}  ",
             f"**Aprobación humana:** {'sí' if report['human_approved'] else 'pendiente'}  ",
             f"**Publicable:** {'sí' if report['publishable'] else 'NO'}", "",
             "| Verificación | Estado | Detalle |", "|---|---|---|"]
    for c in report["checks"]:
        lines.append(f"| {c['check']} | {icon[c['status']]} {c['status']} | {c['detail']} |")
    lines += ["", "## Frases para verificar originalidad en la web", ""]
    lines += [f"- \"{p}\"" for p in report["fingerprints"]]
    return "\n".join(lines)
