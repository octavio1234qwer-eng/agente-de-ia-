# Producto: problemas reales por los que las pymes pagarían

Este documento explica por qué existen estas herramientas, a quién van dirigidas, cómo se definieron los precios y cómo validar con datos reales que la gente pague. Las cifras de precios son **hipótesis de partida**: el panel de administración está pensado para confirmarlas o corregirlas en las primeras semanas.

## Cliente objetivo

1. **Micro y pequeños negocios con atención por WhatsApp**: restaurantes, pastelerías, estéticas, consultorios, talleres y tiendas. Hay una o dos personas atendiendo mensajes, redes y cobranza, además de operar el negocio.
2. **Vendedores en línea**: personas que venden en Mercado Libre, Amazon, Shopify o Instagram y publican muchos productos.
3. **Profesionistas independientes y agencias pequeñas**: diseñadores, contadores, consultores y desarrolladores que cotizan, dan seguimiento y cobran.

Qué tienen en común: el tiempo del dueño es el recurso más escaso, pagan con tarjeta o transferencia en pesos y no van a aprender a escribir prompts. Quieren un formulario corto y un resultado listo para copiar.

## Problemas y cómo los resuelve cada herramienta

| # | Problema (dolor) | Costo para el negocio | Herramienta | Por qué pagarían |
|---|---|---|---|---|
| 1 | Mensajes de clientes sin contestar o contestados tarde, a deshoras | Ventas perdidas: el cliente le escribe a otro negocio | Respuestas a clientes | Ahorra tiempo diario y cierra más ventas. Es el uso más frecuente |
| 2 | Reseñas negativas sin responder o respondidas a la defensiva | Peor reputación en Google Maps y menos visitas | Respuesta a reseñas | Responder bien bajo presión es difícil; pesa en la decisión de clientes nuevos |
| 3 | Fichas de producto pobres en marketplaces | Baja conversión y mal posicionamiento en búsquedas | Fichas de producto | Se usa por volumen: decenas de productos al mes |
| 4 | Cobrar da pena o se hace con mensajes agresivos | Flujo de efectivo apretado, clientes molestos | Mensajes de cobranza | Recuperar una sola factura paga meses de suscripción |
| 5 | Cotizaciones en un mensaje de WhatsApp o en una hoja improvisada | Se pierden contratos contra competidores más profesionales | Cotizaciones y propuestas | Relación directa con ingresos; buen motivo para el plan Pro |
| 6 | No hay tiempo ni ideas para publicar en redes | Poca visibilidad y dependencia de la recomendación de boca en boca | Contenido para redes | Sustituye parte del trabajo de un community manager |
| 7 | Contratos, arrendamientos y minutas largas que se firman sin leer | Penalizaciones y obligaciones inesperadas | Resumen de documentos | Ayuda a decidir antes de firmar. **No sustituye a un abogado** y la herramienta lo dice |
| 8 | Correos desordenados con proveedores, bancos y clientes | Malentendidos y retrasos | Correos profesionales | Uso frecuente y de bajo costo; ayuda a retener usuarios |

### Por qué no un chat genérico

- **Formato correcto a la primera**: cada herramienta ya sabe qué entregar (dos opciones de respuesta, título de 60 caracteres para Mercado Libre, propuesta con IVA, etc.).
- **Reglas de negocio integradas**: no inventa precios ni políticas, marca con corchetes los datos que faltan, la cobranza no amenaza ni menciona el buró y los resúmenes no se presentan como asesoría legal.
- **Contexto mexicano**: español de México, pesos, IVA del 16 % y fechas comerciales como el Buen Fin o el Día de Muertos.
- **Historial y reutilización**: lo que funcionó se vuelve a usar con un clic.

## Precios (hipótesis inicial)

| Plan | Precio | Créditos al mes | Para quién |
|---|---|---|---|
| Gratis | $0 | 25 | Probar el valor; herramientas de uso diario |
| Pro | $199 MXN con IVA | 500 | Negocio con atención diaria; desbloquea cotizaciones, cobranza, redes y documentos |
| Negocio | $499 MXN con IVA | 2,000 | Varios productos o clientes al día; documentos largos |

Razonamiento:

- **Ancla de valor**: un solo cliente recuperado o una cotización ganada vale más de $199. Frente a contratar a una persona, la suscripción cuesta una fracción.
- **Gratis limitado pero útil**: 25 créditos alcanzan para notar el ahorro de tiempo sin regalar el uso intensivo. Las herramientas con más relación con el dinero (cotizar y cobrar) están en Pro.
- **Créditos en lugar de tokens**: el usuario entiende "usos", no tokens. Las herramientas largas cuestan 2 créditos.

