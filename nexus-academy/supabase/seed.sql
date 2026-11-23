-- ARCHIVO GENERADO por scripts/generate-seed.mjs. No editar a mano.
-- Catálogo inicial de NEXUS ACADEMY (sin reseñas, ventas ni alumnos ficticios).
begin;
insert into public.categories (id, slug, name, description, icon, color, sort_order) values ($s$36248014-a8d0-509c-ac7b-e985e04b7dea$s$, $s$desarrollo-web$s$, $s$Desarrollo Web$s$, $s$HTML, CSS, JavaScript, React y todo lo necesario para construir productos web modernos.$s$, $s$code$s$, $s$#3b82f6$s$, 0) on conflict (slug) do nothing;
insert into public.categories (id, slug, name, description, icon, color, sort_order) values ($s$efc473f3-db38-5e75-a85a-8cdafe4bb527$s$, $s$inteligencia-artificial$s$, $s$IA y Machine Learning$s$, $s$Fundamentos y práctica de inteligencia artificial, modelos y aprendizaje automático.$s$, $s$brain$s$, $s$#8b5cf6$s$, 1) on conflict (slug) do nothing;
insert into public.categories (id, slug, name, description, icon, color, sort_order) values ($s$aad66f67-0e58-5521-a168-e424545a1b58$s$, $s$ciencia-de-datos$s$, $s$Ciencia de Datos$s$, $s$Python, análisis, visualización y toma de decisiones con datos.$s$, $s$bar-chart-3$s$, $s$#06b6d4$s$, 2) on conflict (slug) do nothing;
insert into public.categories (id, slug, name, description, icon, color, sort_order) values ($s$990547f4-a182-5945-a3f1-586afac8a570$s$, $s$diseno$s$, $s$Diseño UI/UX$s$, $s$Diseño de interfaces, investigación de usuarios y sistemas de diseño.$s$, $s$pen-tool$s$, $s$#ec4899$s$, 3) on conflict (slug) do nothing;
insert into public.categories (id, slug, name, description, icon, color, sort_order) values ($s$4857f5b0-3019-52ca-ae1a-14e19a6423a1$s$, $s$negocios$s$, $s$Negocios y Marketing$s$, $s$Marketing digital, crecimiento y estrategia para productos digitales.$s$, $s$trending-up$s$, $s$#f59e0b$s$, 4) on conflict (slug) do nothing;
insert into public.categories (id, slug, name, description, icon, color, sort_order) values ($s$bc78e765-b76d-599d-a283-635d1f52ccb0$s$, $s$ciberseguridad$s$, $s$Ciberseguridad$s$, $s$Buenas prácticas de seguridad para desarrolladores y equipos.$s$, $s$shield$s$, $s$#10b981$s$, 5) on conflict (slug) do nothing;
insert into public.instructors (id, slug, name, headline, bio) values ($s$c48d1ed4-8656-5838-a0f2-18b558f9f4c4$s$, $s$equipo-desarrollo$s$, $s$Equipo de Desarrollo NEXUS$s$, $s$Ingeniería de software y web moderna$s$, $s$El equipo responsable de los programas de desarrollo web y software de NEXUS Academy.$s$) on conflict (slug) do nothing;
insert into public.instructors (id, slug, name, headline, bio) values ($s$a6ada229-5f6a-5b3b-ac18-711f920a3b39$s$, $s$laboratorio-ia$s$, $s$Laboratorio de IA NEXUS$s$, $s$Inteligencia artificial aplicada$s$, $s$El laboratorio que diseña los programas de inteligencia artificial y machine learning de NEXUS Academy.$s$) on conflict (slug) do nothing;
insert into public.instructors (id, slug, name, headline, bio) values ($s$e525c0c4-9391-5721-a4ca-7b0b9f5c5f31$s$, $s$equipo-datos$s$, $s$Equipo de Datos NEXUS$s$, $s$Análisis y ciencia de datos$s$, $s$El equipo responsable de los programas de análisis y ciencia de datos de NEXUS Academy.$s$) on conflict (slug) do nothing;
insert into public.instructors (id, slug, name, headline, bio) values ($s$998e9c54-434e-5480-ac00-3a9f5d8cca5f$s$, $s$estudio-diseno$s$, $s$Estudio de Diseño NEXUS$s$, $s$Producto, interfaces y experiencia$s$, $s$El estudio que crea los programas de diseño de producto y experiencia de usuario de NEXUS Academy.$s$) on conflict (slug) do nothing;
insert into public.instructors (id, slug, name, headline, bio) values ($s$b20e6590-023e-5c83-a67e-9452da91080b$s$, $s$equipo-negocios$s$, $s$Equipo de Negocios NEXUS$s$, $s$Crecimiento y marketing digital$s$, $s$El equipo responsable de los programas de negocio y marketing de NEXUS Academy.$s$) on conflict (slug) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, instructor_id, level, price_cents, compare_at_price_cents, currency, status, is_featured, what_you_will_learn, requirements, target_audience) values ($s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$fundamentos-html-css$s$, $s$Fundamentos de HTML y CSS$s$, $s$Construye y publica tu primera página web con estructura semántica y estilos modernos.$s$, $s$Este curso es la puerta de entrada al desarrollo web. Aprenderás cómo el navegador interpreta HTML y CSS, cómo escribir código limpio y accesible y cómo construir una página responsive desde cero. Al terminar tendrás un proyecto propio listo para publicar.$s$, $s$36248014-a8d0-509c-ac7b-e985e04b7dea$s$, $s$c48d1ed4-8656-5838-a0f2-18b558f9f4c4$s$, $s$beginner$s$, 0, null, $s$MXN$s$, $s$published$s$, true, array[$s$Estructurar documentos con HTML semántico$s$, $s$Dar estilo con selectores, cascada y especificidad$s$, $s$Maquetar con Flexbox y CSS Grid$s$, $s$Crear diseños responsive para móvil y escritorio$s$]::text[], array[$s$Una computadora con navegador moderno$s$, $s$Un editor de código (por ejemplo VS Code)$s$]::text[], array[$s$Personas sin experiencia previa en programación$s$, $s$Diseñadores que quieren llevar sus ideas a la web$s$]::text[]) on conflict (slug) do nothing;
insert into public.modules (id, course_id, title, position) values ($s$276aceb0-b030-572c-a40e-bf62a67c311e$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$La estructura de la web$s$, 0) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$92e399f0-9e79-5d8c-aadc-f42a870ed39e$s$, $s$276aceb0-b030-572c-a40e-bf62a67c311e$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$Cómo funciona una página web$s$, $s$article$s$, 360, 0, true) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$92e399f0-9e79-5d8c-aadc-f42a870ed39e$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$## Del servidor a tu pantalla

Cuando escribes una dirección en el navegador ocurre una conversación:

1. El navegador pide el documento al **servidor** mediante HTTP.
2. El servidor responde con un archivo **HTML**.
3. El navegador lee el HTML, descarga el **CSS** y el **JavaScript** que este menciona y construye la página.

### Las tres capas
- **HTML** define el contenido y su significado (títulos, párrafos, imágenes).
- **CSS** define la presentación (colores, tipografía, distribución).
- **JavaScript** añade comportamiento (interacción, datos en tiempo real).

Separar estas capas hace que el código sea más fácil de mantener: puedes rediseñar un sitio completo cambiando solo el CSS.

> Consejo: abre las herramientas de desarrollo de tu navegador (F12) en cualquier sitio y explora la pestaña *Elements*. Es la mejor forma de aprender cómo están construidas las páginas que usas a diario.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$95776240-527e-5eb7-ac25-888b277bafb9$s$, $s$276aceb0-b030-572c-a40e-bf62a67c311e$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$HTML semántico$s$, $s$article$s$, 480, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$95776240-527e-5eb7-ac25-888b277bafb9$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$## Etiquetas con significado

HTML semántico significa elegir la etiqueta que **describe** el contenido, no la que "se ve" de cierta forma.

```html
<header>
  <nav>…</nav>
</header>
<main>
  <article>
    <h1>Título principal</h1>
    <p>Contenido del artículo.</p>
  </article>
</main>
<footer>…</footer>
```

### ¿Por qué importa?
- **Accesibilidad:** los lectores de pantalla usan estas etiquetas para navegar.
- **SEO:** los buscadores entienden mejor la jerarquía de tu contenido.
- **Mantenimiento:** el código se explica solo.

### Reglas prácticas
- Usa un solo `<h1>` por página y respeta el orden de los encabezados.
- Toda imagen informativa necesita un atributo `alt` descriptivo.
- Los botones son `<button>`; los enlaces que cambian de página son `<a>`.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$b666e39c-fbb5-543a-ab5f-4b41a837084b$s$, $s$276aceb0-b030-572c-a40e-bf62a67c311e$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$Ejercicio: tu primera página$s$, $s$exercise$s$, 1200, 2, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$b666e39c-fbb5-543a-ab5f-4b41a837084b$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$## Objetivo
Crear una página personal con estructura semántica.

### Instrucciones
1. Crea un archivo `index.html`.
2. Incluye `<header>` con tu nombre y una navegación con tres enlaces internos.
3. Dentro de `<main>` crea tres `<section>`: *Sobre mí*, *Proyectos* y *Contacto*.
4. Agrega una imagen con un `alt` descriptivo.
5. Termina con un `<footer>`.

### Criterios de éxito
- La página se valida sin errores en el validador del W3C.
- Navegando solo con el teclado (Tab) puedes llegar a todos los enlaces.

Cuando lo tengas listo, marca la lección como completada.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.modules (id, course_id, title, position) values ($s$8eff6d0e-2f24-5878-ac17-27782e162d19$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$Estilos y maquetación$s$, 1) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$4ad6f593-0fa3-5242-aef6-7fa4095ac88f$s$, $s$8eff6d0e-2f24-5878-ac17-27782e162d19$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$Selectores, cascada y especificidad$s$, $s$article$s$, 540, 0, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$4ad6f593-0fa3-5242-aef6-7fa4095ac88f$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$## Cómo decide CSS qué estilo aplicar

Cuando varias reglas apuntan al mismo elemento, CSS decide con tres criterios en orden:

1. **Origen e importancia** (`!important`, estilos del autor, del navegador).
2. **Especificidad:** `#id` (1,0,0) > `.clase` (0,1,0) > `etiqueta` (0,0,1).
3. **Orden:** si empatan, gana la regla escrita al final.

```css
p { color: gray; }          /* 0,0,1 */
.nota { color: blue; }      /* 0,1,0 → gana */
```

### Buenas prácticas
- Prefiere **clases** a IDs para estilos; mantienen la especificidad baja.
- Evita `!important`: suele ocultar un problema de arquitectura.
- Usa variables CSS para colores y espaciados:

```css
:root { --primario: #3b82f6; }
.boton { background: var(--primario); }
```$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$bb169c91-3ad0-5769-ab97-fe980dfe202c$s$, $s$8eff6d0e-2f24-5878-ac17-27782e162d19$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$Flexbox y Grid$s$, $s$article$s$, 600, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$bb169c91-3ad0-5769-ab97-fe980dfe202c$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$## Dos herramientas, dos dimensiones

**Flexbox** distribuye elementos en **una dimensión** (fila o columna). Ideal para barras de navegación, alinear iconos y texto, o centrar.

```css
.nav { display: flex; gap: 1rem; align-items: center; justify-content: space-between; }
```

**Grid** controla **dos dimensiones** a la vez. Ideal para la estructura general y galerías.

```css
.galeria {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
}
```

La línea de `auto-fill` + `minmax` crea una cuadrícula **responsive sin media queries**: las columnas se reacomodan según el ancho disponible.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$fa85e014-2e92-512f-a70d-4056e157219f$s$, $s$8eff6d0e-2f24-5878-ac17-27782e162d19$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$Diseño responsive$s$, $s$article$s$, 480, 2, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$fa85e014-2e92-512f-a70d-4056e157219f$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$## Mobile first

Diseña primero para pantallas pequeñas y agrega complejidad conforme crece el espacio.

```css
.tarjetas { display: grid; gap: 1rem; }

@media (min-width: 768px) {
  .tarjetas { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1200px) {
  .tarjetas { grid-template-columns: repeat(3, 1fr); }
}
```

### No olvides
- `<meta name="viewport" content="width=device-width, initial-scale=1">` en el `<head>`.
- Áreas táctiles de al menos **44 × 44 px**.
- Imágenes flexibles: `img { max-width: 100%; height: auto; }`.
- Unidades relativas (`rem`, `%`, `clamp()`) para tipografía fluida:
  `font-size: clamp(1.5rem, 4vw, 3rem);`$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$4eb5272c-f8c2-5e8c-a1ce-585a03434bd4$s$, $s$8eff6d0e-2f24-5878-ac17-27782e162d19$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$Evaluación final: HTML y CSS$s$, $s$quiz$s$, 300, 3, false) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$3abbe47f-4a95-5319-a782-422eaae0dadb$s$, $s$4eb5272c-f8c2-5e8c-a1ce-585a03434bd4$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$¿Qué etiqueta describe el contenido principal y único de una página?$s$, $s$["<section>","<main>","<div>","<body>"]$s$::jsonb, 1, $s$<main> envuelve el contenido principal; solo debe haber uno visible por página.$s$, 0) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$2fc8c7f6-5f20-5a59-a28f-5b81b456eddb$s$, $s$4eb5272c-f8c2-5e8c-a1ce-585a03434bd4$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$¿Qué selector tiene mayor especificidad?$s$, $s$["p",".nota","#aviso","div p"]$s$::jsonb, 2, $s$Un ID (1,0,0) supera a clases (0,1,0) y etiquetas (0,0,1).$s$, 1) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$88d97fc2-8dba-5b05-a745-d5fc55d33f01$s$, $s$4eb5272c-f8c2-5e8c-a1ce-585a03434bd4$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$¿Qué herramienta es más adecuada para un layout en dos dimensiones?$s$, $s$["Flexbox","CSS Grid","float","position: absolute"]$s$::jsonb, 1, $s$Grid controla filas y columnas a la vez.$s$, 2) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$47fe81f1-cff4-5bc2-a208-2aaea03febfe$s$, $s$4eb5272c-f8c2-5e8c-a1ce-585a03434bd4$s$, $s$d9b5a6de-edf5-510b-a358-ac441d246279$s$, $s$En un enfoque mobile first, las media queries normalmente usan…$s$, $s$["max-width","min-width","orientation","aspect-ratio"]$s$::jsonb, 1, $s$Se parte del estilo móvil y se añaden reglas con min-width para pantallas mayores.$s$, 3) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, instructor_id, level, price_cents, compare_at_price_cents, currency, status, is_featured, what_you_will_learn, requirements, target_audience) values ($s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$javascript-moderno$s$, $s$JavaScript Moderno: de cero a interactivo$s$, $s$Variables, funciones, asincronía y el DOM con las prácticas actuales del lenguaje.$s$, $s$JavaScript es el lenguaje de la web. En este curso pasarás de los fundamentos a construir interfaces interactivas que consumen datos reales, con un enfoque en código claro, moderno y mantenible.$s$, $s$36248014-a8d0-509c-ac7b-e985e04b7dea$s$, $s$c48d1ed4-8656-5838-a0f2-18b558f9f4c4$s$, $s$intermediate$s$, 89900, 149900, $s$MXN$s$, $s$published$s$, true, array[$s$Dominar tipos, funciones y estructuras de datos$s$, $s$Manipular el DOM y gestionar eventos$s$, $s$Trabajar con promesas y async/await$s$, $s$Consumir APIs reales con fetch$s$]::text[], array[$s$Conocimientos básicos de HTML y CSS$s$]::text[], array[$s$Personas que terminaron un curso de HTML/CSS$s$, $s$Desarrolladores que quieren actualizar su JavaScript$s$]::text[]) on conflict (slug) do nothing;
