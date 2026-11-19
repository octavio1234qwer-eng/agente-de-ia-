/* =====================================================================
   DATOS DEL BIO LINK · La Casa de la Mantarraya
   ---------------------------------------------------------------------
   Aquí se cambia TODO: horarios, precios, textos, enlaces y promoción.

   Reglas para editar sin romper nada:
   1. Cambia solo lo que está entre comillas "..." o los números.
   2. No borres comas, llaves { } ni corchetes [ ].
   3. Guarda el archivo y recarga la página para ver el cambio.
   4. Las horas van en formato de 24 horas: "08:00", "20:00", "23:00".
      Para la medianoche escribe "24:00".
   ===================================================================== */

window.DATOS = {

  /* Dirección final donde vivirá esta página. El QR de las mesas apunta aquí.
     Si la cambias, cámbiala también en index.html (busca y reemplaza el
     texto completo) y vuelve a imprimir los QR desde qr/index.html. */
  SITE_URL: "https://casadelamantarraya.com/links/",

  negocio: {
    nombre: "La Casa de la Mantarraya",
    telefono: "+529982556502",          // para llamar (sin espacios)
    telefonoVisible: "998 255 6502",    // como se muestra en pantalla
    whatsapp: "5219984895643",          // para wa.me (sin + ni espacios)
    whatsappVisible: "998 489 5643",
    correo: "casadelamantarraya@gmail.com",
    direccion: {
      calle: "Av. Xpuhil Sur, Supermanzana 19, Manzana 2, Lote 26",
      corta: "Av. Xpuhil Sur, SM 19, Mz 2, Lt 26",
      cp: "77505",
      ciudad: "Cancún",
      estado: "Q. Roo",
      pais: "MX"
    },
    mapa: "https://www.google.com/maps/place/La+Casa+de+la+Mantarraya/data=!4m2!3m1!1s0x0:0xe06438217231a116",
    instagram: "https://www.instagram.com/lacasadelamantarraya/",
    facebook: "https://www.facebook.com/lacasadelamantarraya"
  },

  /* Páginas del sitio oficial. A estas se les agrega la etiqueta de medición
     (utm) automáticamente. */
  sitio: {
    es: {
      inicio: "https://casadelamantarraya.com/",
      menu: "https://casadelamantarraya.com/menu/",
      desayunos: "https://casadelamantarraya.com/desayunos/",
      tacos: "https://casadelamantarraya.com/tacos-de-mantarraya/",
      historia: "https://casadelamantarraya.com/nuestra-historia/",
      galeria: "https://casadelamantarraya.com/galeria/",
      reservaciones: "https://casadelamantarraya.com/reservaciones/",
      promociones: "https://casadelamantarraya.com/promociones-y-eventos/"
    },
    en: {
      inicio: "https://casadelamantarraya.com/en/",
      menu: "https://casadelamantarraya.com/en/menu/",
      desayunos: "https://casadelamantarraya.com/en/menu/",
      tacos: "https://casadelamantarraya.com/en/stingray-tacos/",
      historia: "https://casadelamantarraya.com/en/our-story/",
      galeria: "https://casadelamantarraya.com/en/gallery/",
      reservaciones: "https://casadelamantarraya.com/en/reservations/",
      promociones: "https://casadelamantarraya.com/en/specials-and-events/"
    }
  },

  /* HORARIO (hora de Cancún). Formato: ["abre", "cierra"].
     Si un día cierran, escribe: domingo: null,
     Nota: Google y algunos directorios muestran apertura a la 1:00 p. m.;
     el sitio oficial dice 8:00 a. m. Confirma cuál es el correcto. */
  horario: {
    domingo:   ["08:00", "23:00"],
    lunes:     ["08:00", "23:00"],
    martes:    ["08:00", "23:00"],
    miercoles: ["08:00", "23:00"],
    jueves:    ["08:00", "23:00"],
    viernes:   ["08:00", "24:00"],
    sabado:    ["08:00", "24:00"]
  },

  /* Noches de salsa. "avisarDesde": a partir de qué hora del mismo día
     aparece el aviso "Esta noche: salsa en vivo" arriba de la página. */
  salsa: {
    dias: ["viernes", "sabado"],
    inicio: "20:00",
    fin: "23:00",
    avisarDesde: "19:00"
  },

  /* Reservaciones por WhatsApp.
     horas: botones de hora que puede elegir el cliente (se ocultan solos
     las que caen fuera del horario o que ya pasaron hoy). */
  reservas: {
    horas: ["09:00", "10:30", "13:00", "14:30", "16:00", "18:00", "19:30", "20:00", "21:00", "22:00"],
    maxPersonas: 12,
    /* {personas}, {dia} y {a_las_hora} se rellenan solos. [BIOLINK] es la
       marca para que el equipo sepa que el cliente vino de esta página. */
    mensaje: {
      es: "¡Hola! Quiero reservar una mesa en La Casa de la Mantarraya para {personas} el {dia} {a_las_hora}. [BIOLINK]",
      en: "Hi! I'd like to book a table at La Casa de la Mantarraya for {personas} on {dia} {a_las_hora}. [BIOLINK]"
    }
  },

  /* PLATILLOS del carrusel "Lo que tienes que probar".
     precio: número en pesos, o null si no quieres mostrar precio.
     desde: true si el precio es "desde".
     foto: nombre de la foto en assets/img (sin el -400/-600 ni la extensión).
     enlace: "menu", "tacos", "desayunos"... (páginas de arriba) o una URL completa. */
  platillos: [
    {
      foto: "platillo-taco",
      precio: 179,
      enlace: "tacos",
      es: { nombre: "Tacos de mantarraya", detalle: "Al tamarindo · orden de 3", alt: "Taco de mantarraya servido en un plato blanco" },
      en: { nombre: "Stingray tacos", detalle: "Tamarind glaze · order of 3", alt: "Stingray taco served on a white plate" }
    },
    {
      foto: "platillo-pescadillas",
      precio: 159,
      enlace: "menu",
      es: { nombre: "Pescadillas de mantarraya", detalle: "Tortilla de maíz rellena y frita · 3 piezas", alt: "Pescadillas de mantarraya con jitomate y limón" },
      en: { nombre: "Stingray pescadillas", detalle: "Stuffed, fried corn tortillas · 3 pieces", alt: "Stingray pescadillas with tomato and lime" }
    },
    {
      foto: "platillo-tostadas",
      precio: 78,
      enlace: "menu",
      es: { nombre: "Tostadas de la casa", detalle: "Mantarraya a la vizcaína, 1 pieza · también de atún", alt: "Tostadas de La Casa de la Mantarraya en platos blancos" },
      en: { nombre: "House tostadas", detalle: "Stingray a la vizcaína, 1 piece · tuna too", alt: "Tostadas from La Casa de la Mantarraya on white plates" }
    },
    {
      foto: "platillo-ceviche",
      precio: 370,
      desde: true,
      enlace: "menu",
      es: { nombre: "Ceviche negro", detalle: "El emblemático de la casa · salsa tatemada", alt: "Ceviche negro con aguacate, pepino y zanahoria" },
      en: { nombre: "Black ceviche", detalle: "The house signature · charred salsa", alt: "Black ceviche with avocado, cucumber and carrot" }
    },
    {
      foto: "platillo-chilaquiles",
      precio: null,
      enlace: "desayunos",
      es: { nombre: "Chilaquiles rojos", detalle: "Desayunos desde las 8 a. m.", alt: "Chilaquiles rojos con crema, queso y cebolla morada" },
      en: { nombre: "Red chilaquiles", detalle: "Breakfast from 8 AM", alt: "Red chilaquiles with cream, cheese and red onion" }
    }
  ],

  /* PROMOCIÓN del momento. Para apagarla escribe  activa: false
     Para cambiarla, reemplaza los textos y el enlace. */
  promo: {
    activa: true,
    enlace: { es: "https://casadelamantarraya.com/promociones-y-eventos/#posadas", en: "https://casadelamantarraya.com/en/specials-and-events/#posadas" },
    es: { etiqueta: "Temporada", titulo: "Posadas 2026", detalle: "Menús de tres tiempos desde $380 por persona", accion: "Ver paquetes" },
    en: { etiqueta: "This season", titulo: "Posadas 2026", detalle: "Three-course menus from $380 MXN per person", accion: "See packages" }
  },

  /* Reseñas (actualízalas de vez en cuando). */
  resenas: {
    calificacion: 4.5,
    total: 880,              // número aproximado de reseñas en Google
    facebookRecomienda: 90   // % que recomienda en Facebook
  },

  /* Sellos pequeños. icono: pin, huella, parasol, auto, rehilete, pastel,
     balon, moneda, sol, maracas, estrella. */
  servicios: [
    { icono: "huella",   es: "Pet friendly",             en: "Pet friendly" },
    { icono: "parasol",  es: "Terraza al aire libre",    en: "Open-air terrace" },
    { icono: "auto",     es: "Estacionamiento",          en: "Parking" },
    { icono: "rehilete", es: "Área de niños",            en: "Kids' area" },
    { icono: "pastel",   es: "Salón para cumpleaños",    en: "Private room for birthdays" },
    { icono: "balon",    es: "Partidos en vivo",         en: "Live football matches" },
    { icono: "moneda",   es: "$200–300 por persona",     en: "$200–300 MXN per person" }
  ],

  /* TEXTOS de la página en español (es) e inglés (en). */
  textos: {
    es: {
      metaTitulo: "La Casa de la Mantarraya · Reserva tu mesa en Cancún",
      metaDescripcion: "Cocina de mar con recetas de tres generaciones. Reserva por WhatsApp, mira el menú y cómo llegar. Terraza, salsa en vivo y pet friendly en Cancún.",
      saltar: "Saltar al contenido",
      idioma: "Idioma",
      kicker: "Cocina de mar · Cancún",
      antesNombre: "La Casa de la",
      nombre: "Mantarraya",
      lema: "Con <em>sabor a casa</em>.",
      estadoAbierto: "Abierto ahora · cierra {cuando}",
      estadoPronto: "Cierra pronto · {cuando}",
      estadoAbreHoy: "Cerrado · abrimos hoy {cuando}",
      estadoAbreManana: "Abrimos mañana {cuando}",
      estadoAbreDia: "Abrimos el {dia} {cuando}",
      salsaHoy: "Esta noche: salsa en vivo de {inicio} a {fin} 💃",
      salsaAhora: "Salsa en vivo ahora · hasta las {fin} 💃",
      n01: "Reserva",
      ctaTitulo: "Reservar mesa",
      ctaSub: "Por WhatsApp · el equipo te confirma",
      llamar: "o llámanos al",
      n02: "Lo que tienes que probar",
      desliza: "Desliza",
      arrastra: "Arrastra",
      ver: "Ver",
      desde: "desde",
      menuCompleto: "Ver menú completo",
      menuCompletoSub: "Toda la carta, con precios",
      n03: "Antes de venir",
      mapaTitulo: "Cómo llegar",
      mapaSub: "Fuera de la Zona Hotelera",
      mapaAccion: "Abrir en Google Maps",
      salsaTitulo: "Noches de salsa",
      salsaSub: "{dias} · {inicio} a {fin}",
      salsaTexto: "Salsa y bachata en vivo. La banda acepta peticiones.",
      salsaAccion: "Aparta tu mesa",
      resenasDe: "en Google",
      resenasTotal: "unas {total} reseñas",
      resenasFacebook: "{pct} % lo recomienda en Facebook",
      resenasAccion: "Leer reseñas",
      desayunosTitulo: "Desayunos",
      desayunosSub: "Desde las {hora}",
      desayunosTexto: "Chilaquiles, huevos al gusto y brunch",
      desayunosAccion: "Ver desayunos",
      n04: "Nuestra historia",
      historiaFrase1: "Tres generaciones.",
      historiaFrase2: "Una misma mesa.",
      historiaTexto: "Recetas familiares de la Península de Yucatán, servidas en una terraza llena de plantas. Un rincón de Cancún para quedarte a la sobremesa.",
      historiaPie: "Nuestra entrada en Av. Xpuhil Sur",
      historiaAlt: "Fachada y acceso de La Casa de la Mantarraya en Cancún, con pérgola y plantas",
      historiaAccion: "Conoce nuestra historia",
      horarioTitulo: "Horario",
      cerrado: "Cerrado",
      deCinco: "de 5 en Google",
      redes: "Síguenos",
      sitioWeb: "Sitio web",
      lateralIzq: "Cocina de mar · Cancún, Q. Roo",
      lateralDer: "Tres generaciones · Una misma mesa",
      guardar: "Guardar contacto",
      compartir: "Compartir",
      copiado: "¡Enlace copiado!",
      copiarFallo: "Copia este enlace:",
      firma: "Con sabor a casa · Cancún, Q. Roo",
      giro: "Mover la mantarraya con tu celular",
      compartirTexto: "La Casa de la Mantarraya · Cocina de mar en Cancún",
      // Hoja de reserva
      hojaTitulo: "Reserva tu mesa",
      hojaPersonas: "¿Cuántas personas?",
      hojaDia: "¿Qué día?",
      hojaHoy: "Hoy",
      hojaManana: "Mañana",
      hojaOtra: "Otra fecha",
      hojaHora: "¿A qué hora?",
      hojaSinHoras: "Ese día ya no quedan horarios. Elige otro día.",
      hojaEligeHora: "Elige una hora para continuar",
      hojaMensaje: "Así se enviará tu mensaje",
      hojaEnviar: "Enviar por WhatsApp",
      hojaNota: "Tu mesa queda apartada cuando el equipo te confirma por WhatsApp.",
      hojaCerrar: "Cerrar",
      menos: "Una persona menos",
      mas: "Una persona más",
      persona: "persona",
      personas: "personas",
      masDe: "más de {n}",
      medianoche: "medianoche",
      aLaMedianoche: "a medianoche",
      aLas: "a las",
      aLa: "a la"
    },
    en: {
      metaTitulo: "La Casa de la Mantarraya · Book a table in Cancún",
      metaDescripcion: "Seafood cooking from three generations of family recipes. Book on WhatsApp, see the menu and get directions. Terrace, live salsa and pet friendly in Cancún.",
      saltar: "Skip to content",
      idioma: "Language",
      kicker: "Seafood kitchen · Cancún",
      antesNombre: "La Casa de la",
      nombre: "Mantarraya",
      lema: "It <em>tastes like home</em>.",
      estadoAbierto: "Open now · closes {cuando}",
      estadoPronto: "Closing soon · {cuando}",
      estadoAbreHoy: "Closed · opens today {cuando}",
      estadoAbreManana: "Opens tomorrow {cuando}",
      estadoAbreDia: "Opens {dia} {cuando}",
      salsaHoy: "Tonight: live salsa from {inicio} to {fin} 💃",
      salsaAhora: "Live salsa now · until {fin} 💃",
      n01: "Book",
      ctaTitulo: "Book a table",
      ctaSub: "On WhatsApp · our team confirms",
      llamar: "or call us at",
      n02: "What you have to try",
      desliza: "Swipe",
      arrastra: "Drag",
      ver: "View",
      desde: "from",
      menuCompleto: "See the full menu",
      menuCompletoSub: "Everything we cook, with prices",
      n03: "Before you come",
      mapaTitulo: "Getting here",
      mapaSub: "Outside the Hotel Zone",
      mapaAccion: "Open in Google Maps",
      salsaTitulo: "Salsa nights",
      salsaSub: "{dias} · {inicio} to {fin}",
      salsaTexto: "Live salsa and bachata. The band takes requests.",
      salsaAccion: "Save your table",
      resenasDe: "on Google",
      resenasTotal: "about {total} reviews",
      resenasFacebook: "{pct}% recommend us on Facebook",
      resenasAccion: "Read reviews",
      desayunosTitulo: "Breakfast",
      desayunosSub: "From {hora}",
      desayunosTexto: "Chilaquiles, eggs your way and brunch",
      desayunosAccion: "See breakfast",
      n04: "Our story",
      historiaFrase1: "Three generations.",
      historiaFrase2: "One table.",
      historiaTexto: "Family recipes from the Yucatán Peninsula, served on a terrace full of plants. A corner of Cancún made for lingering after the meal.",
      historiaPie: "Our entrance on Av. Xpuhil Sur",
      historiaAlt: "Entrance of La Casa de la Mantarraya in Cancún, with a pergola and plants",
      historiaAccion: "Read our story",
      horarioTitulo: "Hours",
      cerrado: "Closed",
      deCinco: "out of 5 on Google",
      redes: "Follow us",
      sitioWeb: "Website",
      lateralIzq: "Seafood kitchen · Cancún, Q. Roo",
      lateralDer: "Three generations · One table",
      guardar: "Save contact",
      compartir: "Share",
      copiado: "Link copied!",
      copiarFallo: "Copy this link:",
      firma: "Tastes like home · Cancún, Q. Roo",
      giro: "Move the manta ray with your phone",
      compartirTexto: "La Casa de la Mantarraya · Seafood kitchen in Cancún",
      hojaTitulo: "Book your table",
      hojaPersonas: "How many people?",
      hojaDia: "Which day?",
      hojaHoy: "Today",
      hojaManana: "Tomorrow",
      hojaOtra: "Another date",
      hojaHora: "What time?",
      hojaSinHoras: "No times left that day. Please pick another day.",
      hojaEligeHora: "Pick a time to continue",
      hojaMensaje: "Your message will read",
      hojaEnviar: "Send on WhatsApp",
      hojaNota: "Your table is held once our team confirms on WhatsApp.",
      hojaCerrar: "Close",
      menos: "One person fewer",
      mas: "One more person",
      persona: "person",
      personas: "people",
      masDe: "more than {n}",
      medianoche: "midnight",
      aLaMedianoche: "at midnight",
      aLas: "at",
      aLa: "at"
    }
  }
};
