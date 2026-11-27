# API INTEGRATIONS

| Integración | Estado | Costo | Autorización |
|---|---|---|---|
| PostgreSQL / Supabase | Adaptador `pg` probado contra PostgreSQL 16 real; falta proyecto Supabase | Plan gratuito | Crear proyecto (propietario) |
| Gumroad API v2 | **Verificado en vivo**: lectura de 10 productos, 0 ventas | Gratis (comisión por venta) | Token de lectura |
| Mercado Pago (Checkout Pro + webhooks) | Adaptador y verificación de firma probados con pruebas; sin credenciales | Comisión por cobro | ROJO: el propietario entrega credenciales y fija precios |
| Programa de Afiliados Mercado Libre | Registro manual de enlaces + importación CSV | Gratis | Alta del propietario en el programa |
| SMTP (correo) | Adaptador con consentimiento y tope; sin credenciales | Depende del proveedor | Credenciales SMTP |
| Claude API | Adaptador opcional para borradores | **De pago** | ROJO |
| Google Analytics 4 | Etiqueta opcional en `/cotizafacil` con IP anonimizada | Gratis | ID de medición |
| Buffer | Conectado a esta cuenta de Claude; no integrado en código | Plan del usuario | AMARILLO para publicar |

## Mercado Pago
1. Panel de desarrolladores → tu aplicación → credenciales de **producción**: `MP_ACCESS_TOKEN`.
2. Webhooks → URL `https://<dominio>/api/webhooks/mercadopago`, evento **Pagos** → copiar la clave secreta a `MP_WEBHOOK_SECRET`.
3. `PUBLIC_BASE_URL=https://<dominio>`.
4. Flujo: `createPreference({ externalReference: "cotizafacil-mx:<id>" })` → cliente paga → webhook firmado → `GET /v1/payments/{id}` → si `approved`, ingreso real verificado (idempotente) + comisión de plataforma.

## Gumroad
Settings → Advanced → Applications → token → `GUMROAD_ACCESS_TOKEN`. Solo se usan `GET /v2/sales` y `GET /v2/products`.

## Mercado Libre afiliados
1. Alta en el programa oficial (propietario).
2. Generar cada enlace en el panel oficial → registrarlo en Command Center → Afiliados (solo dominios de Mercado Libre).
3. Publicar el enlace corto `https://<dominio>/go/<slug>` dentro de contenido original.
4. Exportar el reporte de comisiones → CSV `order_id,date,commission_mxn,status` → Importar. Quedan como **estimadas**.
No se inventan tasas de comisión: el campo queda vacío si no está confirmado en el panel.

## Claude API (opcional)
`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`. Solo Content Factory la usa; sin clave usa plantillas. Activarla es un gasto: requiere autorización.
