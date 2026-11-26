# Canales de venta y embudo — AUTO-INCOME AI

Última actualización: 2026-11-25. Datos de partida (últimos 30 días): 36 productos en Gumroad, 129 visitas (todas "direct"), **0 ventas**; 36 publicaciones en Buffer, 1,897 impresiones, 2 reacciones.
Diagnóstico: falta **audiencia y confianza**, no productos. Prioridad: canales donde ya hay compradores buscando + oferta de servicio con caso real.

## Embudo automático activo (Gumroad) — creado 2026-11-25

```
Publicación en redes / Pinterest / SEO
        ↓
Regalo GRATIS: https://octavius724.gumroad.com/l/bhbdx   (pide correo: Gumroad lo registra)
        ↓  (automático: correo del recibo)
Oferta: Paquete Negocio y Hogar $24 → $19.20 con GRACIAS20 (vence 31-dic-2026)
        ↓  (la guía también enlaza al paquete al final)
Cliente
```

- Lead magnet: "Guía GRATIS: Precios que sí dejan ganancia (margen vs recargo) + calculadora" (id `7I-SztS7AMq_txuJEgJ10w==`, permalink `bhbdx`), $0 con "paga lo que quieras". Publicado y verificado (HTTP 200).
- Cupón `GRACIAS20`: 20 % solo en `shgbyx` (los productos de $1 impiden un cupón general).
- Recibo personalizado con el cupón = primer correo automático del embudo.
- Promoción: LinkedIn 26-nov 09:40 y X 26-nov 13:10 (hora Cancún).
- **Pendiente del dueño (2 min, opcional):** en Gumroad → Emails → Workflows, crear un correo "3 días después de la compra" de `bhbdx` recordando el cupón. La API conectada no permite crear workflows.
- Nota: la guía menciona "celdas amarillas"; el CSV no tiene colores (las celdas a editar son B2 y B3). Corregir si se vuelve a subir el archivo.

## Canales nuevos

| Canal | Estado | Qué falta | Quién |
|---|---|---|---|
| **Product Hunt** (cuenta octavio1) | **Enviado y programado** (launch id 1331091), público el 2-dic-2026 00:00 PT. Publicaciones de apoyo en LinkedIn (09:15) y X (10:05) ese día | El dueño debería responder comentarios en Product Hunt ese día | Dueño |
| **Pinterest** (conectado en Buffer) | Sin tableros: Buffer no puede publicar | Crear 2 tableros en la app de Pinterest: "Imprimibles para fiestas" y "Plantillas para negocio". Ideal para lotería, planner XV, intercambio, agenda | Dueño (2 min) |
| **Afiliados de Gumroad** | No activado | Activar afiliados en Gumroad (Settings → Affiliates) con 30 % de comisión: contadores pueden vender el Kit RESICO, organizadores de eventos el planner | Dueño (UI) |
| **Gumroad Discover** | Etiquetas y categoría en el producto nuevo | Revisar etiquetas de los demás productos | Agente |
| **Servicio: agente de WhatsApp a negocios locales** | Caso real en La Casa de la Mantarraya | Contactos uno a uno (ver kit abajo). Ticket mucho mayor que plantillas | Dueño envía; agente prepara |
| **Perfil de Google (Google Business Profile)** del servicio | No existe | Crear perfil "Agentes de WhatsApp con IA – Cancún" (gratis) para aparecer en Maps | Dueño |
| **Grupos de Facebook de emprendedores** | No usado | Publicar contenido útil (no spam), respetar reglas de cada grupo, máx. 1 publicación por grupo por semana | Dueño |
| **Hotmart / Etsy / Payhip** | Evaluados, no abiertos | Etsy cobra por anuncio: requiere aprobación de gasto. Verificar tarifas oficiales antes | Pendiente |

## Kit de venta: agente de WhatsApp con IA para negocios locales

