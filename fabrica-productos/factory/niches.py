"""Investigación y puntuación de nichos.

Cada nicho se califica de 0 a 100 combinando:
  - demanda (1-5): interés de búsqueda/compra observado
  - dolor (1-5): qué tan caro le sale al cliente no resolverlo
  - facilidad (1-5): qué tan rápido podemos producir algo excelente
  - competencia: menos competidores en español => más puntos
  - margen de precio: mediana de precios de la competencia
  - traslape con el catálogo propio: penaliza canibalizar productos existentes
"""
from __future__ import annotations

import json
import statistics
from dataclasses import dataclass, field
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "niches.json"


@dataclass
class Niche:
    id: str
    name: str
    audience: str
    competitors_es: int
    competitor_prices_usd: list[float]
    competitor_prices_en_usd: list[float]
    demand: int
    pain: int
    ease: int
    own_catalog_overlap: str = ""
    notes: str = ""
    query: str = ""
    score: float = 0.0
    breakdown: dict = field(default_factory=dict)

    @property
    def reference_price(self) -> float | None:
        prices = [p for p in self.competitor_prices_usd + self.competitor_prices_en_usd if p > 0]
        return statistics.median(prices) if prices else None


def _competition_points(n: int) -> float:
    # 0 competidores = 20 pts; 5 o más = 0
    return max(0.0, 20.0 - 4.0 * n)


def _price_points(ref: float | None) -> float:
    if ref is None:
        return 5.0
    return min(15.0, ref / 2.0)  # $30+ de referencia => 15 pts


def _overlap_penalty(text: str) -> float:
    t = text.lower()
    if not t or "sin traslape" in t:
        return 0.0
    if "parcial" in t:
        return 8.0
    if "otro público" in t or "no " in t:
        return 3.0
    return 12.0


def score(n: Niche) -> Niche:
    parts = {
        "demanda": n.demand * 5.0,          # máx 25
        "dolor": n.pain * 4.0,              # máx 20
        "facilidad": n.ease * 4.0,          # máx 20
        "competencia": _competition_points(n.competitors_es),  # máx 20
        "precio": _price_points(n.reference_price),            # máx 15
        "traslape": -_overlap_penalty(n.own_catalog_overlap),
    }
    n.breakdown = parts
    n.score = round(max(0.0, min(100.0, sum(parts.values()))), 1)
    return n


def load(path: Path = DATA) -> list[Niche]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    fields = Niche.__dataclass_fields__.keys()
    return [score(Niche(**{k: v for k, v in item.items() if k in fields})) for item in raw["niches"]]


def ranking(path: Path = DATA) -> list[Niche]:
    return sorted(load(path), key=lambda n: n.score, reverse=True)


def report(path: Path = DATA) -> str:
    lines = ["# Ranking de nichos", "", "| # | Nicho | Puntos | Competidores ES | Precio ref. |", "|---|---|---|---|---|"]
    for i, n in enumerate(ranking(path), 1):
        ref = f"${n.reference_price:.2f}" if n.reference_price else "—"
        lines.append(f"| {i} | {n.name} | {n.score} | {n.competitors_es} | {ref} |")
    return "\n".join(lines)
