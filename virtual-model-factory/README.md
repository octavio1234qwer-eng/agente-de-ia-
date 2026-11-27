# Virtual Model Factory AI

Sistema para administrar, desde un solo panel, una fábrica de **modelos virtuales ficticios y adultos** identificados como IA: identidades, personalidad, contenido, distribución autorizada, conversaciones transparentes, monetización y analíticas, con control por Telegram.

> Estado: **Fases 1 y 2 completadas** (fundación + panel). Las secciones de fases posteriores aparecen deshabilitadas en el menú con su número de fase. Ver [docs/ROADMAP.md](docs/ROADMAP.md).

## Qué funciona hoy
- **Autenticación propia** sobre PostgreSQL: contraseñas scrypt, sesiones con token aleatorio (solo se guarda su hash), expiración absoluta e inactividad, bloqueo tras 5 fallos, límites de intentos por IP y por correo, cierre de sesiones remotas, invalidación al cambiar la contraseña.
- **Roles** owner / admin / operator / viewer, aplicados en la app y en la base de datos (RLS). Operadores y lectores solo ven los modelos que se les asignan.
- **Base de datos**: 26 tablas (las 19 pedidas + sesiones, accesos por modelo, mensajes, ajustes, límites de solicitudes, auditoría), índices, RLS en todas, restricciones de seguridad (edad ≥ 25, divulgación de IA, OnlyFans desactivado, publicación solo con confirmación, neto calculado, duplicados por hash).
- **Auditoría automática** de cambios (quién, desde dónde, qué campos; nunca secretos) y registro de eventos de seguridad.
- **Panel** oscuro violeta/azul, responsive (probado en iPhone 15): dashboard con métricas reales, gestor de modelos (alta, edición, personalidad versionada, identidad visual, idiomas, estado con requisitos de activación), seguridad (sesiones, eventos, auditoría) y configuración (parada de emergencia, pausa de operaciones, carga de demo).
- **3 modelos de demostración** marcados como DEMO: Luna Vex, Aria Solenne, Dante Ríos.

## Inicio rápido (local, sin cuentas externas)
Requisitos: Node.js 20.9–24.
```bash
cd virtual-model-factory
npm install
cp .env.example .env.local
npm run secrets:generate      # copia SETUP_TOKEN y ENCRYPTION_KEY a .env.local
npm run dev                   # http://localhost:3000 → /setup crea el propietario
```
O por consola (con el servidor detenido): `npm run admin:create -- --email tu@correo.com --name "Tu nombre"` y `npm run db:seed:demo`.

Producción con Supabase: [docs/SETUP.md](docs/SETUP.md).

## Pruebas
```bash
npm test                 # 51 pruebas unitarias y de integración (BD, RLS, auth, permisos, módulos)
npm run build && npm run test:e2e   # 7 pruebas Playwright (escritorio + iPhone)
npm run lint && npm run typecheck
```

## Documentación
| Archivo | Contenido |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Reglas permanentes para Claude Code |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Subsistemas, datos, decisiones técnicas |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fases y estado |
| [docs/SETUP.md](docs/SETUP.md) | Instalación local y en Supabase/Vercel |
| [docs/SECURITY.md](docs/SECURITY.md) | Modelo de seguridad y cumplimiento |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | Plataformas, requisitos y estado |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Operación diaria, emergencias, copias |