insert into public.modules (id, course_id, title, position) values ($s$c0203b81-70a7-5288-abfd-346f9a877d9c$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$Fundamentos del lenguaje$s$, 0) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$cd092f00-96ae-59c2-a891-199e0ef82b74$s$, $s$c0203b81-70a7-5288-abfd-346f9a877d9c$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$Variables, tipos y funciones$s$, $s$article$s$, 600, 0, true) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$cd092f00-96ae-59c2-a891-199e0ef82b74$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$## let, const y tipos

```js
const nombre = "Ada";     // no se puede reasignar
let intentos = 0;         // sí se puede reasignar
intentos += 1;
```

Usa `const` por defecto y `let` solo cuando necesites reasignar. Evita `var`.

### Tipos primitivos
`string`, `number`, `boolean`, `null`, `undefined`, `bigint` y `symbol`. Todo lo demás es un **objeto**.

### Funciones flecha
```js
const precioConIVA = (precio, iva = 0.16) => precio * (1 + iva);
precioConIVA(100); // 116
```

Compara siempre con `===` para evitar conversiones implícitas inesperadas.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$2437e6a4-1083-54ab-aa22-015fc2aaed9e$s$, $s$c0203b81-70a7-5288-abfd-346f9a877d9c$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$Arreglos y objetos$s$, $s$article$s$, 600, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$2437e6a4-1083-54ab-aa22-015fc2aaed9e$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$## Transformar datos sin mutarlos

