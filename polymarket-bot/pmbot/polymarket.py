"""Acceso de solo lectura a Polymarket (Gamma, CLOB y Data API v2) y cálculo de comisiones.

Los mercados "Bitcoin Up or Down" usan slugs deterministas:
    btc-updown-5m-<inicio_epoch>   y   btc-updown-15m-<inicio_epoch>
Resuelven "Up" si la TWAP de BTC/USD de Chainlink durante la ventana es >= al
precio del inicio de la ventana.
"""

import json
import urllib.parse

from .http import HttpError, get_json

GAMMA = "https://gamma-api.polymarket.com"
CLOB = "https://clob.polymarket.com"
DATA = "https://data-api.polymarket.com"

WINDOWS = {"5m": 300, "15m": 900}

# Coeficiente de comisión de taker de los mercados BTC 5m/15m.
# 0.07 hasta el 20-nov-2026 23:59 UTC, 0.05 después (docs.polymarket.com/trading/fees).
FEE_RATE_UNTIL = 1795219140  # 2026-11-20T23:59:00Z
FEE_RATE_OLD = 0.07
FEE_RATE_NEW = 0.05


def fee_rate_at(ts):
    return FEE_RATE_OLD if ts < FEE_RATE_UNTIL else FEE_RATE_NEW


def taker_fee(shares, price, fee_rate):
    """fee = C × feeRate × p × (1 − p), en USDC/pUSD."""
    return shares * fee_rate * price * (1.0 - price)


def slug_for(window, start_ts):
    return f"btc-updown-{window}-{start_ts}"


def window_start(window, ts):
    size = WINDOWS[window]
    return ts - ts % size


def _parse_market(event):
    m = event["markets"][0]
    outcomes = json.loads(m["outcomes"])
    tokens = json.loads(m["clobTokenIds"])
    prices = json.loads(m.get("outcomePrices") or "[]")
    winner = None
    if m.get("closed") and len(prices) == 2:
        if prices[0] in ("1", "1.0"):
            winner = outcomes[0]
        elif prices[1] in ("1", "1.0"):
            winner = outcomes[1]
    sched = m.get("feeSchedule") or {}
    return {
        "slug": event["slug"],
        "question": m.get("question"),
        "condition_id": m["conditionId"],
        "tokens": dict(zip(outcomes, tokens)),
        "closed": bool(m.get("closed")),
        "winner": winner,
        "fee_rate": sched.get("rate"),
        "accepting_orders": m.get("acceptingOrders"),
        "min_order_size": m.get("orderMinSize"),
    }


def get_markets(slugs):
    """Hasta ~20 slugs por petición. Devuelve {slug: market}."""
    out = {}
    for i in range(0, len(slugs), 20):
        chunk = slugs[i:i + 20]
        qs = "&".join("slug=" + urllib.parse.quote(s) for s in chunk)
        for ev in get_json(f"{GAMMA}/events?{qs}"):
            if ev.get("markets"):
                out[ev["slug"]] = _parse_market(ev)
    return out


def get_market(slug):
    return get_markets([slug]).get(slug)


def get_trades(condition_id, max_pages=50):
    """Todas las operaciones (lado taker) de un mercado, ordenadas por tiempo."""
    rows = []
    cursor = None
    for _ in range(max_pages):
        url = f"{DATA}/v2/trades?condition={condition_id}&limit=1000"
        if cursor:
            url += "&cursor=" + urllib.parse.quote(cursor)
        r = get_json(url, timeout=30)
        items = r.get("data") or []
        rows.extend(
            {
                "t": int(x["timestamp"]),
                "side": x["side"],
                "outcome": x["outcome"],
                "price": float(x["price"]),
                "size": float(x["size"]),
            }
            for x in items
        )
        cursor = r.get("next_cursor")
        if not cursor or not items:
            break
    rows.sort(key=lambda x: x["t"])
    return rows


def get_book(token_id):
    try:
        b = get_json(f"{CLOB}/book?token_id={token_id}", timeout=10)
    except HttpError as e:
        if e.status == 404:
            return None
        raise
    bids = sorted(((float(x["price"]), float(x["size"])) for x in b.get("bids", [])), reverse=True)
    asks = sorted((float(x["price"]), float(x["size"])) for x in b.get("asks", []))
    return {"bids": bids, "asks": asks}


def effective_asks(book_side, book_other):
    """Asks efectivos para comprar un resultado.

    El motor de Polymarket cruza una compra de "Up" a p con una compra de "Down"
    a 1-p (acuñando el par), pero /book devuelve cada token por separado. Por eso
    la liquidez real para comprar Up = asks de Up + (1 - bids de Down).
    """
    levels = {}
    for p, s in (book_side or {}).get("asks", []):
        levels[round(p, 4)] = levels.get(round(p, 4), 0.0) + s
    for p, s in (book_other or {}).get("bids", []):
        q = round(1.0 - p, 4)
        levels[q] = levels.get(q, 0.0) + s
    return sorted(levels.items())


def fill_from_book(asks, usd):
    """Simula comprar `usd` de acciones recorriendo los asks. Devuelve (acciones, precio_medio)."""
    shares = 0.0
    spent = 0.0
    for price, size in asks:
        if spent >= usd:
            break
        take = min(size, (usd - spent) / price)
        shares += take
        spent += take * price
    if shares == 0:
        return 0.0, None
    return shares, spent / shares
