# FINANCIAL RULES

1. **Presupuesto.** Total autorizado: **$500 MXN** (`budgets.initial`, registrado en auditoría). Solo el propietario puede cambiarlo (acción ROJA `budget.change`).
2. **Gastos.** Flujo obligatorio: solicitud (`requestSpend`) → aprobación del propietario (`decideApproval`) → registro del gasto real (`recordApprovedExpense`).
   - La solicitud y la aprobación se bloquean si el monto supera el disponible (autorizado − gastado − comprometido).
   - La base rechaza cualquier gasto real sin autorización (`expense_needs_approval`).
3. **Ingresos.** Solo son "reales" si están verificados contra la fuente: Mercado Pago (firma + API, `status=approved`), Gumroad (API). La base rechaza ingresos reales sin verificar (`real_income_verified`). Duplicados imposibles por `(source, external_id)`.
4. **Comisiones de afiliado.** Se importan del reporte oficial como **estimadas**. Pasan a reales solo al conciliar el depósito (pendiente de implementar; mientras tanto se quedan estimadas).
5. **Comisiones de plataforma** (`fee`) se registran aparte y restan al margen bruto; no consumen presupuesto.
6. **Monedas.** No se convierten: cada moneda se reporta por separado. No se usa tipo de cambio inventado.
7. **Sin reinversión automática.** Ningún agente puede gastar, contratar herramientas ni reinvertir. Solo puede recomendar y crear solicitudes.
8. **Métricas.** Margen bruto = ingresos + comisiones − comisiones de plataforma. Beneficio neto = margen bruto − gastos. Las estimaciones nunca se suman.
9. **Servicios de pago.** Ninguna API se asume gratuita. Activar una (Claude API, dominio, hosting de pago) es ROJO.