**Oferta:** "Tu WhatsApp contesta solo, 24/7, con tus precios, horarios y menú reales. Listo en 3 a 5 días. Ya funciona en un restaurante de Cancún."
Cobro sugerido (decide el dueño): instalación + mensualidad que cubra los costos de la API de IA y Meta del cliente. **Verificar costos reales por mensaje antes de cotizar.**

**A quién (uno a uno, nunca masivo):** restaurantes y fondas con muchos pedidos por WhatsApp, pastelerías (pedidos de diciembre), estéticas y barberías (citas), consultorios dentales, rentas vacacionales y tours en Cancún/Tulum.

**Mensaje (personalizar con el nombre del negocio; enviar solo a negocios con WhatsApp público, una vez, sin insistir):**
> Hola, ¿qué tal? Soy Octavio, de Cancún. Vi que [NEGOCIO] atiende pedidos por WhatsApp. Instalé un asistente con IA en un restaurante de aquí que contesta solo precios, horarios, menú y reservaciones con los datos reales del negocio, a cualquier hora. Si en diciembre les llegan muchos mensajes, ¿les interesaría verlo funcionando 5 minutos? Sin compromiso.

**Seguimiento:** registrar cada contacto en el CRM de AUTO-INCOME (`POST /api/businesses/:bid/customers`, `source: "outreach"`), etapa `contacted`. Si responde, `qualified`; demo, `proposal`; cierra, `won`. Si dice que no o no responde, `lost`: no volver a escribir.

## Reglas
- Sin spam, sin mensajes masivos, sin reseñas falsas, sin comprar tráfico.
- No se promete ningún resultado de ventas.
- Cualquier gasto (anuncios, Etsy, dominios) requiere aprobación expresa.

## Reparto de trabajo entre sesiones (2026-11-26)
El dueño pidió no recibir tareas: todo lo hacen las sesiones de código.
- **Sesión "Investigación de mercado para micronegocios"** (session_01BhCR59vw8HvmQioN2REFog, ronda cada 2 h): portada de `bhbdx`, enlaces al regalo desde los sitios SEO (precios/costeo/cotizaciones/IVA), regalo en BANCO-POSTS desde el 28-nov (máx. 1/semana por red), sitio de The One Ad en línea el 2-dic.
- **Sesión "Fábrica automatizada de productos digitales"** (session_01BhCR57yJhBdoE6qKsdgj3W, ronda cada 6 h): venta cruzada en recibos de productos de pago, guías que enlacen al regalo, medición del embudo (`bhbdx` → `shgbyx` con GRACIAS20).
- **Esta sesión (AUTO-INCOME AI):** embudo, Product Hunt, integración de datos reales y coordinación.
- Corrección aplicada: la descripción de `bhbdx` ahora indica que las celdas a editar son B2 y B3.

### Sin vía automática (ni API ni conector disponible)
Crear tableros de Pinterest, activar afiliados de Gumroad y crear workflows de correo en Gumroad solo se pueden hacer en sus aplicaciones con la sesión del dueño iniciada. Quedan anotados; ninguna sesión los puede ejecutar hoy.

## Actualización 2026-11-26
- Ventas al 26-nov: **$0** (Gumroad, desde el 20-nov).
- Product Hunt: galería completada con 3 imágenes (inicio, compra, móvil) en el lanzamiento 1331091.
- La otra sesión de 2 h puso la portada al regalo `bhbdx` y agregará enlaces desde cotizafacil, plantillasmx, resicoclaro y costeodulce.
- Gumroad Discover: las búsquedas en español no devuelven ningún producto (ni propios ni ajenos); no sirve como canal hasta tener ventas.
- Correo en frío a negocios de Cancún: evaluado y **no ejecutado**. Los correos públicos encontrados son de cadenas grandes o no están verificados, el rendimiento esperado es muy bajo y el riesgo para la cuenta de Gmail del dueño es alto. El servicio de WhatsApp se vende mejor en persona o por recomendación.
- Revisión automática programada para el 2-dic a las 10:30 (hora Cancún), id `trig_01VFtBZ1Kky5f7asMAYXq79V`.
