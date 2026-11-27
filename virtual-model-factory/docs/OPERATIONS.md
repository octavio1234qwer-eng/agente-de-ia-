# Operación

## Día a día
- **Dashboard**: estado (operativa / detenida), modelos activos, aprobaciones, cola, errores 24 h y finanzas del mes (USD). Sin datos reales, todo en cero.
- **Modelos**: crear como borrador → completar biografía (20+ caracteres), personalidad con límites y declaración de identidad → Activar. Pausar o archivar en cualquier momento.
- **Roles**: owner (todo, usuarios, demo), admin (todos los modelos, estado, emergencias), operator (edita modelos asignados), viewer (lectura de asignados). Asignación: tabla `user_model_access` (pantalla de usuarios en fase posterior; mientras tanto, por SQL como propietario).

## Emergencias
1. **Configuración → Parada de emergencia** (con motivo): detiene todas las automatizaciones; aparece un banner rojo en todo el panel.
2. Revisa **Seguridad**: eventos y auditoría.
3. Revoca sesiones sospechosas; si hay sospecha de fuga, rota `ENCRYPTION_KEY`/contraseñas y desactiva usuarios.
4. Desactiva la parada solo tras resolver la causa (queda registrado).

La **pausa de operaciones** es la versión suave (mantenimiento), equivalente a `/pause` de Telegram.

## Salud
`GET /api/health` → `{"status":"ok","database":"postgres"|"pglite"}` o 503.

## Migraciones
`npm run db:migrate` es idempotente y falla si una migración aplicada fue modificada. Haz copia antes de migrar en producción.

## Copias de seguridad
- Supabase Free: copias diarias gestionadas por Supabase (consulta la retención de tu plan). Recomendado además: `pg_dump --schema=vmf --schema=vmf_meta "$DATABASE_URL" > backup.sql` semanal guardado cifrado fuera del servidor.
- Local: copia la carpeta `.data/pglite` con el servidor detenido.

## Mantenimiento periódico (se automatizará en la Fase 7)
```sql
delete from vmf.sessions where expires_at < now() - interval '30 days' or revoked_at < now() - interval '30 days';
delete from vmf.rate_limits where window_start < now() - interval '1 day';
```
