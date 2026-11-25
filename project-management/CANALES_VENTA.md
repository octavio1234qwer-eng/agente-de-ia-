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
| **Product Hunt** (cuenta octavio1) | Borrador listo de *The One Ad* para el 2-dic-2026, con miniatura y 2 capturas | Confirmar el envío (vista previa mostrada al dueño) | Dueño confirma |
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
