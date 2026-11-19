# AUTO-INCOME AI

Ecosistema modular para crear y operar negocios digitales con agentes, orquestador de tareas, CRM, cotizaciones (CotizaFácil MX), Product Studio, analítica y pagos. Backend en TypeScript ejecutado directamente por Node ≥ 22.18, **sin dependencias de runtime**, base de datos SQLite integrada.

> Estado: backend v0.1.0 probado. La interfaz web está pendiente. No está desplegado en ninguna URL.

## Requisitos
- Node.js 22.18 – 24 (probado con 22.23).

## Uso
```bash
cd auto-income
npm install          # solo instala typescript/@types para typecheck
npm test             # 31 pruebas
npm run typecheck
cp .env.example .env # completa SESSION_SECRET y OWNER_SETUP_TOKEN
npm start            # http://localhost:8787/health
```
Node no lee `.env` automáticamente: exporta las variables o usa `node --env-file=.env` (ajusta el script si lo prefieres).

### Primer acceso (crear propietario)
`POST /api/auth/setup` con `{ "setupToken": "<OWNER_SETUP_TOKEN>", "email": "...", "name": "...", "password": "mínimo 10 caracteres con letras y números" }`. Después **borra `OWNER_SETUP_TOKEN`** del entorno.

## Módulos
| Carpeta | Contenido |
|---|---|
| `packages/core` | Precios (margen vs recargo), cotizaciones, scoring de oportunidades, autonomía — fórmulas en `docs/FORMULAS.md` |
| `packages/agents` | Orquestador de tareas y 10 agentes |
| `packages/database` | SQLite + migraciones |
| `packages/security` | Contraseñas, CSRF, HMAC, rate limit, permisos |
| `packages/integrations` | `PaymentProvider` (demo + webhook HMAC) |
| `packages/analytics` | Métricas financieras y de tráfico |
| `apps/api` | Servidor HTTP + worker |

## Seguridad
- Cookies HttpOnly + SameSite=Strict, token CSRF (`x-csrf-token`) en peticiones que modifican datos.
- Roles: owner, admin, viewer. Rate limiting por IP (login 10/15 min).
- Las ventas solo cuentan cuando el proveedor las confirma por webhook firmado; el modo DEMO nunca cuenta.
- Dinero, datos sensibles, acciones irreversibles y mensajes externos siempre requieren aprobación del propietario.
