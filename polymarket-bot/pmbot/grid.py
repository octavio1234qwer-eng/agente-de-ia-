"""Barrido de umbrales (momentum mínimo × sesgo mínimo) sobre datos ya cacheados.

Sirve para ver si un buen resultado es una zona estable o un pico de suerte.

    python -m pmbot.grid --window 15m --days 14 --end <epoch> --latency 1
"""

import argparse
import time

from . import polymarket as pm
from .backtest import Series, load_btc, load_markets, load_trades, simulate, summarize
from .signals import SignalParams


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--window", choices=list(pm.WINDOWS), default="15m")
    ap.add_argument("--days", type=float, default=14)
    ap.add_argument("--end", type=int, default=None)
    ap.add_argument("--latency", type=int, default=1)
    ap.add_argument("--fill", choices=("next", "last"), default="next")
    ap.add_argument("--moms", default="0,0.01,0.02,0.03,0.05")
    ap.add_argument("--skews", default="0,0.2,0.3,0.5")
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args(argv)

    size = pm.WINDOWS[a.window]
    end = a.end or int(time.time())
    last_start = pm.window_start(a.window, end) - size
    first_start = pm.window_start(a.window, int(end - a.days * 86400))
    starts = list(range(first_start, last_start + 1, size))
    markets = load_markets(a.window, starts, a.workers)
    trades = load_trades(markets, a.workers)
    series = Series(load_btc(first_start - 400, last_start + size + 1, a.workers))
    hours = len(markets) * (size - 20) / 3600

    sim_args = argparse.Namespace(
        seed=7, min_trade_size=1.0, start_after=0, stop_before_end=20, cooldown=90, fill=a.fill,
        max_wait=10, latency=a.latency, slippage=0.0, min_price=0.05, max_price=0.95, stake=100.0, fee_rate=None,
    )
    print(f"{len(markets)} mercados {a.window}, latencia {a.latency}s, fill {a.fill}")
    print(f"{'mom_min':>8}{'sesgo_min':>10}{'ops':>7}{'acierto':>9}{'precio':>8}{'neto':>10}{'ROI':>8}   IC95% neto")
    for mom in [float(x) for x in a.moms.split(",")]:
        for skew in [float(x) for x in a.skews.split(",")]:
            p = SignalParams(30, 300, mom, skew)
            rows = [r for r in simulate(markets, trades, series, sim_args, p) if r["variant"] == "senal"]
            s = summarize(rows, hours)
            if not s:
                print(f"{mom:>8}{skew:>10}   sin operaciones")
                continue
            lo, hi = s["pnl_neto_IC95"]
            mark = "  *" if lo > 0 else ""
            print(f"{mom:>8}{skew:>10}{s['operaciones']:>7}{s['tasa_acierto']:>9.3f}{s['precio_medio_pagado']:>8.3f}"
                  f"{s['pnl_neto']:>10.0f}{s['roi_sobre_apostado']:>8.2%}   [{lo:.0f}, {hi:.0f}]{mark}")


if __name__ == "__main__":
    main()
