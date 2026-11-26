# Plataforma de cursos online · Guía de instalación

Gracias por tu compra. Este kit es una academia online completa: tienda de cursos con pagos para México, aula virtual, certificados verificables, tutor con IA y panel de administración. Todo el código es tuyo para usarlo en tus proyectos (ver `LICENCIA.md`).

> Lee esta guía de principio a fin una vez antes de empezar. El archivo `README.md` tiene el detalle técnico de cada paso.

---

## 1. Qué incluye

**Para tus alumnos**
- Catálogo con búsqueda, filtros y página de cada curso (temario, instructor, reseñas).
- Registro e inicio de sesión con correo (confirmación y recuperación de contraseña).
- Carrito, cupones y pago con **Stripe**, **Mercado Pago** y **PayPal** (datos de facturación RFC opcionales). La tarjeta nunca toca tu servidor.
- Aula virtual: video (archivo propio, YouTube o Vimeo), lecturas, evaluaciones, recursos descargables, progreso, subtítulos, notas personales con marcas de tiempo y búsqueda dentro de sus cursos.
- Preguntas y respuestas en cada lección: los alumnos preguntan y se ayudan entre sí, tus respuestas se destacan como «Equipo» y el alumno recibe un aviso por correo.
- Tutor con IA (Claude de Anthropic) que responde sobre la lección que el alumno está viendo.
- Certificados en PDF con QR, página pública de verificación y botón para agregarlos a LinkedIn.
- Racha de estudio, meta semanal y descarga de sus datos personales (derechos ARCO).

**Para ti (panel `/admin`)**
- Cursos, módulos, lecciones (editor Markdown), videos con subida reanudable, recursos y evaluaciones.
- Liberación programada: cada módulo puede abrirse N días después de que el alumno se inscribe (por ejemplo, una semana por módulo).
- Bandeja de preguntas de alumnos (sin responder, todas, ocultas) con moderación.
- Avisos por curso (novedades, sesiones en vivo, material nuevo) que tus alumnos ven en el aula y, si quieres, reciben por correo.
- Categorías, instructores, paquetes de cursos, cupones, reseñas y alumnos (otorgar o quitar acceso).
- Pedidos con reembolsos, reporte de ingresos por producto, exportación a CSV.
- Dashboard con ventas, conversión, alumnos y actividad de estudio; embudo por curso (en qué lección se detienen).
- Correos automáticos (bienvenida, compra, certificado, recordatorios, carritos abandonados, aviso de racha, respuestas a preguntas, avisos del curso) y campañas con baja de un clic.

**Calidad**: pruebas de base de datos (pgTAP), unitarias y de navegador incluidas (`README.md`, sección «Pruebas»), auditoría de accesibilidad WCAG 2.1 y seguridad por filas (RLS) en todas las tablas.

---

## 2. Lo que necesitas

| Servicio | Para qué | ¿Obligatorio? |
| --- | --- | --- |
| [Supabase](https://supabase.com) | Base de datos, usuarios y archivos | Sí (tiene plan gratuito para empezar) |
| [Vercel](https://vercel.com) | Publicar el sitio | Sí (tiene plan gratuito para empezar) |
| Cuenta de GitHub | Subir tu copia del código y conectarla a Vercel | Sí |
| Stripe, Mercado Pago y/o PayPal | Cobrar | Al menos uno para vender cursos de pago |
| [Resend](https://resend.com) | Enviar correos desde tu dominio | Recomendado |
| [Anthropic](https://console.anthropic.com) | Tutor con IA | Opcional |
| Un dominio | Tu dirección web | Recomendado |

Cada proveedor cobra sus propias tarifas (por ejemplo, comisiones por venta en los procesadores de pago y consumo del modelo de IA). Revisa sus páginas de precios.

Para probarlo en tu computadora necesitas además **Node.js 20 o superior** y **Docker**.

---

## 3. Pruébalo primero en tu computadora (opcional, 15 minutos)

```bash
npm install
npm run dev:up                                     # levanta Supabase local y el sitio
node scripts/create-admin.mjs tu@correo.com UnaClaveSegura123
```

Abre http://localhost:3000 (sitio) y http://localhost:3000/admin (panel). Viene con un catálogo de ejemplo para que veas todo funcionando.

---

## 4. Publicarlo (paso a paso)

1. **Sube el código a un repositorio privado de GitHub.**
2. **Supabase**: crea un proyecto y aplica la base de datos:
   ```bash
   npx supabase login
   npx supabase link --project-ref TU_PROJECT_REF
   npx supabase db push
   ```
   Luego sigue el `README.md`, sección **3.1** (URL del sitio, plantillas de correo, confirmación de correo y SMTP).
3. **Vercel**: importa el repositorio. Si el proyecto está en una subcarpeta, indícala en *Root Directory*. Copia las variables de `.env.example` en *Environment Variables* (mínimo: URL del sitio, claves de Supabase, `CRON_SECRET` y `UNSUBSCRIBE_SECRET`). Despliega.
4. **Crea tu administrador** con `scripts/create-admin.mjs` (README, sección 3.2, paso 5).
5. **Pagos**: activa los proveedores que vayas a usar (README, sección 4). Cada uno tiene su webhook ya programado y verificado; solo pegas la URL y la clave. Haz una compra de prueba en modo sandbox antes de cobrar de verdad.
6. **Correo e IA**: agrega `RESEND_API_KEY` / `EMAIL_FROM` y, si quieres el tutor, `ANTHROPIC_API_KEY`. El panel muestra qué integraciones están activas.

Si algo falla, el panel y las páginas muestran mensajes claros: la plataforma nunca finge un pago ni un correo enviado cuando falta una clave.

---

## 5. Hazla tuya

- **Nombre, tutor y lema**: variables `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_AI_NAME` y `NEXT_PUBLIC_SITE_TAGLINE`. Cambian en todo el sitio, los correos, los certificados y los cobros.
- **Colores**: `src/app/globals.css`, bloque `@theme`.
- **Logotipo**: `src/components/layout/logo.tsx`.
- **Correos de Supabase** (confirmación y recuperación): `supabase/templates/`.
- **Páginas legales** (términos, privacidad, reembolsos): son plantillas; complétalas con tus datos y revísalas con un asesor.
- **Cursos e instructores de ejemplo**: edítalos o archívalos desde el panel, o no cargues `supabase/seed.sql` en producción.

---

## 6. Soporte e instalación

- ¿Dudas con la instalación? Responde al correo de tu compra.
- **¿Prefieres que te la deje funcionando** con tu dominio, tu marca y tus pagos? Escríbeme respondiendo al correo de compra y te envío una cotización.
