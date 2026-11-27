# DEPLOYMENT GUIDE (costo $0)

## Estado actual (2026-11-27)
Ya hecho por Claude:
- Proyecto **`empire-ai`** creado en tu Vercel (equipo `octavio`): Next.js, Node 22, carpeta raíz `AUTONOMOUS-EMPIRE-AI/apps/command-center`, install `cd ../.. && npm ci`, build `cd ../.. && npm run build`.
- Variables de producción cargadas: `SESSION_SECRET`, `CRON_SECRET`, `ANALYTICS_SALT` (sensibles) y `SETUP_TOKEN` (cifrada, visible en Settings → Environment Variables).
- Cron de Vercel definido en `apps/command-center/vercel.json` (diario, "hourly" una vez al día por límite del plan Hobby, semanal y mensual). Vercel envía `Authorization: Bearer CRON_SECRET` automáticamente.
- La app acepta `DATABASE_URL` o `POSTGRES_URL` (la que inyectan Neon/Supabase del Marketplace de Vercel) y aplica migraciones y semilla al arrancar.

## Lo que falta (solo el propietario puede hacerlo)
1. **Conectar GitHub a Vercel** (Vercel no pudo enlazar el repo: "add a Login Connection to your GitHub account").
   Vercel → Account Settings → Authentication → GitHub → Connect. Luego `empire-ai` → Settings → Git → Connect Git Repository → `octavio1234qwer-eng/agente-de-ia-`.
   El código está en la rama `claude/blissful-thompson-oeu79g`: fusiónala a `main` (o pide a Claude el pull request) o en Settings → Environments → Production → *Branch Tracking* pon esa rama.
2. **Base de datos gratuita:** `empire-ai` → Storage → Create Database → **Neon** (plan Free) → conectar al proyecto (entornos Production y Preview). Esto inyecta la conexión. Luego Deployments → Redeploy.
3. **Crear tu usuario:** abre `https://<tu-dominio>/setup`, escribe el código `SETUP_TOKEN` y tu correo/contraseña. La página se desactiva sola después.

Verificación: `https://<tu-dominio>/api/health` → `{"ok":true,"db":"pg"}`.

## Alternativa: Supabase
Si prefieres Supabase: crea el proyecto, copia la cadena *Session pooler* y agrégala en Vercel como `DATABASE_URL`. La migración `002_rls.sql` protege las tablas de la API REST pública de Supabase.

## Rutinas
- Principal: Vercel Cron (sin configuración extra).
- Alternativa: `.github/workflows/empire-routines.yml` (requiere el secreto `EMPIRE_DATABASE_URL`; sin él no hace nada).

## Desarrollo local
```bash
npm install
npm run user:create -- --email yo@local.test --role owner   # PGlite en .data/ si no hay DATABASE_URL
npm run dev                                                  # http://localhost:3000
```