```js
const cursos = [
  { titulo: "HTML", horas: 6 },
  { titulo: "JS", horas: 12 },
];

const largos = cursos.filter((c) => c.horas > 8);
const titulos = cursos.map((c) => c.titulo);
const total = cursos.reduce((suma, c) => suma + c.horas, 0);
```

### Desestructuración y spread
```js
const { titulo, horas } = cursos[0];
const actualizado = { ...cursos[0], horas: 7 };
```

Trabajar con copias en lugar de mutar evita errores difíciles de rastrear, especialmente en frameworks como React.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.modules (id, course_id, title, position) values ($s$f0a4809f-3271-5cf5-abf8-27090210241a$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$El navegador y la asincronía$s$, 1) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$b87ab925-a2bf-5643-a566-2c1ecac17028$s$, $s$f0a4809f-3271-5cf5-abf8-27090210241a$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$El DOM y los eventos$s$, $s$article$s$, 720, 0, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$b87ab925-a2bf-5643-a566-2c1ecac17028$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$## Seleccionar y reaccionar

```js
const boton = document.querySelector("#suscribir");
const mensaje = document.querySelector("#mensaje");

boton.addEventListener("click", () => {
  mensaje.textContent = "¡Gracias por suscribirte!";
});
```

### Delegación de eventos
En listas dinámicas registra un solo manejador en el contenedor:

```js
lista.addEventListener("click", (e) => {
  const item = e.target.closest("[data-id]");
  if (item) eliminar(item.dataset.id);
});
```

Usa `textContent` en lugar de `innerHTML` cuando insertes texto del usuario: evita ataques XSS.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$d0ab617b-a99f-5968-a04f-931420e2c097$s$, $s$f0a4809f-3271-5cf5-abf8-27090210241a$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$Promesas, async/await y fetch$s$, $s$article$s$, 720, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$d0ab617b-a99f-5968-a04f-931420e2c097$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$## Código asíncrono legible

```js
async function cargarCursos() {
  try {
    const res = await fetch("/api/cursos");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("No se pudieron cargar los cursos", error);
    return [];
  }
}
```

### Peticiones en paralelo
```js
const [usuario, cursos] = await Promise.all([getUsuario(), getCursos()]);
```

Siempre muestra al usuario tres estados: **cargando**, **error** y **éxito**.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$7aeb5336-aea8-5100-acd7-2d1394e27322$s$, $s$f0a4809f-3271-5cf5-abf8-27090210241a$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$Evaluación: JavaScript$s$, $s$quiz$s$, 300, 2, false) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$43197ff4-99c6-5332-ac48-d9d8a61e758d$s$, $s$7aeb5336-aea8-5100-acd7-2d1394e27322$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$¿Qué declaración usarías por defecto para una variable que no se reasigna?$s$, $s$["var","let","const","static"]$s$::jsonb, 2, $s$const comunica que la referencia no cambiará.$s$, 0) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$ea8e31d5-0357-5339-a082-e74f090ce169$s$, $s$7aeb5336-aea8-5100-acd7-2d1394e27322$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$¿Qué método devuelve un nuevo arreglo solo con los elementos que cumplen una condición?$s$, $s$["map","filter","reduce","forEach"]$s$::jsonb, 1, $s$filter crea un arreglo con los elementos que pasan la prueba.$s$, 1) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$0caa916e-065e-5b9c-a3b5-9300e7b1a913$s$, $s$7aeb5336-aea8-5100-acd7-2d1394e27322$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, $s$Para insertar texto escrito por un usuario en la página de forma segura usas…$s$, $s$["innerHTML","outerHTML","textContent","document.write"]$s$::jsonb, 2, $s$textContent no interpreta HTML, evitando XSS.$s$, 2) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, instructor_id, level, price_cents, compare_at_price_cents, currency, status, is_featured, what_you_will_learn, requirements, target_audience) values ($s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$react-nextjs-produccion$s$, $s$React y Next.js para producción$s$, $s$Componentes, estado, Server Components y despliegue de aplicaciones reales.$s$, $s$Un recorrido práctico por React y Next.js orientado a productos reales: arquitectura de componentes, obtención de datos en el servidor, formularios con validación y despliegue.$s$, $s$36248014-a8d0-509c-ac7b-e985e04b7dea$s$, $s$c48d1ed4-8656-5838-a0f2-18b558f9f4c4$s$, $s$advanced$s$, 149900, 249900, $s$MXN$s$, $s$published$s$, false, array[$s$Pensar la interfaz en componentes reutilizables$s$, $s$Gestionar estado y efectos correctamente$s$, $s$Usar Server Components y Server Actions$s$, $s$Desplegar con buenas prácticas de rendimiento y seguridad$s$]::text[], array[$s$JavaScript moderno (ES2020+)$s$, $s$Nociones de HTML y CSS$s$]::text[], array[$s$Desarrolladores frontend$s$, $s$Equipos que migran a Next.js$s$]::text[]) on conflict (slug) do nothing;
insert into public.modules (id, course_id, title, position) values ($s$6be51866-1d77-556c-ab3d-811c869e90b5$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$React esencial$s$, 0) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$cb6f8b12-069c-518b-aba4-b3ce9500c78e$s$, $s$6be51866-1d77-556c-ab3d-811c869e90b5$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$Componentes y props$s$, $s$article$s$, 600, 0, true) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$cb6f8b12-069c-518b-aba4-b3ce9500c78e$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$## La interfaz como función de los datos

```jsx
function TarjetaCurso({ titulo, nivel }) {
  return (
    <article className="tarjeta">
      <h3>{titulo}</h3>
      <span>{nivel}</span>
    </article>
  );
}
```

Un componente recibe **props** y devuelve UI. Mantén los componentes pequeños, con una sola responsabilidad, y compón interfaces complejas a partir de piezas simples.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$aebb21a3-e537-514a-a733-750dbb850b36$s$, $s$6be51866-1d77-556c-ab3d-811c869e90b5$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$Estado y efectos$s$, $s$article$s$, 720, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$aebb21a3-e537-514a-a733-750dbb850b36$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$## useState y useEffect con criterio

```jsx
const [abierto, setAbierto] = useState(false);
```

- El **estado** es memoria del componente que, al cambiar, provoca un nuevo render.
- Un **efecto** sincroniza el componente con algo externo (una suscripción, el título del documento).

> Si puedes calcular un valor a partir de props o estado, **no** lo guardes en estado ni lo sincronices con un efecto: calcúlalo durante el render.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.modules (id, course_id, title, position) values ($s$c7e8265a-f801-5b27-a8ec-90efb732e88a$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$Next.js en producción$s$, 1) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$9c0c74c8-3f3a-5d85-ae77-ff9d2f9bc74e$s$, $s$c7e8265a-f801-5b27-a8ec-90efb732e88a$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$Server Components y obtención de datos$s$, $s$article$s$, 840, 0, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$9c0c74c8-3f3a-5d85-ae77-ff9d2f9bc74e$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$## Datos en el servidor

En el App Router los componentes son **de servidor** por defecto: pueden leer la base de datos directamente y no envían su código al navegador.

```tsx
export default async function Page() {
  const cursos = await db.cursos.findMany();
  return <ListaCursos cursos={cursos} />;
}
```

Marca con `"use client"` solo los componentes que necesitan interactividad (estado, eventos). Así reduces el JavaScript que descarga el usuario.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$807fa217-a8bc-5761-a3e8-cc99e1ac91f7$s$, $s$c7e8265a-f801-5b27-a8ec-90efb732e88a$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$Server Actions y seguridad$s$, $s$article$s$, 720, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$807fa217-a8bc-5761-a3e8-cc99e1ac91f7$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$## Mutaciones seguras

Una Server Action es una función que se ejecuta en el servidor y puede invocarse desde un formulario.

