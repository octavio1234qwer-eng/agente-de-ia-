# Integraciones

Principio: solo APIs oficiales y autorizadas. Si una integración no está autorizada, el contenido se exporta para publicación manual (`publishing_calendar.status = 'exported_manual'`). Nunca se simula una publicación exitosa.

| Plataforma | Mecanismo oficial | Requisitos | Estado |
|---|---|---|---|
| Telegram (bot admin) | Bot API + webhook con `X-Telegram-Bot-Api-Secret-Token` | Crear bot con @BotFather, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ADMIN_CHAT_IDS` | Fase 4 |
| Instagram / Facebook | Meta Graph API (Instagram Content Publishing, Pages API), OAuth | App de Meta en modo Live con revisión de permisos (`instagram_content_publish`, `pages_manage_posts`…), cuenta profesional. Las políticas de Meta prohíben desnudos y servicios sexuales: solo contenido apto | Fase 5 |
| TikTok | Content Posting API, OAuth | App aprobada por TikTok; auditoría para publicar en público. Contenido apto y etiqueta de contenido generado por IA | Fase 5 |
| Telegram (canal) | Bot API (`sendPhoto`, `sendMessage`) | Bot administrador del canal | Fase 5 |
| OnlyFans | — | No admite perfiles totalmente sintéticos: **desactivado** por restricción en BD | Bloqueado |
| Fanvue (alternativa) | Por evaluar | Admite creadores de IA con divulgación; verificar API y términos vigentes antes de integrar | A evaluar con el propietario |
| Pagos | Por decidir | Proveedor que permita explícitamente contenido adulto/virtual; modo prueba primero | Fase 6 |
| Generación de imagen/vídeo y LLM | Adaptadores intercambiables | Claves del proveedor elegido, límites de gasto | Fases 3 y 7 |

## Cómo se guardarán las credenciales
Tokens OAuth cifrados (`social_connections.access_token_enc`, AES-256-GCM con `ENCRYPTION_KEY`), sin lectura posible desde el rol `vmf_runtime`; renovación automática antes de `token_expires_at`; errores registrados en `last_error`.
