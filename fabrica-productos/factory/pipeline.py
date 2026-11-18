"""Orquestación: construir -> describir -> revisar -> (aprobar) -> publicar."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from . import covers, listing, pricing, quality
from .builders import ebook, printable, spreadsheet

ROOT = Path(__file__).resolve().parent.parent
PRODUCTS = ROOT / "products"
DIST = ROOT / "dist"


def load(slug: str) -> dict:
    return json.loads((PRODUCTS / slug / "product.json").read_text(encoding="utf-8"))


def save(slug: str, product: dict) -> None:
    (PRODUCTS / slug / "product.json").write_text(
        json.dumps(product, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def slugs() -> list[str]:
    return sorted(p.name for p in PRODUCTS.iterdir() if (p / "product.json").exists())


def build(slug: str) -> dict:
    product = load(slug)
    pdir, out = PRODUCTS / slug, DIST / slug
    out.mkdir(parents=True, exist_ok=True)
    images = covers.render(product, out)
    files = []
    kind = product["type"]
    base = product.get("file_basename", slug)
    if kind == "ebook":
        files.append(ebook.build(product, pdir / "manuscript.md", out / f"{base}.pdf",
                                 images.get("ebook_cover")))
    if kind == "spreadsheet" or (pdir / "spreadsheet.json").exists():
        files.append(spreadsheet.build(product, pdir / "spreadsheet.json", out / f"{base}.xlsx"))
    if kind == "printable" or (pdir / "printable.json").exists():
        files.append(printable.build(product, pdir / "printable.json", out / f"{base}.pdf"))
    listing.write(product, pdir, out)
    built = {"files": [str(f) for f in files], "images": {k: str(v) for k, v in images.items()}}
    (out / "build.json").write_text(json.dumps(built, indent=2), encoding="utf-8")
    return built


def qa(slug: str) -> dict:
    built = json.loads((DIST / slug / "build.json").read_text(encoding="utf-8"))
    report = quality.run(slug, built)
    (DIST / slug / "qa_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2,
                                                           default=str), encoding="utf-8")
    (DIST / slug / "qa_report.md").write_text(quality.to_markdown(report), encoding="utf-8")
    return report


def approve(slug: str, reviewer: str, notes: str = "") -> Path:
    """Registra la aprobación humana. Solo procede si el QA automático está en PASS."""
    report = qa(slug)
    if report["status"] != "PASS":
        raise RuntimeError("El QA automático no está en PASS; corrige los errores antes de aprobar.")
    path = PRODUCTS / slug / "approval.json"
    path.write_text(json.dumps({"approved": True, "reviewer": reviewer, "notes": notes,
                                "version": load(slug).get("version"),
                                "at": datetime.now(timezone.utc).isoformat()},
                               ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def price(slug: str, store_median: float | None = None) -> dict:
    from . import niches
    product = load(slug)
    ref = {n.id: n for n in niches.load()}.get(product.get("niche"))
    pdir = PRODUCTS / slug
    extras = tuple(t for t, f in (("spreadsheet", "spreadsheet.json"), ("printable", "printable.json"))
                   if t != product["type"] and (pdir / f).exists())
    s = pricing.suggest(product["type"], ref.reference_price if ref else None,
                        product.get("value_points", 0), store_median, extras)
    return s


def publish(slug: str, client=None) -> dict:
    """Publica en Gumroad solo si el QA está en PASS y hay aprobación humana de ESTA versión."""
    report = qa(slug)
    product = load(slug)
    approval = PRODUCTS / slug / "approval.json"
    if not report["publishable"]:
        raise PermissionError(f"{slug}: no publicable (QA={report['status']}, "
                              f"aprobado={report['human_approved']}). Ver dist/{slug}/qa_report.md")
    if json.loads(approval.read_text())["version"] != product.get("version"):
        raise PermissionError(f"{slug}: la aprobación es de otra versión; vuelve a revisar y aprobar.")
    gid = product.get("gumroad", {}).get("id")
    if not gid:
        raise RuntimeError(f"{slug}: falta gumroad.id (crea el borrador y sube los archivos primero).")
    from .gumroad import Gumroad
    result = (client or Gumroad()).enable(gid)
    product.setdefault("gumroad", {})["published_at"] = datetime.now(timezone.utc).isoformat()
    save(slug, product)
    return result
