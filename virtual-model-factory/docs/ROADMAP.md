# Roadmap

| Fase | Contenido | Estado |
|---|---|---|
| 1. Fundación | Proyecto, arquitectura, BD (26 tablas, RLS, auditoría), autenticación, roles, seguridad, documentación | ✅ Completada |
| 2. Panel | Dashboard, gestor de modelos, 3 modelos demo, navegación responsive, seguridad y configuración | ✅ Completada |
| 3. Estudio creativo | Biblioteca de archivos (Supabase Storage), etiquetas, versiones, capa de proveedores de imagen/vídeo, control de calidad y políticas, duplicados (hash exacto + perceptual), registro de procedencia | ⏳ Siguiente |
| 4. Telegram | Bot con webhook verificado, vinculación de admin (`users.telegram_user_id`), comandos /start /dashboard /models /status /content /calendar /revenue /analytics /errors /pause /resume /help, aprobaciones y alertas | Pendiente |
| 5. Redes | Conectores Instagram/Facebook (Graph API), TikTok (Content Posting API), Telegram canal; OAuth + tokens cifrados; calendario; exportación manual; OnlyFans desactivado; evaluar Fanvue | Pendiente — requiere apps aprobadas por cada plataforma |
| 6. Monetización | Catálogo, pagos en modo prueba (proveedor compatible con contenido adulto/virtual), webhooks, ingresos, comisiones, gastos, informes | Pendiente — requiere elegir proveedor |
| 7. Automatización | Worker con `FOR UPDATE SKIP LOCKED`, reintentos con backoff, límites de frecuencia, pausa automática ante anomalías, agentes conversacionales con LLM intercambiable | Pendiente |
| 8. Producción | Pruebas integrales, auditoría de seguridad, CSP con nonces, MFA (TOTP), copias de seguridad, despliegue | Pendiente |

## Hecho en Fases 1–2 (pruebas)
- 51 pruebas Vitest (unitarias + integración en PGlite; 36 de integración verificadas también en PostgreSQL 16 con usuario no superusuario).
- 7 pruebas Playwright sobre la build de producción (escritorio 1440×900 e iPhone 15).

## Decisiones pendientes del propietario
- Proveedor de pagos (muchos prohíben contenido adulto; hay que elegir uno que lo permita explícitamente).
- Plataforma de suscripción para perfiles virtuales (p. ej. Fanvue admite creadores de IA con divulgación; verificar términos vigentes).
- Proveedores de generación de imagen/vídeo y LLM (coste y políticas de contenido).
