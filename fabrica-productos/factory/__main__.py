"""CLI de la fábrica.  Uso:  python -m factory <comando> [opciones]

  niches                      Ranking de nichos investigados (data/niches.json)
  price <slug>                Precio sugerido para un producto
  build [slug|all]            Genera archivos, portadas, descripción y página de venta en dist/
  qa [slug|all]               Control de calidad y originalidad (dist/<slug>/qa_report.md)
  approve <slug> --by NOMBRE  Aprobación humana (requiere QA en PASS)
  publish <slug>              Publica en Gumroad (requiere QA PASS + aprobación de la versión)
  sync [--after AAAA-MM-DD]   Descarga ventas de Gumroad a data/sales.sqlite3
  serve [--port 8080]         Recibe avisos de venta (Ping) en /ping/<GUMROAD_PING_SECRET>
  import-views <csv>          Importa visitas por producto (product_id,day,views)
  feedback <product_id> <1-5> "comentario"
  report [--days 30]          Tablero dist/dashboard.html
  improve [--days 90]         Diagnóstico y backlog de mejoras por producto
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs

from . import analytics, improve, niches, pipeline


def _targets(arg: str | None) -> list[str]:
    return pipeline.slugs() if arg in (None, "all") else [arg]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="factory", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("niches")
    p = sub.add_parser("price"); p.add_argument("slug"); p.add_argument("--store-median", type=float)
    for name in ("build", "qa"):
        p = sub.add_parser(name); p.add_argument("slug", nargs="?")
    p = sub.add_parser("approve"); p.add_argument("slug"); p.add_argument("--by", required=True)
    p.add_argument("--notes", default="")
    p = sub.add_parser("publish"); p.add_argument("slug")
    p = sub.add_parser("sync"); p.add_argument("--after")
    p = sub.add_parser("serve"); p.add_argument("--port", type=int, default=8080)
    p = sub.add_parser("import-views"); p.add_argument("csv")
    p = sub.add_parser("feedback"); p.add_argument("product_id"); p.add_argument("rating", type=int)
    p.add_argument("comment", nargs="?", default="")
    p = sub.add_parser("report"); p.add_argument("--days", type=int, default=30)
    p = sub.add_parser("improve"); p.add_argument("--days", type=int, default=90)
    a = ap.parse_args(argv)

    if a.cmd == "niches":
        print(niches.report())
    elif a.cmd == "price":
        print(json.dumps(pipeline.price(a.slug, a.store_median), ensure_ascii=False, indent=2))
    elif a.cmd == "build":
        for s in _targets(a.slug):
            print(s, "->", pipeline.build(s)["files"])
    elif a.cmd == "qa":
        failed = False
        for s in _targets(a.slug):
            r = pipeline.qa(s)
            failed |= r["status"] != "PASS"
            print(f"{s}: QA {r['status']} · aprobado={r['human_approved']} · publicable={r['publishable']}")
            for c in r["checks"]:
                if c["status"] != "PASS":
                    print(f"   {c['status']}: {c['check']} — {c['detail']}")
        return 1 if failed else 0
    elif a.cmd == "approve":
        print("Aprobación registrada:", pipeline.approve(a.slug, a.by, a.notes))
    elif a.cmd == "publish":
        print(json.dumps(pipeline.publish(a.slug), ensure_ascii=False, indent=2))
    elif a.cmd == "sync":
        from .gumroad import Gumroad
        con = analytics.connect()
        sales = Gumroad().sales(after=a.after)
        for s in sales:
            analytics.upsert_sale(con, s)
        print(f"{len(sales)} ventas sincronizadas")
    elif a.cmd == "serve":
        _serve(a.port)
    elif a.cmd == "import-views":
        print(analytics.import_views(analytics.connect(), Path(a.csv)), "filas importadas")
    elif a.cmd == "feedback":
        analytics.add_feedback(analytics.connect(), a.product_id, a.rating, a.comment)
    elif a.cmd == "report":
        m = analytics.metrics(analytics.connect(), a.days)
        out = pipeline.DIST / "dashboard.html"
        out.parent.mkdir(exist_ok=True)
        out.write_text(analytics.dashboard_html(m), encoding="utf-8")
        print(f"Ingresos {a.days} días: ${m['total_revenue_cents']/100:,.2f} · {m['total_units']} ventas · {out}")
    elif a.cmd == "improve":
        recs = improve.run(analytics.metrics(analytics.connect(), a.days))
        for slug, items in recs.items():
            print(f"\n{slug}")
            for r in items or [{"prioridad": "-", "área": "-", "acción": "sin acciones"}]:
                print(f"  P{r['prioridad']} {r['área']}: {r['acción']}")
    return 0


def _serve(port: int) -> None:
    from .gumroad import GumroadError, parse_ping
    secret = os.environ.get("GUMROAD_PING_SECRET")
    if not secret or len(secret) < 24:
        sys.exit("Define GUMROAD_PING_SECRET (mínimo 24 caracteres) para proteger la URL del Ping.")
    con = analytics.connect()

    class H(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            if self.path != f"/ping/{secret}":
                self.send_response(404); self.end_headers(); return
            body = self.rfile.read(min(int(self.headers.get("Content-Length", 0)), 100_000)).decode()
            try:
                sale = parse_ping(parse_qs(body))
                analytics.upsert_sale(con, sale)
                self.send_response(200)
            except GumroadError:
                self.send_response(403)
            self.end_headers()

        def log_message(self, *args):
            pass

    print(f"Escuchando avisos de venta en :{port}/ping/<secreto>")
    HTTPServer(("0.0.0.0", port), H).serve_forever()


if __name__ == "__main__":
    sys.exit(main())
