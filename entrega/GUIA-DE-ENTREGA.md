# Bio link · La Casa de la Mantarraya

**Guía de entrega.** Todo lo que hay que saber para publicar la página, ponerla en Instagram, imprimir los QR de las mesas y cambiar horarios, precios o promociones sin programar.

---

## 1. Qué se entrega

| Carpeta o archivo | Para qué sirve |
|---|---|
| `LEEME - Guia de entrega.pdf` | Esta guía. |
| `1 - Sitio para subir a Hostinger` | La página completa. Su contenido se sube tal cual al hosting. |
| `2 - QR y tarjeton para imprimir` | Tarjetón para mesas de 10 × 15 cm (PDF para imprenta) y el QR suelto en PNG y SVG. |
| `3 - Capturas` | Cómo se ve en celular (español e inglés) y en computadora. |
| `4 - Reportes Lighthouse` | Reportes de velocidad y calidad de Google Lighthouse (se abren con el navegador). |

**Qué hace la página:**

- **Reserva por WhatsApp:** el cliente elige personas, día y hora, y el mensaje le llega ya armado al WhatsApp del restaurante.
- **Estado en vivo:** con la hora de Cancún muestra "Abierto ahora · cierra a las 11 p. m." o "Abrimos mañana a las 8 a. m.". Los viernes y sábados por la noche avisa "Esta noche: salsa en vivo".
- **Carrusel de platillos:** fotos reales y precios del menú oficial.
- **Accesos rápidos:** cómo llegar, noches de salsa, desayunos, la promoción del momento (Posadas 2026) y las reseñas de Google.
- **Dos idiomas:** español e inglés, con un botón para cambiar.
- **Guardar contacto y compartir:** botón que descarga la tarjeta del restaurante al celular y botón para compartir la página.
- **Lista para Google y redes:** imagen para cuando se comparte el enlace (WhatsApp, Facebook) y datos de restaurante para Google.
- **QR para mesas:** con el logo original y los colores de la marca.

---

## 2. Antes de publicar: confirmar 3 datos con el restaurante

Estos datos se tomaron de fuentes públicas, pero no coinciden entre sí. Confírmalos con el dueño y, si hace falta, cámbialos en `js/data.js` (ver sección 5).

1. **Horario.** El sitio oficial dice de **8:00 a. m.** a 11:00 p. m. (viernes y sábado, hasta medianoche), y es lo que trae la página. Google y algunos directorios dicen que abren a la **1:00 p. m.**
2. **Noches de salsa.** La página dice **viernes y sábado de 8 a 11 p. m.** La sección de promociones del sitio oficial solo menciona los "sábados de salsa" (y los viernes de cumpleaños).
3. **Ceviche negro.** Aparece "desde $370", que es el precio del menú oficial (ceviche negro de pescado). El mixto cuesta $390.

---

## 3. Cómo publicarlo en Hostinger (recomendado)

El sitio del restaurante ya está en Hostinger, así que el bio link queda en su mismo dominio: **https://casadelamantarraya.com/links/**. El QR y la imagen para redes ya vienen configurados con esa dirección, así que no hay que cambiar nada.