### Margen por usuario (calcula con tus datos)

El costo de IA por generación es `(tokens de entrada × precio de entrada + tokens de salida × precio de salida) / 1,000,000`. El panel de administración muestra los tokens reales de los últimos 30 días; si configuras `AI_COST_INPUT_USD_PER_MTOK` y `AI_COST_OUTPUT_USD_PER_MTOK` con los precios vigentes de tu modelo, también muestra el costo estimado.

Ejemplo **con supuestos** que debes reemplazar: una generación promedio de 1,500 tokens de entrada y 700 de salida, con un modelo de US$1 por millón de entrada y US$5 por millón de salida, cuesta US$0.005. Un usuario Pro que agota sus 500 créditos costaría alrededor de US$2.50 al mes; a un tipo de cambio supuesto de 20 MXN/USD son $50 MXN, frente a $171.55 MXN de ingreso antes de IVA. Resta la comisión de Stripe (consulta la tarifa vigente para México en stripe.com/mx/pricing) y el alojamiento. La mayoría de los usuarios no agota sus créditos, así que el margen real suele ser mayor. Revísalo cada mes en el panel.

## Cómo validar que la gente paga (primeras 6 semanas)

1. **Semana 1–2: entrevistas y demo.** Muestra la plataforma a 10–15 negocios del cliente objetivo. Pregunta cuánto tiempo dedican hoy a cada tarea y cuánto pagan por resolverla (personas, agencias, otras apps).
2. **Semana 2–4: lanzamiento con el plan gratuito.** Mide en el panel:
   - **Activación**: porcentaje de registros que confirman su correo y hacen su primera generación. Meta: más de 40 %.
   - **Herramientas más usadas**: dónde está el dolor real. Prioriza mejorar esas.
   - **Agotamiento del plan gratuito**: quién llega a 25 créditos es tu mejor prospecto de pago.
3. **Semana 4–6: conversión.** Meta inicial de conversión de Gratis a pago: 2–5 %. Si es menor, revisa qué herramientas están detrás del muro de pago y el precio. Si es mayor, prueba subir el precio en cohortes nuevas.
4. **Retención**: cancelaciones en 30 días (panel) y, en Stripe, pagos fallidos. Un cobro fallido no es una cancelación voluntaria: el correo automático ayuda a recuperarlo.

## Plan de trabajo sugerido

Ordenado por impacto esperado en ingresos:

1. **Integración con WhatsApp Business** (la carpeta raíz de este repositorio ya tiene un agente de WhatsApp para restaurante): responder desde la plataforma o automatizar respuestas frecuentes. Es la evolución natural de "Respuestas a clientes" y justificaría un plan superior.
2. **Perfil del negocio guardado**: datos, tono y políticas capturados una vez y usados por todas las herramientas. Menos fricción y mejores resultados.
3. **Pagos locales**: OXXO y transferencia SPEI con Stripe, o Mercado Pago como segundo proveedor. Por ahora el administrador puede asignar planes manualmente con fecha de vencimiento.
4. **Facturación CFDI automática** con un PAC (por ejemplo Facturapi o Facturama) al recibir `invoice.paid`.
5. **Planes anuales** con descuento, para mejorar el flujo de efectivo y reducir cancelaciones.
6. **Cuentas de equipo** (varios usuarios por negocio) para el plan Negocio.
7. **Cola de trabajos** para generaciones largas cuando el tráfico crezca.

## Mercado global

La plataforma ya se puede vender fuera de México:

- **Clientes objetivo fuera de México**: pymes y freelancers de EE. UU. (incluido el mercado hispano), Latinoamérica y España, que atienden clientes por WhatsApp, venden en marketplaces o facturan servicios.
- **Precio en dólares**: Pro $12 USD y Negocio $29 USD al mes (más impuestos). Es una hipótesis: compárala con alternativas locales y ajústala con `PLAN_*_PRICE_USD` y `npm run stripe:setup`.
- **Diferenciador internacional**: un mismo negocio puede contestar a turistas o clientes extranjeros en su idioma (6 idiomas) sin saber ese idioma.
- **Impuestos**: al vender a otros países pueden aplicar IVA/VAT o sales tax del cliente. Activa Stripe Tax y `STRIPE_AUTOMATIC_TAX=true`, y consulta a tu contador sobre tus obligaciones.
- **Canales sugeridos**: Product Hunt y comunidades de vendedores de Amazon/Etsy en inglés; grupos de emprendedores y agencias en Latinoamérica; alianzas con agencias que ya venden agentes de WhatsApp.
- **Qué medir**: en el panel, usuarios por idioma e ingresos por moneda; si un país crece, prioriza su idioma, métodos de pago locales y testimonios de ese mercado.
