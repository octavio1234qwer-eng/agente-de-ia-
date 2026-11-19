"""Convierte entrega/GUIA-DE-ENTREGA.md en un PDF con la identidad de la marca."""
import markdown, os, subprocess
BASE = os.path.dirname(os.path.abspath(__file__))
SITIO = os.path.normpath(os.path.join(BASE, '../mantarraya-links'))
md = open(os.path.join(BASE, '../entrega/GUIA-DE-ENTREGA.md'), encoding='utf-8').read()
cuerpo = markdown.markdown(md, extensions=['tables', 'fenced_code'])
html = f'''<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
@font-face {{ font-family: Fraunces; src: url("file://{SITIO}/assets/fonts/fraunces.woff2"); font-weight: 380 480; }}
@font-face {{ font-family: Fraunces; src: url("file://{SITIO}/assets/fonts/fraunces-italic.woff2"); font-style: italic; }}
@font-face {{ font-family: Bricolage; src: url("file://{SITIO}/assets/fonts/bricolage.woff2"); font-weight: 400 700; }}
@page {{ size: A4; margin: 18mm 16mm 18mm; }}
body {{ font-family: Bricolage, sans-serif; color: #15281f; font-size: 10.4pt; line-height: 1.5; }}
.portada {{ background: #193f30; color: #f3eadb; padding: 22px 26px; border-radius: 14px; display: flex; gap: 18px; align-items: center; margin-bottom: 18px; }}
.portada img {{ width: 64px; height: 64px; background: #f3eadb; border-radius: 50%; padding: 6px; }}
.portada small {{ color: #e9b872; letter-spacing: .16em; text-transform: uppercase; font-weight: 650; font-size: 8pt; }}
h1 {{ font-family: Fraunces; font-weight: 430; font-size: 24pt; margin: 2px 0 0; line-height: 1.05; }}
.portada + p {{ font-size: 11pt; }}
h2 {{ font-family: Fraunces; font-weight: 450; font-size: 15pt; color: #193f30; margin: 18px 0 6px; padding-top: 8px; border-top: 1.5px solid #193f30; break-after: avoid; }}
h3 {{ font-family: Fraunces; font-size: 12pt; margin: 12px 0 4px; break-after: avoid; }}
table {{ border-collapse: collapse; width: 100%; margin: 6px 0 10px; font-size: 9.4pt; break-inside: avoid; }}
th, td {{ text-align: left; padding: 5px 8px; border-bottom: 1px solid #d9d2c0; vertical-align: top; }}
th {{ background: #f3eadb; }}
code {{ background: #f3eadb; padding: 1px 5px; border-radius: 4px; font-size: 9pt; }}
pre {{ background: #f3eadb; padding: 8px 12px; border-radius: 8px; break-inside: avoid; }}
pre code {{ padding: 0; }}
blockquote {{ margin: 8px 0; padding: 6px 12px; border-left: 3px solid #9a4a24; background: #faf5ec; color: #4b5b51; }}
blockquote p {{ margin: 0; }}
a {{ color: #9a4a24; }}
hr {{ display: none; }}
li {{ margin: 2px 0; }}
strong {{ font-weight: 650; }}
</style></head><body>
<div class="portada"><img src="file://{SITIO}/assets/img/logo-mantarraya.png" alt=""><div><small>Guía de entrega</small><h1>Bio link · La Casa de la Mantarraya</h1></div></div>
{cuerpo.split('</h1>', 1)[1]}
</body></html>'''
ruta_html = os.path.join(BASE, 'salida/guia.html')
open(ruta_html, 'w', encoding='utf-8').write(html)
js = """const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://%s', { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
await p.pdf({ path: '%s', format: 'A4', printBackground: true, margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
  displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:7pt;color:#4b5b51;width:100%%;text-align:center">La Casa de la Mantarraya · bio link · <span class=pageNumber></span>/<span class=totalPages></span></div>' });
await b.close(); })();""" % (ruta_html, os.path.join(BASE, '../entrega/Bio-link-La-Casa-de-la-Mantarraya/5 - Para el programador (no es necesario abrir)/Guia tecnica completa.pdf'))
open(os.path.join(BASE, 'salida/guia.cjs'), 'w').write(js)
subprocess.run(['node', os.path.join(BASE, 'salida/guia.cjs')], check=True)
print('PDF listo')
