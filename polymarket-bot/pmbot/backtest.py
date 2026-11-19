"""Backtest de la estrategia con datos reales.

- BTC: velas de 1 s de Binance (espejo público data-api.binance.vision).
- Mercados: los "Bitcoin Up or Down" ya resueltos de Polymarket (resultado oficial).
- Precio de entrada: operaciones reales de Polymarket (Data API v2), no un 0.50 supuesto.
  Comprar "Up" a p equivale a: un taker que compró Up a p, o uno que vendió Down a 1-p.
  Modo "next" (por defecto): primer precio negociado DESPUÉS de la señal (incluye latencia).
  Modo "last": último precio ANTES de la señal (optimista: ignora que el libro ya se movió).
- Comisión de taker: C × feeRate × p × (1 − p).

Uso:
    python -m pmbot.backtest --window 15m --days 7
    python -m pmbot.backtest --window 5m --days 3 --fill last
"""

import argparse
import bisect
import csv
import json
import math
import os
import random
import time
from concurrent.futures import ThreadPoolExecutor

from . import btc, polymarket as pm
from .signals import SignalParams, decide

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(HERE, ".cache")


# ---------------------------------------------------------------- descarga + caché

def _cached(path, fn):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    data = fn()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f)
    os.replace(tmp, path)
    return data


def load_btc(start_ts, end_ts, workers):
    """Cierres de 1 s en [start_ts, end_ts), descargados por horas y cacheados."""
    h0 = start_ts - start_ts % 3600
    hours = list(range(h0, end_ts, 3600))
    now = int(time.time())

    def one(h):
        path = os.path.join(CACHE, "btc", f"{h}.json")
        if h + 3600 > now - 5:  # hora incompleta: no cachear
            return btc.klines_1s(h, min(h + 3600, now))
        return _cached(path, lambda: {str(k): v for k, v in btc.klines_1s(h, h + 3600).items()})

    out = {}
    with ThreadPoolExecutor(workers) as ex:
        for part in ex.map(one, hours):
            out.update({int(k): v for k, v in part.items()})
    return out


def load_markets(window, starts, workers):
    size = pm.WINDOWS[window]
    slugs = [pm.slug_for(window, s) for s in starts]
    path = os.path.join(CACHE, "markets", f"{window}-{starts[0]}-{starts[-1]}.json")
    chunks = [slugs[i:i + 20] for i in range(0, len(slugs), 20)]

    def fetch():
        res = {}
        with ThreadPoolExecutor(workers) as ex:
            for part in ex.map(pm.get_markets, chunks):
                res.update(part)
        return res

    markets = _cached(path, fetch)
    out = []
    for s in starts:
        m = markets.get(pm.slug_for(window, s))
        if m and m["closed"] and m["winner"] in ("Up", "Down"):
            m = dict(m, start=s, end=s + size)
            out.append(m)
    return out


def load_trades(markets, workers):
    def one(m):
        path = os.path.join(CACHE, "trades", f"{m['condition_id']}.json")
        return _cached(path, lambda: pm.get_trades(m["condition_id"]))

    with ThreadPoolExecutor(workers) as ex:
        return list(ex.map(one, markets))


# ---------------------------------------------------------------- señales vectorizadas

class Series:
    """Cierres de 1 s contiguos (rellenando huecos) con sumas prefijas de semivarianza."""

    def __init__(self, closes_by_sec):
        self.t0 = min(closes_by_sec)
        t1 = max(closes_by_sec)
        c = []
        last = closes_by_sec[self.t0]
        for s in range(self.t0, t1 + 1):
            last = closes_by_sec.get(s, last)
            c.append(last)
        self.c = c
        up = [0.0]
        dn = [0.0]
        for j in range(1, len(c)):
            r = (c[j] - c[j - 1]) / c[j - 1]
            up.append(up[-1] + (r * r if r > 0 else 0.0))
            dn.append(dn[-1] + (r * r if r < 0 else 0.0))
        self.up = up
        self.dn = dn

    def at(self, t, p):
        """(momentum %, sesgo) con la información disponible en el instante t."""
        k = t - 1 - self.t0  # última vela cerrada antes de t
        if k - max(p.momentum_secs, p.skew_secs) < 1 or k >= len(self.c):
            return None
        c = self.c
        mom = (c[k] - c[k - p.momentum_secs]) / c[k - p.momentum_secs] * 100.0
        u = self.up[k] - self.up[k - p.skew_secs]
        d = self.dn[k] - self.dn[k - p.skew_secs]
        skew = 0.0 if u + d == 0 else (u - d) / (u + d)
        return mom, skew