Reglas de oro:
1. **Valida** siempre la entrada (por ejemplo con Zod).
2. **Autoriza** dentro de la acción: verifica la sesión y el rol, nunca confíes en la UI.
3. **No devuelvas** datos sensibles al cliente.
4. Mantén secretos solo en variables de entorno del servidor.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$aeb6c118-1c49-5773-a27c-05fe25ca87d5$s$, $s$c7e8265a-f801-5b27-a8ec-90efb732e88a$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$Evaluación: React y Next.js$s$, $s$quiz$s$, 300, 2, false) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$f98070c3-8327-5b11-ac74-cf28b6669827$s$, $s$aeb6c118-1c49-5773-a27c-05fe25ca87d5$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$En el App Router, los componentes son por defecto…$s$, $s$["De cliente","De servidor","Estáticos sin datos","Web Components"]$s$::jsonb, 1, $s$Los componentes del App Router son Server Components salvo que declares "use client".$s$, 0) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$e97a017b-1340-5719-aab2-c91de1c1f350$s$, $s$aeb6c118-1c49-5773-a27c-05fe25ca87d5$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$¿Dónde debe verificarse la autorización de una Server Action?$s$, $s$["En el botón","En el CSS","Dentro de la propia acción en el servidor","En localStorage"]$s$::jsonb, 2, $s$La UI puede manipularse; la verificación debe hacerse en el servidor.$s$, 1) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$f1d000e4-381f-5f85-ac05-c86f111cf027$s$, $s$aeb6c118-1c49-5773-a27c-05fe25ca87d5$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, $s$Si un valor se puede calcular a partir de props, lo correcto es…$s$, $s$["Guardarlo en estado","Sincronizarlo con useEffect","Calcularlo durante el render","Guardarlo en una cookie"]$s$::jsonb, 2, $s$Evita estado redundante: calcúlalo al renderizar.$s$, 2) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, instructor_id, level, price_cents, compare_at_price_cents, currency, status, is_featured, what_you_will_learn, requirements, target_audience) values ($s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$introduccion-inteligencia-artificial$s$, $s$Introducción a la Inteligencia Artificial$s$, $s$Qué es la IA, cómo funcionan los modelos de lenguaje y cómo usarlos con criterio.$s$, $s$Una introducción clara y sin tecnicismos innecesarios a la inteligencia artificial: sus conceptos clave, cómo funcionan los modelos actuales y cómo aprovecharlos de forma responsable.$s$, $s$efc473f3-db38-5e75-a85a-8cdafe4bb527$s$, $s$a6ada229-5f6a-5b3b-ac18-711f920a3b39$s$, $s$beginner$s$, 0, null, $s$MXN$s$, $s$published$s$, true, array[$s$Distinguir IA, machine learning y deep learning$s$, $s$Entender cómo aprende un modelo a partir de datos$s$, $s$Escribir buenas instrucciones (prompts)$s$, $s$Reconocer limitaciones, sesgos y riesgos$s$]::text[], array[$s$Ninguno: curso para todo público$s$]::text[], array[$s$Cualquier persona curiosa por la IA$s$, $s$Profesionales que quieren aplicarla en su trabajo$s$]::text[]) on conflict (slug) do nothing;
insert into public.modules (id, course_id, title, position) values ($s$d5b3e5e9-8f68-54fe-acc3-0da1b2f60c7b$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$Conceptos clave$s$, 0) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$2a9e280e-78ec-5a89-acd5-68dc580737e1$s$, $s$d5b3e5e9-8f68-54fe-acc3-0da1b2f60c7b$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$IA, machine learning y deep learning$s$, $s$article$s$, 480, 0, true) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$2a9e280e-78ec-5a89-acd5-68dc580737e1$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$## Tres círculos concéntricos

- **Inteligencia artificial:** el campo amplio de crear sistemas que realizan tareas que asociamos con la inteligencia.
- **Machine learning:** una rama de la IA en la que el sistema **aprende patrones a partir de datos** en vez de seguir reglas escritas a mano.
- **Deep learning:** machine learning con **redes neuronales profundas**, capaz de aprender representaciones complejas (imágenes, audio, lenguaje).

### Un ejemplo
Para detectar spam podrías escribir reglas ("si contiene *gratis*…"). Con machine learning, en cambio, das miles de correos etiquetados y el modelo descubre por sí mismo qué combinaciones de rasgos predicen el spam.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$3a1c06fe-7317-54ad-a57b-cb2966314d8a$s$, $s$d5b3e5e9-8f68-54fe-acc3-0da1b2f60c7b$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$Cómo aprende un modelo$s$, $s$article$s$, 600, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$3a1c06fe-7317-54ad-a57b-cb2966314d8a$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$## Datos, error y ajuste

1. El modelo hace una **predicción**.
2. Se compara con la respuesta correcta y se mide el **error** (función de pérdida).
3. Se **ajustan los parámetros** para reducir ese error (descenso de gradiente).
4. Se repite millones de veces.

### Entrenamiento vs. evaluación
Separamos los datos en **entrenamiento** y **prueba**. Si el modelo acierta mucho con los datos de entrenamiento pero falla con los nuevos, está **sobreajustado**: memorizó en lugar de generalizar.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.modules (id, course_id, title, position) values ($s$c38bc993-48a9-56ae-ac17-fb6267b0c8e9$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$IA generativa en la práctica$s$, 1) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$ab5ecf26-20f6-5891-a276-386c79541466$s$, $s$c38bc993-48a9-56ae-ac17-fb6267b0c8e9$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$Modelos de lenguaje y prompts efectivos$s$, $s$article$s$, 720, 0, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$ab5ecf26-20f6-5891-a276-386c79541466$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$## Cómo funcionan los LLM

Un modelo de lenguaje predice el siguiente fragmento de texto a partir de lo anterior. Entrenado con enormes cantidades de texto, aprende gramática, hechos y patrones de razonamiento.

### Prompts que funcionan
- **Contexto:** quién eres y para qué lo necesitas.
- **Tarea concreta:** qué quieres exactamente.
- **Formato:** cómo quieres la respuesta (lista, tabla, longitud).
- **Ejemplos:** muestra una entrada y la salida esperada.

> Mal: "Háblame de marketing".
> Mejor: "Soy dueña de una cafetería en Puebla. Dame 5 ideas de publicaciones para Instagram de esta semana, en una tabla con día, idea y texto sugerido."$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$143e9f0d-daa0-5284-a11c-0012d5a74f63$s$, $s$c38bc993-48a9-56ae-ac17-fb6267b0c8e9$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$Limitaciones, sesgos y uso responsable$s$, $s$article$s$, 540, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$143e9f0d-daa0-5284-a11c-0012d5a74f63$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$## Usar la IA con criterio

- **Alucinaciones:** los modelos pueden generar datos falsos con total seguridad. Verifica cifras, citas y fuentes.
- **Sesgos:** reflejan los sesgos de sus datos de entrenamiento.
- **Privacidad:** no compartas datos personales o confidenciales en herramientas que no controlas.
- **Responsabilidad:** la decisión final y sus consecuencias son tuyas, no del modelo.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$dfbf8d56-eabd-5e33-a7fe-5eb7a94d5ad9$s$, $s$c38bc993-48a9-56ae-ac17-fb6267b0c8e9$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$Ejercicio: diseña tu asistente$s$, $s$exercise$s$, 900, 2, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$dfbf8d56-eabd-5e33-a7fe-5eb7a94d5ad9$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$## Objetivo
Escribir un prompt de sistema para un asistente útil en tu trabajo o estudios.

