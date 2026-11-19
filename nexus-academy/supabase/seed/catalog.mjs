// Catálogo inicial de NEXUS ACADEMY.
// Este archivo es la fuente de supabase/seed.sql (genera con `npm run seed:generate`).
// Contiene únicamente contenido del catálogo: categorías, equipos docentes,
// cursos, temarios, lecciones y cuestionarios. NO contiene reseñas, ventas,
// alumnos ni estadísticas: esos datos solo existen cuando ocurren de verdad.

export const categories = [
  { slug: "desarrollo-web", name: "Desarrollo Web", icon: "code", color: "#3b82f6", description: "HTML, CSS, JavaScript, React y todo lo necesario para construir productos web modernos." },
  { slug: "inteligencia-artificial", name: "IA y Machine Learning", icon: "brain", color: "#8b5cf6", description: "Fundamentos y práctica de inteligencia artificial, modelos y aprendizaje automático." },
  { slug: "ciencia-de-datos", name: "Ciencia de Datos", icon: "bar-chart-3", color: "#06b6d4", description: "Python, análisis, visualización y toma de decisiones con datos." },
  { slug: "diseno", name: "Diseño UI/UX", icon: "pen-tool", color: "#ec4899", description: "Diseño de interfaces, investigación de usuarios y sistemas de diseño." },
  { slug: "negocios", name: "Negocios y Marketing", icon: "trending-up", color: "#f59e0b", description: "Marketing digital, crecimiento y estrategia para productos digitales." },
  { slug: "ciberseguridad", name: "Ciberseguridad", icon: "shield", color: "#10b981", description: "Buenas prácticas de seguridad para desarrolladores y equipos." },
];

export const instructors = [
  { slug: "equipo-desarrollo", name: "Equipo de Desarrollo NEXUS", headline: "Ingeniería de software y web moderna", bio: "El equipo responsable de los programas de desarrollo web y software de NEXUS Academy." },
  { slug: "laboratorio-ia", name: "Laboratorio de IA NEXUS", headline: "Inteligencia artificial aplicada", bio: "El laboratorio que diseña los programas de inteligencia artificial y machine learning de NEXUS Academy." },
  { slug: "equipo-datos", name: "Equipo de Datos NEXUS", headline: "Análisis y ciencia de datos", bio: "El equipo responsable de los programas de análisis y ciencia de datos de NEXUS Academy." },
  { slug: "estudio-diseno", name: "Estudio de Diseño NEXUS", headline: "Producto, interfaces y experiencia", bio: "El estudio que crea los programas de diseño de producto y experiencia de usuario de NEXUS Academy." },
  { slug: "equipo-negocios", name: "Equipo de Negocios NEXUS", headline: "Crecimiento y marketing digital", bio: "El equipo responsable de los programas de negocio y marketing de NEXUS Academy." },
];

const read = (minutes) => minutes * 60;

