/* =====================================================================
   La Casa de la Mantarraya · bio link
   Lógica de la página. No necesitas editar este archivo: todo lo que
   cambia (horarios, precios, textos, promoción) vive en js/data.js.
   ===================================================================== */

/* ---------------------------------------------------------------------
   MEDICIÓN: conecta aquí Google Analytics o Meta Pixel cuando quieras.
   Cada clic en un elemento con data-track="..." llama a esta función.
   Ejemplos (descomenta el que uses):
     window.gtag && gtag('event', evento, datos);              // GA4
     window.fbq && fbq('trackCustom', evento, datos);          // Meta Pixel
   --------------------------------------------------------------------- */
function track(evento, datos) {
  // vacío a propósito
}

(function () {
  'use strict';

  var D = window.DATOS;
  if (!D) return;

  var doc = document;
  var html = doc.documentElement;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var punteroFino = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var escritorio = matchMedia('(min-width: 900px)');
  var params = new URLSearchParams(location.search);
  var ZONA = 'America/Cancun';

  var DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  var NOMBRE_DIA = {
    es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  };
  var DIA_CORTO = {
    es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  };
  var MES = {
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };

  /* ---------- Utilidades ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rellena(plantilla, valores) {
    return String(plantilla).replace(/\{(\w+)\}/g, function (m, k) { return valores[k] != null ? valores[k] : m; });
  }
  function guarda(tipo, k, v) { try { window[tipo].setItem(k, v); } catch (e) {} }
  function lee(tipo, k) { try { return window[tipo].getItem(k); } catch (e) { return null; } }

  /* ---------- Idioma ----------
     Siempre abre en español (en celular y en computadora, sin importar el
     idioma del navegador). El visitante cambia con el botón EN y la página
     recuerda su elección. ?lang=en abre directo en inglés. */
  var idioma = (function () {
    var p = params.get('lang');
    if (p === 'es' || p === 'en') return p;
    var g = lee('localStorage', 'mm-idioma');
    if (g === 'es' || g === 'en') return g;
    return 'es';
  })();
  var T = D.textos[idioma] || D.textos.es;

  /* ---------- Origen de la visita y etiquetas utm ---------- */
  var fuente = params.get('src') || lee('sessionStorage', 'mm-src') || 'instagram';
  guarda('sessionStorage', 'mm-src', fuente);
  function conUtm(url) {
    try {
      var u = new URL(url);
      if (/(^|\.)casadelamantarraya\.com$/.test(u.hostname)) {
        u.searchParams.set('utm_source', fuente);
        u.searchParams.set('utm_medium', 'biolink');
      }
      return u.href;
    } catch (e) { return url; }
  }
  function paginaSitio(clave) {
    var s = D.sitio[idioma] || D.sitio.es;
    return /^https?:/.test(clave) ? clave : (s[clave] || D.sitio.es[clave] || s.inicio);
  }

  /* ---------- Hora de Cancún (con simulación ?ahora=2026-11-23T07:00) ---------- */
  function crear(y, m, d, min) {
    var f = new Date(Date.UTC(y, m - 1, d));
    return { fecha: f, dow: f.getUTCDay(), min: min };
  }
  function ahora() {
    var sim = params.get('ahora');
    var m = sim && sim.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/);
    if (m) return crear(+m[1], +m[2], +m[3], (+m[4] || 0) * 60 + (+m[5] || 0));
    var p = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return crear(+p.year, +p.month, +p.day, (+p.hour % 24) * 60 + (+p.minute));
  }
  function masDias(fecha, n) { return new Date(fecha.getTime() + n * 864e5); }
  function iso(fecha) { return fecha.toISOString().slice(0, 10); }
  function deIso(s) { var p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }

  /* ---------- Formatos de hora ---------- */
  function aMin(hhmm) { var p = String(hhmm).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function hora(min, op) {
    op = op || {};
    if (min === 1440 && !op.ceros) return T.medianoche;
    var h = Math.floor(min / 60) % 24, mm = min % 60, h12 = h % 12 || 12;
    var num = h12 + ((mm || op.ceros) ? ':' + (mm < 10 ? '0' : '') + mm : '');
    if (op.corta) return num;
    var suf = idioma === 'es' ? (h < 12 ? 'a. m.' : 'p. m.') : (h < 12 ? 'AM' : 'PM');
    return num + ' ' + suf;
  }
  function aLas(min, op) {
    if (min === 1440 && !(op && op.ceros)) return T.aLaMedianoche;
    var h12 = (Math.floor(min / 60) % 24) % 12 || 12;
    return (h12 === 1 ? T.aLa : T.aLas) + ' ' + hora(min, op);
  }
  function fechaLarga(f) {
    var d = f.getUTCDate(), m = f.getUTCMonth(), w = f.getUTCDay();
    return idioma === 'es'
      ? NOMBRE_DIA.es[w] + ' ' + d + ' de ' + MES.es[m]
      : NOMBRE_DIA.en[w] + ', ' + MES.en[m] + ' ' + d;
  }
  function fechaCorta(f) {
    var d = f.getUTCDate(), m = f.getUTCMonth(), w = f.getUTCDay();
    return idioma === 'es'
      ? DIA_CORTO.es[w] + ' ' + d + ' ' + MES.es[m].slice(0, 3)
      : DIA_CORTO.en[w] + ', ' + MES.en[m].slice(0, 3) + ' ' + d;
  }

  /* ---------- Horario y estado en vivo ---------- */
  function horarioDe(dow) {
    var r = D.horario[DIAS[dow]];
    return r ? { abre: aMin(r[0]), cierra: aMin(r[1]) } : null;
  }
  function estado(a) {
    var t = a.min, hoy = horarioDe(a.dow), ayer = horarioDe((a.dow + 6) % 7);
    if (ayer && ayer.cierra > 1440 && t < ayer.cierra - 1440) {
      return { tipo: ayer.cierra - 1440 - t <= 60 ? 'pronto' : 'abierto', cierra: ayer.cierra - 1440 };
    }
    if (hoy && t >= hoy.abre && t < hoy.cierra) {
      return { tipo: hoy.cierra - t <= 60 ? 'pronto' : 'abierto', cierra: hoy.cierra };
    }
    if (hoy && t < hoy.abre) return { tipo: 'cerrado', abre: hoy.abre, cuando: 'hoy' };
    for (var k = 1; k <= 7; k++) {
      var h = horarioDe((a.dow + k) % 7);
      if (h) return { tipo: 'cerrado', abre: h.abre, cuando: k === 1 ? 'manana' : 'dia', dow: (a.dow + k) % 7 };
    }
    return null;
  }
  function textoEstado(a) {
    var e = estado(a);
    if (!e) return null;
    var txt;
    if (e.tipo === 'abierto') txt = rellena(T.estadoAbierto, { cuando: aLas(e.cierra) });
    else if (e.tipo === 'pronto') txt = rellena(T.estadoPronto, { cuando: aLas(e.cierra) });
    else if (e.cuando === 'hoy') txt = rellena(T.estadoAbreHoy, { cuando: aLas(e.abre) });
    else if (e.cuando === 'manana') txt = rellena(T.estadoAbreManana, { cuando: aLas(e.abre) });
    else txt = rellena(T.estadoAbreDia, { dia: NOMBRE_DIA[idioma][e.dow], cuando: aLas(e.abre) });
    return { tipo: e.tipo, texto: txt };
  }
  function textoSalsa(a) {
    var s = D.salsa;
    if (!s || s.dias.indexOf(DIAS[a.dow]) < 0) return null;
    var ini = aMin(s.inicio), fin = aMin(s.fin), desde = aMin(s.avisarDesde || s.inicio);
    if (a.min >= ini && a.min < fin) return rellena(T.salsaAhora, { fin: hora(fin, { corta: true }) });
    if (a.min >= desde && a.min < ini) return rellena(T.salsaHoy, { inicio: hora(ini, { corta: true }), fin: hora(fin, { corta: true }) });
    return null;
  }
  function pintarEstado() {
    var a = ahora(), el = $('#estado'), e = textoEstado(a), av = $('#salsa-aviso');
    if (!e) { el.hidden = true; } else {
      el.hidden = false;
      el.setAttribute('data-tipo', e.tipo);
      $('.estado__texto', el).textContent = e.texto;
    }
    var s = textoSalsa(a);
    av.hidden = !s;
    if (s) av.textContent = s;
  }
  function pintarHorario() {
    var grupos = [];
    for (var d = 0; d < 7; d++) {
      var h = horarioDe(d);
      var clave = h ? hora(h.abre) + '–' + hora(h.cierra) : T.cerrado;
      var g = grupos[grupos.length - 1];
      if (g && g.clave === clave) g.fin = d; else grupos.push({ ini: d, fin: d, clave: clave });
    }
    $('#horario').innerHTML = grupos.map(function (g) {
      var fin = DIA_CORTO[idioma][g.fin];
      var dias = DIA_CORTO[idioma][g.ini] + (g.fin > g.ini ? '–' + (idioma === 'es' ? fin.toLowerCase() : fin) : '');
      return '<div><dt>' + esc(dias) + '</dt><dd>' + esc(g.clave) + '</dd></div>';
    }).join('');
  }
  function primeraApertura() {
    var min = 1440;
    for (var d = 0; d < 7; d++) { var h = horarioDe(d); if (h && h.abre < min) min = h.abre; }
    return min;
  }

  /* ---------- Textos e idioma ---------- */
  function datoNegocio(clave) {
    var n = D.negocio, d = n.direccion;
    return {
      telefonoVisible: n.telefonoVisible,
      direccionCorta: d.corta,
      direccionLarga: d.calle + ', ' + d.cp + ' ' + d.ciudad + ', ' + d.estado
    }[clave];
  }
  function partirPalabras() {
    var i = 0;
    $$('.frase [data-palabras]').forEach(function (el) {
      el.innerHTML = el.textContent.trim().split(/\s+/).map(function (w) {
        return '<span class="palabra" style="--i:' + (i++) + '">' + esc(w) + '</span>';
      }).join(' ');
    });
    var frase = $('.frase');
    if (frase) frase.setAttribute('aria-label', T.historiaFrase1 + ' ' + T.historiaFrase2);
  }
  function aplicarTextos() {
    T = D.textos[idioma] || D.textos.es;
    html.lang = idioma;
    doc.title = T.metaTitulo;
    var md = $('meta[name="description"]');
    if (md) md.setAttribute('content', T.metaDescripcion);

    $$('[data-t]').forEach(function (el) { var v = T[el.getAttribute('data-t')]; if (v != null) el.textContent = v; });
    $$('[data-t-html]').forEach(function (el) { var v = T[el.getAttribute('data-t-html')]; if (v != null) el.innerHTML = v; });
    $$('[data-t-aria]').forEach(function (el) { var v = T[el.getAttribute('data-t-aria')]; if (v != null) el.setAttribute('aria-label', v); });
    $$('[data-t-alt]').forEach(function (el) { var v = T[el.getAttribute('data-t-alt')]; if (v != null) el.alt = v; });
    $$('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === idioma)); });

    $$('[data-sitio]').forEach(function (a) { a.href = conUtm(paginaSitio(a.getAttribute('data-sitio'))); });
    $$('[data-negocio]').forEach(function (a) { a.href = D.negocio[a.getAttribute('data-negocio')]; });
    $$('[data-tel]').forEach(function (a) { a.href = 'tel:' + D.negocio.telefono; });
    $$('[data-wa]').forEach(function (a) { a.href = 'https://wa.me/' + D.negocio.whatsapp; });
    $$('[data-correo]').forEach(function (a) { a.href = 'mailto:' + D.negocio.correo; a.textContent = D.negocio.correo; });
    $$('[data-dato]').forEach(function (el) { var v = datoNegocio(el.getAttribute('data-dato')); if (v) el.textContent = v; });

    partirPalabras();
    pintarEstado();
    pintarHorario();
    pintarPlatillos();
    pintarBento();
    pintarServicios();
    if (hoja && hoja.open) pintarReserva();
  }

  /* ---------- Carrusel de platillos ---------- */
  function foto(nombre, alt) {
    if (/\.(jpe?g|png|webp|avif)$/i.test(nombre)) {
      return '<img src="assets/img/' + esc(nombre) + '" alt="' + esc(alt) + '" width="600" height="720" loading="lazy" decoding="async">';
    }
    var b = 'assets/img/' + esc(nombre), sz = '(min-width: 480px) 290px, 70vw';
    return '<picture><source type="image/avif" srcset="' + b + '-400.avif 400w, ' + b + '-600.avif 600w" sizes="' + sz + '">' +
      '<img src="' + b + '-600.webp" srcset="' + b + '-400.webp 400w, ' + b + '-600.webp 600w" sizes="' + sz + '" width="600" height="720" alt="' + esc(alt) + '" loading="lazy" decoding="async"></picture>';
  }
  function pintarPlatillos() {
    var ul = $('#platillos');
    if (!ul) return;
    ul.setAttribute('aria-label', T.n02);
    var items = D.platillos.map(function (p) {
      var t = p[idioma] || p.es;
      var precio = p.precio != null
        ? '<span class="plato__precio tnum">' + (p.desde ? '<small>' + esc(T.desde) + '</small>' : '') + '$' + p.precio + '</span>'
        : '';
      return '<li class="plato"><a class="plato__enlace toca" href="' + esc(conUtm(paginaSitio(p.enlace || 'menu'))) + '" data-track="platillo" data-platillo="' + esc(p.foto) + '">' +
        '<span class="plato__foto">' + foto(p.foto, t.alt) + precio + '</span>' +
        '<span class="plato__nombre">' + esc(t.nombre) + '</span>' +
        '<span class="plato__detalle">' + esc(t.detalle) + '</span></a></li>';
    });
    items.push('<li class="plato plato--menu"><a class="plato__enlace toca" href="' + esc(conUtm(paginaSitio('menu'))) + '" data-track="menu">' +
      '<span class="plato__foto"><span class="menu__flecha"><svg class="ico" aria-hidden="true"><use href="#i-flecha"/></svg></span>' +
      '<span class="menu__titulo">' + esc(T.menuCompleto) + '</span><span class="menu__sub">' + esc(T.menuCompletoSub) + '</span></span></a></li>');
    ul.innerHTML = items.join('');
  }
  function iniciarCarrusel() {
    var pista = $('#platillos');
    if (!pista) return;
    // Barra de avance si el navegador no tiene animaciones de scroll
    if (!(window.CSS && CSS.supports('animation-timeline: scroll()'))) {
      var barra = $('.carrusel__barra i');
      var actualiza = function () {
        var max = pista.scrollWidth - pista.clientWidth;
        barra.style.setProperty('--avance', (0.24 + 0.76 * (max > 0 ? pista.scrollLeft / max : 0)).toFixed(3));
      };
      pista.addEventListener('scroll', actualiza, { passive: true });
    }
    // Arrastrar con el mouse en escritorio
    var activo = false, movido = false, x0 = 0, s0 = 0;
    pista.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      activo = true; movido = false; x0 = e.clientX; s0 = pista.scrollLeft;
    });
    addEventListener('pointermove', function (e) {
      if (!activo) return;
      var dx = e.clientX - x0;
      if (!movido && Math.abs(dx) > 6) { movido = true; pista.classList.add('arrastrando'); }
      if (movido) pista.scrollLeft = s0 - dx;
    });
    addEventListener('pointerup', function () {
      if (!activo) return;
      activo = false;
      if (movido) {
        pista.classList.remove('arrastrando');
        setTimeout(function () { movido = false; }, 0);
      }
    });
    pista.addEventListener('click', function (e) { if (movido) { e.preventDefault(); e.stopPropagation(); } }, true);
    pista.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }

  /* ---------- Bloques "Antes de venir" ---------- */
  function pintarBento() {
    var s = D.salsa;
    var dias = s.dias.map(function (d) { return DIA_CORTO[idioma][DIAS.indexOf(d)]; });
    var unidos = dias.length > 1
      ? dias.slice(0, -1).join(', ') + (idioma === 'es' ? ' y ' : ' & ') + (idioma === 'es' ? dias[dias.length - 1].toLowerCase() : dias[dias.length - 1])
      : dias[0];
    var sub = $('#salsa-sub');
    var ini = aMin(s.inicio), fin = aMin(s.fin);
    var mismaMitad = (ini >= 720) === (fin >= 720);
    sub.textContent = rellena(T.salsaSub, {
      dias: unidos,
      inicio: mismaMitad ? hora(ini, { corta: true }) : hora(ini),
      fin: hora(fin)
    });

    var hd = rellena(T.desayunosSub, { hora: hora(primeraApertura()) });
    $('#desayunos-sub').textContent = idioma === 'es' ? hd.replace(/\blas 1 /, 'la 1 ') : hd;

    var r = D.resenas;
    var visible = $('#contador');
    if (!visible.getAttribute('data-animado')) visible.textContent = r.calificacion.toFixed(1);
    $('#contador-sr').textContent = r.calificacion.toFixed(1) + ' ' + T.deCinco;
    $('#resenas-total').textContent = rellena(T.resenasTotal, { total: r.total.toLocaleString(idioma === 'es' ? 'es-MX' : 'en-US') });
    $('#resenas-fb').textContent = rellena(T.resenasFacebook, { pct: r.facebookRecomienda });

    var pr = D.promo, el = $('#promo');
    if (!pr || !pr.activa) { el.hidden = true; return; }
    var t = pr[idioma] || pr.es;
    el.hidden = false;
    el.href = conUtm(typeof pr.enlace === 'string' ? pr.enlace : (pr.enlace[idioma] || pr.enlace.es));
    $('#promo-etiqueta').textContent = t.etiqueta;
    $('#promo-titulo').textContent = t.titulo;
    $('#promo-detalle').textContent = t.detalle;
    $('#promo-accion').textContent = t.accion;
  }
  function pintarServicios() {
    $('#servicios').innerHTML = D.servicios.map(function (s, i) {
      return '<li style="--i:' + i + '"><svg class="ico" aria-hidden="true"><use href="#i-' + esc(s.icono) + '"/></svg>' + esc(s[idioma] || s.es) + '</li>';
    }).join('');
  }
  function iniciarContador() {
    var el = $('#contador'), final = D.resenas.calificacion;
    if (reducido || !('IntersectionObserver' in window)) return;
    el.textContent = '0.0';
    el.setAttribute('data-animado', '1');
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      var t0 = performance.now(), dur = 1100;
      (function paso(t) {
        var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        el.textContent = (final * e).toFixed(1);
        if (p < 1) requestAnimationFrame(paso);
      })(t0);
    }, { threshold: 0.6 });
    io.observe(el);
  }

  /* ---------- Hoja de reserva ---------- */
  var hoja = $('#hoja');
  var panel = hoja && $('.hoja__panel', hoja);
  var origen = null;
  var R = { n: 2, dia: 'hoy', fecha: null, hora: null };

  function horasDe(fecha) {
    var a = ahora(), h = horarioDe(fecha.getUTCDay());
    if (!h) return [];
    var esHoy = iso(fecha) === iso(a.fecha);
    return D.reservas.horas.map(aMin).filter(function (t) {
      return t >= h.abre && t <= h.cierra - 60 && (!esHoy || t >= a.min + 30);
    });
  }
  function fechaElegida() {
    var hoyF = ahora().fecha;
    if (R.dia === 'hoy') return hoyF;
    if (R.dia === 'manana') return masDias(hoyF, 1);
    return R.fecha || masDias(hoyF, 2);
  }
  function textoPersonas(n) {
    var max = D.reservas.maxPersonas;
    if (n > max) return rellena(T.masDe, { n: max }) + ' ' + T.personas;
    return n + ' ' + (n === 1 ? T.persona : T.personas);
  }
  function mensaje(horaTxt) {
    return rellena(D.reservas.mensaje[idioma] || D.reservas.mensaje.es, {
      personas: textoPersonas(R.n),
      dia: fechaLarga(fechaElegida()),
      a_las_hora: horaTxt
    }).replace(/\u00a0/g, ' ').replace(/([ap]\. m\.)\./g, '$1');
  }
  function pintarReserva() {
    var max = D.reservas.maxPersonas, hoyF = ahora().fecha;
    // Personas
    var out = $('#personas');
    out.innerHTML = '<b class="tnum">' + (R.n > max ? max + '+' : R.n) + '</b> <span>' + esc(R.n === 1 ? T.persona : T.personas) + '</span>';
    $('[data-paso="-1"]').disabled = R.n <= 1;
    $('[data-paso="1"]').disabled = R.n > max;
    // Días
    var hayHoy = horasDe(hoyF).length > 0;
    var rHoy = $('input[name="dia"][value="hoy"]');
    rHoy.disabled = !hayHoy;
    if (!hayHoy && R.dia === 'hoy') R.dia = 'manana';
    $$('input[name="dia"]').forEach(function (r) { r.checked = r.value === R.dia; });
    var fecha = $('#fecha');
    fecha.min = iso(hoyF);
    fecha.hidden = R.dia !== 'otra';
    $('#otra-texto').textContent = R.dia === 'otra' && R.fecha ? fechaCorta(R.fecha) : T.hojaOtra;
    // Horas
    var lista = horasDe(fechaElegida());
    if (R.hora != null && lista.indexOf(R.hora) < 0) R.hora = null;
    $('#chips-hora').innerHTML = lista.map(function (t) {
      return '<label class="chip toca"><input type="radio" name="hora" value="' + t + '"' + (t === R.hora ? ' checked' : '') + '><span class="tnum">' + esc(hora(t, { ceros: true })) + '</span></label>';
    }).join('');
    $('#sin-horas').hidden = lista.length > 0;
    // Mensaje y botón
    var listo = R.hora != null;
    var vista = $('#vista');
    if (listo) vista.textContent = mensaje(aLas(R.hora, { ceros: true }));
    else vista.innerHTML = esc(mensaje('§')).replace('§', '<span class="hueco">' + (idioma === 'es' ? 'a las ··:··' : 'at ··:··') + '</span>');
    var enviar = $('#enviar');
    enviar.href = 'https://wa.me/' + D.negocio.whatsapp + (listo ? '?text=' + encodeURIComponent(mensaje(aLas(R.hora, { ceros: true }))) : '');
    enviar.setAttribute('aria-disabled', String(!listo));
  }
  function preparar(preset) {
    var a = ahora();
    R.hora = null;
    R.dia = horasDe(a.fecha).length ? 'hoy' : 'manana';
    R.fecha = null;
    if (preset === 'salsa' && D.salsa) {
      var ini = aMin(D.salsa.inicio);
      for (var k = 0; k < 14; k++) {
        var f = masDias(a.fecha, k);
        if (D.salsa.dias.indexOf(DIAS[f.getUTCDay()]) > -1 && horasDe(f).indexOf(ini) > -1) {
          R.dia = k === 0 ? 'hoy' : k === 1 ? 'manana' : 'otra';
          R.fecha = k > 1 ? f : null;
          R.hora = ini;
          break;
        }
      }
    }
    pintarReserva();
  }
  function abrirHoja(desde, preset) {
    origen = desde;
    preparar(preset);
    var abrir = function () {
      hoja.classList.remove('cerrando');
      panel.style.setProperty('--arrastre', '0px');
      hoja.showModal();
      html.classList.add('hoja-abierta');
    };
    if (doc.startViewTransition && !reducido && origen) {
      html.classList.add('vt-activa');
      origen.style.viewTransitionName = 'hoja';
      var vt = doc.startViewTransition(function () {
        origen.style.viewTransitionName = '';
        abrir();
        panel.style.viewTransitionName = 'hoja';
      });
      vt.finished.then(limpiarVT, limpiarVT);
    } else {
      abrir();
    }
  }
  function limpiarVT() {
    panel.style.viewTransitionName = '';
    if (origen) origen.style.viewTransitionName = '';
    html.classList.remove('vt-activa');
  }
  function cerrarHoja(sinVT) {
    if (!hoja.open) return;
    var fin = function () {
      hoja.close();
      hoja.classList.remove('cerrando');
      panel.style.setProperty('--arrastre', '0px');
      html.classList.remove('hoja-abierta');
    };
    if (!sinVT && doc.startViewTransition && !reducido && origen && origen.isConnected) {
      html.classList.add('vt-activa');
      panel.style.viewTransitionName = 'hoja';
      var vt = doc.startViewTransition(function () {
        panel.style.viewTransitionName = '';
        fin();
        origen.style.viewTransitionName = 'hoja';
      });
      vt.finished.then(limpiarVT, limpiarVT);
    } else if (!reducido) {
      hoja.classList.add('cerrando');
      setTimeout(fin, 250);
    } else {
      fin();
    }
  }
  function iniciarHoja() {
    if (!hoja) return;
    $$('[data-abrir-reserva]').forEach(function (b) {
      b.addEventListener('click', function () { abrirHoja(b, b.getAttribute('data-abrir-reserva')); });
    });
    $('[data-cerrar]', hoja).addEventListener('click', function () { cerrarHoja(); });
    hoja.addEventListener('cancel', function (e) { e.preventDefault(); cerrarHoja(); });
    hoja.addEventListener('click', function (e) { if (e.target === hoja) cerrarHoja(); });
    $$('[data-paso]', hoja).forEach(function (b) {
      b.addEventListener('click', function () {
        R.n = Math.max(1, Math.min(D.reservas.maxPersonas + 1, R.n + (+b.getAttribute('data-paso'))));
        pintarReserva();
      });
    });
    $('#chips-dia').addEventListener('change', function (e) {
      R.dia = e.target.value;
      if (R.dia === 'otra' && !R.fecha) R.fecha = masDias(ahora().fecha, 2);
      pintarReserva();
      if (R.dia === 'otra') {
        var f = $('#fecha');
        f.value = iso(R.fecha);
        try { if (f.showPicker) f.showPicker(); } catch (err) {}
      }
    });
    $('#fecha').addEventListener('change', function (e) {
      if (!e.target.value) return;
      var f = deIso(e.target.value);
      if (iso(f) < iso(ahora().fecha)) return;
      R.fecha = f;
      pintarReserva();
    });
    $('#chips-hora').addEventListener('change', function (e) { R.hora = +e.target.value; pintarReserva(); });
    $('#enviar').addEventListener('click', function (e) {
      if (this.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
      track('reservar_enviar', { personas: R.n, dia: iso(fechaElegida()), hora: hora(R.hora, { ceros: true }) });
    });
    // Deslizar hacia abajo para cerrar
    [$('.hoja__asa', hoja), $('.hoja__cabeza', hoja)].forEach(function (zona) {
      var y0 = null, dy = 0;
      zona.addEventListener('pointerdown', function (e) {
        if (e.target.closest('button')) return;
        y0 = e.clientY; dy = 0;
        hoja.classList.add('arrastrando');
        zona.setPointerCapture(e.pointerId);
      });
      zona.addEventListener('pointermove', function (e) {
        if (y0 == null) return;
        dy = Math.max(0, e.clientY - y0);
        panel.style.setProperty('--arrastre', dy + 'px');
      });
      var suelta = function () {
        if (y0 == null) return;
        y0 = null;
        hoja.classList.remove('arrastrando');
        if (dy > 90) cerrarHoja(true); else panel.style.setProperty('--arrastre', '0px');
      };
      zona.addEventListener('pointerup', suelta);
      zona.addEventListener('pointercancel', suelta);
    });
  }

  /* ---------- Guardar contacto (vCard) ---------- */
  function vcard() {
    var n = D.negocio, d = n.direccion;
    var e = function (s) { return String(s).replace(/([,;\\])/g, '\\$1'); };
    var nota = $$('#horario div').map(function (r) { return $('dt', r).textContent + ' ' + $('dd', r).textContent; });
    return [
      'BEGIN:VCARD', 'VERSION:3.0',
      'N:;' + e(n.nombre) + ';;;', 'FN:' + e(n.nombre), 'ORG:' + e(n.nombre),
      'TEL;TYPE=WORK,VOICE:' + n.telefono,
      'item1.TEL;TYPE=CELL:+' + n.whatsapp.replace(/^521/, '52'), 'item1.X-ABLabel:WhatsApp',
      'EMAIL;TYPE=INTERNET,WORK:' + n.correo,
      'ADR;TYPE=WORK:;;' + e(d.calle) + ';' + e(d.ciudad) + ';' + e(d.estado) + ';' + d.cp + ';México',
      'URL:' + D.sitio.es.inicio,
      'X-SOCIALPROFILE;TYPE=instagram:' + n.instagram,
      'X-SOCIALPROFILE;TYPE=facebook:' + n.facebook,
      'NOTE:' + e(T.horarioTitulo + ': ' + nota.join(' · ')),
      'END:VCARD'
    ].join('\r\n');
  }
  function iniciarVcard() {
    var a = $('[data-vcard]');
    var enApp = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Bytedance/i.test(navigator.userAgent);
    if (!a || enApp || !window.Blob || !URL.createObjectURL) return; // en apps se usa el archivo contacto.vcf
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var url = URL.createObjectURL(new Blob([vcard()], { type: 'text/vcard;charset=utf-8' }));
      var tmp = doc.createElement('a');
      tmp.href = url; tmp.download = 'La-Casa-de-la-Mantarraya.vcf';
      doc.body.appendChild(tmp); tmp.click(); tmp.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    });
  }

  /* ---------- Compartir y toast ---------- */
  var toastT;
  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('visible'); }, ms || 2400);
  }
  function urlCompartir() {
    var u = D.SITE_URL || location.href.split('#')[0];
    return idioma === 'en' ? u + (u.indexOf('?') > -1 ? '&' : '?') + 'lang=en' : u;
  }
  function iniciarCompartir() {
    var b = $('[data-compartir]');
    if (!b) return;
    b.addEventListener('click', function () {
      var url = urlCompartir();
      var copiar = function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () { toast(T.copiado); }, function () { toast(T.copiarFallo + ' ' + url, 7000); });
        } else {
          toast(T.copiarFallo + ' ' + url, 7000);
        }
      };
      if (navigator.share) {
        navigator.share({ title: D.negocio.nombre, text: T.compartirTexto, url: url }).catch(function (err) {
          if (!err || err.name !== 'AbortError') copiar();
        });
      } else {
        copiar();
      }
    });
  }

  /* ---------- Datos estructurados (JSON-LD Restaurant) ---------- */
  function jsonLd() {
    var n = D.negocio, base = D.SITE_URL || '';
    var EN = { domingo: 'Sunday', lunes: 'Monday', martes: 'Tuesday', miercoles: 'Wednesday', jueves: 'Thursday', viernes: 'Friday', sabado: 'Saturday' };
    var esp = [];
    DIAS.forEach(function (d) {
      var r = D.horario[d];
      if (!r) return;
      var cierra = r[1] === '24:00' ? '00:00' : r[1];
      var g = esp.filter(function (x) { return x.opens === r[0] && x.closes === cierra; })[0];
      if (g) g.dayOfWeek.push(EN[d]);
      else esp.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: [EN[d]], opens: r[0], closes: cierra });
    });
    var data = {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: n.nombre,
      url: D.sitio.es.inicio,
      image: base + 'assets/og.jpg',
      logo: base + 'assets/img/logo-mantarraya.png',
      telephone: n.telefono,
      email: n.correo,
      address: {
        '@type': 'PostalAddress',
        streetAddress: n.direccion.calle,
        addressLocality: n.direccion.ciudad,
        addressRegion: 'Quintana Roo',
        postalCode: n.direccion.cp,
        addressCountry: n.direccion.pais
      },
      servesCuisine: ['Seafood', 'Mexican', 'Yucatecan'],
      priceRange: '$$',
      acceptsReservations: true,
      hasMenu: D.sitio.es.menu,
      openingHoursSpecification: esp,
      sameAs: [n.instagram, n.facebook, D.sitio.es.inicio, n.mapa]
    };
    var s = doc.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(data);
    doc.head.appendChild(s);
  }

  /* ---------- Movimiento: mantarraya, giroscopio, cursor, magnetismo ---------- */
  function iniciarRuta() {
    if (reducido || (window.CSS && CSS.supports('animation-timeline: scroll()'))) return;
    var ruta = $('.raya-ruta'), raf = 0;
    var KF = {
      movil: [[0, 36, 2, -138], [0.45, 4, 38, -150], [1, -40, 74, -126]],
      escritorio: [[0, 52, -6, -128], [0.5, 14, 30, -148], [1, -30, 52, -122]]
    };
    function pinta() {
      raf = 0;
      var max = html.scrollHeight - innerHeight, p = max > 0 ? Math.min(1, scrollY / max) : 0;
      var k = escritorio.matches ? KF.escritorio : KF.movil, i = p <= k[1][0] ? 0 : 1;
      var a = k[i], b = k[i + 1], t = (p - a[0]) / (b[0] - a[0]);
      var v = function (j) { return a[j] + (b[j] - a[j]) * t; };
      ruta.style.transform = 'translate3d(' + v(1).toFixed(2) + 'vw,' + v(2).toFixed(2) + 'vh,0) rotate(' + v(3).toFixed(1) + 'deg)';
    }
    addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(pinta); }, { passive: true });
    addEventListener('resize', pinta);
    pinta();
  }
  function iniciarGiro() {
    if (reducido || !window.DeviceOrientationEvent || !matchMedia('(pointer: coarse)').matches) return;
    var capa = $('.raya-inclina'), ultimo = null, raf = 0;
    function aplica() {
      raf = 0;
      var g = Math.max(-30, Math.min(30, ultimo.gamma || 0));
      var b = Math.max(-30, Math.min(30, (ultimo.beta || 0) - 45));
      capa.style.setProperty('--gx', (g * 0.8).toFixed(1) + 'px');
      capa.style.setProperty('--gy', (b * 0.6).toFixed(1) + 'px');
      capa.style.setProperty('--gr', (g * 0.18).toFixed(2) + 'deg');
    }
    function on(e) { if (e.gamma == null) return; ultimo = e; if (!raf) raf = requestAnimationFrame(aplica); }
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      var b = $('#giro');
      b.hidden = false;
      b.addEventListener('click', function () {
        DeviceOrientationEvent.requestPermission().then(function (r) {
          if (r === 'granted') { addEventListener('deviceorientation', on); b.hidden = true; }
        }).catch(function () {});
      });
    } else {
      addEventListener('deviceorientation', on);
    }
  }
  function iniciarCursor() {
    if (!punteroFino || reducido) return;
    var c = $('#cursor'), txt = c.firstElementChild, x = -200, y = -200, cx = -200, cy = -200, zona = null, raf = 0;
    html.classList.add('cursor-activo');
    function mueve() {
      cx += (x - cx) * 0.22; cy += (y - cy) * 0.22;
      c.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.4 ? requestAnimationFrame(mueve) : 0;
    }
    doc.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      var z = e.target.closest ? e.target.closest('[data-cursor]') : null;
      if (z !== zona) {
        if (z && !zona) { cx = x; cy = y; }
        zona = z;
        if (z) { txt.textContent = T[z.getAttribute('data-cursor')] || ''; c.classList.add('visible'); }
        else c.classList.remove('visible');
      }
      if (!raf) raf = requestAnimationFrame(mueve);
    });
    doc.addEventListener('pointerleave', function () { zona = null; c.classList.remove('visible'); });
  }
  function iniciarMagnetico() {
    if (!punteroFino || reducido) return;
    $$('[data-magnet]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        var f = r.width > 120 ? 10 : 8;
        el.style.setProperty('--mx', (dx * f).toFixed(2) + 'px');
        el.style.setProperty('--my', (dy * f * 0.8).toFixed(2) + 'px');
      });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
      });
    });
  }
  function iniciarVibracion() {
    doc.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' && navigator.vibrate && e.target.closest && e.target.closest('.toca')) {
        try { navigator.vibrate(10); } catch (err) {}
      }
    }, { passive: true });
  }
  function iniciarReveladoRespaldo() {
    if (reducido || (window.CSS && CSS.supports('animation-timeline: view()')) || !('IntersectionObserver' in window)) return;
    html.classList.add('sin-sda');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    $$('.carrusel, .bento, .sellos, .frase').forEach(function (el) { io.observe(el); });
  }

  /* ---------- Idioma: botones ---------- */
  function iniciarIdioma() {
    $$('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () {
        var nuevo = b.getAttribute('data-lang');
        if (nuevo === idioma) return;
        idioma = nuevo;
        guarda('localStorage', 'mm-idioma', idioma);
        track('idioma', { idioma: idioma });
        if (doc.startViewTransition && !reducido) doc.startViewTransition(aplicarTextos);
        else aplicarTextos();
      });
    });
  }

  /* ---------- Medición: un evento por clic ---------- */
  doc.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track]');
    if (!el || el.id === 'enviar') return;
    track(el.getAttribute('data-track'), {
      idioma: idioma,
      fuente: fuente,
      platillo: el.getAttribute('data-platillo') || undefined
    });
  });

  /* ---------- Arranque ---------- */
  aplicarTextos();
  iniciarCarrusel();
  iniciarContador();
  iniciarHoja();
  iniciarVcard();
  iniciarCompartir();
  iniciarIdioma();
  iniciarRuta();
  iniciarGiro();
  iniciarCursor();
  iniciarMagnetico();
  iniciarVibracion();
  iniciarReveladoRespaldo();
  jsonLd();
  if (!params.get('ahora')) setInterval(pintarEstado, 60000);
  guarda('sessionStorage', 'mm-visto', '1');
})();