1. Define el **rol** del asistente y su público.
2. Lista **3 reglas** que debe seguir siempre.
3. Indica el **formato** de sus respuestas.
4. Pruébalo con NEXUS AI desde el aula y mejora el prompt dos veces según los resultados.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$8ffb1117-ad08-5cd0-aea4-fb857152dfae$s$, $s$c38bc993-48a9-56ae-ac17-fb6267b0c8e9$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$Evaluación: fundamentos de IA$s$, $s$quiz$s$, 300, 3, false) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$ae3be876-cae0-5472-a72c-bc9851c6dca1$s$, $s$8ffb1117-ad08-5cd0-aea4-fb857152dfae$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$El machine learning se caracteriza por…$s$, $s$["Seguir reglas escritas a mano","Aprender patrones a partir de datos","Funcionar sin datos","Ser siempre deep learning"]$s$::jsonb, 1, $s$El ML aprende patrones de datos en lugar de reglas explícitas.$s$, 0) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$b70ca7a6-523d-522b-a738-ec487edbccbe$s$, $s$8ffb1117-ad08-5cd0-aea4-fb857152dfae$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$Un modelo que acierta en entrenamiento pero falla con datos nuevos está…$s$, $s$["Subajustado","Sobreajustado","Normalizado","Cuantizado"]$s$::jsonb, 1, $s$Sobreajuste: memorizó los datos en lugar de generalizar.$s$, 1) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$f5d5fbd6-6e15-597c-ad07-b7779070cd2b$s$, $s$8ffb1117-ad08-5cd0-aea4-fb857152dfae$s$, $s$a8f33abc-a39c-5932-a733-c3b064a4af73$s$, $s$¿Qué hacer ante una cifra importante generada por un modelo de lenguaje?$s$, $s$["Usarla directamente","Verificarla en una fuente confiable","Pedirle que la repita","Ignorarla siempre"]$s$::jsonb, 1, $s$Los modelos pueden alucinar; verifica los datos críticos.$s$, 2) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, instructor_id, level, price_cents, compare_at_price_cents, currency, status, is_featured, what_you_will_learn, requirements, target_audience) values ($s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$python-ciencia-de-datos$s$, $s$Python para Ciencia de Datos$s$, $s$Analiza, limpia y visualiza datos con Python, pandas y buenas prácticas.$s$, $s$Aprende el flujo de trabajo completo de un análisis de datos con Python: desde cargar un archivo hasta presentar conclusiones claras y respaldadas por evidencia.$s$, $s$aad66f67-0e58-5521-a168-e424545a1b58$s$, $s$e525c0c4-9391-5721-a4ca-7b0b9f5c5f31$s$, $s$beginner$s$, 119900, 199900, $s$MXN$s$, $s$published$s$, true, array[$s$Escribir Python claro y efectivo$s$, $s$Cargar y limpiar datos con pandas$s$, $s$Responder preguntas de negocio con agregaciones$s$, $s$Comunicar hallazgos con visualizaciones$s$]::text[], array[$s$No se requiere experiencia previa en programación$s$]::text[], array[$s$Analistas que usan hojas de cálculo$s$, $s$Estudiantes que quieren iniciar en datos$s$]::text[]) on conflict (slug) do nothing;
insert into public.modules (id, course_id, title, position) values ($s$0b1a20a9-42cb-5011-a1b8-fd58748494ff$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$Python esencial$s$, 0) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$9a3ca633-4d6b-5211-add1-ebc845f20f60$s$, $s$0b1a20a9-42cb-5011-a1b8-fd58748494ff$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$Tu primer análisis con Python$s$, $s$article$s$, 600, 0, true) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$9a3ca633-4d6b-5211-add1-ebc845f20f60$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$## Python en 10 minutos

```python
ventas = [1200, 950, 1800, 1430]
promedio = sum(ventas) / len(ventas)
print(f"Promedio: {promedio:.2f}")
```

- Las **listas** guardan secuencias; los **diccionarios** asocian claves con valores.
- Las *f-strings* formatean texto de manera legible.
- La indentación forma parte de la sintaxis: define los bloques de código.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$85802119-963a-5958-a47c-e4ded741d513$s$, $s$0b1a20a9-42cb-5011-a1b8-fd58748494ff$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$Funciones y estructuras de datos$s$, $s$article$s$, 600, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$85802119-963a-5958-a47c-e4ded741d513$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$## Reutiliza tu lógica

```python
def variacion(actual: float, anterior: float) -> float:
    """Variación porcentual entre dos periodos."""
    if anterior == 0:
        return 0.0
    return (actual - anterior) / anterior * 100
```

Documenta tus funciones con *docstrings* y usa anotaciones de tipo: tu yo del futuro te lo agradecerá.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.modules (id, course_id, title, position) values ($s$bcf8f7f7-ab25-55a8-ad3a-e9e994292257$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$Análisis con pandas$s$, 1) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$65af14a0-3515-5bb3-a3ac-f09955df9d9a$s$, $s$bcf8f7f7-ab25-55a8-ad3a-e9e994292257$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$DataFrames: cargar y limpiar$s$, $s$article$s$, 840, 0, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$65af14a0-3515-5bb3-a3ac-f09955df9d9a$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$## pandas en acción

```python
import pandas as pd

df = pd.read_csv("ventas.csv", parse_dates=["fecha"])
df = df.drop_duplicates()
df["monto"] = df["monto"].fillna(0)
df.info()
```

Antes de analizar, **inspecciona**: tipos de columnas, valores nulos, duplicados y rangos imposibles (precios negativos, fechas futuras).$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$d3532dc1-d719-51d2-a337-3150baa1f791$s$, $s$bcf8f7f7-ab25-55a8-ad3a-e9e994292257$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$Agrupar, resumir y visualizar$s$, $s$article$s$, 840, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$d3532dc1-d719-51d2-a337-3150baa1f791$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$## De datos a respuestas

```python
por_mes = (df.groupby(df["fecha"].dt.to_period("M"))["monto"]
             .sum()
             .rename("ingresos"))
por_mes.plot(kind="bar", title="Ingresos por mes")
```

Cada gráfica debe responder **una pregunta**. Ponle un título que diga la conclusión, no solo el tema: *"Los ingresos crecieron 18 % en el trimestre"*.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$35e94c1e-efd7-554e-a5e5-7735bb9208a5$s$, $s$bcf8f7f7-ab25-55a8-ad3a-e9e994292257$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$Evaluación: Python y pandas$s$, $s$quiz$s$, 300, 2, false) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$4f78ac16-9008-5467-a2d8-c709f2c20acf$s$, $s$35e94c1e-efd7-554e-a5e5-7735bb9208a5$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$¿Qué estructura de Python asocia claves con valores?$s$, $s$["Lista","Tupla","Diccionario","Conjunto"]$s$::jsonb, 2, $s$Los diccionarios mapean claves a valores.$s$, 0) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$1ccf0a94-3241-5234-ac90-a20807715c27$s$, $s$35e94c1e-efd7-554e-a5e5-7735bb9208a5$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$¿Qué método de pandas elimina filas duplicadas?$s$, $s$["dropna()","drop_duplicates()","unique()","clean()"]$s$::jsonb, 1, $s$drop_duplicates() elimina filas repetidas.$s$, 1) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$60dd55ba-3466-5a63-a02a-2eeefa20d838$s$, $s$35e94c1e-efd7-554e-a5e5-7735bb9208a5$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, $s$Un buen título de gráfica…$s$, $s$["Solo nombra las variables","Comunica la conclusión","Siempre está vacío","Incluye el código"]$s$::jsonb, 1, $s$El título debe decir qué aprendemos de la gráfica.$s$, 2) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, instructor_id, level, price_cents, compare_at_price_cents, currency, status, is_featured, what_you_will_learn, requirements, target_audience) values ($s$69a5e7d9-c45c-594d-adaa-d2c17c86b60a$s$, $s$machine-learning-aplicado$s$, $s$Machine Learning Aplicado$s$, $s$Entrena, evalúa y pon en producción modelos con scikit-learn.$s$, $s$Un curso práctico para construir modelos de machine learning que funcionen fuera del notebook: desde el planteamiento del problema hasta la evaluación y el monitoreo.$s$, $s$efc473f3-db38-5e75-a85a-8cdafe4bb527$s$, $s$a6ada229-5f6a-5b3b-ac18-711f920a3b39$s$, $s$intermediate$s$, 179900, 299900, $s$MXN$s$, $s$published$s$, false, array[$s$Plantear problemas de clasificación y regresión$s$, $s$Preparar datos y evitar fugas de información$s$, $s$Evaluar modelos con las métricas correctas$s$, $s$Llevar un modelo a producción de forma responsable$s$]::text[], array[$s$Python y pandas a nivel básico$s$]::text[], array[$s$Analistas de datos$s$, $s$Desarrolladores que quieren incorporar modelos$s$]::text[]) on conflict (slug) do nothing;
insert into public.modules (id, course_id, title, position) values ($s$74d1cc0f-2cc1-507e-aea5-94904fe03b4a$s$, $s$69a5e7d9-c45c-594d-adaa-d2c17c86b60a$s$, $s$Modelado$s$, 0) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$6a93e474-ab5c-5d6f-a705-a7c0be51dfa1$s$, $s$74d1cc0f-2cc1-507e-aea5-94904fe03b4a$s$, $s$69a5e7d9-c45c-594d-adaa-d2c17c86b60a$s$, $s$Plantear el problema$s$, $s$article$s$, 540, 0, true) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$6a93e474-ab5c-5d6f-a705-a7c0be51dfa1$s$, $s$69a5e7d9-c45c-594d-adaa-d2c17c86b60a$s$, $s$## Antes del modelo, la pregunta

- **Clasificación:** predecir una categoría (¿abandonará el curso? sí/no).
- **Regresión:** predecir un número (¿cuántas inscripciones tendremos?).

