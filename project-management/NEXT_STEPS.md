# NEXT STEPS — instrucciones exactas para la próxima sesión

Al recibir **"CONTINUAR AUTO-INCOME AI"**:

1. Leer `project-management/*.md`. Ejecutar:
   ```bash
   cd auto-income && npm install && npm test && npm run typecheck
   ```
   Debe dar 33/33. Si algo falla, registrarlo en ERRORS.md y arreglarlo primero.

1b. Si hay acceso a Gumroad, correr la sincronización real para verificar ventas nuevas:
   `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` + tarea `finance.sync_gumroad`.

2. **Siguiente tarea exacta: crear `auto-income/apps/web`** (TASKS.md pendiente #1):
   - `npm create vite@latest` equivalente manual: React + TypeScript + Vite + Tailwind CSS (paquete propio `apps/web/package.json`, no afecta al backend sin dependencias).
   - Proxy de desarrollo `/api` y `/health` → `http://localhost:8787`. En producción la API ya sirve `apps/web/dist` (ver `serveStatic` en `apps/api/src/app.ts`).
   - Cliente API: `fetch` con `credentials: 'same-origin'`, cabecera `x-csrf-token` (obtenido de `/api/auth/me` o del login), `content-type: application/json`.
   - Pantallas en este orden: Setup/Login → Dashboard (datos de `GET /api/dashboard?period=`) → Negocios → Tareas y aprobaciones (`/api/tasks`, approve/cancel/retry) → Agentes → Notificaciones → Búsqueda global.
   - Estilo: oscuro, azul eléctrico (#3b82f6) + violeta (#8b5cf6), móvil primero (menú inferior/hamburguesa en iPhone), estados vacíos explícitos ("Sin datos todavía"), nunca cifras inventadas.
   - CSP actual: `script-src 'self'`, `style-src 'self' 'unsafe-inline'` → no usar scripts inline ni CDNs.
   - Verificar con Playwright (preinstalado) en viewport iPhone: login, dashboard en cero, crear negocio.

3. Después: CotizaFácil UI (calculadoras + editor de cotización + vista imprimible PDF por `window.print()` + botón WhatsApp + historial), luego CRM, Product Studio, Analytics, Configuración.

4. Al cerrar la sesión: actualizar PROJECT_STATE, TASKS, CHANGELOG, ERRORS, DECISIONS; commit y push a `claude/auto-income-ai-setup-dw8nr1`.

## Cómo probar la API manualmente
```bash
cd auto-income
OWNER_SETUP_TOKEN=un-token-largo-de-prueba SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))") npm start
# POST /api/auth/setup {setupToken, email, name, password}
```
