"""Genera el sitio estático de calculadoras gratis (tráfico de búsqueda -> productos)."""
import json
from pathlib import Path

OUT = Path(__file__).parent / "public"
BASE = "https://calculatunegocio.vercel.app"
G = "https://octavius724.gumroad.com/l/"

CSS = """*{box-sizing:border-box}body{margin:0;font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1e1e1e;background:#fafaf7}
header{background:#1F4E5F;color:#fff;padding:28px 18px}header a{color:#fff;text-decoration:none;font-weight:700}
.w{max-width:760px;margin:0 auto;padding:0 18px}h1{font-size:clamp(26px,5vw,36px);line-height:1.2;margin:18px 0 8px}
h2{color:#1F4E5F;margin-top:34px}.card{background:#fff;border:1px solid #e3e0d8;border-radius:12px;padding:20px;margin:20px 0}
label{display:block;font-weight:600;margin:10px 0 4px;font-size:15px}input,select{width:100%;padding:10px;font-size:16px;border:1px solid #c9c5ba;border-radius:8px}
.row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:6px;align-items:end;margin-bottom:6px}.row input{padding:8px}
button{background:#E07A2F;color:#fff;border:0;border-radius:8px;padding:11px 18px;font-size:16px;font-weight:700;cursor:pointer}
button.sec{background:#e9e6de;color:#1e1e1e}.res{background:#F4EFE6;border-radius:10px;padding:16px;margin-top:16px}
.res b{font-size:22px;color:#1F4E5F}.ok{color:#1b7a3a}.bad{color:#b3261e}.cta{display:block;background:#1F4E5F;color:#fff;text-decoration:none;
border-radius:12px;padding:18px;margin:26px 0;text-align:center}.cta strong{display:block;font-size:19px}.grid12{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:15px}td,th{border:1px solid #e3e0d8;padding:8px;text-align:left;vertical-align:top}th{background:#F4EFE6}
footer{color:#666;font-size:14px;text-align:center;padding:30px}@media(max-width:560px){.row{grid-template-columns:1fr 1fr}.grid12{grid-template-columns:repeat(2,1fr)}}"""

def page(slug, title, desc, h1, body, faq, script=""):
    ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}
    faq_html = "".join(f"<h3>{q}</h3><p>{a}</p>" for q, a in faq)
    url = f"{BASE}/{slug}/" if slug else f"{BASE}/"
    html = f"""<!DOCTYPE html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><meta name="description" content="{desc}"><link rel="canonical" href="{url}">
<meta property="og:title" content="{title}"><meta property="og:description" content="{desc}"><meta property="og:url" content="{url}">
<link rel="stylesheet" href="/s.css"><script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script></head><body>
<header><div class="w"><a href="/">Calcula tu Negocio</a><h1>{h1}</h1><p>{desc}</p></div></header>
<main class="w">{body}<h2>Preguntas frecuentes</h2>{faq_html}</main>
<footer>Calculadoras gratis para negocios pequeños en México · Resultados orientativos: no sustituyen la asesoría de tu contador.<br>
<a href="/">Inicio</a> · <a href="/calculadora-food-cost/">Food cost</a> · <a href="/punto-de-reorden-tienda/">Punto de reorden</a> · <a href="/sueldo-ingresos-irregulares/">Sueldo con ingresos irregulares</a> · <a href="/blog/">Guías</a></footer>
<script>const f=(n,d=2)=>isFinite(n)?n.toLocaleString('es-MX',{{minimumFractionDigits:d,maximumFractionDigits:d}}):'—';const num=id=>parseFloat(document.getElementById(id).value)||0;{script}</script></body></html>"""
    d = OUT / slug if slug else OUT
    d.mkdir(parents=True, exist_ok=True)
    (d / "index.html").write_text(html, encoding="utf-8")
    return url

def cta(perm, title, price, text):
    return f'<a class="cta" href="{G}{perm}"><strong>{title} · {price} USD</strong>{text}</a>'

