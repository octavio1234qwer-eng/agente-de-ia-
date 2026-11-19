"""Precio de BTC: velas de 1 s históricas (espejo público de Binance) y precio en vivo."""

from .http import get_json

BINANCE_DATA = "https://data-api.binance.vision"
COINBASE = "https://api.exchange.coinbase.com"


def klines_1s(start_ts, end_ts, symbol="BTCUSDT"):
    """Cierres de 1 s en [start_ts, end_ts). Devuelve {segundo: cierre}.

    La vela con apertura en el segundo s cierra en s+1, así que el precio
    "conocido en el instante t" es el cierre de la vela s = t-1.
    """
    out = {}
    cur = start_ts * 1000
    end = end_ts * 1000
    while cur < end:
        rows = get_json(
            f"{BINANCE_DATA}/api/v3/klines?symbol={symbol}&interval=1s&startTime={cur}&endTime={end - 1}&limit=1000",
            timeout=30,
        )
        if not rows:
            break
        for r in rows:
            out[int(r[0]) // 1000] = float(r[4])
        cur = int(rows[-1][0]) + 1000
    return out


def spot_price():
    """Último precio BTC-USD. Coinbase primero, Binance (espejo) de respaldo."""
    try:
        return float(get_json(f"{COINBASE}/products/BTC-USD/ticker", timeout=5)["price"])
    except Exception:
        return float(get_json(f"{BINANCE_DATA}/api/v3/ticker/price?symbol=BTCUSDT", timeout=5)["price"])
