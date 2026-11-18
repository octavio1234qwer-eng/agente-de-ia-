"""Analítica de ventas en SQLite + tablero HTML.

Fuentes de datos:
  - Gumroad API (/v2/sales) con `python -m factory sync`
  - Avisos en tiempo real (Ping) con `python -m factory serve`
  - Visitas por producto (CSV exportado de Gumroad Analytics) con `import-views`
  - Opiniones de compradores con `feedback`
"""
from __future__ import annotations

import csv
import hashlib
import json
import sqlite3
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "sales.sqlite3"

SCHEMA = """
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY, product_id TEXT, product_name TEXT, price_cents INTEGER,
  currency TEXT, created_at TEXT, refunded INTEGER DEFAULT 0, buyer_hash TEXT,
  country TEXT, referrer TEXT, is_test INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS views (product_id TEXT, day TEXT, views INTEGER, PRIMARY KEY (product_id, day));
CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT, day TEXT,
  rating INTEGER, comment TEXT);
"""


def connect(path: Path = DB) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.executescript(SCHEMA)
    return con


def _hash(email: str | None) -> str | None:
    # Nunca guardamos el correo del comprador en claro.
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()[:16] if email else None


def upsert_sale(con, s: dict) -> None:
    con.execute(
        "INSERT OR REPLACE INTO sales VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (s.get("id") or s.get("sale_id"), s.get("product_id"), s.get("product_name"),
         int(s.get("price") or s.get("price_cents") or 0), s.get("currency", "usd"),
         s.get("created_at") or s.get("sale_timestamp"),
         int(str(s.get("refunded", "false")).lower() in ("true", "1")), _hash(s.get("email")),
         s.get("ip_country") or s.get("country"), s.get("referrer"), int(bool(s.get("is_test")))))
    con.commit()


def import_views(con, csv_path: Path) -> int:
    """CSV con columnas: product_id, day (AAAA-MM-DD), views."""
    n = 0
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            con.execute("INSERT OR REPLACE INTO views VALUES (?,?,?)",
                        (row["product_id"], row["day"], int(row["views"])))
            n += 1
    con.commit()
    return n


def add_feedback(con, product_id: str, rating: int, comment: str = "") -> None:
    con.execute("INSERT INTO feedback (product_id, day, rating, comment) VALUES (?,?,?,?)",
                (product_id, date.today().isoformat(), rating, comment))
    con.commit()


def metrics(con, days: int = 30, today: date | None = None) -> dict:
    today = today or date.today()
    since = (today - timedelta(days=days)).isoformat()
    per = defaultdict(lambda: {"name": "", "units": 0, "revenue_cents": 0, "refunds": 0, "views": 0,
                               "ratings": [], "comments": []})
    daily = defaultdict(int)
    for pid, name, price, created, refunded in con.execute(
            "SELECT product_id, product_name, price_cents, created_at, refunded FROM sales "
            "WHERE is_test = 0 AND substr(created_at,1,10) >= ?", (since,)):
        p = per[pid]
        p["name"] = name or p["name"]
        p["units"] += 1
        if refunded:
            p["refunds"] += 1
        else:
            p["revenue_cents"] += price
            daily[created[:10]] += price
    for pid, v in con.execute("SELECT product_id, SUM(views) FROM views WHERE day >= ? GROUP BY product_id",
                              (since,)):
        per[pid]["views"] = v or 0
    for pid, rating, comment in con.execute("SELECT product_id, rating, comment FROM feedback"):
        per[pid]["ratings"].append(rating)
        if comment:
            per[pid]["comments"].append(comment)
    for p in per.values():
        p["conversion"] = (p["units"] / p["views"]) if p["views"] else None
        p["refund_rate"] = (p["refunds"] / p["units"]) if p["units"] else 0.0
        p["avg_rating"] = (sum(p["ratings"]) / len(p["ratings"])) if p["ratings"] else None
        p["aov_cents"] = (p["revenue_cents"] / max(1, p["units"] - p["refunds"]))
    series = [(today - timedelta(days=d)).isoformat() for d in range(days - 1, -1, -1)]
    return {
        "days": days,
        "since": since,
        "total_revenue_cents": sum(p["revenue_cents"] for p in per.values()),
        "total_units": sum(p["units"] for p in per.values()),
        "products": dict(per),
        "daily": [(d, daily.get(d, 0)) for d in series],
    }


def dashboard_html(m: dict) -> str:
    rows = "".join(
        f"<tr><td>{p['name'] or pid}</td><td>{p['units']}</td><td>${p['revenue_cents']/100:,.2f}</td>"
        f"<td>{'' if p['conversion'] is None else f'{p['conversion']:.1%}'}</td>"
        f"<td>{p['refund_rate']:.0%}</td><td>{'' if p['avg_rating'] is None else f'{p['avg_rating']:.1f}★'}</td></tr>"
        for pid, p in sorted(m["products"].items(), key=lambda kv: -kv[1]["revenue_cents"]))
    vals = [v for _, v in m["daily"]] or [0]
    top = max(vals) or 1
    w, h = 720, 160
    bw = w / max(1, len(vals))
    bars = "".join(
        f'<rect x="{i*bw+1:.1f}" y="{h - v/top*(h-20):.1f}" width="{bw-2:.1f}" height="{v/top*(h-20):.1f}" '
        f'fill="#1F4E5F"><title>{d}: ${v/100:.2f}</title></rect>'
        for i, (d, v) in enumerate(m["daily"]))
    return f"""<!DOCTYPE html><html lang="es"><meta charset="utf-8"><title>Ventas</title>
<style>body{{font:15px system-ui;margin:32px;color:#222;max-width:820px}}table{{border-collapse:collapse;width:100%}}
td,th{{padding:8px 10px;border-bottom:1px solid #e5e5e5;text-align:left}}th{{background:#f4efe6}}
.k{{display:inline-block;margin-right:32px}}.k b{{display:block;font-size:28px;color:#1F4E5F}}</style>
<h1>Ventas · últimos {m['days']} días</h1>
<div class="k"><b>${m['total_revenue_cents']/100:,.2f}</b>ingresos netos</div>
<div class="k"><b>{m['total_units']}</b>ventas</div>
<h2>Ingresos por día</h2><svg width="{w}" height="{h}" role="img" aria-label="Ingresos por día">{bars}</svg>
<h2>Por producto</h2><table><tr><th>Producto</th><th>Ventas</th><th>Ingresos</th><th>Conversión</th>
<th>Reembolsos</th><th>Calificación</th></tr>{rows}</table>
<p style="color:#666">Generado {datetime.now():%Y-%m-%d %H:%M}. Conversión = ventas / visitas importadas.</p></html>"""


def export_json(m: dict) -> str:
    return json.dumps(m, ensure_ascii=False, indent=2)
