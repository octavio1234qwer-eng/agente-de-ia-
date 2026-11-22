# Agente de ventas autónomo: manual de cada ronda

Una tarea programada abre una sesión nueva cada 6 horas y ejecuta esta ronda. Objetivo: traer clientes a la tienda de Gumroad (octavius724.gumroad.com) sin bajar la calidad ni hacer spam.

## Datos fijos

- Repositorio: rama `claude/digital-products-factory-w7ytqo`, carpeta `fabrica-productos/`.
- Sitio de calculadoras: https://calculatunegocio.vercel.app (Vercel, team `team_LvTRNr1T7OB8Uo6sCEc5yZul`, proyecto `calculatunegocio`). Fuente en `sitio/`: `articulos/*.html` (JSON de metadatos + `\n---\n` + HTML), `build.py` genera `sitio/public/`, `indexnow.py` avisa a buscadores.
- Productos propios de esta fábrica (Gumroad): costeo `qkcnlf` ($12), inventario `meugkp` ($7), ebook ingresos irregulares `bleofy` ($7), menú semanal `gqjiht` ($5), paquete `shgbyx` ($24).
- Buffer: organización `6af4ebbdcd76f5bc85f8f6e5`; X `6af4ec4f62b70b94b0fd25e8`; LinkedIn `6af4ecb562b70b94b0fd2991`; Pinterest `6af4f40c62b70b94b0fd7e55` (sin tablero: no se puede publicar ahí todavía). Plan gratuito: 10 publicaciones programadas en total, compartidas con otros productos del usuario.

## Ronda (en este orden)

1. **Medir.** Gumroad `get_analytics` y `get_sales_totals` de los últimos 7 días (por producto y por referrer). Anota el resultado en `marketing/bitacora.md` (fecha, visitas, ventas, ingresos, qué hiciste).
2. **Redes.** `list_posts` con estado `scheduled`. Si hay menos de 10, programa con `addToQueue` UNA publicación nueva por canal libre (X o LinkedIn) sobre una guía o calculadora del sitio o sobre un producto propio. Texto útil primero, enlace al final, sin repetir textos ya publicados (revisa `sent`). Nunca borres ni edites publicaciones de otros productos.
3. **Contenido (si no hubo ventas en la semana).** Escribe 2 o 3 guías nuevas en `sitio/articulos/` que respondan búsquedas reales de compradores (restaurantes, tienditas, independientes, cocina familiar en México) y enlacen a la calculadora y al producto correctos. Antes de publicar:
   - Verifica toda cifra y cálculo de los ejemplos.
   - Originalidad: similitud con las demás guías < 8 % (`factory.originality.similarity`) y búsqueda web entre comillas de 2 frases distintivas sin coincidencias.
   - No prometas resultados garantizados ni des asesoría fiscal/legal.
4. **Publicar.** `python3 sitio/build.py`; despliega con `mcp__Vercel__create_deployment` (files): los archivos sin cambio por `sha` (sha1) y `size`, los nuevos/modificados en línea (utf-8). Luego compara cada URL en línea contra su archivo local (sha256) y corre `python3 sitio/indexnow.py`.
5. **Mejorar.** Si un producto tiene visitas pero 0 ventas en 14 días, propón (no apliques) un cambio de portada, título o precio en la bitácora para que el usuario decida.
6. **Guardar.** Commit y push a la rama. Termina con un resumen de 3 a 5 líneas.

## Reglas

- No gastar dinero (anuncios, planes, compras) ni crear códigos de descuento sin aprobación del usuario.
- No publicar productos nuevos en Gumroad sin pasar el control de calidad de la fábrica (`python -m factory qa`) y sin aprobación registrada.
- No hacer spam: máximo 1 publicación por canal por ronda; nada de mensajes directos no solicitados.
- No tocar los sitios ni proyectos de otros productos del usuario.
- Si algo falla (límite, credencial, red), anótalo en la bitácora y sigue con el siguiente paso.
