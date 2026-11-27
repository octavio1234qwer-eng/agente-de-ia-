# DEPLOYMENT GUIDE (costo $0)

## 1. Base de datos — Supabase (plan gratuito)
1. Crea un proyecto en supabase.com (región cercana, p. ej. `us-east`). Guarda la contraseña en tu gestor de contraseñas.
2. Project Settings → Database → *Connection string* → **Session pooler** (puerto 5432). Esa es tu `DATABASE_URL`.
3. En tu computadora: `cp .env.example .env`, pega `DATABASE_URL` y ejecuta `npm install && npm run db:migrate`.
4. Crea al propietario: `npm run user:create -- --email tu@correo --name "Tu nombre" --role owner` (pide la contraseña, mín. 12).
5. Supabase expone una API REST por tabla. La migración `002_rls.sql` activa RLS sin políticas en todas las tablas, así la API pública no puede leerlas; la app se conecta como dueña de las tablas y no se ve afectada. Verifica en *Table Editor* que todas muestren "RLS enabled".

## 2. Aplicación — Vercel (plan Hobby)
1. Importa el repositorio en Vercel. **Root Directory:** `AUTONOMOUS-EMPIRE-AI/apps/command-center`. Activa "Include files outside the root directory".
2. Install command: `cd ../.. && npm ci` · Build command: `cd ../.. && npm run build`.
3. Variables de entorno (Production): `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`, `ANALYTICS_SALT` (+ opcionales de `.env.example`).
   Genera secretos con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
4. Despliega y prueba `https://<dominio>/api/health` → `{"ok":true,"db":"pg"}`.

## 3. Rutinas — GitHub Actions
Settings → Secrets and variables → Actions:
- `EMPIRE_DATABASE_URL` (misma de Supabase), `EMPIRE_SESSION_SECRET`.
- Opcionales: `GUMROAD_ACCESS_TOKEN`, `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`.
Prueba: Actions → *Empire Routines* → Run workflow → `daily`.

## 4. Mercado Pago (cuando el propietario lo autorice)
Ver `API_INTEGRATIONS.md`. Agrega `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `PUBLIC_BASE_URL` en Vercel.

## Desarrollo local
```bash
npm install
npm run user:create -- --email yo@local.test --role owner   # PGlite en .data/ si no hay DATABASE_URL
npm run dev                                                  # http://localhost:3000
```
PGlite es solo para desarrollo (un proceso a la vez). Para producción siempre PostgreSQL.

## Verificación posterior al despliegue
- [ ] `/api/health` ok con `db: pg`
- [ ] `/cotizafacil` envía un lead de prueba y aparece en Clientes potenciales (luego márcalo `lost`)
- [ ] Login con bloqueo tras 5 intentos fallidos
- [ ] Workflow *Empire Routines* `daily` en verde y el informe visible en el Dashboard
- [ ] Seguridad → cadena de auditoría íntegra
