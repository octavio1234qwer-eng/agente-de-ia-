# Registro de decisiones

Formato: ID · fecha · decisión · motivo · alternativas. No borrar entradas; si una cambia, añadir una nueva que la reemplace.

- **D-001 · 2026-11-19 · AUTO-INCOME AI vive en `auto-income/`.** El repo ya contiene el agente de WhatsApp de La Casa de la Mantarraya desplegado en Render desde la raíz (`npm start` → `server.mjs`). Convertir la raíz en monorepo rompería ese despliegue. Alternativa descartada: mover el agente a otra carpeta.
- **D-002 · 2026-11-19 · Backend TypeScript sin paso de compilación.** Node 22.23 ejecuta `.ts` nativamente (type stripping). Restricción: solo sintaxis borrable (`erasableSyntaxOnly`), imports con extensión `.ts`. `tsc` solo para typecheck.
- **D-003 · 2026-11-19 · Base de datos: SQLite nativo (`node:sqlite`).** $0, sin servidor, sin dependencias. Limitación: una sola instancia de escritura; requiere disco persistente en producción. Migración futura posible a libSQL/Postgres detrás del mismo esquema SQL. (El módulo emite aviso "experimental"; se silencia con `--disable-warning=ExperimentalWarning`.)
- **D-004 · 2026-11-19 · Cero dependencias de runtime en el backend.** Router HTTP, validación, rate limit y seguridad implementados con la librería estándar. Menos superficie de ataque y coste $0. Dev-deps: `typescript`, `@types/node`.
- **D-005 · 2026-11-19 · Dinero en centavos enteros**, redondeo medio alejado de cero, porcentajes redondeados a 4 decimales.
- **D-006 · 2026-11-19 · Autenticación por cookie HttpOnly SameSite=Strict + token CSRF de doble envío** (`x-csrf-token`). Contraseñas scrypt (N=16384). La cuenta de propietario solo se crea con `OWNER_SETUP_TOKEN` (evita que un desconocido la reclame en un despliegue público).
- **D-007 · 2026-11-19 · Roles:** owner (todo), admin (sin aprobar tareas, gestionar usuarios/agentes, borrar CRM), viewer (solo lectura).
- **D-008 · 2026-11-19 · Agentes deterministas primero; LLM opcional después** detrás de una interfaz `LLMProvider` con modo "sin IA". Motivo: $0 y nunca inventar datos. Los agentes fallan con mensaje claro cuando faltan datos.
- **D-009 · 2026-11-19 · Política de autonomía:** riesgos `financial`, `sensitive_data`, `irreversible`, `external_communication` siempre requieren aprobación. Nivel 0 y 1: todo espera aprobación (en nivel 0 el propietario ejecuta tras aprobar). Nivel 2: ejecuta `internal_low`. Nivel 3: + `publish_approved`. Nivel 4: + `internal_optimization`.
- **D-010 · 2026-11-19 · Recuperación de tareas:** una tarea interrumpida se reencola solo si su handler es idempotente; si no, pasa a WAITING_APPROVAL. Así nunca se repite una operación peligrosa.
- **D-011 · 2026-11-19 · Pagos:** solo `confirmed` vía webhook firmado cuenta como venta. Modo DEMO con `source='demo'` excluido de todas las métricas. Webhook HMAC-SHA256 sobre `timestamp.body`, tolerancia 300 s, idempotencia por `(provider, event_id)`, verificación de monto y moneda.
- **D-012 · 2026-11-19 · Beneficio neto = ingresos brutos confirmados − reembolsos − comisiones − gastos.** Transacciones pendientes se muestran aparte.
- **D-013 · 2026-11-19 · PDF de cotizaciones mediante impresión del navegador (CSS de impresión, "Guardar como PDF").** $0, sin librerías pesadas, funciona en iPhone. Pendiente de implementar en la UI.
- **D-014 · 2026-11-19 · Analítica sin cookies:** hash diario de IP+UA+secreto; no se guarda la IP.
- **D-015 · 2026-11-19 · Supresión de clientes:** se borra el registro y notas; cotizaciones quedan anonimizadas ("[eliminado]") por obligaciones contables. Requiere escribir `ELIMINAR`.
- **D-016 · 2026-11-22 · No se crea un tercer agente "chambeador" programado.** Ya existen dos tareas programadas de ventas creadas desde otras sesiones del propietario ("Cada 2 horas: vender y generar flujo de clientes" y "Agente de ventas: ronda cada 6 horas") que publican en Buffer y miden Gumroad. Otro más duplicaría publicaciones (riesgo de spam) y gastaría créditos. AUTO-INCOME AI se enfoca en ser el centro de control con datos reales de esos canales.
- **D-017 · 2026-11-22 · Integraciones externas de solo lectura primero.** Gumroad se importa sin modificar nada en la tienda; publicar/cambiar precios sigue requiriendo aprobación.
