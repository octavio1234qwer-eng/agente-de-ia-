# COSTS — servicios, dependencias y límites

Presupuesto: **$0 MXN**. Ningún servicio contratado. No se ha realizado ningún pago.

## En uso
| Servicio / dependencia | Uso | Coste | Límites | Verificado |
|---|---|---|---|---|
| Node.js 22 (incluye `node:sqlite`, `node:http`, `node:crypto`, `node:test`) | runtime, BD, HTTP, cripto, pruebas | $0 (MIT) | `node:sqlite` experimental | ✅ local 2026-11-19 |
| typescript, @types/node | solo desarrollo (typecheck) | $0 | — | ✅ |
| GitHub (repo existente) | código | $0 | — | ✅ |

## Evaluados, NO contratados (verificar límites vigentes antes de usar)
| Opción | Para qué | Notas | Estado |
|---|---|---|---|
| Render (plan gratuito) | hosting | El README del agente Mantarraya cita que se duerme tras 15 min sin tráfico. **Por verificar:** si el plan gratuito permite disco persistente (sin él, SQLite se pierde en cada despliegue). | ⏳ verificar |
| Otros hosts gratuitos con volumen persistente | hosting | Comparar límites oficiales antes de recomendar. | ⏳ verificar |
| LLM (OpenAI, Anthropic, modelos locales) | agentes con IA | De pago por uso salvo modelos locales; se implementará como opcional y desactivable. | ⏳ |
| Pasarelas MX (Mercado Pago, Stripe MX, Conekta, Gumroad) | cobros | Sin cuota mensual típica pero cobran comisión por venta; confirmar tarifas oficiales vigentes. Gumroad aparece conectado a esta sesión, sin usar. | ⏳ |

## Controles de coste implementados
- Límite de tareas por agente/hora y timeout por tarea.
- Deduplicación de tareas activas e idempotencia.
- Agentes desactivables.
- Tabla `service_costs` (coste mensual, nivel gratuito, activado) sumada en el dashboard como coste de infraestructura.
- `finance.report` recomienda desactivar servicios de pago sin ingresos.
