"""Motor de precios.

Parte del precio de referencia del nicho (mediana de la competencia), lo ajusta al
mercado hispano (menor poder adquisitivo que el mercado en inglés), al valor
percibido del formato y al historial propio de ventas, y redondea a precio
psicológico ($X o $X.99 no aplica en Gumroad MX; usamos enteros terminados en 5, 7 o 9).
"""
from __future__ import annotations

FORMAT_FLOOR = {"ebook": 5, "spreadsheet": 7, "printable": 4, "bundle": 12}
FORMAT_CEIL = {"ebook": 19, "spreadsheet": 29, "printable": 12, "bundle": 49}
SPANISH_MARKET_FACTOR = 0.35   # los competidores en inglés/euros cobran ~3x
CHARM = [3, 5, 7, 9, 12, 15, 17, 19, 24, 29, 39, 49]


def charm_round(value: float) -> int:
    return min(CHARM, key=lambda c: (abs(c - value), -c))


def suggest(product_type: str, reference_price: float | None, value_points: int = 0,
            store_median: float | None = None) -> dict:
    """Devuelve el precio sugerido en USD y su justificación.

    value_points: extras objetivos del producto (hojas con fórmulas, páginas, bonos), 0-5.
    store_median: mediana de precios de la tienda propia, para coherencia del catálogo.
    """
    floor, ceil = FORMAT_FLOOR[product_type], FORMAT_CEIL[product_type]
    base = (reference_price or floor * 1.5) * SPANISH_MARKET_FACTOR
    base *= 1 + 0.08 * max(0, min(5, value_points))
    if store_median:
        base = 0.6 * base + 0.4 * store_median  # no desentonar con el resto del catálogo
    price = charm_round(max(floor, min(ceil, base)))
    return {
        "price_usd": price,
        "price_cents": price * 100,
        "rationale": (
            f"Referencia ${reference_price or 0:.2f} × factor mercado hispano {SPANISH_MARKET_FACTOR} "
            f"× valor +{value_points * 8}%"
            + (f", mezclado con mediana de la tienda ${store_median:.2f}" if store_median else "")
            + f", acotado a [{floor}, {ceil}] y redondeado a precio psicológico."
        ),
    }


def bundle_price(prices: list[int], discount: float = 0.3) -> int:
    return charm_round(sum(prices) * (1 - discount))