export const courses = [
  {
    slug: "fundamentos-html-css",
    title: "Fundamentos de HTML y CSS",
    subtitle: "Construye y publica tu primera página web con estructura semántica y estilos modernos.",
    category: "desarrollo-web",
    instructor: "equipo-desarrollo",
    level: "beginner",
    price: 0,
    featured: true,
    learn: [
      "Estructurar documentos con HTML semántico",
      "Dar estilo con selectores, cascada y especificidad",
      "Maquetar con Flexbox y CSS Grid",
      "Crear diseños responsive para móvil y escritorio",
    ],
    requirements: ["Una computadora con navegador moderno", "Un editor de código (por ejemplo VS Code)"],
    audience: ["Personas sin experiencia previa en programación", "Diseñadores que quieren llevar sus ideas a la web"],
    description:
      "Este curso es la puerta de entrada al desarrollo web. Aprenderás cómo el navegador interpreta HTML y CSS, cómo escribir código limpio y accesible y cómo construir una página responsive desde cero. Al terminar tendrás un proyecto propio listo para publicar.",
    modules: [
      {
        title: "La estructura de la web",
        lessons: [
          {
            title: "Cómo funciona una página web",
            type: "article",
            preview: true,
            duration: read(6),
            body: `## Del servidor a tu pantalla

Cuando escribes una dirección en el navegador ocurre una conversación:

1. El navegador pide el documento al **servidor** mediante HTTP.
2. El servidor responde con un archivo **HTML**.
3. El navegador lee el HTML, descarga el **CSS** y el **JavaScript** que este menciona y construye la página.

### Las tres capas
- **HTML** define el contenido y su significado (títulos, párrafos, imágenes).
- **CSS** define la presentación (colores, tipografía, distribución).
- **JavaScript** añade comportamiento (interacción, datos en tiempo real).

Separar estas capas hace que el código sea más fácil de mantener: puedes rediseñar un sitio completo cambiando solo el CSS.

> Consejo: abre las herramientas de desarrollo de tu navegador (F12) en cualquier sitio y explora la pestaña *Elements*. Es la mejor forma de aprender cómo están construidas las páginas que usas a diario.`,
          },
          {
            title: "HTML semántico",
            type: "article",
            duration: read(8),
            body: `## Etiquetas con significado

HTML semántico significa elegir la etiqueta que **describe** el contenido, no la que "se ve" de cierta forma.

\`\`\`html
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
\`\`\`

### ¿Por qué importa?
- **Accesibilidad:** los lectores de pantalla usan estas etiquetas para navegar.
- **SEO:** los buscadores entienden mejor la jerarquía de tu contenido.
- **Mantenimiento:** el código se explica solo.

### Reglas prácticas
- Usa un solo \`<h1>\` por página y respeta el orden de los encabezados.
- Toda imagen informativa necesita un atributo \`alt\` descriptivo.
- Los botones son \`<button>\`; los enlaces que cambian de página son \`<a>\`.`,
          },
          {
            title: "Ejercicio: tu primera página",
            type: "exercise",
            duration: read(20),
            body: `## Objetivo
Crear una página personal con estructura semántica.

### Instrucciones
1. Crea un archivo \`index.html\`.
2. Incluye \`<header>\` con tu nombre y una navegación con tres enlaces internos.
3. Dentro de \`<main>\` crea tres \`<section>\`: *Sobre mí*, *Proyectos* y *Contacto*.
4. Agrega una imagen con un \`alt\` descriptivo.
5. Termina con un \`<footer>\`.

### Criterios de éxito
- La página se valida sin errores en el validador del W3C.
- Navegando solo con el teclado (Tab) puedes llegar a todos los enlaces.

Cuando lo tengas listo, marca la lección como completada.`,
          },
        ],
      },
      {
        title: "Estilos y maquetación",
        lessons: [
          {
            title: "Selectores, cascada y especificidad",
            type: "article",
            duration: read(9),
            body: `## Cómo decide CSS qué estilo aplicar

Cuando varias reglas apuntan al mismo elemento, CSS decide con tres criterios en orden:

1. **Origen e importancia** (\`!important\`, estilos del autor, del navegador).
2. **Especificidad:** \`#id\` (1,0,0) > \`.clase\` (0,1,0) > \`etiqueta\` (0,0,1).
3. **Orden:** si empatan, gana la regla escrita al final.

\`\`\`css
p { color: gray; }          /* 0,0,1 */
.nota { color: blue; }      /* 0,1,0 → gana */
\`\`\`

### Buenas prácticas
- Prefiere **clases** a IDs para estilos; mantienen la especificidad baja.
- Evita \`!important\`: suele ocultar un problema de arquitectura.
- Usa variables CSS para colores y espaciados:

\`\`\`css
:root { --primario: #3b82f6; }
.boton { background: var(--primario); }
\`\`\``,
          },
          {
            title: "Flexbox y Grid",
            type: "article",
            duration: read(10),
            body: `## Dos herramientas, dos dimensiones

**Flexbox** distribuye elementos en **una dimensión** (fila o columna). Ideal para barras de navegación, alinear iconos y texto, o centrar.

\`\`\`css
.nav { display: flex; gap: 1rem; align-items: center; justify-content: space-between; }
\`\`\`

**Grid** controla **dos dimensiones** a la vez. Ideal para la estructura general y galerías.

\`\`\`css
.galeria {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
}
\`\`\`

La línea de \`auto-fill\` + \`minmax\` crea una cuadrícula **responsive sin media queries**: las columnas se reacomodan según el ancho disponible.`,
          },
          {
            title: "Diseño responsive",
            type: "article",
            duration: read(8),
            body: `## Mobile first

Diseña primero para pantallas pequeñas y agrega complejidad conforme crece el espacio.

\`\`\`css
.tarjetas { display: grid; gap: 1rem; }

@media (min-width: 768px) {
  .tarjetas { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1200px) {
  .tarjetas { grid-template-columns: repeat(3, 1fr); }
}
\`\`\`

### No olvides
- \`<meta name="viewport" content="width=device-width, initial-scale=1">\` en el \`<head>\`.
- Áreas táctiles de al menos **44 × 44 px**.
- Imágenes flexibles: \`img { max-width: 100%; height: auto; }\`.
- Unidades relativas (\`rem\`, \`%\`, \`clamp()\`) para tipografía fluida:
  \`font-size: clamp(1.5rem, 4vw, 3rem);\``,
          },
          {
            title: "Evaluación final: HTML y CSS",
            type: "quiz",
            duration: read(5),
            questions: [
              { prompt: "¿Qué etiqueta describe el contenido principal y único de una página?", options: ["<section>", "<main>", "<div>", "<body>"], correct: 1, explanation: "<main> envuelve el contenido principal; solo debe haber uno visible por página." },
              { prompt: "¿Qué selector tiene mayor especificidad?", options: ["p", ".nota", "#aviso", "div p"], correct: 2, explanation: "Un ID (1,0,0) supera a clases (0,1,0) y etiquetas (0,0,1)." },
              { prompt: "¿Qué herramienta es más adecuada para un layout en dos dimensiones?", options: ["Flexbox", "CSS Grid", "float", "position: absolute"], correct: 1, explanation: "Grid controla filas y columnas a la vez." },
              { prompt: "En un enfoque mobile first, las media queries normalmente usan…", options: ["max-width", "min-width", "orientation", "aspect-ratio"], correct: 1, explanation: "Se parte del estilo móvil y se añaden reglas con min-width para pantallas mayores." },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "javascript-moderno",
    title: "JavaScript Moderno: de cero a interactivo",
    subtitle: "Variables, funciones, asincronía y el DOM con las prácticas actuales del lenguaje.",
    category: "desarrollo-web",
    instructor: "equipo-desarrollo",
    level: "intermediate",
    price: 89900,
    compareAt: 149900,
    featured: true,
    learn: [
      "Dominar tipos, funciones y estructuras de datos",
      "Manipular el DOM y gestionar eventos",
      "Trabajar con promesas y async/await",
      "Consumir APIs reales con fetch",
    ],
    requirements: ["Conocimientos básicos de HTML y CSS"],
    audience: ["Personas que terminaron un curso de HTML/CSS", "Desarrolladores que quieren actualizar su JavaScript"],
    description:
      "JavaScript es el lenguaje de la web. En este curso pasarás de los fundamentos a construir interfaces interactivas que consumen datos reales, con un enfoque en código claro, moderno y mantenible.",
    modules: [
      {
        title: "Fundamentos del lenguaje",
        lessons: [
          {
            title: "Variables, tipos y funciones",
            type: "article",
            preview: true,
            duration: read(10),
            body: `## let, const y tipos

\`\`\`js
const nombre = "Ada";     // no se puede reasignar
let intentos = 0;         // sí se puede reasignar
intentos += 1;
\`\`\`

Usa \`const\` por defecto y \`let\` solo cuando necesites reasignar. Evita \`var\`.

### Tipos primitivos
\`string\`, \`number\`, \`boolean\`, \`null\`, \`undefined\`, \`bigint\` y \`symbol\`. Todo lo demás es un **objeto**.

### Funciones flecha
\`\`\`js
const precioConIVA = (precio, iva = 0.16) => precio * (1 + iva);
precioConIVA(100); // 116
\`\`\`

Compara siempre con \`===\` para evitar conversiones implícitas inesperadas.`,
          },
          {
            title: "Arreglos y objetos",
            type: "article",
            duration: read(10),
            body: `## Transformar datos sin mutarlos

\`\`\`js
const cursos = [
  { titulo: "HTML", horas: 6 },
  { titulo: "JS", horas: 12 },
];

const largos = cursos.filter((c) => c.horas > 8);
const titulos = cursos.map((c) => c.titulo);
const total = cursos.reduce((suma, c) => suma + c.horas, 0);
\`\`\`

### Desestructuración y spread
\`\`\`js
const { titulo, horas } = cursos[0];
const actualizado = { ...cursos[0], horas: 7 };
\`\`\`

Trabajar con copias en lugar de mutar evita errores difíciles de rastrear, especialmente en frameworks como React.`,
          },
        ],
      },
      {
        title: "El navegador y la asincronía",
        lessons: [
          {
            title: "El DOM y los eventos",
            type: "article",
            duration: read(12),
            body: `## Seleccionar y reaccionar

\`\`\`js
const boton = document.querySelector("#suscribir");
const mensaje = document.querySelector("#mensaje");

boton.addEventListener("click", () => {
  mensaje.textContent = "¡Gracias por suscribirte!";
});
\`\`\`

### Delegación de eventos
En listas dinámicas registra un solo manejador en el contenedor:

\`\`\`js
lista.addEventListener("click", (e) => {
  const item = e.target.closest("[data-id]");
  if (item) eliminar(item.dataset.id);
});
\`\`\`

Usa \`textContent\` en lugar de \`innerHTML\` cuando insertes texto del usuario: evita ataques XSS.`,
          },
          {
            title: "Promesas, async/await y fetch",
            type: "article",
            duration: read(12),
            body: `## Código asíncrono legible

\`\`\`js
async function cargarCursos() {
  try {
    const res = await fetch("/api/cursos");
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
    return await res.json();
  } catch (error) {
    console.error("No se pudieron cargar los cursos", error);
    return [];
  }
}
\`\`\`

### Peticiones en paralelo
\`\`\`js
const [usuario, cursos] = await Promise.all([getUsuario(), getCursos()]);
\`\`\`

Siempre muestra al usuario tres estados: **cargando**, **error** y **éxito**.`,
          },
          {
            title: "Evaluación: JavaScript",
            type: "quiz",
            duration: read(5),
            questions: [
              { prompt: "¿Qué declaración usarías por defecto para una variable que no se reasigna?", options: ["var", "let", "const", "static"], correct: 2, explanation: "const comunica que la referencia no cambiará." },
              { prompt: "¿Qué método devuelve un nuevo arreglo solo con los elementos que cumplen una condición?", options: ["map", "filter", "reduce", "forEach"], correct: 1, explanation: "filter crea un arreglo con los elementos que pasan la prueba." },
              { prompt: "Para insertar texto escrito por un usuario en la página de forma segura usas…", options: ["innerHTML", "outerHTML", "textContent", "document.write"], correct: 2, explanation: "textContent no interpreta HTML, evitando XSS." },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "react-nextjs-produccion",
    title: "React y Next.js para producción",
    subtitle: "Componentes, estado, Server Components y despliegue de aplicaciones reales.",
    category: "desarrollo-web",
    instructor: "equipo-desarrollo",
    level: "advanced",
    price: 149900,
    compareAt: 249900,
    learn: [
      "Pensar la interfaz en componentes reutilizables",
      "Gestionar estado y efectos correctamente",
      "Usar Server Components y Server Actions",
      "Desplegar con buenas prácticas de rendimiento y seguridad",
    ],
    requirements: ["JavaScript moderno (ES2020+)", "Nociones de HTML y CSS"],
    audience: ["Desarrolladores frontend", "Equipos que migran a Next.js"],
    description:
      "Un recorrido práctico por React y Next.js orientado a productos reales: arquitectura de componentes, obtención de datos en el servidor, formularios con validación y despliegue.",
    modules: [
      {
        title: "React esencial",
        lessons: [
          { title: "Componentes y props", type: "article", preview: true, duration: read(10), body: `## La interfaz como función de los datos

\`\`\`jsx
function TarjetaCurso({ titulo, nivel }) {
  return (
    <article className="tarjeta">
      <h3>{titulo}</h3>
      <span>{nivel}</span>
    </article>
  );
}
\`\`\`

Un componente recibe **props** y devuelve UI. Mantén los componentes pequeños, con una sola responsabilidad, y compón interfaces complejas a partir de piezas simples.` },
          { title: "Estado y efectos", type: "article", duration: read(12), body: `## useState y useEffect con criterio

\`\`\`jsx
const [abierto, setAbierto] = useState(false);
\`\`\`

- El **estado** es memoria del componente que, al cambiar, provoca un nuevo render.
- Un **efecto** sincroniza el componente con algo externo (una suscripción, el título del documento).

> Si puedes calcular un valor a partir de props o estado, **no** lo guardes en estado ni lo sincronices con un efecto: calcúlalo durante el render.` },
        ],
      },
      {
        title: "Next.js en producción",
        lessons: [
          { title: "Server Components y obtención de datos", type: "article", duration: read(14), body: `## Datos en el servidor

En el App Router los componentes son **de servidor** por defecto: pueden leer la base de datos directamente y no envían su código al navegador.

\`\`\`tsx
export default async function Page() {
  const cursos = await db.cursos.findMany();
  return <ListaCursos cursos={cursos} />;
}
\`\`\`

Marca con \`"use client"\` solo los componentes que necesitan interactividad (estado, eventos). Así reduces el JavaScript que descarga el usuario.` },
          { title: "Server Actions y seguridad", type: "article", duration: read(12), body: `## Mutaciones seguras

Una Server Action es una función que se ejecuta en el servidor y puede invocarse desde un formulario.

Reglas de oro:
1. **Valida** siempre la entrada (por ejemplo con Zod).
2. **Autoriza** dentro de la acción: verifica la sesión y el rol, nunca confíes en la UI.
3. **No devuelvas** datos sensibles al cliente.
4. Mantén secretos solo en variables de entorno del servidor.` },
          { title: "Evaluación: React y Next.js", type: "quiz", duration: read(5), questions: [
            { prompt: "En el App Router, los componentes son por defecto…", options: ["De cliente", "De servidor", "Estáticos sin datos", "Web Components"], correct: 1, explanation: "Los componentes del App Router son Server Components salvo que declares \"use client\"." },
            { prompt: "¿Dónde debe verificarse la autorización de una Server Action?", options: ["En el botón", "En el CSS", "Dentro de la propia acción en el servidor", "En localStorage"], correct: 2, explanation: "La UI puede manipularse; la verificación debe hacerse en el servidor." },
            { prompt: "Si un valor se puede calcular a partir de props, lo correcto es…", options: ["Guardarlo en estado", "Sincronizarlo con useEffect", "Calcularlo durante el render", "Guardarlo en una cookie"], correct: 2, explanation: "Evita estado redundante: calcúlalo al renderizar." },
          ] },
        ],
      },
    ],
  },
  {
    slug: "introduccion-inteligencia-artificial",
    title: "Introducción a la Inteligencia Artificial",
    subtitle: "Qué es la IA, cómo funcionan los modelos de lenguaje y cómo usarlos con criterio.",
    category: "inteligencia-artificial",
    instructor: "laboratorio-ia",
    level: "beginner",
    price: 0,
    featured: true,
    learn: [
      "Distinguir IA, machine learning y deep learning",
      "Entender cómo aprende un modelo a partir de datos",
      "Escribir buenas instrucciones (prompts)",
      "Reconocer limitaciones, sesgos y riesgos",
    ],
    requirements: ["Ninguno: curso para todo público"],
    audience: ["Cualquier persona curiosa por la IA", "Profesionales que quieren aplicarla en su trabajo"],
    description:
      "Una introducción clara y sin tecnicismos innecesarios a la inteligencia artificial: sus conceptos clave, cómo funcionan los modelos actuales y cómo aprovecharlos de forma responsable.",
    modules: [
      {
        title: "Conceptos clave",
        lessons: [
          { title: "IA, machine learning y deep learning", type: "article", preview: true, duration: read(8), body: `## Tres círculos concéntricos

- **Inteligencia artificial:** el campo amplio de crear sistemas que realizan tareas que asociamos con la inteligencia.
- **Machine learning:** una rama de la IA en la que el sistema **aprende patrones a partir de datos** en vez de seguir reglas escritas a mano.
- **Deep learning:** machine learning con **redes neuronales profundas**, capaz de aprender representaciones complejas (imágenes, audio, lenguaje).

### Un ejemplo
Para detectar spam podrías escribir reglas ("si contiene *gratis*…"). Con machine learning, en cambio, das miles de correos etiquetados y el modelo descubre por sí mismo qué combinaciones de rasgos predicen el spam.` },
          { title: "Cómo aprende un modelo", type: "article", duration: read(10), body: `## Datos, error y ajuste

1. El modelo hace una **predicción**.
2. Se compara con la respuesta correcta y se mide el **error** (función de pérdida).
3. Se **ajustan los parámetros** para reducir ese error (descenso de gradiente).
4. Se repite millones de veces.

### Entrenamiento vs. evaluación
Separamos los datos en **entrenamiento** y **prueba**. Si el modelo acierta mucho con los datos de entrenamiento pero falla con los nuevos, está **sobreajustado**: memorizó en lugar de generalizar.` },
        ],
      },
      {
        title: "IA generativa en la práctica",
        lessons: [
          { title: "Modelos de lenguaje y prompts efectivos", type: "article", duration: read(12), body: `## Cómo funcionan los LLM

Un modelo de lenguaje predice el siguiente fragmento de texto a partir de lo anterior. Entrenado con enormes cantidades de texto, aprende gramática, hechos y patrones de razonamiento.

### Prompts que funcionan
- **Contexto:** quién eres y para qué lo necesitas.
- **Tarea concreta:** qué quieres exactamente.
- **Formato:** cómo quieres la respuesta (lista, tabla, longitud).
- **Ejemplos:** muestra una entrada y la salida esperada.

> Mal: "Háblame de marketing".
> Mejor: "Soy dueña de una cafetería en Puebla. Dame 5 ideas de publicaciones para Instagram de esta semana, en una tabla con día, idea y texto sugerido."` },
          { title: "Limitaciones, sesgos y uso responsable", type: "article", duration: read(9), body: `## Usar la IA con criterio

- **Alucinaciones:** los modelos pueden generar datos falsos con total seguridad. Verifica cifras, citas y fuentes.
- **Sesgos:** reflejan los sesgos de sus datos de entrenamiento.
- **Privacidad:** no compartas datos personales o confidenciales en herramientas que no controlas.
- **Responsabilidad:** la decisión final y sus consecuencias son tuyas, no del modelo.` },
          { title: "Ejercicio: diseña tu asistente", type: "exercise", duration: read(15), body: `## Objetivo
Escribir un prompt de sistema para un asistente útil en tu trabajo o estudios.

1. Define el **rol** del asistente y su público.
2. Lista **3 reglas** que debe seguir siempre.
3. Indica el **formato** de sus respuestas.
4. Pruébalo con NEXUS AI desde el aula y mejora el prompt dos veces según los resultados.` },
          { title: "Evaluación: fundamentos de IA", type: "quiz", duration: read(5), questions: [
            { prompt: "El machine learning se caracteriza por…", options: ["Seguir reglas escritas a mano", "Aprender patrones a partir de datos", "Funcionar sin datos", "Ser siempre deep learning"], correct: 1, explanation: "El ML aprende patrones de datos en lugar de reglas explícitas." },
            { prompt: "Un modelo que acierta en entrenamiento pero falla con datos nuevos está…", options: ["Subajustado", "Sobreajustado", "Normalizado", "Cuantizado"], correct: 1, explanation: "Sobreajuste: memorizó los datos en lugar de generalizar." },
            { prompt: "¿Qué hacer ante una cifra importante generada por un modelo de lenguaje?", options: ["Usarla directamente", "Verificarla en una fuente confiable", "Pedirle que la repita", "Ignorarla siempre"], correct: 1, explanation: "Los modelos pueden alucinar; verifica los datos críticos." },
          ] },
        ],
      },
    ],
  },
  {
    slug: "python-ciencia-de-datos",
    title: "Python para Ciencia de Datos",
    subtitle: "Analiza, limpia y visualiza datos con Python, pandas y buenas prácticas.",
    category: "ciencia-de-datos",
    instructor: "equipo-datos",
    level: "beginner",
    price: 119900,
    compareAt: 199900,
    featured: true,
    learn: [
      "Escribir Python claro y efectivo",
      "Cargar y limpiar datos con pandas",
      "Responder preguntas de negocio con agregaciones",
      "Comunicar hallazgos con visualizaciones",
    ],
    requirements: ["No se requiere experiencia previa en programación"],
    audience: ["Analistas que usan hojas de cálculo", "Estudiantes que quieren iniciar en datos"],
    description:
      "Aprende el flujo de trabajo completo de un análisis de datos con Python: desde cargar un archivo hasta presentar conclusiones claras y respaldadas por evidencia.",
    modules: [
      { title: "Python esencial", lessons: [
        { title: "Tu primer análisis con Python", type: "article", preview: true, duration: read(10), body: `## Python en 10 minutos

\`\`\`python
ventas = [1200, 950, 1800, 1430]
promedio = sum(ventas) / len(ventas)
print(f"Promedio: {promedio:.2f}")
\`\`\`

- Las **listas** guardan secuencias; los **diccionarios** asocian claves con valores.
- Las *f-strings* formatean texto de manera legible.
- La indentación forma parte de la sintaxis: define los bloques de código.` },
        { title: "Funciones y estructuras de datos", type: "article", duration: read(10), body: `## Reutiliza tu lógica

\`\`\`python
def variacion(actual: float, anterior: float) -> float:
    """Variación porcentual entre dos periodos."""
    if anterior == 0:
        return 0.0
    return (actual - anterior) / anterior * 100
\`\`\`

Documenta tus funciones con *docstrings* y usa anotaciones de tipo: tu yo del futuro te lo agradecerá.` },
      ] },
      { title: "Análisis con pandas", lessons: [
        { title: "DataFrames: cargar y limpiar", type: "article", duration: read(14), body: `## pandas en acción

\`\`\`python
import pandas as pd

df = pd.read_csv("ventas.csv", parse_dates=["fecha"])
df = df.drop_duplicates()
df["monto"] = df["monto"].fillna(0)
df.info()
\`\`\`

Antes de analizar, **inspecciona**: tipos de columnas, valores nulos, duplicados y rangos imposibles (precios negativos, fechas futuras).` },
        { title: "Agrupar, resumir y visualizar", type: "article", duration: read(14), body: `## De datos a respuestas

\`\`\`python
por_mes = (df.groupby(df["fecha"].dt.to_period("M"))["monto"]
             .sum()
             .rename("ingresos"))
por_mes.plot(kind="bar", title="Ingresos por mes")
\`\`\`

Cada gráfica debe responder **una pregunta**. Ponle un título que diga la conclusión, no solo el tema: *"Los ingresos crecieron 18 % en el trimestre"*.` },
        { title: "Evaluación: Python y pandas", type: "quiz", duration: read(5), questions: [
          { prompt: "¿Qué estructura de Python asocia claves con valores?", options: ["Lista", "Tupla", "Diccionario", "Conjunto"], correct: 2, explanation: "Los diccionarios mapean claves a valores." },
          { prompt: "¿Qué método de pandas elimina filas duplicadas?", options: ["dropna()", "drop_duplicates()", "unique()", "clean()"], correct: 1, explanation: "drop_duplicates() elimina filas repetidas." },
          { prompt: "Un buen título de gráfica…", options: ["Solo nombra las variables", "Comunica la conclusión", "Siempre está vacío", "Incluye el código"], correct: 1, explanation: "El título debe decir qué aprendemos de la gráfica." },
        ] },
      ] },
    ],
  },
  {
    slug: "machine-learning-aplicado",
    title: "Machine Learning Aplicado",
    subtitle: "Entrena, evalúa y pon en producción modelos con scikit-learn.",
    category: "inteligencia-artificial",
    instructor: "laboratorio-ia",
    level: "intermediate",
    price: 179900,
    compareAt: 299900,
    learn: [
      "Plantear problemas de clasificación y regresión",
      "Preparar datos y evitar fugas de información",
      "Evaluar modelos con las métricas correctas",
      "Llevar un modelo a producción de forma responsable",
    ],
    requirements: ["Python y pandas a nivel básico"],
    audience: ["Analistas de datos", "Desarrolladores que quieren incorporar modelos"],
    description:
      "Un curso práctico para construir modelos de machine learning que funcionen fuera del notebook: desde el planteamiento del problema hasta la evaluación y el monitoreo.",
    modules: [
      { title: "Modelado", lessons: [
        { title: "Plantear el problema", type: "article", preview: true, duration: read(9), body: `## Antes del modelo, la pregunta

- **Clasificación:** predecir una categoría (¿abandonará el curso? sí/no).
- **Regresión:** predecir un número (¿cuántas inscripciones tendremos?).

Define también **cómo medirás el éxito** y cuál es la línea base: un modelo que no supera una regla simple no aporta valor.` },
        { title: "Entrenar con scikit-learn", type: "article", duration: read(14), body: `## Pipeline reproducible

\`\`\`python
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
modelo = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
modelo.fit(X_train, y_train)
\`\`\`

El **pipeline** garantiza que la normalización se aprenda solo con datos de entrenamiento, evitando fugas de información.` },
      ] },
      { title: "Evaluación y producción", lessons: [
        { title: "Métricas que importan", type: "article", duration: read(12), body: `## Más allá de la exactitud

Con clases desbalanceadas la exactitud engaña. Usa:
- **Precisión:** de lo que predije positivo, ¿cuánto lo era?
- **Recall:** de los positivos reales, ¿cuántos detecté?
- **F1:** equilibrio entre ambas.
- **Matriz de confusión** para ver los tipos de error.

Elige la métrica según el costo de cada error en tu negocio.` },
        { title: "Evaluación: ML aplicado", type: "quiz", duration: read(5), questions: [
          { prompt: "Predecir el número de inscripciones del próximo mes es un problema de…", options: ["Clasificación", "Regresión", "Clustering", "Reducción de dimensionalidad"], correct: 1, explanation: "Se predice un valor numérico continuo." },
          { prompt: "¿Para qué sirve un pipeline de scikit-learn?", options: ["Para graficar", "Para encadenar preprocesamiento y modelo evitando fugas", "Para subir datos a la nube", "Para acelerar Python"], correct: 1, explanation: "Asegura que las transformaciones se ajusten solo con los datos de entrenamiento." },
          { prompt: "Con clases muy desbalanceadas, ¿qué métrica es engañosa por sí sola?", options: ["Recall", "F1", "Exactitud (accuracy)", "Matriz de confusión"], correct: 2, explanation: "Un modelo que siempre predice la clase mayoritaria puede tener alta exactitud." },
        ] },
      ] },
    ],
  },
  {
    slug: "diseno-ui-ux",
    title: "Diseño UI/UX: interfaces que convierten",
    subtitle: "Investigación, jerarquía visual y sistemas de diseño para productos digitales.",
    category: "diseno",
    instructor: "estudio-diseno",
    level: "intermediate",
    price: 99900,
    compareAt: 159900,
    learn: [
      "Investigar necesidades reales de usuarios",
      "Construir jerarquía visual clara",
      "Diseñar componentes y sistemas consistentes",
      "Evaluar la usabilidad con pruebas rápidas",
    ],
    requirements: ["Interés en el diseño de producto", "Figma (gratuito) instalado"],
    audience: ["Diseñadores gráficos que migran a producto", "Desarrolladores y emprendedores"],
    description:
      "Aprende a diseñar interfaces claras, accesibles y orientadas a objetivos, con un proceso que va desde la investigación hasta el sistema de diseño.",
    modules: [
      { title: "Fundamentos", lessons: [
        { title: "UX vs. UI", type: "article", preview: true, duration: read(7), body: `## Dos disciplinas complementarias

- **UX (experiencia de usuario):** ¿resuelve el producto un problema real de forma sencilla?
- **UI (interfaz):** ¿cómo se ve y se siente cada pantalla?

Una interfaz bella con un flujo confuso fracasa. Empieza por entender a las personas y sus objetivos.` },
        { title: "Jerarquía visual", type: "article", duration: read(10), body: `## Guiar la mirada

Herramientas: **tamaño, peso, color, contraste, espacio y posición**.

- Una sola acción principal por pantalla, claramente destacada.
- Usa el espacio en blanco para agrupar (ley de proximidad).
- Contraste mínimo de texto 4.5:1 para accesibilidad (WCAG AA).` },
      ] },
      { title: "Sistemas y validación", lessons: [
        { title: "Sistemas de diseño", type: "article", duration: read(10), body: `## Consistencia a escala

Un sistema de diseño define **tokens** (color, tipografía, espaciado), **componentes** (botones, campos, tarjetas) y **patrones** de uso. Reduce decisiones repetidas y acelera al equipo.` },
        { title: "Ejercicio: prueba de usabilidad de 5 usuarios", type: "exercise", duration: read(25), body: `## Objetivo
Detectar los principales problemas de un flujo con una prueba ligera.

1. Elige un flujo (por ejemplo, registrarse en una app).
2. Escribe 3 tareas realistas.
3. Observa a 5 personas sin ayudarlas y anota dónde dudan.
4. Prioriza los 3 problemas más frecuentes y propone una mejora para cada uno.` },
      ] },
    ],
  },
  {
    slug: "marketing-digital-growth",
    title: "Marketing Digital y Growth",
    subtitle: "Atrae, convierte y retiene clientes con estrategia y métricas.",
    category: "negocios",
    instructor: "equipo-negocios",
    level: "beginner",
    price: 79900,
    learn: [
      "Definir tu cliente ideal y propuesta de valor",
      "Construir un embudo de adquisición",
      "Medir con métricas accionables",
      "Diseñar experimentos de crecimiento",
    ],
    requirements: ["Ninguno"],
    audience: ["Emprendedores", "Responsables de marketing en pymes"],
    description:
      "Un método práctico para hacer crecer un negocio digital con marketing basado en datos, sin depender de trucos ni de presupuestos enormes.",
    modules: [
      { title: "Estrategia", lessons: [
        { title: "Cliente ideal y propuesta de valor", type: "article", preview: true, duration: read(9), body: `## Empieza por quién

Describe a tu cliente ideal: su problema, lo que ha intentado y por qué no le funcionó. Tu **propuesta de valor** responde en una frase: *para quién*, *qué problema resuelves* y *por qué tú*.` },
        { title: "El embudo AARRR", type: "article", duration: read(10), body: `## Métricas pirata

**A**dquisición → **A**ctivación → **R**etención → **R**eferencia → **R**evenue (ingresos).

Identifica la etapa con mayor fuga y enfoca ahí tus esfuerzos: mejorar la retención suele multiplicar el impacto de todo lo demás.` },
      ] },
      { title: "Ejecución", lessons: [
        { title: "Experimentos de crecimiento", type: "article", duration: read(10), body: `## Hipótesis → prueba → aprendizaje

Formato: *"Creemos que **[cambio]** aumentará **[métrica]** porque **[razón]**. Lo sabremos si **[resultado medible]**."*

Prioriza con ICE: Impacto, Confianza y Facilidad (1–10 cada uno).` },
        { title: "Evaluación: marketing y growth", type: "quiz", duration: read(5), questions: [
          { prompt: "¿Qué etapa NO forma parte del embudo AARRR?", options: ["Activación", "Retención", "Reputación", "Referencia"], correct: 2, explanation: "AARRR: Adquisición, Activación, Retención, Referencia y Revenue." },
          { prompt: "Una propuesta de valor debe responder…", options: ["Cuántos empleados tienes", "Para quién, qué problema resuelves y por qué tú", "Tu historia completa", "El precio"], correct: 1, explanation: "Debe ser específica y centrada en el cliente." },
          { prompt: "En el método ICE, la «C» significa…", options: ["Costo", "Confianza", "Canal", "Conversión"], correct: 1, explanation: "Impacto, Confianza y Facilidad (Ease)." },
        ] },
      ] },
    ],
  },
  {
    slug: "git-github-esencial",
    title: "Git y GitHub esencial",
    subtitle: "Guarda, versiona y colabora en tu código sin miedo a romper nada.",
    category: "desarrollo-web",
    instructor: "equipo-desarrollo",
    level: "beginner",
    price: 0,
    learn: [
      "Entender commits, ramas y el historial",
      "Colaborar con pull requests",
      "Resolver conflictos de fusión",
    ],
    requirements: ["Una computadora con terminal"],
    audience: ["Personas que empiezan a programar"],
    description: "El control de versiones es una habilidad indispensable. Aprende Git desde cero y colabora en GitHub como lo hacen los equipos profesionales.",
    modules: [
      { title: "Control de versiones", lessons: [
        { title: "Commits y el historial", type: "article", preview: true, duration: read(9), body: `## Fotografías de tu proyecto

\`\`\`bash
git init
git add index.html
git commit -m "Agrega página inicial"
git log --oneline
\`\`\`

Un buen mensaje de commit explica **qué** cambia y **por qué**, en tiempo presente y de forma breve.` },
        { title: "Ramas y pull requests", type: "article", duration: read(10), body: `## Trabajar en paralelo

\`\`\`bash
git switch -c mejora-navegacion
# … cambios y commits …
git push -u origin mejora-navegacion
\`\`\`

En GitHub abre un **pull request** para que el equipo revise antes de fusionar a la rama principal.` },
        { title: "Evaluación: Git", type: "quiz", duration: read(4), questions: [
          { prompt: "¿Qué comando crea una rama nueva y te cambia a ella?", options: ["git branch -d", "git switch -c", "git merge", "git init"], correct: 1, explanation: "git switch -c <nombre> crea la rama y cambia a ella." },
          { prompt: "Un pull request sirve para…", options: ["Borrar el repositorio", "Proponer y revisar cambios antes de fusionarlos", "Descargar Git", "Cifrar el código"], correct: 1, explanation: "Permite revisión y discusión antes del merge." },
        ] },
      ] },
    ],
  },
  {
    slug: "ciberseguridad-desarrolladores",
    title: "Ciberseguridad para desarrolladores",
    subtitle: "Protege tus aplicaciones web de las vulnerabilidades más comunes.",
    category: "ciberseguridad",
    instructor: "equipo-desarrollo",
    level: "intermediate",
    price: 129900,
    compareAt: 189900,
    learn: [
      "Reconocer las vulnerabilidades del OWASP Top 10",
      "Prevenir inyecciones y XSS",
      "Gestionar autenticación, sesiones y secretos",
    ],
    requirements: ["Experiencia básica desarrollando aplicaciones web"],
    audience: ["Desarrolladores web", "Líderes técnicos"],
    description: "La seguridad se diseña desde el inicio. Aprende a identificar y corregir las vulnerabilidades más frecuentes en aplicaciones web modernas.",
    modules: [
      { title: "Amenazas comunes", lessons: [
        { title: "OWASP Top 10 en la práctica", type: "article", preview: true, duration: read(12), body: `## Las fallas más frecuentes

Control de acceso roto, fallas criptográficas, inyección, diseño inseguro, mala configuración, componentes vulnerables, fallas de autenticación, integridad de software, registro insuficiente y SSRF.

El **control de acceso roto** encabeza la lista: verifica permisos en el servidor en *cada* petición.` },
        { title: "Inyección SQL y XSS", type: "article", duration: read(12), body: `## Nunca concatenes entradas

\`\`\`js
// ❌ Vulnerable
db.query("SELECT * FROM users WHERE email = '" + email + "'");
// ✅ Consulta parametrizada
db.query("SELECT * FROM users WHERE email = $1", [email]);
\`\`\`

Para XSS: escapa la salida, evita \`innerHTML\` con datos del usuario y define una **Content Security Policy**.` },
        { title: "Evaluación: seguridad", type: "quiz", duration: read(4), questions: [
          { prompt: "¿Cuál es la defensa principal contra la inyección SQL?", options: ["Ocultar errores", "Consultas parametrizadas", "Usar HTTPS", "Minificar el código"], correct: 1, explanation: "Los parámetros separan datos de instrucciones SQL." },
          { prompt: "¿Dónde debe verificarse el control de acceso?", options: ["Solo en el frontend", "En el servidor en cada petición", "En el CSS", "En la URL"], correct: 1, explanation: "El cliente puede manipularse; el servidor decide." },
        ] },
      ] },
    ],
  },
];

export const bundles = [
  {
    slug: "ruta-desarrollador-web",
    title: "Ruta Desarrollador Web",
    description: "JavaScript moderno, React y Next.js y ciberseguridad en un solo paquete para dar el salto a desarrollo profesional.",
    price: 299900,
    compareAt: 439700,
    courses: ["javascript-moderno", "react-nextjs-produccion", "ciberseguridad-desarrolladores"],
  },
  {
    slug: "ruta-datos-e-ia",
    title: "Ruta Datos e IA",
    description: "Python para ciencia de datos y Machine Learning aplicado: del análisis a los modelos en producción.",
    price: 249900,
    compareAt: 299800,
    courses: ["python-ciencia-de-datos", "machine-learning-aplicado"],
  },
];
