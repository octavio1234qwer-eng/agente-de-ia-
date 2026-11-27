# CotizaFácil MX — plan de validación

Compuertas calculadas por `product-manager.validation_gate` (diario):
- **G1** ≥ 30 leads reales con consentimiento.
- **G2** ≥ 40 % de quienes responden (mín. 10) pagaría ≥ $99 MXN/mes (precio hipotético `PILOT_PRICE_CENTS`).
- **G3** ≥ 5 pagos reales verificados por Mercado Pago.

Veredicto: `KEEP_VALIDATING` → `PRESELL` (G1+G2) → `BUILD` (G1+G3).

## Entrevista guía (15 min)
1. ¿Cómo hiciste tu última cotización? ¿Cuánto tardaste?
2. ¿Qué pasa después de enviarla? ¿Cuántas se cierran?
3. ¿Has perdido un trabajo por tardar o por un error en la cotización?
4. ¿Qué usas hoy (libreta, Excel, app)? ¿Pagas algo?
5. Si existiera X, ¿cuánto pagarías al mes? ¿Pagarías hoy un mes por adelantado para el piloto?
Registrar respuestas como notas del lead. No contar opiniones como validación: solo pagos (G3) confirman.
