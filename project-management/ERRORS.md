# ERRORS

| Fecha | Error | Causa | Solución | Estado |
|---|---|---|---|---|
| 2026-11-19 | `marginPct(25000,18000)` devolvía `28.000000000000004` | Coma flotante en división | `roundPct()` a 4 decimales en todos los porcentajes | ✅ resuelto, probado |
| 2026-11-19 | Prueba esperaba `WAITING_APPROVAL→QUEUED` en tarea con dependencia | Expectativa incorrecta: con dependencias pasa por `PENDING` | Corregida la prueba (comportamiento correcto) | ✅ resuelto |
| 2026-11-19 | Contador de transacciones anidadas global compartido entre bases | Variable de módulo | `WeakMap` por instancia de DB | ✅ resuelto |
| 2026-11-19 | TS2352 en `errorToResponse` | Conversión de tipo directa | `as unknown as Error` | ✅ resuelto |

## Problemas conocidos / pendientes
- `node:sqlite` es "experimental" en Node 22: el aviso se silencia en los scripts. Fijar versión de Node en despliegue.
- Rate limiter y sesión de worker en memoria: válidos solo con **una** instancia.
- El orquestador marca `actual_cost_cents = 0` (no hay LLM ni servicios de pago aún).
- Raíz del repo: archivos `download`, `download (1)`, `download (2)` (nombres incorrectos de `.dockerignore`, `.gitignore`, `.node-version` del agente Mantarraya). Sin tocar.
