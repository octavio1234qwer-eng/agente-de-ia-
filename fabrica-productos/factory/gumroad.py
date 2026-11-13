"""Integración con Gumroad: pagos, entrega automática de archivos y datos de ventas.

Por qué Gumroad: cobra con tarjeta/PayPal en más de 200 países, emite el recibo, entrega
los archivos al comprador al instante (correo + biblioteca) y avisa de cada venta por webhook
("Ping"). La fábrica no maneja datos de tarjetas.

Autenticación: variable GUMROAD_ACCESS_TOKEN (Settings > Advanced > Applications en Gumroad).
En el entorno de Claude Code el proxy inyecta la credencial, así que basta un valor ficticio.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.gumroad.com/v2"


class GumroadError(RuntimeError):
    pass


class Gumroad:
    def __init__(self, token: str | None = None, opener=urllib.request.urlopen):
        self.token = token or os.environ.get("GUMROAD_ACCESS_TOKEN", "proxy-injected")
        self._open = opener

    def _req(self, method: str, path: str, params: dict | None = None) -> dict:
        params = dict(params or {})
        data = None
        url = f"{API}{path}"
        if method == "GET":
            if params:
                url += "?" + urllib.parse.urlencode(params)
        else:
            data = urllib.parse.urlencode(params).encode()
        req = urllib.request.Request(url, data=data, method=method,
                                     headers={"Authorization": f"Bearer {self.token}",
                                              "User-Agent": "fabrica-productos/1.0"})
        try:
            with self._open(req, timeout=30) as r:
                body = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            raise GumroadError(f"{method} {path}: HTTP {e.code} {e.read()[:300]!r}") from e
        if not body.get("success", False):
            raise GumroadError(f"{method} {path}: {body.get('message', body)}")
        return body

    # --- catálogo ---------------------------------------------------------
    def products(self) -> list[dict]:
        return self._req("GET", "/products")["products"]

    def product(self, product_id: str) -> dict:
        return self._req("GET", f"/products/{product_id}")["product"]

    def enable(self, product_id: str) -> dict:
        """Publica un producto. Úsalo solo a través de pipeline.publish(), que exige QA + aprobación."""
        return self._req("PUT", f"/products/{product_id}/enable")["product"]

    def disable(self, product_id: str) -> dict:
        return self._req("PUT", f"/products/{product_id}/disable")["product"]

    # --- ventas -----------------------------------------------------------
    def sales(self, after: str | None = None, product_id: str | None = None) -> list[dict]:
        out, page_key = [], None
        while True:
            params = {k: v for k, v in {"after": after, "product_id": product_id,
                                        "page_key": page_key}.items() if v}
            body = self._req("GET", "/sales", params)
            out += body.get("sales", [])
            page_key = body.get("next_page_key")
            if not page_key:
                return out

    # --- webhooks (Ping) --------------------------------------------------
    def subscribe(self, post_url: str, resource: str = "sale") -> dict:
        return self._req("PUT", "/resource_subscriptions",
                         {"resource_name": resource, "post_url": post_url})["resource_subscription"]


def parse_ping(form: dict, seller_id: str | None = None) -> dict:
    """Valida y normaliza el aviso de venta ('Ping') que Gumroad envía por POST.

    Gumroad no firma el Ping; por eso se compara el seller_id con el de la cuenta y
    conviene usar una URL con un secreto en la ruta (p. ej. /ping/<secreto-largo>).
    """
    flat = {k: (v[0] if isinstance(v, list) else v) for k, v in form.items()}
    expected = seller_id or os.environ.get("GUMROAD_SELLER_ID")
    if expected and flat.get("seller_id") != expected:
        raise GumroadError("Ping rechazado: seller_id no coincide")
    if flat.get("test") == "true":
        flat["is_test"] = True
    return flat