Define también **cómo medirás el éxito** y cuál es la línea base: un modelo que no supera una regla simple no aporta valor.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$1ad8be79-cf56-5148-a258-2297261c670b$s$, $s$74d1cc0f-2cc1-507e-aea5-94904fe03b4a$s$, $s$69a5e7d9-c45c-594d-adaa-d2c17c86b60a$s$, $s$Entrenar con scikit-learn$s$, $s$article$s$, 840, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$1ad8be79-cf56-5148-a258-2297261c670b$s$, $s$69a5e7d9-c45c-594d-adaa-d2c17c86b60a$s$, $s$## Pipeline reproducible

```python
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
modelo = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
modelo.fit(X_train, y_train)
```

El **pipeline** garantiza que la normalización se aprenda solo con datos de entrenamiento, evitando fugas de información.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.modules (id, course_id, title, position) values ($s$16a70003-9a74-5b75-abfc-180a8a140b91$s$, $s$69a5e7d9-c45c-594d-adaa-d2c17c86b60a$s$, $s$Evaluación y producción$s$, 1) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$9218ac6a-298c-5243-a9e6-77bd3c9a0f70$s$, $s$16a70003-9a74-5b75-abfc-180a8a140b91$s$, $s$69a5e7d9-c45c-594d-adaa-d2c17c86b60a$s$, $s$Métricas que importan$s$, $s$article$s$, 720, 0, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$9218ac6a-298c-5243-a9e6-77bd3c9a0f70$s$, $s$69a5e7d9-c45c-594d-adaa-d2c17c86b60a$s$, $s$## Más allá de la exactitud

Con clases desbalanceadas la exactitud engaña. Usa:
- **Precisión:** de lo que predije positivo, ¿cuánto lo era?
- **Recall:** de los positivos reales, ¿cuántos detecté?
- **F1:** equilibrio entre ambas.
- **Matriz de confusión** para ver los tipos de error.

Elige la métrica según el costo de cada error en tu negocio.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$a14d71e5-eea5-5a63-a23f-c12498bba889$s$, $s$16a70003-9a74-5b75-abfc-180a8a140b91$s$, $s$69a5e7d9-c45c-594d-adaa-d2c17c86b60a$s$, $s$Evaluación: ML aplicado$s$, $s$quiz$s$, 300, 1, false) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$f05f5baa-b2b4-5523-aa0a-5a34b62b080e$s$, $s$a14d71e5-eea5-5a63-a23f-c12498bba889$s$, $s$69a5e7d9-c45c-594d-adaa-d2c17c86b60a$s$, $s$Predecir el número de inscripciones del próximo mes es un problema de…$s$, $s$["Clasificación","Regresión","Clustering","Reducción de dimensionalidad"]$s$::jsonb, 1, $s$Se predice un valor numérico continuo.$s$, 0) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$c2479a78-efa3-5c58-aaad-b55ca92c88ce$s$, $s$a14d71e5-eea5-5a63-a23f-c12498bba889$s$, $s$69a5e7d9-c45c-594d-adaa-d2c17c86b60a$s$, $s$¿Para qué sirve un pipeline de scikit-learn?$s$, $s$["Para graficar","Para encadenar preprocesamiento y modelo evitando fugas","Para subir datos a la nube","Para acelerar Python"]$s$::jsonb, 1, $s$Asegura que las transformaciones se ajusten solo con los datos de entrenamiento.$s$, 1) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$c98daf13-f4d3-5338-a482-518fcc7253b6$s$, $s$a14d71e5-eea5-5a63-a23f-c12498bba889$s$, $s$69a5e7d9-c45c-594d-adaa-d2c17c86b60a$s$, $s$Con clases muy desbalanceadas, ¿qué métrica es engañosa por sí sola?$s$, $s$["Recall","F1","Exactitud (accuracy)","Matriz de confusión"]$s$::jsonb, 2, $s$Un modelo que siempre predice la clase mayoritaria puede tener alta exactitud.$s$, 2) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, instructor_id, level, price_cents, compare_at_price_cents, currency, status, is_featured, what_you_will_learn, requirements, target_audience) values ($s$5434afd5-ef2b-5964-a47a-fc54bf47e24f$s$, $s$diseno-ui-ux$s$, $s$Diseño UI/UX: interfaces que convierten$s$, $s$Investigación, jerarquía visual y sistemas de diseño para productos digitales.$s$, $s$Aprende a diseñar interfaces claras, accesibles y orientadas a objetivos, con un proceso que va desde la investigación hasta el sistema de diseño.$s$, $s$990547f4-a182-5945-a3f1-586afac8a570$s$, $s$998e9c54-434e-5480-ac00-3a9f5d8cca5f$s$, $s$intermediate$s$, 99900, 159900, $s$MXN$s$, $s$published$s$, false, array[$s$Investigar necesidades reales de usuarios$s$, $s$Construir jerarquía visual clara$s$, $s$Diseñar componentes y sistemas consistentes$s$, $s$Evaluar la usabilidad con pruebas rápidas$s$]::text[], array[$s$Interés en el diseño de producto$s$, $s$Figma (gratuito) instalado$s$]::text[], array[$s$Diseñadores gráficos que migran a producto$s$, $s$Desarrolladores y emprendedores$s$]::text[]) on conflict (slug) do nothing;
insert into public.modules (id, course_id, title, position) values ($s$13fca29c-6d6d-55d0-a1a6-a0580260fc68$s$, $s$5434afd5-ef2b-5964-a47a-fc54bf47e24f$s$, $s$Fundamentos$s$, 0) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$17fd0292-23e8-55a0-ad0e-e4699406a51f$s$, $s$13fca29c-6d6d-55d0-a1a6-a0580260fc68$s$, $s$5434afd5-ef2b-5964-a47a-fc54bf47e24f$s$, $s$UX vs. UI$s$, $s$article$s$, 420, 0, true) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$17fd0292-23e8-55a0-ad0e-e4699406a51f$s$, $s$5434afd5-ef2b-5964-a47a-fc54bf47e24f$s$, $s$## Dos disciplinas complementarias

- **UX (experiencia de usuario):** ¿resuelve el producto un problema real de forma sencilla?
- **UI (interfaz):** ¿cómo se ve y se siente cada pantalla?

Una interfaz bella con un flujo confuso fracasa. Empieza por entender a las personas y sus objetivos.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$c921d04b-60c9-53ba-a826-f09240a42038$s$, $s$13fca29c-6d6d-55d0-a1a6-a0580260fc68$s$, $s$5434afd5-ef2b-5964-a47a-fc54bf47e24f$s$, $s$Jerarquía visual$s$, $s$article$s$, 600, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$c921d04b-60c9-53ba-a826-f09240a42038$s$, $s$5434afd5-ef2b-5964-a47a-fc54bf47e24f$s$, $s$## Guiar la mirada

Herramientas: **tamaño, peso, color, contraste, espacio y posición**.

- Una sola acción principal por pantalla, claramente destacada.
- Usa el espacio en blanco para agrupar (ley de proximidad).
- Contraste mínimo de texto 4.5:1 para accesibilidad (WCAG AA).$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.modules (id, course_id, title, position) values ($s$6aa2d6e9-4ab8-50ce-a3cc-a689a7a9f86a$s$, $s$5434afd5-ef2b-5964-a47a-fc54bf47e24f$s$, $s$Sistemas y validación$s$, 1) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$dd38931a-8fe7-5499-a921-12f7877565e4$s$, $s$6aa2d6e9-4ab8-50ce-a3cc-a689a7a9f86a$s$, $s$5434afd5-ef2b-5964-a47a-fc54bf47e24f$s$, $s$Sistemas de diseño$s$, $s$article$s$, 600, 0, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$dd38931a-8fe7-5499-a921-12f7877565e4$s$, $s$5434afd5-ef2b-5964-a47a-fc54bf47e24f$s$, $s$## Consistencia a escala

Un sistema de diseño define **tokens** (color, tipografía, espaciado), **componentes** (botones, campos, tarjetas) y **patrones** de uso. Reduce decisiones repetidas y acelera al equipo.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$9d1b52c3-f65d-59dd-a3dd-beb6d0001ebd$s$, $s$6aa2d6e9-4ab8-50ce-a3cc-a689a7a9f86a$s$, $s$5434afd5-ef2b-5964-a47a-fc54bf47e24f$s$, $s$Ejercicio: prueba de usabilidad de 5 usuarios$s$, $s$exercise$s$, 1500, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$9d1b52c3-f65d-59dd-a3dd-beb6d0001ebd$s$, $s$5434afd5-ef2b-5964-a47a-fc54bf47e24f$s$, $s$## Objetivo
Detectar los principales problemas de un flujo con una prueba ligera.

