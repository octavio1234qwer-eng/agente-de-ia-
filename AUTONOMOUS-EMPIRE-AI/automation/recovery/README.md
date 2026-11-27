# Recuperación
- Rutina fallida: se reintenta en el siguiente disparo del periodo o con `npm run routine -- <rutina> --force`.
- Ejecución colgada: se reclama automáticamente tras 2× el tiempo límite.
- Integridad: `npm run audit:verify`. Ver OPERATIONS_MANUAL.md.
