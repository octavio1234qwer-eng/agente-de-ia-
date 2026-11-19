# Fórmulas financieras — CotizaFácil MX

Todas las cantidades se calculan en **centavos enteros** (sin coma flotante). Redondeo: medio alejado de cero, al centavo. Código: `packages/core/src/pricing.ts` y `quotes.ts`. Pruebas: `tests/core.test.ts`.

## Margen ≠ recargo

| Concepto | Fórmula | Base |
|---|---|---|
| Ganancia | precio − costo | — |
| **Margen** | (precio − costo) / **precio** × 100 | precio de venta |
| **Recargo (markup)** | (precio − costo) / **costo** × 100 | costo |
| Precio por recargo | costo × (1 + recargo/100) | |
| Precio por margen | costo / (1 − margen/100), margen < 100 % | |
| Recargo → margen | r / (100 + r) × 100 | |
| Margen → recargo | m / (100 − m) × 100 | |
| Punto de equilibrio (unidades) | ⌈costos fijos / (precio − costo variable)⌉ | null si precio ≤ costo |

Ejemplo: costo $100. Recargo 50 % → precio $150 (margen 33.33 %). Margen 50 % → precio $200 (recargo 100 %).

## Cotización

1. Importe de línea = round(cantidad × precio unitario)
2. Descuento de línea = round(importe × desc% / 100)
3. Subtotal = Σ (importe − descuento de línea)
4. Descuento global = round(subtotal × descGlobal% / 100)
5. Si los precios **no** incluyen IVA: base = subtotal − desc. global; IVA = round(base × tasa / 100)
6. Si los precios **sí** incluyen IVA: base = round(monto / (1 + tasa/100)); IVA = monto − base
7. Total = base + IVA

IVA predeterminado: 16 % (configurable: 0 %, 8 % zona fronteriza, etc.). Moneda predeterminada: MXN; cada negocio puede cambiarla (ISO 4217).

La ganancia estimada de una cotización solo considera líneas con costo conocido y prorratea el descuento global; es interna y no se muestra al cliente.