1. Entra a **hPanel** → **Sitios web** → `casadelamantarraya.com` → **Administrador de archivos**.
2. Abre la carpeta **`public_html`** y crea una carpeta nueva llamada **`links`** (en minúsculas).
3. Entra a `links` y sube **todo lo que hay dentro** de la carpeta `1 - Sitio para subir a Hostinger` (no la carpeta en sí, sino su contenido). Puedes arrastrarlo a la ventana o usar el botón **Subir** → **Carpeta**/**Archivo**.
   - Si descargaste esta entrega desde Google Drive y te llegó como un archivo `.zip`, sube ese `.zip` a `links`, haz clic derecho → **Extraer**, y mueve el contenido de `1 - Sitio para subir a Hostinger` directamente a `links`.
4. Dentro de `public_html/links/` deben quedar: `index.html`, `.htaccess`, `_headers`, `contacto.vcf`, y las carpetas `assets`, `css`, `js` y `qr`.
5. Abre **https://casadelamantarraya.com/links/** en el celular y prueba: el botón "Reservar mesa", el carrusel, "Cómo llegar" y el cambio de idioma.

> El archivo `.htaccess` comprime la página y guarda las fotos en caché para que cargue más rápido. Si el administrador de archivos no lo muestra, activa "Mostrar archivos ocultos".

### Alternativa: Netlify (gratis)

1. Entra a **app.netlify.com/drop** y arrastra la carpeta `1 - Sitio para subir a Hostinger`.
2. Netlify te da una dirección (por ejemplo `mantarraya.netlify.app`).
3. Como la dirección cambió, abre `js/data.js` y cambia `SITE_URL`. Después abre `index.html` y reemplaza todas las veces que aparece `https://casadelamantarraya.com/links/` por la dirección nueva. Vuelve a arrastrar la carpeta a Netlify.
4. Abre `https://TU-DIRECCION/qr/` y descarga el QR nuevo. **No imprimas el tarjetón incluido**, porque apunta a la dirección de Hostinger.

---

## 4. Ponerlo en Instagram, Facebook y TikTok

- **Instagram:** Perfil → **Editar perfil** → **Enlaces** → **Agregar enlace externo**. URL: `https://casadelamantarraya.com/links/`. Título sugerido: *Reserva y menú*.
- **Facebook:** en la página del restaurante → **Editar** → **Sitio web**: `https://casadelamantarraya.com/links/?src=facebook`
- **TikTok** (cuenta de empresa): **Editar perfil** → **Sitio web**: `https://casadelamantarraya.com/links/?src=tiktok`

La terminación `?src=...` sirve para saber de qué red llegó cada visita: todos los enlaces que van al sitio oficial llevan esa etiqueta (`utm_source`). Sin terminación cuenta como Instagram, y el QR de las mesas ya trae `?src=qr`.

---

## 5. Cómo cambiar horarios, precios y la promoción (sin programar)

Todo lo editable está en **un solo archivo: `js/data.js`**. En Hostinger: Administrador de archivos → `public_html/links/js/data.js` → clic derecho → **Editar**. Guarda y recarga la página.

**Reglas:** cambia solo lo que está entre comillas `"..."` o los números. No borres comas, llaves `{ }` ni corchetes `[ ]`. Las horas van en formato de 24 horas (`"20:00"` = 8 p. m.); para la medianoche usa `"24:00"`.

**Cambiar el horario** (por ejemplo, abrir a la 1 p. m.):

```
lunes: ["13:00", "23:00"],
```

Para un día que cierran: `lunes: null,`. El letrero "Abierto ahora", la lista de horarios, los botones de hora de la reserva y los datos para Google se actualizan solos.

**Cambiar un precio:** busca el platillo y cambia el número: `precio: 179,` → `precio: 185,`. Para no mostrar precio: `precio: null,`.

**Apagar o cambiar la promoción:** en `promo`, escribe `activa: false,` para ocultarla. Para la siguiente promoción, cambia `titulo`, `detalle`, `accion` y el `enlace` (en español `es` y en inglés `en`) y deja `activa: true,`.

**Noches de salsa:** en `salsa`, cambia `dias`, `inicio` y `fin`.

**Reseñas:** en `resenas`, actualiza `calificacion` y `total` de vez en cuando.

**Textos:** están en `textos`, en español (`es`) y en inglés (`en`).

**Cambiar la foto de un platillo:** sube una foto a `assets/img/` (por ejemplo `tostada-nueva.jpg`, horizontal o vertical, de al menos 800 px) y en el platillo escribe `foto: "tostada-nueva.jpg",`.

> **Probar el letrero de horario a otra hora:** agrega `?ahora=2026-11-21T21:00` al final de la dirección (año-mes-díaThora:minuto). Solo sirve para revisar; los clientes ven la hora real de Cancún.

---

## 6. QR para las mesas

- **`tarjeton-mesa-10x15.pdf`** (carpeta 2): imprímelo en cartulina a tamaño real (100 %), sin márgenes. Dice "Escanea · Reserva · Síguenos".
- **`qr-mantarraya.png`** (1600 px) o **`qr-mantarraya.svg`** (para imprenta): para ventana, tickets o lonas. Que mida al menos 2.5 cm.
- También puedes abrir `https://casadelamantarraya.com/links/qr/` para descargarlo o imprimir el tarjetón desde el navegador.
- **Antes de imprimir muchos,** sube la página y escanea un QR de prueba con el celular.

---

## 7. Medición (opcional)

Cada botón importante ya tiene su nombre de evento (`reservar`, `reservar_enviar`, `menu`, `mapa`, `salsa`, `promo`, `instagram`, etc.). Para contarlos en Google Analytics o Meta Pixel hay que pegar el código de la herramienta en `index.html` y activar una línea en la función `track()` al inicio de `js/main.js`. Ahí mismo vienen los ejemplos.

---

## 8. Resultados de calidad (Google Lighthouse)

| | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
|---|---|---|---|---|
| Celular | 99–100 | 100 | 100 | 100 |
| Computadora | 100 | 100 | 100 | 100 |

**Otras métricas:**

- **Carga del contenido principal (LCP):** 0.6 s en 4G normal y 1.8–2.0 s en la simulación de 4G lento de Lighthouse.
- **Movimiento de la página al cargar (CLS):** 0.
- **JavaScript total:** 17 KB comprimido.

La página también respeta "reducir movimiento" del celular y se puede usar completa con teclado.

---

## 9. Tres fotos que conviene tomar

1. **La terraza de noche con las luces encendidas**, en horizontal. Es la mejor foto para el botón "Reservar mesa". Sin clientes reconocibles, o con su permiso.
2. **La banda tocando un viernes o sábado, con gente bailando.** Para el bloque de Noches de salsa y para historias de Instagram.
3. **Toma desde arriba de la mesa completa:** tacos al tamarindo, pescadillas, tostada, ceviche negro y bebidas, con luz natural de la tarde. Sirve para el carrusel y para la imagen que aparece al compartir el enlace.

Consejo: tómalas con la cámara normal del celular (no en modo retrato), en la resolución más alta, en horizontal y en vertical.

---

**Nota sobre la marca:** en todo lo que funciona como logo (encabezado, ícono de la pestaña, ícono del iPhone, QR y la imagen para redes) se usa el logo original del restaurante, sin cambios. La mantarraya dibujada en línea fina que nada por el fondo es solo una ilustración decorativa de la página.
