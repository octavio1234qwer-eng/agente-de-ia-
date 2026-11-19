import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pmbot import polymarket as pm  # noqa: E402
from pmbot.backtest import Series, ask_quotes, entry_price  # noqa: E402
from pmbot.signals import SignalParams, decide, evaluate, momentum_pct, semivariance_skew  # noqa: E402


class SignalTests(unittest.TestCase):
    def test_momentum(self):
        self.assertAlmostEqual(momentum_pct(101.0, 100.0), 1.0)
        self.assertAlmostEqual(momentum_pct(99.0, 100.0), -1.0)

    def test_skew(self):
        self.assertEqual(semivariance_skew([0.01, 0.02]), 1.0)
        self.assertEqual(semivariance_skew([-0.01, -0.02]), -1.0)
        self.assertEqual(semivariance_skew([0.01, -0.01]), 0.0)
        self.assertEqual(semivariance_skew([]), 0.0)
        # una subida grande pesa más que varias bajadas pequeñas (cuadrados)
        self.assertGreater(semivariance_skew([0.03, -0.01, -0.01, -0.01]), 0)

    def test_decide_requires_agreement(self):
        p = SignalParams()
        self.assertEqual(decide(0.01, 0.2, p), "Up")
        self.assertEqual(decide(-0.01, -0.2, p), "Down")
        self.assertIsNone(decide(0.01, -0.2, p))
        self.assertIsNone(decide(-0.01, 0.2, p))
        self.assertIsNone(decide(0.0, 0.5, p))

    def test_thresholds(self):
        p = SignalParams(min_momentum_pct=0.02, min_skew=0.3)
        self.assertIsNone(decide(0.01, 0.5, p))
        self.assertIsNone(decide(0.03, 0.2, p))
        self.assertEqual(decide(0.03, 0.4, p), "Up")

    def test_evaluate_matches_vectorized(self):
        import random
        rng = random.Random(1)
        closes = [60000.0]
        for _ in range(1000):
            closes.append(closes[-1] * (1 + rng.gauss(0, 0.0002)))
        p = SignalParams(momentum_secs=30, skew_secs=120)
        s = Series({1000 + i: c for i, c in enumerate(closes)})
        for t in (1200, 1500, 1999):
            # en el instante t se conoce hasta la vela del segundo t-1
            known = closes[: t - 1000]
            side, mom, skew = evaluate(known, p)
            vmom, vskew = s.at(t, p)
            self.assertAlmostEqual(mom, vmom, places=9)
            self.assertAlmostEqual(skew, vskew, places=9)
            self.assertEqual(side, decide(vmom, vskew, p))

    def test_no_lookahead(self):
        # el precio del segundo t no debe influir en la decisión tomada en t
        base = {i: 100.0 for i in range(0, 400)}
        moved = dict(base)
        moved[350] = 200.0
        p = SignalParams(momentum_secs=30, skew_secs=60)
        self.assertEqual(Series(base).at(350, p), Series(moved).at(350, p))
        self.assertNotEqual(Series(base).at(351, p), Series(moved).at(351, p))


class MarketTests(unittest.TestCase):
    def test_fee_formula_matches_docs_table(self):
        # docs: 100 acciones a 0.50 con coeficiente 0.07 => 1.75 USDC; a 0.10 => 0.63
        self.assertAlmostEqual(pm.taker_fee(100, 0.5, 0.07), 1.75)
        self.assertAlmostEqual(round(pm.taker_fee(100, 0.1, 0.07), 2), 0.63)

    def test_fee_schedule_switch(self):
        self.assertEqual(pm.fee_rate_at(pm.FEE_RATE_UNTIL - 1), 0.07)
        self.assertEqual(pm.fee_rate_at(pm.FEE_RATE_UNTIL), 0.05)

    def test_slugs(self):
        self.assertEqual(pm.window_start("15m", 1795055331), 1795054500)
        self.assertEqual(pm.slug_for("5m", 1795055100), "btc-updown-5m-1795055100")

    def test_quotes_and_entry(self):
        trades = [
            {"t": 10, "side": "BUY", "outcome": "Up", "price": 0.55, "size": 10},
            {"t": 12, "side": "SELL", "outcome": "Down", "price": 0.40, "size": 10},  # => Up ~0.60
            {"t": 13, "side": "BUY", "outcome": "Up", "price": 0.58, "size": 0.5},   # polvo, se ignora
        ]
        q = ask_quotes(trades, min_size=1)
        self.assertEqual(entry_price(q, "Up", 10, "next", 5), (0.6, 12))
        self.assertEqual(entry_price(q, "Up", 11, "last", 5), (0.55, 10))
        self.assertEqual(entry_price(q, "Up", 20, "next", 5), (None, None))

    def test_effective_asks_merges_complement(self):
        up = {"asks": [(0.24, 100.0), (0.25, 50.0)], "bids": []}
        down = {"asks": [], "bids": [(0.77, 30.0), (0.75, 20.0)]}
        self.assertEqual(pm.effective_asks(up, down), [(0.23, 30.0), (0.24, 100.0), (0.25, 70.0)])

    def test_fill_from_book(self):
        shares, avg = pm.fill_from_book([(0.5, 100), (0.6, 100)], 80)
        self.assertAlmostEqual(shares, 100 + 30 / 0.6)
        self.assertAlmostEqual(avg, 80 / shares)


if __name__ == "__main__":
    unittest.main()
