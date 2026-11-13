# Fábrica de productos digitales

Sistema para investigar nichos, producir productos digitales originales (ebooks, hojas de cálculo e imprimibles), generar portadas, descripciones, precios y páginas de venta, venderlos con entrega automática en Gumroad, medir las ventas y mejorar los productos con datos.

**Regla central:** nada se publica sin pasar el control de calidad automático **y** una aprobación humana de esa versión exacta. El código lo impone: `publish` se niega si falta cualquiera de los dos.

## Flujo

```
nicho → producto (fuente en products/<slug>/) → build → QA → aprobación → borrador en Gumroad → publicar
                                                                                          ↓
                         mejoras ← diagnóstico ← analítica (ventas, visitas, opiniones) ←─┘
```

| Paso | Comando | Resultado |
|---|---|---|
| Investigar nichos | `python -m factory niches` | Ranking de `data/niches.json` (demanda, dolor, facilidad, competencia, precio, traslape con tu catálogo) |
| Precio | `python -m factory price <slug>` | Precio sugerido con justificación; lee la mediana de tu tienda en Gumroad |
| Construir | `python -m factory build all` | En `dist/<slug>/`: archivos (PDF/XLSX), `cover.png`, `thumbnail.png`, `description.html`, `sales_page.html` |
| Revisar | `python -m factory qa all` | `dist/<slug>/qa_report.md` con cada verificación |
| Aprobar | `python -m factory approve <slug> --by "Tu nombre"` | Crea `approval.json` (solo si el QA está en PASS) |
| Publicar | `python -m factory publish <slug>` | Activa el producto en Gumroad (requiere `gumroad.id` en `product.json`) |
| Ventas | `python -m factory sync` / `serve` | Descarga las ventas de la API, o las recibe en tiempo real por el Ping de Gumroad |
| Tablero | `python -m factory report --days 30` | `dist/dashboard.html` |
| Mejoras | `python -m factory improve` | `products/<slug>/improvements.md` con acciones priorizadas |

Requisitos: Python 3.11+, `pip install -r requirements.txt`, fuentes DejaVu y LibreOffice (para recalcular las fórmulas de Excel en el QA).

## Control de calidad (factory/quality.py)

Un FAIL bloquea la publicación; un WARN se muestra para revisión.

- **Contenido:** marcadores pendientes (TODO, lorem ipsum), promesas engañosas ("hazte rico", "garantizado"), caracteres corruptos, párrafos duplicados, extensión mínima del ebook (4,000 palabras, 20 páginas), legibilidad Fernández-Huerta y longitud de oración.
- **Archivos:** el PDF abre, tiene páginas suficientes, título y metadatos. El Excel abre, tiene fórmulas, **LibreOffice lo recalcula sin un solo error** (#REF!, #DIV/0!…) y los resultados coinciden con `expected_values.json`, que se calcula por separado en Python.
- **Imágenes:** tamaños exactos de portada (1280×720), miniatura (600×600) y portada de ebook (1200×1800).
- **Descripción:** extensión, secciones obligatorias (qué incluye, para quién, formato, reembolso), precio definido y **páginas prometidas = páginas reales**.
- **Originalidad (factory/originality.py):**
  1. Similitud por fragmentos de 5 palabras contra el resto de productos y `data/corpus/*.txt` (máximo 8 %).
  2. Auto-repetición (relleno o copiar y pegar, máximo 3 %).
  3. Verificación web: el QA extrae frases distintivas; se buscan entre comillas y el resultado se registra en `products/<slug>/originality.json`. Sin ese registro, o con coincidencias, el producto no pasa.

## Pagos y entrega (factory/gumroad.py)

Gumroad cobra (tarjeta, PayPal, Apple/Google Pay), emite el recibo y entrega los archivos al instante por correo y en la biblioteca del comprador. La fábrica nunca toca datos de tarjetas.

- `GUMROAD_ACCESS_TOKEN`: token de la app (Gumroad → Settings → Advanced → Applications).
- `GUMROAD_SELLER_ID`: para validar los avisos de venta.
- `GUMROAD_PING_SECRET`: secreto largo para la URL del aviso. En Gumroad → Settings → Advanced → Ping, pon `https://tu-servidor/ping/<secreto>` y ejecuta `python -m factory serve`.

Las páginas de venta (`sales_page.html`) usan el checkout superpuesto oficial de Gumroad: se suben a cualquier hosting estático después de poner la URL del producto en `product.json → gumroad.url` y volver a construir.

> Los archivos de `dist/` no se suben a git (están en `.gitignore`): son el producto que se vende, y el repositorio podría ser público.

## Analítica y mejora

`data/sales.sqlite3` guarda las ventas (el correo del comprador solo como hash), las visitas importadas (`import-views`, CSV `product_id,day,views`) y las opiniones (`feedback`). `improve` aplica reglas como estas:

- Visitas sin ventas → reescribir gancho y portada.
- Conversión < 1 % → agregar capturas, preguntas frecuentes y muestra gratis.
- Conversión del doble del promedio → probar un precio más alto.
- Reembolsos > 8 % o calificación < 4★ → revisar calidad antes de promocionar.
- Comentarios con "error", "fórmula", "no abre" → corregir y agregar el caso a `expected_values.json`.

Cada mejora sube la versión (`improve.bump_version`) y vuelve a pasar por QA y aprobación.

## Agregar un producto nuevo

1. Agrega el nicho a `data/niches.json` con los datos de tu búsqueda y revisa el ranking.
2. Crea `products/<slug>/product.json` (usa uno existente como plantilla) y la fuente:
   - ebook: `manuscript.md` (# capítulo, ## sección, listas, tablas, `> consejo`)
   - hoja de cálculo: `spreadsheet.json` + `expected_values.json`
   - imprimible: `printable.json` (páginas `text`, `grid`, `checklist`, `repeat`)
3. `build` → `qa` → corregir hasta PASS → verificación web → leer los archivos tú mismo → `approve`.

## Productos de la primera ronda

| Producto | Formato | Precio | Estado |
|---|---|---|---|
| Costeo de Platillos y Food Cost para Restaurantes | Excel, 6 hojas, 3,500+ fórmulas | $12 | QA PASS · pendiente de aprobación |
| Gana como independiente, vive con sueldo | Ebook de 35 páginas + calculadora Excel | $7 | QA PASS · pendiente de aprobación |
| Planificador de Menú Semanal y Lista del Súper | PDF imprimible de 16 páginas | $5 | QA PASS · pendiente de aprobación |

Pruebas: `python -m unittest discover -s tests -t .`