# ---------------------------------------------------------------- precios de entrada

def ask_quotes(trades, min_size):
    """Para cada resultado, lista ordenada de (t, precio para COMPRARLO)."""
    q = {"Up": [], "Down": []}
    other = {"Up": "Down", "Down": "Up"}
    for x in trades:
        if x["size"] < min_size or x["outcome"] not in q:
            continue
        if x["side"] == "BUY":
            q[x["outcome"]].append((x["t"], x["price"]))
        else:  # alguien vendió el contrario a p => comprar este cuesta ~1-p
            q[other[x["outcome"]]].append((x["t"], round(1.0 - x["price"], 6)))
    for k in q:
        q[k].sort()
    return {k: ([t for t, _ in v], [p for _, p in v]) for k, v in q.items()}


def entry_price(quotes, side, t, mode, max_wait, latency=1):
    times, prices = quotes[side]
    if mode == "next":
        i = bisect.bisect_left(times, t + latency)
        if i < len(times) and times[i] <= t + latency + max_wait:
            return prices[i], times[i]
    else:
        i = bisect.bisect_left(times, t) - 1
        if i >= 0 and times[i] >= t - max_wait:
            return prices[i], times[i]
    return None, None


# ---------------------------------------------------------------- simulación

VARIANTS = ("senal", "solo_momentum", "aleatorio", "contraria")


def simulate(markets, trades_list, series, args, params):
    rng = random.Random(args.seed)
    rows = []
    flip = {"Up": "Down", "Down": "Up"}
    mom_only = SignalParams(params.momentum_secs, params.skew_secs, params.min_momentum_pct, -2.0)

    for m, trades in zip(markets, trades_list):
        quotes = ask_quotes(trades, args.min_trade_size)
        last_entry = {v: -10**9 for v in VARIANTS}
        for t in range(m["start"] + args.start_after, m["end"] - args.stop_before_end):
            sig = series.at(t, params)
            if sig is None:
                continue
            mom, skew = sig
            base = decide(mom, skew, params)
            choices = {
                "senal": base,
                "solo_momentum": decide(mom, skew, mom_only),
                "aleatorio": rng.choice(("Up", "Down")) if base else None,
                "contraria": flip[base] if base else None,
            }
            for v, side in choices.items():
                if side is None or t - last_entry[v] < args.cooldown:
                    continue
                price, fill_t = entry_price(quotes, side, t, args.fill, args.max_wait, args.latency)
                if price is None:
                    continue
                price = min(0.99, price + args.slippage)
                if not (args.min_price <= price <= args.max_price):
                    continue
                last_entry[v] = t
                shares = args.stake / price
                win = side == m["winner"]
                fee_rate = args.fee_rate if args.fee_rate is not None else pm.fee_rate_at(fill_t)
                fee = pm.taker_fee(shares, price, fee_rate)
                fee_new = pm.taker_fee(shares, price, pm.FEE_RATE_NEW)
                gross = (shares if win else 0.0) - args.stake
                rows.append({
                    "variant": v, "slug": m["slug"], "t": t, "secs_in": t - m["start"],
                    "side": side, "winner": m["winner"], "win": int(win),
                    "price": round(price, 4), "fill_delay": fill_t - t,
                    "momentum_pct": round(mom, 5), "skew": round(skew, 4),
                    "stake": args.stake, "gross_pnl": round(gross, 4),
                    "fee": round(fee, 4), "net_pnl": round(gross - fee, 4),
                    "net_pnl_fee005": round(gross - fee_new, 4),
                })
    return rows


