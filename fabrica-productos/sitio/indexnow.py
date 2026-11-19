"""Avisa a Bing, Yandex y otros buscadores (protocolo IndexNow) de las URLs del sitemap."""
import json, re, urllib.request
from pathlib import Path
from build import INDEXNOW_KEY, BASE

urls = re.findall(r"<loc>(.*?)</loc>", (Path(__file__).parent / "public" / "sitemap.xml").read_text())
body = json.dumps({"host": BASE.split("//")[1], "key": INDEXNOW_KEY,
                   "keyLocation": f"{BASE}/{INDEXNOW_KEY}.txt", "urlList": urls}).encode()
req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body, method="POST",
                             headers={"Content-Type": "application/json; charset=utf-8"})
with urllib.request.urlopen(req, timeout=30) as r:
    print(r.status, len(urls), "URLs enviadas")
