"""Verificación de originalidad.

1. Similitud local: compara el texto del producto (shingles de 5 palabras, Jaccard y
   'containment') contra un corpus de referencia: el resto de productos de la fábrica y
   los textos de data/corpus/*.txt (descripciones de competidores, textos de referencia).
2. Huellas para verificación web: extrae frases distintivas que deben buscarse entre
   comillas en un buscador. El resultado de esa búsqueda se registra en
   products/<slug>/originality.json ({"checked_at":..,"phrases":[..],"matches":0,"checked_by":..}).
   El control de calidad bloquea la publicación si esa verificación no existe o tiene coincidencias.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STOP = set("""de la que el en y a los se del las un por con no una su para es al lo como más o pero sus le ya
este si porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos
uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa
estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros tu te tus""".split())


def normalize(text: str) -> list[str]:
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.findall(r"[a-zñ0-9]+", text)


def shingles(words: list[str], k: int = 5) -> set[tuple[str, ...]]:
    return {tuple(words[i:i + k]) for i in range(len(words) - k + 1)}


def similarity(a: str, b: str, k: int = 5) -> dict:
    sa, sb = shingles(normalize(a), k), shingles(normalize(b), k)
    if not sa or not sb:
        return {"jaccard": 0.0, "containment": 0.0}
    inter = len(sa & sb)
    return {"jaccard": inter / len(sa | sb), "containment": inter / len(sa)}


def corpus(exclude_slug: str) -> dict[str, str]:
    docs: dict[str, str] = {}
    for d in (ROOT / "data" / "corpus").glob("*.txt"):
        docs[f"corpus/{d.name}"] = d.read_text(encoding="utf-8")
    for pdir in (ROOT / "products").iterdir():
        if pdir.is_dir() and pdir.name != exclude_slug:
            docs[f"producto/{pdir.name}"] = product_text(pdir)
    return docs


def product_text(pdir: Path) -> str:
    """Todo el texto original de un producto: manuscrito, especificaciones y descripción."""
    parts = []
    for name in ("manuscript.md", "listing.md"):
        if (pdir / name).exists():
            parts.append((pdir / name).read_text(encoding="utf-8"))
    for name in ("spreadsheet.json", "printable.json"):
        if (pdir / name).exists():
            parts.append(" ".join(_strings(json.loads((pdir / name).read_text(encoding="utf-8")))))
    return "\n".join(parts)


def _strings(obj) -> list[str]:
    if isinstance(obj, str):
        if obj.startswith("=") or "!$" in obj or len(obj.split()) < 3:
            return []  # fórmulas, referencias y etiquetas sueltas no son prosa
        return [obj]
    if isinstance(obj, dict):
        # "sample" = filas de datos de ejemplo de una hoja: se repiten a propósito, no son prosa
        return [s for k, v in obj.items() if k != "sample" for s in _strings(v)]
    if isinstance(obj, list):
        return [s for v in obj for s in _strings(v)]
    return []


def self_repetition(text: str, k: int = 8) -> float:
    """Proporción de shingles de 8 palabras repetidos dentro del mismo texto (relleno, copia-pega)."""
    words = normalize(text)
    seq = [tuple(words[i:i + k]) for i in range(len(words) - k + 1)]
    if not seq:
        return 0.0
    return 1 - len(set(seq)) / len(seq)


def fingerprint_phrases(text: str, n: int = 6) -> list[str]:
    """Frases distintivas (8-14 palabras, pocas palabras vacías) para buscar entre comillas en la web."""
    sentences = re.split(r"(?<=[.!?])\s+", re.sub(r"[#>*|\-]", " ", text))
    scored = []
    for s in sentences:
        words = s.split()
        if 10 <= len(words) <= 30:
            content = [w for w in normalize(s) if w not in STOP]
            scored.append((len(content) / max(1, len(words)), " ".join(words[:12])))
    scored.sort(reverse=True)
    step = max(1, len(scored) // n)
    return [p for _, p in scored[::step][:n]]


def check(slug: str) -> dict:
    pdir = ROOT / "products" / slug
    text = product_text(pdir)
    worst = {"source": None, "jaccard": 0.0, "containment": 0.0}
    for name, doc in corpus(slug).items():
        sim = similarity(text, doc)
        if sim["containment"] > worst["containment"]:
            worst = {"source": name, **sim}
    web_file = pdir / "originality.json"
    web = json.loads(web_file.read_text(encoding="utf-8")) if web_file.exists() else None
    return {
        "max_local_similarity": worst,
        "self_repetition": round(self_repetition(text), 4),
        "fingerprints": fingerprint_phrases(text),
        "web_check": web,
    }