def summarize(rows, hours):
    if not rows:
        return None
    n = len(rows)
    by_market = {}
    for r in rows:
        by_market[r["slug"]] = by_market.get(r["slug"], 0.0) + r["net_pnl"]
    per_mkt = list(by_market.values())
    k = len(per_mkt)
    mean_m = sum(per_mkt) / k
    var_m = sum((x - mean_m) ** 2 for x in per_mkt) / (k - 1) if k > 1 else 0.0
    se_total = math.sqrt(var_m * k) if k > 1 else float("nan")  # error estándar del total, agrupado por mercado
    net = sum(r["net_pnl"] for r in rows)
    staked = sum(r["stake"] for r in rows)
    return {
        "operaciones": n,
        "ops_por_hora": round(n / hours, 1) if hours else None,
        "tasa_acierto": round(sum(r["win"] for r in rows) / n, 4),
        "precio_medio_pagado": round(sum(r["price"] for r in rows) / n, 4),
        "pnl_bruto": round(sum(r["gross_pnl"] for r in rows), 2),
        "comisiones": round(sum(r["fee"] for r in rows), 2),
        "pnl_neto": round(net, 2),
        "pnl_neto_con_fee_0.05": round(sum(r["net_pnl_fee005"] for r in rows), 2),
        "pnl_medio_por_op": round(net / n, 3),
        "roi_sobre_apostado": round(net / staked, 4),
        "pnl_neto_IC95": [round(net - 1.96 * se_total, 2), round(net + 1.96 * se_total, 2)],
        "mercados_operados": k,
    }


