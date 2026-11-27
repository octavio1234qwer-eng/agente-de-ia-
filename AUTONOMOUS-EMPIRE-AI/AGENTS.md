# AGENTS

Nueve agentes definidos en `agents/<id>/agent.json` (misión, objetivos, acciones permitidas, límites, tareas) con instrucciones en `agents/<id>/INSTRUCTIONS.md` y lógica en `agents/<id>/handler.ts`. El orquestador (`core/orchestrator`) ejecuta cada tarea con:
- **Permisos:** el agente solo puede ejecutar acciones de su lista blanca y de nivel VERDE/AMARILLO; ROJO siempre exige autorización del propietario.
- **Idempotencia:** clave por tarea y periodo; una tarea exitosa no se repite.
- **Registro:** fila en `tasks` + entradas en `audit_log`.

| Agente | Tareas | Puede | No puede |
|---|---|---|---|
| empire-ceo | daily_cycle, weekly_cycle, monthly_cycle, executive_report | Orquestar, priorizar, informar, registrar decisiones | Gastar o aprobar |
| market-intelligence | add_opportunity, score_opportunities | Puntuar oportunidades con evidencia | Inventar datos de mercado |
| product-manager | validation_gate | Calcular compuertas G1–G3 | Construir sin `BUILD` |
| content-factory | draft_posts | Crear borradores originales (plantillas o Claude API si está autorizada) | Publicar |
| growth-manager | funnel_metrics | Medir embudo y enlaces | Comprar publicidad |
| customer-success | score_leads, plan_follow_ups | Puntuar leads, programar seguimiento, redactar borradores | Enviar correos sin aprobación |
| finance-controller | pnl_report, budget_check | P&L, alertas de pérdida y presupuesto | Gastar, reinvertir |
| risk-compliance | compliance_scan | Verificar auditoría, consentimiento, ingresos sin verificar, rechazar contenido prohibido | Borrar registros, publicar |
| engineering | health_check, check_affiliate_links | Salud del sistema, enlaces rotos | Desplegar o cambiar credenciales |

Ejecutar manualmente: Command Center → Agentes, o `npx tsx -e` con `runAgentTask`. Agregar un agente: crear la carpeta con los tres archivos y registrarlo en `core/agent-registry/index.ts`; la prueba `cada tarea declarada tiene manejador` valida la coherencia.