1. Elige un flujo (por ejemplo, registrarse en una app).
2. Escribe 3 tareas realistas.
3. Observa a 5 personas sin ayudarlas y anota dónde dudan.
4. Prioriza los 3 problemas más frecuentes y propone una mejora para cada uno.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.courses (id, slug, title, subtitle, description, category_id, instructor_id, level, price_cents, compare_at_price_cents, currency, status, is_featured, what_you_will_learn, requirements, target_audience) values ($s$d2e33fe0-356f-5171-a9ca-031b62025044$s$, $s$marketing-digital-growth$s$, $s$Marketing Digital y Growth$s$, $s$Atrae, convierte y retiene clientes con estrategia y métricas.$s$, $s$Un método práctico para hacer crecer un negocio digital con marketing basado en datos, sin depender de trucos ni de presupuestos enormes.$s$, $s$4857f5b0-3019-52ca-ae1a-14e19a6423a1$s$, $s$b20e6590-023e-5c83-a67e-9452da91080b$s$, $s$beginner$s$, 79900, null, $s$MXN$s$, $s$published$s$, false, array[$s$Definir tu cliente ideal y propuesta de valor$s$, $s$Construir un embudo de adquisición$s$, $s$Medir con métricas accionables$s$, $s$Diseñar experimentos de crecimiento$s$]::text[], array[$s$Ninguno$s$]::text[], array[$s$Emprendedores$s$, $s$Responsables de marketing en pymes$s$]::text[]) on conflict (slug) do nothing;
insert into public.modules (id, course_id, title, position) values ($s$e20a7b2e-77bb-5781-afbd-2b37bdac5d93$s$, $s$d2e33fe0-356f-5171-a9ca-031b62025044$s$, $s$Estrategia$s$, 0) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$9535e34c-56fc-56ca-a240-2691082fc893$s$, $s$e20a7b2e-77bb-5781-afbd-2b37bdac5d93$s$, $s$d2e33fe0-356f-5171-a9ca-031b62025044$s$, $s$Cliente ideal y propuesta de valor$s$, $s$article$s$, 540, 0, true) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$9535e34c-56fc-56ca-a240-2691082fc893$s$, $s$d2e33fe0-356f-5171-a9ca-031b62025044$s$, $s$## Empieza por quién

Describe a tu cliente ideal: su problema, lo que ha intentado y por qué no le funcionó. Tu **propuesta de valor** responde en una frase: *para quién*, *qué problema resuelves* y *por qué tú*.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$88d7fd11-27be-5927-abf6-5a465d4a34bf$s$, $s$e20a7b2e-77bb-5781-afbd-2b37bdac5d93$s$, $s$d2e33fe0-356f-5171-a9ca-031b62025044$s$, $s$El embudo AARRR$s$, $s$article$s$, 600, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$88d7fd11-27be-5927-abf6-5a465d4a34bf$s$, $s$d2e33fe0-356f-5171-a9ca-031b62025044$s$, $s$## Métricas pirata

**A**dquisición → **A**ctivación → **R**etención → **R**eferencia → **R**evenue (ingresos).

Identifica la etapa con mayor fuga y enfoca ahí tus esfuerzos: mejorar la retención suele multiplicar el impacto de todo lo demás.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.modules (id, course_id, title, position) values ($s$54ee9e7e-2b29-5049-ad11-d7d28168c3d0$s$, $s$d2e33fe0-356f-5171-a9ca-031b62025044$s$, $s$Ejecución$s$, 1) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$57115fb7-f84e-5ba3-ac52-a2f8a2990b6a$s$, $s$54ee9e7e-2b29-5049-ad11-d7d28168c3d0$s$, $s$d2e33fe0-356f-5171-a9ca-031b62025044$s$, $s$Experimentos de crecimiento$s$, $s$article$s$, 600, 0, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$57115fb7-f84e-5ba3-ac52-a2f8a2990b6a$s$, $s$d2e33fe0-356f-5171-a9ca-031b62025044$s$, $s$## Hipótesis → prueba → aprendizaje

Formato: *"Creemos que **[cambio]** aumentará **[métrica]** porque **[razón]**. Lo sabremos si **[resultado medible]**."*

Prioriza con ICE: Impacto, Confianza y Facilidad (1–10 cada uno).$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$34b667e5-3725-580d-ade6-6274ba917ec6$s$, $s$54ee9e7e-2b29-5049-ad11-d7d28168c3d0$s$, $s$d2e33fe0-356f-5171-a9ca-031b62025044$s$, $s$Evaluación: marketing y growth$s$, $s$quiz$s$, 300, 1, false) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$d32e60d6-6cce-5d25-a026-8cd66d6e811c$s$, $s$34b667e5-3725-580d-ade6-6274ba917ec6$s$, $s$d2e33fe0-356f-5171-a9ca-031b62025044$s$, $s$¿Qué etapa NO forma parte del embudo AARRR?$s$, $s$["Activación","Retención","Reputación","Referencia"]$s$::jsonb, 2, $s$AARRR: Adquisición, Activación, Retención, Referencia y Revenue.$s$, 0) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$f3356628-2a3d-5009-aa91-7a3be0c64475$s$, $s$34b667e5-3725-580d-ade6-6274ba917ec6$s$, $s$d2e33fe0-356f-5171-a9ca-031b62025044$s$, $s$Una propuesta de valor debe responder…$s$, $s$["Cuántos empleados tienes","Para quién, qué problema resuelves y por qué tú","Tu historia completa","El precio"]$s$::jsonb, 1, $s$Debe ser específica y centrada en el cliente.$s$, 1) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$adf8313f-5e9f-5e87-aaf5-76746bd6f2c0$s$, $s$34b667e5-3725-580d-ade6-6274ba917ec6$s$, $s$d2e33fe0-356f-5171-a9ca-031b62025044$s$, $s$En el método ICE, la «C» significa…$s$, $s$["Costo","Confianza","Canal","Conversión"]$s$::jsonb, 1, $s$Impacto, Confianza y Facilidad (Ease).$s$, 2) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, instructor_id, level, price_cents, compare_at_price_cents, currency, status, is_featured, what_you_will_learn, requirements, target_audience) values ($s$e7aff7ce-c43b-52ed-ae10-ac07ce52e736$s$, $s$git-github-esencial$s$, $s$Git y GitHub esencial$s$, $s$Guarda, versiona y colabora en tu código sin miedo a romper nada.$s$, $s$El control de versiones es una habilidad indispensable. Aprende Git desde cero y colabora en GitHub como lo hacen los equipos profesionales.$s$, $s$36248014-a8d0-509c-ac7b-e985e04b7dea$s$, $s$c48d1ed4-8656-5838-a0f2-18b558f9f4c4$s$, $s$beginner$s$, 0, null, $s$MXN$s$, $s$published$s$, false, array[$s$Entender commits, ramas y el historial$s$, $s$Colaborar con pull requests$s$, $s$Resolver conflictos de fusión$s$]::text[], array[$s$Una computadora con terminal$s$]::text[], array[$s$Personas que empiezan a programar$s$]::text[]) on conflict (slug) do nothing;
insert into public.modules (id, course_id, title, position) values ($s$9a539a6d-91e6-5d3d-a8d6-460aea75340c$s$, $s$e7aff7ce-c43b-52ed-ae10-ac07ce52e736$s$, $s$Control de versiones$s$, 0) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$cabb8861-4032-5cc1-a206-1cb5ee7245ea$s$, $s$9a539a6d-91e6-5d3d-a8d6-460aea75340c$s$, $s$e7aff7ce-c43b-52ed-ae10-ac07ce52e736$s$, $s$Commits y el historial$s$, $s$article$s$, 540, 0, true) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$cabb8861-4032-5cc1-a206-1cb5ee7245ea$s$, $s$e7aff7ce-c43b-52ed-ae10-ac07ce52e736$s$, $s$## Fotografías de tu proyecto

```bash
git init
git add index.html
git commit -m "Agrega página inicial"
git log --oneline
```

Un buen mensaje de commit explica **qué** cambia y **por qué**, en tiempo presente y de forma breve.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$10e584a1-d62b-5328-abd2-075591732322$s$, $s$9a539a6d-91e6-5d3d-a8d6-460aea75340c$s$, $s$e7aff7ce-c43b-52ed-ae10-ac07ce52e736$s$, $s$Ramas y pull requests$s$, $s$article$s$, 600, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$10e584a1-d62b-5328-abd2-075591732322$s$, $s$e7aff7ce-c43b-52ed-ae10-ac07ce52e736$s$, $s$## Trabajar en paralelo

