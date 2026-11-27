# CLAUDE.md — Virtual Model Factory AI

Instrucciones permanentes para futuras sesiones de Claude Code en este proyecto.
Lee también `AGENTS.md` (Next.js 16 cambia APIs: consulta `node_modules/next/dist/docs/` antes de usar una API de Next).

## Qué es
Panel y backend para gestionar y monetizar **personajes virtuales ficticios y adultos** (25+ años), siempre identificados como IA.
Next.js 16 (App Router, TypeScript estricto, Tailwind v4) + PostgreSQL (Supabase en producción, PGlite embebido en desarrollo y pruebas).

## Reglas que el código debe imponer (no negociables)
1. Personajes ficticios, adultos (edad ficticia ≥ 25, `CHECK` en BD) y virtuales (`is_virtual` siempre true).
2. Sin rostros/voces/identidades de personas reales: un modelo solo se activa con `likeness_attestation`.
3. Divulgación de IA obligatoria (`ai_disclosure`); los agentes nunca afirman ser humanos.
4. OnlyFans desactivado (`CHECK` en `social_accounts`). Solo APIs oficiales; nada de scraping.
5. Nunca marcar como publicado sin confirmación de la plataforma (`CHECK` en `publishing_calendar`).
6. No inventar métricas: `analytics.source` es obligatorio; sin datos se muestra cero.
7. Nada de pagos, reembolsos, compras ni publicaciones reales sin aprobación humana (`approvals` con hash del payload).
8. Secretos solo en servidor; tokens cifrados con AES-256-GCM (`src/server/security/crypto.ts`). Nunca `NEXT_PUBLIC_` para secretos.
9. Los modelos `is_demo` nunca actúan en plataformas reales.
10. No contratar servicios ni activar planes de pago. Ante costes, permisos de terceros o riesgo de suspensión: parar y preguntar.

## Arquitectura (ver docs/ARCHITECTURE.md)
- `db/migrations/NNNN_nombre.sql`: migraciones SQL. **Nunca edites una migración aplicada** (el runner compara checksums): crea una nueva.
- Esquema `vmf`. Rol `vmf_runtime` con RLS. Auditoría automática por triggers en `vmf.audit_log`.
- `src/server/db/context.ts`:
  - `withUserContext(userId, source, fn)` → `SET LOCAL ROLE vmf_runtime` + RLS. **Vía por defecto** para todo lo que haga el panel.
  - `withServiceContext(source, fn)` → propietario sin RLS. Solo autenticación, worker, scripts y registro de eventos.
  - **No anidar transacciones** (PGlite tiene una sola conexión: se bloquea). Haz la transacción de usuario y después la de servicio.
  - Errores de restricción dentro de una transacción: envolver con `withSavepoint`.
- `src/server/auth/`: `service.ts` (lógica pura y testeable), `session.ts` (cookies), `dal.ts` (`requireUser`, `requirePermission`, `asCurrentUser`). Toda página/acción protegida llama a la DAL; `src/proxy.ts` es solo optimista.
- Permisos: `src/server/auth/permissions.ts` (app) + políticas RLS (BD). Cambia ambos a la vez.
- Módulos de dominio: `src/server/modules/<módulo>/` (repository = SQL, service = reglas + permisos).
- Esquemas compartidos cliente/servidor: `src/lib/` (sin imports de servidor).
- UI: `src/components/ui` (componentes base), `src/components/shell` (navegación). Secciones no construidas: `ready: false` en `src/lib/navigation.ts` (se muestran deshabilitadas, nunca botones decorativos).

## Comandos
```
npm run dev            # PGlite en .data/pglite, migra solo
npm run db:migrate     # aplica migraciones (DATABASE_URL o PGlite)
npm run db:seed:demo   # 3 modelos DEMO (detén el servidor si usas PGlite)
npm run admin:create -- --email x@y.com --name "Nombre"
npm test               # unitarias + integración (PGlite en memoria)
TEST_DATABASE_URL=postgres://... npm test   # mismas pruebas contra PostgreSQL real (base desechable: se borra)
npm run build && npm run test:e2e           # Playwright escritorio + iPhone
npm run lint && npm run typecheck
```

## Definición de terminado
Una función no está terminada sin pruebas que pasen (`npm test`, `npm run test:e2e`, lint, typecheck, build).
Al cerrar cada fase: actualizar este archivo, README.md, docs/ROADMAP.md y las decisiones en docs/ARCHITECTURE.md.

## Estado actual
Fases 1 (fundación) y 2 (panel) completadas. Siguiente: Fase 3 (estudio creativo). Ver docs/ROADMAP.md.
