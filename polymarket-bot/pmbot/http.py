"""GET JSON con reintentos. Sin dependencias externas."""

import json
import random
import time
import urllib.error
import urllib.request

# Algunos endpoints públicos rechazan el User-Agent por defecto de urllib.
_HEADERS = {"User-Agent": "Mozilla/5.0 (pmbot research client)", "Accept": "application/json"}


class HttpError(RuntimeError):
    def __init__(self, url, status, body=""):
        super().__init__(f"HTTP {status} en {url}: {body[:200]}")
        self.status = status


def get_json(url, timeout=20, retries=5):
    delay = 1.0
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=_HEADERS)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace") if e.fp else ""
            # 4xx distintos de 429 no se arreglan reintentando.
            if e.code != 429 and e.code < 500:
                raise HttpError(url, e.code, body) from None
            if attempt == retries - 1:
                raise HttpError(url, e.code, body) from None
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError):
            if attempt == retries - 1:
                raise
        time.sleep(delay + random.random() * 0.5)
        delay *= 2
    raise RuntimeError("inalcanzable")