```bash
git switch -c mejora-navegacion
# … cambios y commits …
git push -u origin mejora-navegacion
```

En GitHub abre un **pull request** para que el equipo revise antes de fusionar a la rama principal.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$21991568-a97c-5e41-af23-1ec7da7d57a7$s$, $s$9a539a6d-91e6-5d3d-a8d6-460aea75340c$s$, $s$e7aff7ce-c43b-52ed-ae10-ac07ce52e736$s$, $s$Evaluación: Git$s$, $s$quiz$s$, 240, 2, false) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$68de78ad-4f3b-54c4-aba6-4748693f308c$s$, $s$21991568-a97c-5e41-af23-1ec7da7d57a7$s$, $s$e7aff7ce-c43b-52ed-ae10-ac07ce52e736$s$, $s$¿Qué comando crea una rama nueva y te cambia a ella?$s$, $s$["git branch -d","git switch -c","git merge","git init"]$s$::jsonb, 1, $s$git switch -c <nombre> crea la rama y cambia a ella.$s$, 0) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$f586cbc2-8640-5d01-a24b-f60b646a4e5c$s$, $s$21991568-a97c-5e41-af23-1ec7da7d57a7$s$, $s$e7aff7ce-c43b-52ed-ae10-ac07ce52e736$s$, $s$Un pull request sirve para…$s$, $s$["Borrar el repositorio","Proponer y revisar cambios antes de fusionarlos","Descargar Git","Cifrar el código"]$s$::jsonb, 1, $s$Permite revisión y discusión antes del merge.$s$, 1) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, instructor_id, level, price_cents, compare_at_price_cents, currency, status, is_featured, what_you_will_learn, requirements, target_audience) values ($s$716ab3db-ad82-59bf-a4ab-2986721af4ed$s$, $s$ciberseguridad-desarrolladores$s$, $s$Ciberseguridad para desarrolladores$s$, $s$Protege tus aplicaciones web de las vulnerabilidades más comunes.$s$, $s$La seguridad se diseña desde el inicio. Aprende a identificar y corregir las vulnerabilidades más frecuentes en aplicaciones web modernas.$s$, $s$bc78e765-b76d-599d-a283-635d1f52ccb0$s$, $s$c48d1ed4-8656-5838-a0f2-18b558f9f4c4$s$, $s$intermediate$s$, 129900, 189900, $s$MXN$s$, $s$published$s$, false, array[$s$Reconocer las vulnerabilidades del OWASP Top 10$s$, $s$Prevenir inyecciones y XSS$s$, $s$Gestionar autenticación, sesiones y secretos$s$]::text[], array[$s$Experiencia básica desarrollando aplicaciones web$s$]::text[], array[$s$Desarrolladores web$s$, $s$Líderes técnicos$s$]::text[]) on conflict (slug) do nothing;
insert into public.modules (id, course_id, title, position) values ($s$9d1edebd-68ca-517b-aab2-887577929f8f$s$, $s$716ab3db-ad82-59bf-a4ab-2986721af4ed$s$, $s$Amenazas comunes$s$, 0) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$c3695516-c269-553e-af6b-19f89ca7fb65$s$, $s$9d1edebd-68ca-517b-aab2-887577929f8f$s$, $s$716ab3db-ad82-59bf-a4ab-2986721af4ed$s$, $s$OWASP Top 10 en la práctica$s$, $s$article$s$, 720, 0, true) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$c3695516-c269-553e-af6b-19f89ca7fb65$s$, $s$716ab3db-ad82-59bf-a4ab-2986721af4ed$s$, $s$## Las fallas más frecuentes

Control de acceso roto, fallas criptográficas, inyección, diseño inseguro, mala configuración, componentes vulnerables, fallas de autenticación, integridad de software, registro insuficiente y SSRF.

El **control de acceso roto** encabeza la lista: verifica permisos en el servidor en *cada* petición.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$c1601196-150b-55e0-ae37-b06337db644f$s$, $s$9d1edebd-68ca-517b-aab2-887577929f8f$s$, $s$716ab3db-ad82-59bf-a4ab-2986721af4ed$s$, $s$Inyección SQL y XSS$s$, $s$article$s$, 720, 1, false) on conflict (id) do nothing;
insert into public.lesson_contents (lesson_id, course_id, body) values ($s$c1601196-150b-55e0-ae37-b06337db644f$s$, $s$716ab3db-ad82-59bf-a4ab-2986721af4ed$s$, $s$## Nunca concatenes entradas

```js
// ❌ Vulnerable
db.query("SELECT * FROM users WHERE email = '" + email + "'");
// ✅ Consulta parametrizada
db.query("SELECT * FROM users WHERE email = $1", [email]);
```

Para XSS: escapa la salida, evita `innerHTML` con datos del usuario y define una **Content Security Policy**.$s$) on conflict (lesson_id) do update set body = excluded.body;
insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values ($s$7c15ed9c-d619-5416-a35b-3db70303b969$s$, $s$9d1edebd-68ca-517b-aab2-887577929f8f$s$, $s$716ab3db-ad82-59bf-a4ab-2986721af4ed$s$, $s$Evaluación: seguridad$s$, $s$quiz$s$, 240, 2, false) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$3f35fe2e-23cb-5bea-a210-85ad0d3c347c$s$, $s$7c15ed9c-d619-5416-a35b-3db70303b969$s$, $s$716ab3db-ad82-59bf-a4ab-2986721af4ed$s$, $s$¿Cuál es la defensa principal contra la inyección SQL?$s$, $s$["Ocultar errores","Consultas parametrizadas","Usar HTTPS","Minificar el código"]$s$::jsonb, 1, $s$Los parámetros separan datos de instrucciones SQL.$s$, 0) on conflict (id) do nothing;
insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values ($s$9ab0e3d0-a94b-5737-addc-4c28931ed814$s$, $s$7c15ed9c-d619-5416-a35b-3db70303b969$s$, $s$716ab3db-ad82-59bf-a4ab-2986721af4ed$s$, $s$¿Dónde debe verificarse el control de acceso?$s$, $s$["Solo en el frontend","En el servidor en cada petición","En el CSS","En la URL"]$s$::jsonb, 1, $s$El cliente puede manipularse; el servidor decide.$s$, 1) on conflict (id) do nothing;
insert into public.bundles (id, slug, title, description, price_cents, compare_at_price_cents, currency, status) values ($s$47c01a03-6313-5f14-a444-28351b0bd19b$s$, $s$ruta-desarrollador-web$s$, $s$Ruta Desarrollador Web$s$, $s$JavaScript moderno, React y Next.js y ciberseguridad en un solo paquete para dar el salto a desarrollo profesional.$s$, 299900, 439700, 'MXN', 'published') on conflict (slug) do nothing;
insert into public.bundle_courses (bundle_id, course_id, position) values ($s$47c01a03-6313-5f14-a444-28351b0bd19b$s$, $s$aa469142-0faf-5a04-a706-d11a6448137f$s$, 0) on conflict do nothing;
insert into public.bundle_courses (bundle_id, course_id, position) values ($s$47c01a03-6313-5f14-a444-28351b0bd19b$s$, $s$bbcb2905-5c9a-5217-a42d-8107b15d6b79$s$, 1) on conflict do nothing;
insert into public.bundle_courses (bundle_id, course_id, position) values ($s$47c01a03-6313-5f14-a444-28351b0bd19b$s$, $s$716ab3db-ad82-59bf-a4ab-2986721af4ed$s$, 2) on conflict do nothing;
insert into public.bundles (id, slug, title, description, price_cents, compare_at_price_cents, currency, status) values ($s$46c15870-37c8-5864-a5ed-a484df98e509$s$, $s$ruta-datos-e-ia$s$, $s$Ruta Datos e IA$s$, $s$Python para ciencia de datos y Machine Learning aplicado: del análisis a los modelos en producción.$s$, 249900, 299800, 'MXN', 'published') on conflict (slug) do nothing;
insert into public.bundle_courses (bundle_id, course_id, position) values ($s$46c15870-37c8-5864-a5ed-a484df98e509$s$, $s$cadfd941-c910-54a8-a88d-26a2887d885d$s$, 0) on conflict do nothing;
insert into public.bundle_courses (bundle_id, course_id, position) values ($s$46c15870-37c8-5864-a5ed-a484df98e509$s$, $s$69a5e7d9-c45c-594d-adaa-d2c17c86b60a$s$, 1) on conflict do nothing;
commit;
