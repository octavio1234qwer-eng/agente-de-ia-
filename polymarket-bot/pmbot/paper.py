"""Paper trading en vivo: misma señal, libro de órdenes real, sin dinero real.

Cada segundo:
  1. Lee las velas de 1 s de BTCUSDT (las mismas que usa el backtest).
  2. Calcula momentum 30 s + sesgo por semivarianza.
  3. Si ambos coinciden, simula una compra de --stake USD recorriendo el libro
     real de Polymarket del mercado BTC Up/Down en curso (incluye comisión).
  4. Al cerrar cada ventana, liquida con el resultado oficial del mercado.

Uso:
    python -m pmbot.paper --window 15m --stake 10 --minutes 120
Ctrl-C para parar; las operaciones quedan en results/paper-trades.csv.
"""

import argparse
import collections
import csv
import os
import time

from . import polymarket as pm
from .btc import BINANCE_DATA
from .http import get_json
from .signals import SignalParams, evaluate

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Prices:
    """Cierres de 1 s recientes de BTCUSDT, sin huecos."""

    def __init__(self, keep):
        self.keep = keep
        self.closes = collections.OrderedDict()

    def refresh(self):
        need = 1000 if not self.closes else 10
        rows = get_json(f"{BINANCE_DATA}/api/v3/klines?symbol=BTCUSDT&interval=1s&limit={need}", timeout=5)
        now = int(time.time())
        for r in rows:
            sec = int(r[0]) // 1000
            if sec < now:  # solo velas ya cerradas
                self.closes[sec] = float(r[4])
        while len(self.closes) > self.keep:
            self.closes.popitem(last=False)

    def series(self):
        if not self.closes:
            return [], None
        secs = sorted(self.closes)
        out = []
        last = self.closes[secs[0]]
        for s in range(secs[0], secs[-1] + 1):
            last = self.closes.get(s, last)
            out.append(last)
        return out, secs[-1]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--window", choices=list(pm.WINDOWS), default="15m")
    ap.add_argument("--stake", type=float, default=10.0)
    ap.add_argument("--cooldown", type=int, default=90)
    ap.add_argument("--min-price", type=float, default=0.05)
    ap.add_argument("--max-price", type=float, default=0.95)
    ap.add_argument("--stop-before-end", type=int, default=20)
    ap.add_argument("--momentum-secs", type=int, default=30)
    ap.add_argument("--skew-secs", type=int, default=300)
    ap.add_argument("--min-momentum", type=float, default=0.0)
    ap.add_argument("--min-skew", type=float, default=0.0)
    ap.add_argument("--max-loss", type=float, default=None, help="detiene nuevas entradas si el PnL liquidado cae por debajo de -X")
    ap.add_argument("--minutes", type=float, default=None, help="duración; por defecto, hasta Ctrl-C")
    ap.add_argument("--out", default=os.path.join(HERE, "results", "paper-trades.csv"))
    args = ap.parse_args(argv)

    params = SignalParams(args.momentum_secs, args.skew_secs, args.min_momentum, args.min_skew)
    size = pm.WINDOWS[args.window]
    prices = Prices(keep=max(params.momentum_secs, params.skew_secs) + 120)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    new_file = not os.path.exists(args.out)
    out = open(args.out, "a", newline="")
    fields = ["opened_utc", "slug", "side", "stake", "shares", "avg_price", "fee", "momentum_pct", "skew",
              "secs_left", "winner", "pnl"]
    writer = csv.DictWriter(out, fieldnames=fields)
    if new_file:
        writer.writeheader()

    market = None
    market_start = None
    last_entry = -10**9
    open_trades = []
    realized = 0.0
    settled = 0
    wins = 0
    stop_at = time.time() + args.minutes * 60 if args.minutes else None
    print(f"Paper trading {args.window}, {args.stake} USD por señal. Ctrl-C para parar.")

    try:
        while stop_at is None or time.time() < stop_at or open_trades:
            tick = time.time()
            now = int(tick)
            try:
                prices.refresh()
            except Exception as e:
                print("BTC no disponible:", e)
                time.sleep(2)
                continue

            # liquidar ventanas cerradas
            for tr in list(open_trades):
                if now < tr["end"] + 5:
                    continue
                try:
                    m = pm.get_market(tr["slug"])
                except Exception:
                    m = None
                if not m or not m["winner"]:
                    continue  # aún sin resolver; se reintenta en el siguiente segundo
                tr["winner"] = m["winner"]
                payout = tr["shares"] if tr["side"] == m["winner"] else 0.0
                tr["pnl"] = round(payout - tr["stake"] - tr["fee"], 4)
                realized += tr["pnl"]
                settled += 1
                wins += tr["side"] == m["winner"]
                writer.writerow({k: tr[k] for k in fields})
                out.flush()
                open_trades.remove(tr)
                print(f"  liquidada {tr['slug']} {tr['side']} -> {m['winner']}  PnL {tr['pnl']:+.2f}   "
                      f"acumulado {realized:+.2f}  ({wins}/{settled} aciertos)")

            accepting = (stop_at is None or tick < stop_at) and (args.max_loss is None or realized > -args.max_loss)

            start = pm.window_start(args.window, now)
            if start != market_start:
                try:
                    market = pm.get_market(pm.slug_for(args.window, start))
                except Exception as e:
                    print("Mercado no disponible:", e)
                    market = None
                market_start = start if market else None
                last_entry = -10**9
                if market:
                    print(f"\n{market['question']}  (comisión {market['fee_rate']})")

            closes, last_sec = prices.series()
            secs_left = start + size - now
            if accepting and market and market.get("accepting_orders") and secs_left > args.stop_before_end \
                    and last_sec is not None and last_sec >= now - 3 and now - last_entry >= args.cooldown:
                side, mom, skew = evaluate(closes, params)
                if side:
                    other = "Down" if side == "Up" else "Up"
                    try:
                        asks = pm.effective_asks(pm.get_book(market["tokens"][side]), pm.get_book(market["tokens"][other]))
                    except Exception as e:
                        print("Libro no disponible:", e)
                        asks = []
                    shares, avg = pm.fill_from_book(asks, args.stake)
                    if avg and args.min_price <= avg <= args.max_price:
                        fee_rate = market["fee_rate"] if market["fee_rate"] is not None else pm.fee_rate_at(now)
                        fee = sum(pm.taker_fee(s, p, fee_rate) for p, s in _fills(asks, args.stake))
                        tr = {
                            "opened_utc": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(now)), "slug": market["slug"],
                            "end": start + size, "side": side, "stake": args.stake, "shares": round(shares, 4),
                            "avg_price": round(avg, 4), "fee": round(fee, 4), "momentum_pct": round(mom, 5),
                            "skew": round(skew, 4), "secs_left": secs_left, "winner": "", "pnl": "",
                        }
                        open_trades.append(tr)
                        last_entry = now
                        print(f"  {tr['opened_utc']}  {side:<4} a {avg:.3f}  mom {mom:+.4f}%  sesgo {skew:+.2f}  "
                              f"comisión {fee:.3f}  quedan {secs_left}s")

            time.sleep(max(0.0, 1.0 - (time.time() - tick)))
    except KeyboardInterrupt:
        pass
    finally:
        out.close()
        print(f"\nLiquidadas: {settled}  aciertos: {wins}  PnL: {realized:+.2f} USD  abiertas sin liquidar: {len(open_trades)}")
        print(f"Detalle en {args.out}")


def _fills(asks, usd):
    """Fills (precio, acciones) de una compra de `usd`, para calcular la comisión nivel a nivel."""
    spent = 0.0
    for price, size in asks:
        if spent >= usd:
            break
        take = min(size, (usd - spent) / price)
        spent += take * price
        yield price, take


if __name__ == "__main__":
    main()
