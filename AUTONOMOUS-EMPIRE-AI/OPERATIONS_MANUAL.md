# OPERATIONS MANUAL

## Rutina diaria del propietario (10 minutos, desde el teléfono)
1. **Dashboard:** revisa prioridades del informe del EMPIRE CEO y alertas críticas.
2. **Decisiones:** aprueba o rechaza autorizaciones pendientes (gastos, etc.). Siempre con nota.
3. **Clientes potenciales:** revisa leads con score ≥ 60; aprueba o descarta los borradores de seguimiento; cambia estados tras cada contacto.
4. **Publicaciones:** aprueba o rechaza borradores; publica manualmente y marca "publicado" con la URL.

## Semanal
- Lee el informe semanal; decide si alguna unidad cambia de estado (Negocios → con justificación).
- Revisa Afiliados (enlaces rotos, clics) e importa el CSV de comisiones si hubo.

## Procedimientos
| Situación | Qué hacer |
|---|---|
| Alerta crítica de rutina fallida | Automatizaciones → ver error → "Forzar" tras corregir |
| Cadena de auditoría rota | No borrar nada. `npm run audit:verify`, identificar el registro, restaurar desde copia de Supabase, documentar en `PROJECT_STATE.md` |
| Lead pide BAJA / derechos ARCO | Marcar `lost`, descartar borradores; para cancelar datos, acción ROJA `data.delete_important` con autorización |
| Gasto necesario | Decisiones → Solicitar un gasto → aprobar → pagar fuera del sistema → "Registrar gasto realizado" con folio |
| Credencial expuesta | Rotarla en el proveedor y en Vercel/GitHub; registrar decisión |
| Nuevo operador | `npm run user:create -- --role operator` |

## Lo que el sistema NUNCA hace solo
Gastar dinero, contratar, comprar anuncios, mover fondos, publicar contenido, enviar correos no aprobados, borrar datos importantes, aceptar términos legales.