def buckets(rows, key, edges):
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        sel = [r for r in rows if lo <= r[key] < hi]
        if sel:
            n = len(sel)
            out.append({
                "rango": f"[{lo}, {hi})", "ops": n,
                "acierto": round(sum(r["win"] for r in sel) / n, 3),
                "precio_medio": round(sum(r["price"] for r in sel) / n, 3),
                "pnl_neto": round(sum(r["net_pnl"] for r in sel), 2),
            })
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--window", choices=list(pm.WINDOWS), default="15m")
    ap.add_argument("--days", type=float, default=7)
    ap.add_argument("--end", type=int, default=None, help="epoch fin (por defecto: ahora)")
    ap.add_argument("--stake", type=float, default=100.0, help="USD por operación")
    ap.add_argument("--cooldown", type=int, default=90, help="segundos mínimos entre entradas en el mismo mercado (~38 ops/h con 15m)")
    ap.add_argument("--fill", choices=("next", "last"), default="next")
    ap.add_argument("--max-wait", type=int, default=10, help="segundos de tolerancia para encontrar precio de entrada")
    ap.add_argument("--latency", type=int, default=1, help="segundos entre la señal y el primer precio aceptable (modo next)")
    ap.add_argument("--slippage", type=float, default=0.0, help="se suma al precio de entrada")
    ap.add_argument("--min-price", type=float, default=0.05)
    ap.add_argument("--max-price", type=float, default=0.95)
    ap.add_argument("--min-trade-size", type=float, default=1.0, help="ignora operaciones de menos acciones al estimar precios")
    ap.add_argument("--start-after", type=int, default=0, help="segundos tras abrir la ventana antes de operar")
    ap.add_argument("--stop-before-end", type=int, default=20)
    ap.add_argument("--fee-rate", type=float, default=None, help="fuerza el coeficiente de comisión (por defecto, el vigente en cada fecha)")
    ap.add_argument("--momentum-secs", type=int, default=30)
    ap.add_argument("--skew-secs", type=int, default=300)
    ap.add_argument("--min-momentum", type=float, default=0.0, help="umbral |momentum| en %%")
    ap.add_argument("--min-skew", type=float, default=0.0)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default=os.path.join(HERE, "results"))
    ap.add_argument("--tag", default=None, help="sufijo de los archivos de salida")
    args = ap.parse_args(argv)

    params = SignalParams(args.momentum_secs, args.skew_secs, args.min_momentum, args.min_skew)
    size = pm.WINDOWS[args.window]
    end = args.end or int(time.time())
    last_start = pm.window_start(args.window, end) - size  # última ventana ya cerrada
    first_start = pm.window_start(args.window, int(end - args.days * 86400))
    starts = list(range(first_start, last_start + 1, size))

    t0 = time.time()
    print(f"Mercados {args.window}: {len(starts)} ventanas desde {time.strftime('%Y-%m-%d %H:%M', time.gmtime(first_start))} UTC")
    markets = load_markets(args.window, starts, args.workers)
    print(f"  resueltos y encontrados: {len(markets)}")
    trades = load_trades(markets, args.workers)
    print(f"  operaciones de Polymarket descargadas: {sum(len(t) for t in trades):,}")
    lookback = max(params.momentum_secs, params.skew_secs) + 5
    closes = load_btc(first_start - lookback, last_start + size + 1, args.workers)
    print(f"  segundos de BTC: {len(closes):,}   ({time.time() - t0:.0f}s)")

    series = Series(closes)
    rows = simulate(markets, trades, series, args, params)
    hours = len(markets) * (size - args.start_after - args.stop_before_end) / 3600

    report = {
        "config": vars(args) | {"periodo_utc": [time.strftime('%Y-%m-%d %H:%M', time.gmtime(first_start)),
                                                time.strftime('%Y-%m-%d %H:%M', time.gmtime(last_start + size))],
                                "mercados": len(markets)},
        "resultados": {v: summarize([r for r in rows if r["variant"] == v], hours) for v in VARIANTS},
        "senal_por_precio": buckets([r for r in rows if r["variant"] == "senal"], "price",
                                    [0.0, 0.2, 0.35, 0.45, 0.55, 0.65, 0.8, 1.01]),
        "senal_por_segundo_en_ventana": buckets([r for r in rows if r["variant"] == "senal"], "secs_in",
                                                list(range(0, size + 1, size // 5))),
        "senal_por_momentum_abs": buckets([dict(r, am=abs(r["momentum_pct"])) for r in rows if r["variant"] == "senal"],
                                          "am", [0, 0.005, 0.01, 0.02, 0.05, 10]),
    }

    os.makedirs(args.out, exist_ok=True)
    tag = args.tag or f"{args.window}-{args.days:g}d-{args.fill}"
    with open(os.path.join(args.out, f"backtest-{tag}.json"), "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    if rows:
        with open(os.path.join(args.out, f"trades-{tag}.csv"), "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)

    print()
    print(f"{'variante':<15}{'ops':>7}{'ops/h':>7}{'acierto':>9}{'precio':>8}{'bruto':>11}{'comis.':>10}{'neto':>11}{'ROI':>8}  IC95% neto")
    for v in VARIANTS:
        s = report["resultados"][v]
        if not s:
            print(f"{v:<15}  sin operaciones")
            continue
        print(f"{v:<15}{s['operaciones']:>7}{s['ops_por_hora']:>7}{s['tasa_acierto']:>9.3f}{s['precio_medio_pagado']:>8.3f}"
              f"{s['pnl_bruto']:>11.0f}{s['comisiones']:>10.0f}{s['pnl_neto']:>11.0f}{s['roi_sobre_apostado']:>8.2%}  "
              f"[{s['pnl_neto_IC95'][0]:.0f}, {s['pnl_neto_IC95'][1]:.0f}]")
    print("\nSeñal por precio de entrada:")
    for b in report["senal_por_precio"]:
        print("  ", b)
    print("Señal por momento de la ventana (segundos desde el inicio):")
    for b in report["senal_por_segundo_en_ventana"]:
        print("  ", b)
    print("Señal por |momentum| %:")
    for b in report["senal_por_momentum_abs"]:
        print("  ", b)
    print(f"\nGuardado en {args.out}/backtest-{tag}.json")
    return report


if __name__ == "__main__":
    main()