def regalo():
    return ('<div class="card"><strong>Regalo gratis:</strong> guía corta de precios (margen vs. recargo, punto de equilibrio e IVA) '
            'con calculadora para Excel o Google Sheets. <a href="https://octavius724.gumroad.com/l/bhbdx">Descárgala gratis →</a></div>')

REGALO = {"como-calcular-la-merma", "costo-de-una-receta-en-excel", "cuanto-cobrar-por-un-platillo", "ingenieria-de-menu",
          "margen-de-ganancia-tienda-abarrotes", "punto-de-equilibrio-restaurante", "cuanto-cobrar-por-tamales",
          "cuanto-cobrar-por-vaso-de-ponche", "cuanto-cobrar-por-una-rosca-de-reyes", "cena-de-navidad-por-encargo-precio-por-persona", "anticipo-freelancer-clientes-que-no-pagan"}

urls = []
# ---------- Food cost ----------
body = """<div class="card"><p>Agrega cada ingrediente de la receta con lo que pagas, la cantidad que compras y su merma.
La cantidad que usa la receta va en la misma unidad (por ejemplo kg).</p>
<div class="row" style="font-size:13px;font-weight:600"><span>Ingrediente</span><span>Precio pagado $</span><span>Cantidad comprada</span><span>Cantidad en receta</span><span></span></div>
<div id="rows"></div><button class="sec" onclick="addRow()">+ Ingrediente</button>
<label>Merma promedio de los ingredientes (%)</label><input id="merma" type="number" value="10">
<label>Porciones que rinde la receta</label><input id="por" type="number" value="1">
<label>Precio de venta en el menú $</label><input id="precio" type="number" value="135">
<label>¿El precio del menú incluye IVA (16 %)?</label><select id="iva"><option value="1">Sí</option><option value="0">No</option></select>
<label>Food cost objetivo (%)</label><input id="obj" type="number" value="30">
<p><button onclick="calc()">Calcular</button></p><div class="res" id="out">Llena los datos y presiona Calcular.</div></div>"""
body += regalo()
body += cta("qkcnlf", "¿Tienes más de 3 platillos?", 12, "La plantilla de Excel costea todo tu menú, guarda tus insumos y clasifica cada platillo en estrella, caballo de batalla, rompecabezas o perro.")
body += """<h2>Cómo se calcula el food cost</h2><p>El <strong>food cost</strong> es el porcentaje del precio de venta que se va en materia prima.
Se calcula así: <em>costo por porción ÷ precio de venta sin IVA × 100</em>. Si tu platillo cuesta $40 de ingredientes y lo vendes en $135 con IVA
(116.38 sin IVA), tu food cost es 34.4 %.</p><p>Un punto de partida común en México es entre 28 % y 35 % para comida; las bebidas suelen andar más bajo.
Lo importante es que el número sea real: incluye la <strong>merma</strong> (cáscara, hueso, jugo que no sale), porque la pagas aunque no llegue al plato.</p>
<h2>Cómo sacar el precio sugerido</h2><p>Precio sugerido = costo por porción ÷ food cost objetivo, más IVA si tu menú lo incluye. La calculadora lo redondea hacia arriba a múltiplos de $5.</p>"""
faq = [("¿Qué es un buen food cost para un restaurante?", "Muchos restaurantes en México apuntan a un food cost entre 28 % y 35 % en comida. Depende del tipo de negocio: una taquería y un restaurante de mariscos tienen costos muy distintos."),
       ("¿Cómo calculo la merma?", "Pesa el producto antes y después de limpiarlo. Si compras 1 kg de pescado y después de limpiarlo quedan 950 g, la merma es 5 %."),
       ("¿El food cost se calcula con o sin IVA?", "Sin IVA: el IVA no es ingreso del negocio. Si tu precio de menú incluye IVA, divídelo entre 1.16 antes de calcular.")]
