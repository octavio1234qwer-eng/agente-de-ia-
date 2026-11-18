"""Sistema de mejora continua.

Lee las métricas y las opiniones de cada producto, aplica reglas de diagnóstico y genera
una lista priorizada de mejoras (products/<slug>/improvements.md). Las mejoras se aplican
editando la fuente del producto, subiendo la versión y volviendo a pasar por QA:
ninguna versión nueva se publica sin un PASS del control de calidad.
"""
from __future__ import annotations

import json
from collections import Counter
from datetime import date
from pathlib import Path

from .originality import normalize

ROOT = Path(__file__).resolve().parent.parent

THEMES = {
    "precio": ["caro", "precio", "costoso", "barato"],
    "errores": ["error", "no funciona", "#ref", "#div", "fórmula", "formula", "falla", "no abre"],
    "claridad": ["confuso", "no entiendo", "difícil", "dificil", "instrucciones", "explicar"],
    "contenido": ["corto", "poco", "faltó", "falto", "más ejemplos", "mas ejemplos", "superficial"],
    "formato": ["google sheets", "numbers", "mac", "imprimir", "tamaño", "a4", "celular"],
}


def comment_themes(comments: list[str]) -> Counter:
    c = Counter()
    for text in comments:
        t = " ".join(normalize(text)) + " " + text.lower()
        for theme, words in THEMES.items():
            if any(w in t for w in words):
                c[theme] += 1
    return c


def diagnose(p: dict, store_avg_conversion: float | None = None) -> list[dict]:
    """Devuelve recomendaciones [{prioridad, área, hallazgo, acción}] para un producto."""
    recs = []
    views, units, conv = p.get("views", 0), p.get("units", 0), p.get("conversion")
    themes = comment_themes(p.get("comments", []))

    if views >= 100 and units == 0:
        recs.append({"prioridad": 1, "área": "página de venta",
                     "hallazgo": f"{views} visitas y ninguna venta.",
                     "acción": "Reescribir el gancho y la portada; probar la variante B del título 14 días."})
    elif conv is not None and views >= 200 and conv < 0.01:
        recs.append({"prioridad": 2, "área": "conversión",
                     "hallazgo": f"Conversión de {conv:.1%} (meta ≥ 2 %).",
                     "acción": "Agregar capturas del interior, preguntas frecuentes y una muestra gratuita."})
    if conv is not None and store_avg_conversion and conv > 2 * store_avg_conversion and views >= 100:
        recs.append({"prioridad": 3, "área": "precio",
                     "hallazgo": f"Convierte {conv:.1%}, el doble del promedio de la tienda.",
                     "acción": "Probar un precio un escalón más alto durante 30 días y comparar ingresos por visita."})
    if p.get("units", 0) >= 5 and p.get("refund_rate", 0) > 0.08:
        recs.append({"prioridad": 1, "área": "calidad",
                     "hallazgo": f"Reembolsos de {p['refund_rate']:.0%} (máximo aceptable 8 %).",
                     "acción": "Revisar si la descripción promete algo que el archivo no cumple; contactar a quienes pidieron reembolso."})
    if p.get("avg_rating") is not None and p["avg_rating"] < 4.0:
        recs.append({"prioridad": 1, "área": "calidad",
                     "hallazgo": f"Calificación promedio {p['avg_rating']:.1f}★.",
                     "acción": "Leer cada comentario de 1-3★ y corregir la causa principal antes de invertir en promoción."})
    if themes["errores"]:
        recs.append({"prioridad": 1, "área": "errores",
                     "hallazgo": f"{themes['errores']} comentario(s) reportan errores.",
                     "acción": "Reproducir el error, corregir, agregar un valor esperado al QA para que no vuelva."})
    if themes["claridad"]:
        recs.append({"prioridad": 2, "área": "instrucciones",
                     "hallazgo": f"{themes['claridad']} comentario(s) piden instrucciones más claras.",
                     "acción": "Ampliar la hoja/página de instrucciones con un ejemplo paso a paso."})
    if themes["contenido"]:
        recs.append({"prioridad": 2, "área": "contenido",
                     "hallazgo": f"{themes['contenido']} comentario(s) piden más contenido.",
                     "acción": "Agregar un capítulo/plantilla extra y avisar a compradores anteriores (actualización gratuita)."})
    if themes["formato"]:
        recs.append({"prioridad": 3, "área": "formato",
                     "hallazgo": f"{themes['formato']} comentario(s) mencionan otro formato o dispositivo.",
                     "acción": "Probar el archivo en Google Sheets / impresión A4 y ofrecer la variante."})
    if themes["precio"] and units >= 3:
        recs.append({"prioridad": 3, "área": "precio",
                     "hallazgo": "Comentarios sobre el precio.",
                     "acción": "Crear un paquete con otro producto en vez de bajar el precio."})
    if units >= 10 and not recs:
        recs.append({"prioridad": 3, "área": "crecimiento",
                     "hallazgo": "Vende de forma estable sin quejas.",
                     "acción": "Crear producto complementario del mismo nicho y ofrecerlo en un paquete."})
    return sorted(recs, key=lambda r: r["prioridad"])


def bump_version(version: str, major: bool = False) -> str:
    a, b = (version.split(".") + ["0"])[:2]
    return f"{int(a) + 1}.0" if major else f"{a}.{int(b) + 1}"


def write_backlog(slug: str, recs: list[dict]) -> Path:
    path = ROOT / "products" / slug / "improvements.md"
    lines = [f"# Mejoras propuestas: {slug}", "", f"Actualizado: {date.today().isoformat()}", ""]
    if not recs:
        lines.append("Sin datos suficientes o sin problemas detectados.")
    for r in recs:
        lines.append(f"- [ ] **P{r['prioridad']} · {r['área']}**: {r['hallazgo']} → {r['acción']}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def run(metrics: dict) -> dict[str, list[dict]]:
    convs = [p["conversion"] for p in metrics["products"].values() if p.get("conversion")]
    avg = sum(convs) / len(convs) if convs else None
    by_gumroad_id = {}
    for pdir in (ROOT / "products").iterdir():
        pj = pdir / "product.json"
        if pj.exists():
            gid = json.loads(pj.read_text(encoding="utf-8")).get("gumroad", {}).get("id")
            if gid:
                by_gumroad_id[gid] = pdir.name
    result = {}
    for pid, p in metrics["products"].items():
        recs = diagnose(p, avg)
        slug = by_gumroad_id.get(pid)
        if slug:
            write_backlog(slug, recs)
        result[slug or pid] = recs
    return result
