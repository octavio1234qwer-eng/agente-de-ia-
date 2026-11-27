# Instalación

## 1. Local (sin cuentas externas)
```bash
cd virtual-model-factory
npm install
cp .env.example .env.local
npm run secrets:generate   # pega ENCRYPTION_KEY y SETUP_TOKEN en .env.local
npm run dev
```
Abre http://localhost:3000 → te redirige a `/setup`. Introduce el `SETUP_TOKEN`, tu nombre, correo y contraseña (12+ caracteres). Después, en **Configuración → Cargar modelos de demostración**.

La base vive en `.data/pglite` (no se sube a git). Para reiniciarla: detén el servidor y borra esa carpeta.
Los scripts (`db:seed:demo`, `admin:create`) abren la misma carpeta: **ejecútalos con el servidor detenido**.

## 2. Supabase (producción, plan gratuito)
1. Crea un proyecto en supabase.com (plan Free). Guarda la contraseña de la base.
2. *Project Settings → Database → Connection string → Session pooler* (puerto 5432). Cópiala en `DATABASE_URL`.
3. TLS: descarga el certificado en *Database → SSL Configuration* y pon su contenido (o base64) en `DATABASE_SSL_CA`; deja `DATABASE_SSL_MODE` vacío (verify-full). `require` cifra sin verificar el certificado: solo como último recurso.
4. Aplica las migraciones desde tu equipo: `npm run db:migrate`.
5. Crea el propietario: `npm run admin:create -- --email tu@correo.com --name "Tu nombre"` (o `SETUP_TOKEN` + `/setup`).
6. No hace falta activar la Data API ni usar las claves `anon`/`service_role`: el esquema `vmf` no se expone y el acceso es solo desde el servidor.

## 3. Despliegue (Vercel, plan Hobby)
1. Importa el repositorio y fija *Root Directory* = `virtual-model-factory`.
2. Variables: `DATABASE_URL`, `DATABASE_SSL_CA`, `ENCRYPTION_KEY`, `TRUST_PROXY_HEADERS=true`, y `SETUP_TOKEN` solo hasta crear el propietario.
3. Despliega. Comprueba `https://tu-dominio/api/health` → `{"status":"ok","database":"postgres"}`.
> Revisa los términos de uso de tu proveedor de hosting respecto a contenido adulto antes de operar en producción.

## Variables
Ver `.env.example` (cada una está comentada).