script = """let n=0;function addRow(a='',p='',c='',q=''){n++;const r=document.createElement('div');r.className='row';r.innerHTML=`<input placeholder="Ej. pescado" value="${a}"><input type="number" class="p" value="${p}"><input type="number" class="c" value="${c}"><input type="number" class="q" value="${q}"><button class="sec" onclick="this.parentNode.remove()">✕</button>`;document.getElementById('rows').appendChild(r)}
addRow('Filete de pescado',700,5,0.18);addRow('Tortilla de maíz',26,1,0.09);addRow('Col',20,1,0.06);
function calc(){const m=num('merma')/100;let costo=0;document.querySelectorAll('#rows .row').forEach(r=>{const p=+r.querySelector('.p').value||0,c=+r.querySelector('.c').value||0,q=+r.querySelector('.q').value||0;if(c>0&&m<1)costo+=p/c/(1-m)*q});
const por=num('por')||1,cpp=costo/por,iva=document.getElementById('iva').value==='1',psi=iva?num('precio')/1.16:num('precio'),fc=cpp/psi,obj=num('obj')/100;
const sug=Math.ceil(cpp/obj*(iva?1.16:1)/5)*5;const cls=fc>obj?'bad':'ok';
document.getElementById('out').innerHTML=`Costo por porción: <b>$${f(cpp)}</b><br>Food cost: <b class="${cls}">${f(fc*100,1)} %</b> (objetivo ${f(obj*100,0)} %)<br>Margen por porción: <b>$${f(psi-cpp)}</b><br>Precio sugerido en menú: <b>$${f(sug,0)}</b>`}"""
urls.append(page("calculadora-food-cost", "Calculadora de food cost y costo por platillo (gratis) | Calcula tu Negocio",
    "Calcula gratis el costo por porción, el food cost % y el precio sugerido de un platillo, incluyendo merma e IVA.",
    "Calculadora de food cost y costo por platillo", body, faq, script))

# ---------- Punto de reorden ----------
body = """<div class="card"><label>Producto</label><input id="prod" value="Refresco de cola 600 ml">
<label>¿Cuántas piezas vendes al día en promedio?</label><input id="vd" type="number" value="6">
<label>¿Cuántos días tarda en llegar el pedido desde que lo haces?</label><input id="dl" type="number" value="2">
<label>¿Cada cuántos días pasa tu proveedor?</label><input id="cada" type="number" value="7">
<label>Días extra de seguridad (por si se vende más o se retrasa)</label><input id="seg" type="number" value="2">
<label>¿Cuántas piezas tienes hoy?</label><input id="hoy" type="number" value="15">
<p><button onclick="calc()">Calcular</button></p><div class="res" id="out">Llena los datos y presiona Calcular.</div></div>"""
body += cta("meugkp", "Lleva todos tus productos en una sola hoja", 7, "La plantilla de Excel calcula existencias, marca qué pedir y cuánto, y te dice cuánto te deja cada producto.")
body += """<h2>Qué es el punto de reorden</h2><p>Es la cantidad de piezas a la que debes hacer el pedido para que el producto no se agote antes de que llegue el siguiente.
Se calcula como <em>venta diaria × (días de entrega + días de seguridad)</em>.</p>
<h2>Cuánto pedir</h2><p>Para que te alcance hasta la siguiente visita del proveedor, pide lo que vas a vender en ese tiempo más tu punto de reorden, menos lo que ya tienes.
Así evitas quedarte sin el producto que más se vende y también llenar el anaquel de mercancía que se caduca.</p>"""
faq = [("¿Cómo saco la venta diaria de un producto?", "Cuenta cuántas piezas tenías al inicio de la semana, súmale lo que compraste y réstale lo que te queda al final. Divide entre 7."),
       ("¿Qué es el stock de seguridad?", "Son piezas extra para cubrir días de más venta o retrasos del proveedor. Aquí se calcula como días de seguridad × venta diaria.")]
