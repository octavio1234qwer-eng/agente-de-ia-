# CotizaFácil MX — investigación de mercado (2026-11-27)

Fuentes públicas consultadas por búsqueda web. Los precios de sitios comerciales pueden cambiar: verificar antes de usarlos en comunicación pública.

## Tamaño y contexto
- Censos Económicos 2024 (INEGI): 5,451,113 establecimientos; 95.5 % son microempresas (≤ 10 personas). Fuente: [boletín CE 2024](https://inegi.org.mx/contenidos/saladeprensa/boletines/2025/ce/CE_2024_RO_Nal.pdf), [resumen](https://www.liderempresarial.com/censos-economicos-2024-microempresas-dominan-en-mexico-pero-las-grandes-lideran-los-ingresos/).
- CE 2024: ~1.4 millones de unidades usan internet para trabajar.
- CE 2019 (línea base): solo 26 de cada 100 establecimientos tenían computadora. Fuente: [CE 2019](https://en.www.inegi.org.mx/contenidos/saladeprensa/boletines/2020/OtrTemEcon/CenEconResDef2019_Nal.pdf).
- **Implicación:** el producto debe funcionar 100 % desde el celular y salir por WhatsApp; no asumir computadora.

## Competencia
| Producto | Enfoque | Precio publicado | Fuente |
|---|---|---|---|
| Cotiza Pro (iOS, México) | App de cotizaciones en iPhone/iPad | $49 MXN/mes, $499/año | [App Store](https://apps.apple.com/mx/app/cotiza-pro/id6747967324) |
| Zoho Books | Contabilidad + cotizaciones → factura | desde MXN 99/mes por organización | [Zoho](https://www.zoho.com/es-mx/books/pricing/), [cotizaciones](https://www.zoho.com/es-mx/books/quote-management/) |
| Alegra | Facturación CFDI + cotizaciones | ~MXN 129–138/mes (sin IVA) | [Alegra vs Contpaqi](https://blog.alegra.com/mexico/alegra-vs-contpaqi/) |
| CONTPAQi | ERP/contabilidad | desde MXN 2,690 (licencia) | misma fuente |
| CRMs de WhatsApp (p. ej. Aurora Inbox, Leadsales) | Ventas por WhatsApp, cotizaciones incluidas | ~MXN 1,390–1,800/mes + cargos de Meta | [Aurora](https://www.aurorainbox.com/precio-whatsapp-business-api-mexico-2026/), [Leadsales](https://leadsales.io/blog/crea-y-envia-cotizaciones-con-whatsapp-business/) |
| Tu sitio actual `cotizafacil.vercel.app` | Calculadora de precios para freelancers | gratis | proyecto propio en Vercel |

## Conclusiones
1. **Precio:** existe un competidor directo a $49 MXN/mes. La hipótesis de precio baja de $149 a **$99 MXN/mes** (`PILOT_PRICE_CENTS`), y la diferenciación debe justificarla.
2. **Hueco:** las opciones baratas son apps de documento (sin seguimiento ni WhatsApp nativo, solo iOS en el caso de Cotiza Pro); las que integran WhatsApp cuestan 10–30× más. Hueco hipotético: **web móvil (Android incluido) + enlace por WhatsApp + recordatorio de seguimiento, < $100/mes**.
3. **Riesgo:** si los entrevistados ya usan Cotiza Pro o Excel sin dolor, matar la unidad (regla de 60 días).
4. **Sinergia:** el dominio `cotizafacil.vercel.app` ya existe con otro enfoque (freelancers). Decisión pendiente del propietario: unificar o mantener separados.
