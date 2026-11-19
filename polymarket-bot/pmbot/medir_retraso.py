"""Mide cuánto después del match real aparece cada operación en la Data API.

Escucha el websocket público del CLOB (hora exacta del match, en ms), espera a que
la Data API publique esas operaciones y compara los timestamps. Ese retraso es el
motivo de la opción --latency del backtest: una operación con timestamp t+2 en la
Data API pudo ejecutarse ANTES de la señal.

Requiere `pip install websockets` (solo para esta herramienta).

    python -m pmbot.medir_retraso --segundos 180
"""

import argparse
import asyncio
import json
import os
import ssl
import time

from . import polymarket as pm

WS = "wss://ws-subscriptions-clob.polymarket.com/ws/market"


async def capture(market, secs):
    import websockets

    cafile = os.environ.get("SSL_CERT_FILE")
    ctx = ssl.create_default_context(cafile=cafile) if cafile else ssl.create_default_context()
    tok2out = {v: k for k, v in market["tokens"].items()}
    events = []
    async with websockets.connect(WS, ssl=ctx) as ws:
        await ws.send(json.dumps({"assets_ids": list(market["tokens"].values()), "type": "market"}))
        end = time.time() + secs
        while time.time() < end:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
            except asyncio.TimeoutError:
                await ws.send("PING")
                continue
            if raw == "PONG":
                continue
            msgs = json.loads(raw)
            for e in msgs if isinstance(msgs, list) else [msgs]:
                if e.get("event_type") == "last_trade_price":
                    events.append({"ts": int(e["timestamp"]) / 1000, "outcome": tok2out.get(e["asset_id"]),
                                   "price": float(e["price"]), "size": float(e["size"])})
    return events


def match_delays(events, trades):
    used = set()
    delays = []
    for e in events:
        best = None
        for i, x in enumerate(trades):
            if i in used or x["outcome"] != e["outcome"]:
                continue
            if abs(x["price"] - e["price"]) > 1e-9 or abs(x["size"] - e["size"]) > 1e-6:
                continue
            d = x["t"] - e["ts"]
            if -5 < d < 120 and (best is None or abs(d) < abs(best[1])):
                best = (i, d)
        if best:
            used.add(best[0])
            delays.append(best[1])
    return sorted(delays)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--window", choices=list(pm.WINDOWS), default="15m")
    ap.add_argument("--segundos", type=int, default=180)
    ap.add_argument("--espera", type=int, default=90, help="segundos para que la Data API publique las operaciones")
    a = ap.parse_args(argv)

    m = pm.get_market(pm.slug_for(a.window, pm.window_start(a.window, int(time.time()))))
    print(f"Escuchando {m['question']} durante {a.segundos}s…")
    events = asyncio.run(capture(m, a.segundos))
    time.sleep(a.espera)
    delays = match_delays(events, pm.get_trades(m["condition_id"]))
    print(f"operaciones en websocket: {len(events)}   emparejadas con la Data API: {len(delays)}")
    if delays:
        q = lambda p: delays[int(p * (len(delays) - 1))]  # noqa: E731
        print(f"retraso Data API − match (s): min {delays[0]:.1f}  mediana {q(.5):.1f}  p90 {q(.9):.1f}  max {delays[-1]:.1f}")


if __name__ == "__main__":
    main()