script = """function calc(){const vd=num('vd'),rp=Math.ceil(vd*(num('dl')+num('seg'))),ped=Math.max(0,Math.ceil(vd*num('cada'))+rp-num('hoy')),hoy=num('hoy');
const st=hoy<=0?'<b class="bad">Agotado: pide hoy</b>':hoy<=rp?'<b class="bad">Ya debes pedir</b>':'<b class="ok">Todavía alcanza</b>';
document.getElementById('out').innerHTML=`Punto de reorden: <b>${rp} piezas</b><br>Estado hoy: ${st}<br>Pedido sugerido: <b>${ped} piezas</b><br>Te alcanza para unos <b>${vd>0?f(hoy/vd,1):'—'} días</b>`}"""
urls.append(page("punto-de-reorden-tienda", "Punto de reorden: cuánto pedir para tu tiendita (calculadora gratis) | Calcula tu Negocio",
    "Calcula gratis cuándo hacer el pedido de cada producto y cuántas piezas pedir para que no se agote ni se caduque.",
    "Calculadora de punto de reorden para tiendas de abarrotes", body, faq, script))

# ---------- Sueldo ingresos irregulares ----------
meses = [18000, 32000, 9500, 25000, 41000, 14000, 22000, 27500, 12000, 36000, 19500, 30000]
inputs = "".join(f'<div><label>Mes {i+1}</label><input class="m" type="number" value="{v}"></div>' for i, v in enumerate(meses))
body = f"""<div class="card"><p>Escribe lo que cobraste en cada uno de los últimos 12 meses (los datos de ejemplo son de una diseñadora freelance ficticia).</p>
<div class="grid12">{inputs}</div>
<label>Porcentaje que apartas para impuestos (pregúntalo a tu contador)</label><input id="imp" type="number" value="10">
<label>Tu mes mínimo: lo indispensable para vivir un mes sin lujos $</label><input id="min" type="number" value="14200">
<p><button onclick="calc()">Calcular</button></p><div class="res" id="out">Llena los datos y presiona Calcular.</div></div>"""
body += cta("bleofy", "El método completo en 8 pasos", 7, "Ebook de 35 páginas + calculadora de Excel: sueldo fijo, colchón, reglas para meses buenos y plan de mes flaco.")
body += """<h2>Por qué no usar el promedio</h2><p>Cuando tus ingresos cambian cada mes, el promedio lo jalan hacia arriba uno o dos meses excepcionales.
Si haces tu presupuesto con él, en la mayoría de los meses te va a faltar.</p>
<h2>El sueldo fijo</h2><p>La regla conservadora: págate cada mes el <strong>promedio de tus tres meses seguidos más bajos</strong> del último año, después de impuestos,
redondeado hacia abajo a $500. Lo que sobre en meses buenos va a un colchón; lo que falte en meses flojos sale de ahí. Una buena meta es un colchón de tres meses de sueldo.</p>"""
faq = [("¿Cómo hago un presupuesto si no gano lo mismo cada mes?", "Págate un sueldo fijo desde una cuenta donde caen todos tus cobros y usa un colchón para los meses flojos. Así gastas de forma estable aunque cobres distinto."),
       ("¿De qué tamaño debe ser mi colchón?", "Una referencia útil es tres meses de tu sueldo fijo. Si trabajas por temporadas, apunta a seis.")]
script = """function calc(){const t=num('imp')/100;const v=[...document.querySelectorAll('.m')].map(e=>(+e.value||0)*(1-t));const s=[...v].sort((a,b)=>a-b);
const med=s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2;let peor=Infinity;for(let i=2;i<v.length;i++)peor=Math.min(peor,(v[i]+v[i-1]+v[i-2])/3);
const sueldo=Math.floor(peor/500)*500,min=num('min'),dif=sueldo-min;
document.getElementById('out').innerHTML=`Mediana de ingreso neto: <b>$${f(med,0)}</b><br>Peor trimestre (promedio mensual): <b>$${f(peor,0)}</b><br>Sueldo fijo sugerido: <b>$${f(sueldo,0)}</b><br>`+
(dif>=0?`<span class="ok">Te quedan $${f(dif,0)} al mes para gastos flexibles.</span>`:`<span class="bad">Tu sueldo no alcanza tu mes mínimo por $${f(-dif,0)}: revisa gastos o busca subir tu ingreso más bajo.</span>`)+`<br>Colchón objetivo (3 meses): <b>$${f(sueldo*3,0)}</b>`}"""
urls.append(page("sueldo-ingresos-irregulares", "Cómo hacer presupuesto con ingresos irregulares: calculadora de sueldo fijo | Calcula tu Negocio",
    "Calcula gratis tu sueldo fijo si eres freelancer, comisionista o conductor de app: mediana, peor trimestre, sueldo y colchón.",
    "Calculadora de sueldo fijo para ingresos irregulares", body, faq, script))

