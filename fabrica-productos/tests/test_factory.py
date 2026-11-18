import io
import json
import sqlite3
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

from factory import analytics, improve, niches, originality, pipeline, pricing, quality
from factory.gumroad import Gumroad, GumroadError, parse_ping


class NichesTest(unittest.TestCase):
    def test_scores_are_bounded_and_sorted(self):
        ranked = niches.ranking()
        self.assertTrue(all(0 <= n.score <= 100 for n in ranked))
        self.assertEqual([n.score for n in ranked], sorted((n.score for n in ranked), reverse=True))

    def test_less_competition_scores_higher(self):
        base = dict(id="x", name="x", audience="", competitor_prices_usd=[], competitor_prices_en_usd=[],
                    demand=3, pain=3, ease=3)
        a = niches.score(niches.Niche(competitors_es=0, **base))
        b = niches.score(niches.Niche(competitors_es=5, **base))
        self.assertGreater(a.score, b.score)


class PricingTest(unittest.TestCase):
    def test_charm_round(self):
        self.assertEqual(pricing.charm_round(8.4), 9)
        self.assertEqual(pricing.charm_round(6), 7)  # empate: elige el mayor

    def test_price_within_format_bounds(self):
        for t in pricing.FORMAT_FLOOR:
            for ref in (None, 1, 500):
                p = pricing.suggest(t, ref)["price_usd"]
                self.assertGreaterEqual(p, pricing.FORMAT_FLOOR[t])
                self.assertLessEqual(p, pricing.FORMAT_CEIL[t])

    def test_extra_formats_raise_floor(self):
        self.assertGreaterEqual(pricing.suggest("ebook", 3, extra_formats=("spreadsheet",))["price_usd"],
                                pricing.FORMAT_FLOOR["spreadsheet"])

    def test_bundle_discount(self):
        self.assertEqual(pricing.bundle_price([9, 7, 5]), 15)


class QualityTest(unittest.TestCase):
    def test_spanish_todo_is_not_a_placeholder(self):
        product = {"type": "printable"}
        checks = dict((c[0], c[1]) for c in quality.check_text(product, "Todo el dinero y todo el tiempo."))
        self.assertEqual(checks["Sin marcadores pendientes"], "PASS")
        checks = dict((c[0], c[1]) for c in quality.check_text(product, "TODO: escribir esto"))
        self.assertEqual(checks["Sin marcadores pendientes"], "FAIL")

    def test_risky_claims_fail(self):
        checks = dict((c[0], c[1]) for c in quality.check_text({"type": "ebook"}, "Hazte rico en 7 días."))
        self.assertEqual(checks["Sin promesas engañosas"], "FAIL")

    def test_duplicate_paragraphs_detected(self):
        para = "Este es un párrafo bastante largo que se repite dos veces en el documento por error de copia."
        self.assertTrue(quality._repeated_paragraphs(f"{para}\n\n{para}"))

    def test_readability_reasonable(self):
        r = quality.readability("El perro come. La casa es grande. Mañana vamos al mercado temprano.")
        self.assertGreater(r["fh"], 60)


class OriginalityTest(unittest.TestCase):
    def test_similarity(self):
        a = "uno dos tres cuatro cinco seis siete ocho nueve diez once doce"
        self.assertAlmostEqual(originality.similarity(a, a)["containment"], 1.0)
        self.assertEqual(originality.similarity(a, "trece catorce quince dieciseis diecisiete")["jaccard"], 0.0)

    def test_accents_normalized(self):
        self.assertEqual(originality.normalize("Mañana CAFÉ"), ["manana", "cafe"])

    def test_sample_rows_ignored(self):
        self.assertEqual(originality._strings({"sample": [["a b c d"]], "x": "uno dos tres"}), ["uno dos tres"])


class AnalyticsTest(unittest.TestCase):
    def setUp(self):
        self.con = sqlite3.connect(":memory:")
        self.con.executescript(analytics.SCHEMA)

    def test_metrics_exclude_tests_and_refunds(self):
        today = date(2026, 11, 13)
        sales = [
            {"id": "1", "product_id": "p", "product_name": "P", "price": 900, "created_at": "2026-11-10T10:00:00Z",
             "email": "a@b.com"},
            {"id": "2", "product_id": "p", "product_name": "P", "price": 900, "created_at": "2026-11-11T10:00:00Z",
             "refunded": "true"},
            {"id": "3", "product_id": "p", "product_name": "P", "price": 900, "created_at": "2026-11-12T10:00:00Z",
             "is_test": True},
        ]
        for s in sales:
            analytics.upsert_sale(self.con, s)
        self.con.execute("INSERT INTO views VALUES ('p','2026-11-10',100)")
        m = analytics.metrics(self.con, 30, today)
        p = m["products"]["p"]
        self.assertEqual(p["units"], 2)
        self.assertEqual(p["revenue_cents"], 900)
        self.assertEqual(p["refund_rate"], 0.5)
        self.assertAlmostEqual(p["conversion"], 0.02)
        stored = self.con.execute("SELECT buyer_hash FROM sales WHERE id='1'").fetchone()[0]
        self.assertNotIn("@", stored)  # correo nunca en claro
        self.assertIn("<svg", analytics.dashboard_html(m))


class ImproveTest(unittest.TestCase):
    def test_no_sales_with_traffic(self):
        recs = improve.diagnose({"views": 300, "units": 0, "conversion": 0.0})
        self.assertEqual(recs[0]["área"], "página de venta")

    def test_errors_in_comments_are_priority_one(self):
        recs = improve.diagnose({"views": 0, "units": 3, "comments": ["La fórmula da #REF en la hoja"]})
        self.assertTrue(any(r["área"] == "errores" and r["prioridad"] == 1 for r in recs))

    def test_high_refunds(self):
        recs = improve.diagnose({"units": 20, "refund_rate": 0.2})
        self.assertTrue(any(r["área"] == "calidad" for r in recs))

    def test_bump_version(self):
        self.assertEqual(improve.bump_version("1.0"), "1.1")
        self.assertEqual(improve.bump_version("1.3", major=True), "2.0")


class GumroadTest(unittest.TestCase):
    def test_ping_rejects_other_seller(self):
        with self.assertRaises(GumroadError):
            parse_ping({"seller_id": ["otro"]}, seller_id="mio")
        self.assertEqual(parse_ping({"seller_id": ["mio"], "price": ["900"]}, "mio")["price"], "900")

    def test_sales_pagination(self):
        pages = iter([{"success": True, "sales": [{"id": 1}], "next_page_key": "k"},
                      {"success": True, "sales": [{"id": 2}]}])

        class R(io.BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        g = Gumroad("t", opener=lambda req, timeout: R(json.dumps(next(pages)).encode()))
        self.assertEqual([s["id"] for s in g.sales()], [1, 2])


class PublishGateTest(unittest.TestCase):
    def test_publish_refuses_without_approval(self):
        fake = {"publishable": False, "status": "PASS", "human_approved": False}
        client = mock.Mock()
        with mock.patch.object(pipeline, "qa", return_value=fake):
            with self.assertRaises(PermissionError):
                pipeline.publish("costeo-restaurantes", client=client)
        client.enable.assert_not_called()

    def test_every_product_has_required_files(self):
        for slug in pipeline.slugs():
            p = pipeline.load(slug)
            for key in ("title", "type", "version", "price_cents", "listing", "brand"):
                self.assertIn(key, p, slug)


if __name__ == "__main__":
    unittest.main()
