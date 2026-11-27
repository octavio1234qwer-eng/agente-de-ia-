# BUSINESS STRATEGY

> Todo lo que sigue son **hipótesis** hasta que los datos de la base las confirmen. No hay ingresos garantizados.

## Situación de partida (verificada 2026-11-27)
- Presupuesto autorizado: $500 MXN. Gastado: $0.
- Activos existentes en el repositorio: 10 productos en Gumroad (9 publicados, 0 ventas según la API), sitio de calculadoras `calculatunegocio.vercel.app`, fábrica de productos digitales, agente de WhatsApp para un restaurante.
- Ingresos reales registrados: $0.

## Orden de prioridad
1. **CotizaFácil MX** — validar disposición de pago antes de construir.
2. **Digital Products** — ya tiene catálogo publicado: el cuello de botella es tráfico, no producto.
3. **Affiliate Engine** — costo cero; depende de contenido útil y del alta en el programa de Mercado Libre.
4. **Media Engine** — es el canal de tráfico de 1–3; no es un negocio por sí mismo al inicio.
5. **Micro SaaS / AI Services** — solo oportunidades con evidencia; CotizaFácil es el primer candidato.

## CotizaFácil MX
**Problema hipotético:** oficios y pequeños negocios (plomería, electricidad, herrería, imprentas, talleres, eventos) cotizan a mano o por mensajes sueltos: tardan, cometen errores de IVA/totales, no ponen vigencia ni anticipo, y no dan seguimiento.

**Propuesta:** cotización clara con IVA, anticipo y vigencia, enviada por WhatsApp/correo, con recordatorio de seguimiento.

**Hipótesis a validar (en orden):**
| # | Hipótesis | Señal | Umbral |
|---|---|---|---|
| H1 | El dolor existe y es frecuente | Leads con ≥ 4 cotizaciones/mes y descripción del problema | ≥ 30 leads |
| H2 | Pagarían | Respuesta "¿cuánto pagarías?" ≥ $149/mes | ≥ 40 % de quienes responden (mín. 10) |
| H3 | Pagan de verdad | Pagos verificados (preventa/piloto) vía Mercado Pago | ≥ 5 pagos |

La compuerta la calcula `product-manager.validation_gate` cada día: `KEEP_VALIDATING` → `PRESELL` → `BUILD`.

**Adquisición sin presupuesto de anuncios:** grupos y comunidades donde participan los oficios (respetando sus reglas), contenido educativo de Content Factory, el sitio de calculadoras existente y entrevistas 1 a 1 con cada lead.

**Pendiente (no inventado):** investigación de competencia con fuentes citadas — es la primera tarea de Market Intelligence en la próxima sesión.

## Monetización por unidad
| Unidad | Modelo | Cobro |
|---|---|---|
| CotizaFácil MX | Suscripción mensual (precio por validar) | Mercado Pago |
| Digital Products | Venta única | Gumroad |
| Affiliate Engine | Comisión por venta | Programa de Afiliados Mercado Libre |
| AI Services | Proyecto/servicio | Mercado Pago |
| Micro SaaS | Suscripción | Mercado Pago |

## Reglas de corte
- Una unidad sin señales de validación en 60 días pasa a `paused` (decisión del propietario, registrada).
- Gastos solo para desbloquear ingresos medibles (p. ej., dominio cuando haya ≥ 30 leads).