# ---------- Inicio ----------
body = """<div class="card"><h2 style="margin-top:0"><a href="/calculadora-food-cost/">Calculadora de food cost</a></h2><p>Costo por porción, food cost % y precio sugerido de un platillo, con merma e IVA.</p></div>
<div class="card"><h2 style="margin-top:0"><a href="/punto-de-reorden-tienda/">Punto de reorden para tiendita</a></h2><p>Cuándo pedir y cuántas piezas, para que no se agote ni se caduque.</p></div>
<div class="card"><h2 style="margin-top:0"><a href="/sueldo-ingresos-irregulares/">Sueldo fijo con ingresos irregulares</a></h2><p>Para freelancers, comisionistas y conductores de app.</p></div>"""
body += cta("shgbyx", "Las 4 plantillas completas", 24, "Costeo de platillos, inventario, presupuesto para ingresos irregulares y planificador de menú semanal.")
urls.insert(0, page("", "Calcula tu Negocio: calculadoras gratis para restaurantes, tienditas e independientes",
    "Calculadoras gratis en español: food cost de platillos, punto de reorden para tiendas de abarrotes y sueldo fijo con ingresos irregulares.",
    "Calculadoras gratis para tu negocio", body, [("¿Las calculadoras son gratis?", "Sí. No necesitas registrarte. Si quieres llevar todo tu negocio en una hoja, cada calculadora tiene su plantilla de Excel.")]))

# ---------- Artículos ----------
INDEXNOW_KEY = "c4a7e1f09b3d4e6a8f2b5c7d9e1a3b5c"
arts = []
for f in sorted((Path(__file__).parent / "articulos").glob("*.html")):
    meta_raw, html = f.read_text(encoding="utf-8").split("\n---\n", 1)
    m = json.loads(meta_raw)
    slug = f.stem
    tool = f'<p><a href="{m["tool"]}">Prueba la calculadora gratis →</a></p>' if m["tool"] != "/" else ""
    body = html + tool + (regalo() if slug in REGALO else "") + cta(*m["cta"][:2], m["cta"][2], m["cta"][3])
    urls.append(page(f"blog/{slug}", m["title"] + " | Calcula tu Negocio", m["desc"], m["h1"], body, m["faq"]))
    arts.append((slug, m["h1"], m["desc"]))
listado = "".join(f'<div class="card"><h2 style="margin-top:0"><a href="/blog/{s}/">{t}</a></h2><p>{d}</p></div>' for s, t, d in arts)
urls.append(page("blog", "Guías prácticas para restaurantes, tienditas e independientes | Calcula tu Negocio",
    "Guías cortas y prácticas: merma, ingeniería de menú, inventario de tienda, presupuesto con ingresos irregulares y menú semanal.",
    "Guías prácticas", listado, [("¿Las guías son gratis?", "Sí, todas las guías y calculadoras de este sitio son gratis.")]))
(OUT / "s.css").write_text(CSS, encoding="utf-8")
(OUT / f"{INDEXNOW_KEY}.txt").write_text(INDEXNOW_KEY)

(OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n")
(OUT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    + "".join(f"<url><loc>{u}</loc><lastmod>2026-11-14</lastmod></url>" for u in urls) + "</urlset>\n")
print("\n".join(urls))
