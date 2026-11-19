/* QR con los colores de la marca y el logo original al centro.
   Usa qrcode.js (MIT, Kazuhiko Arase). Corrección de errores alta (H),
   por eso el logo puede tapar el centro sin que deje de leerse. */
(function (global) {
  'use strict';

  function qrMarcaSVG(texto, logoHref, op) {
    op = op || {};
    var tinta = op.tinta || '#193f30';
    var ojo = op.ojo || '#9a4a24';
    var fondo = op.fondo || '#f3eadb';
    var qr = global.qrcode(0, 'H');
    qr.addData(texto);
    qr.make();
    var n = qr.getModuleCount();
    var margen = 4;
    var total = n + margen * 2;
    var logo = Math.round(n * 0.24) | 1; // lado del hueco central, en módulos (impar)
    var ini = Math.floor((n - logo) / 2);
    var fin = ini + logo;

    function esOjo(r, c) {
      return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    }
    var puntos = [];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!qr.isDark(r, c) || esOjo(r, c)) continue;
        if (r >= ini - 1 && r <= fin && c >= ini - 1 && c <= fin) continue;
        puntos.push('M' + (c + margen + 0.5) + ' ' + (r + margen + 0.09) + 'a.41 .41 0 0 1 0 .82a.41 .41 0 0 1 0-.82');
      }
    }
    function ojoSVG(r, c) {
      var x = c + margen, y = r + margen;
      return '<rect x="' + (x + 0.5) + '" y="' + (y + 0.5) + '" width="6" height="6" rx="1.9" fill="none" stroke="' + tinta + '"/>' +
        '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" rx=".9" fill="' + ojo + '"/>';
    }
    var cx = margen + ini - 0.5, lado = logo + 1;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="geometricPrecision">' +
      '<rect width="' + total + '" height="' + total + '" fill="' + fondo + '"/>' +
      '<path fill="' + tinta + '" d="' + puntos.join('') + '"/>' +
      ojoSVG(0, 0) + ojoSVG(0, n - 7) + ojoSVG(n - 7, 0) +
      '<rect x="' + cx + '" y="' + cx + '" width="' + lado + '" height="' + lado + '" rx="' + (lado * 0.22) + '" fill="' + fondo + '" stroke="' + tinta + '" stroke-width=".25"/>' +
      (logoHref ? '<image x="' + (cx + lado * 0.06) + '" y="' + (cx + lado * 0.06) + '" width="' + (lado * 0.88) + '" height="' + (lado * 0.88) + '" href="' + logoHref + '" xlink:href="' + logoHref + '"/>' : '') +
      '</svg>';
    return svg;
  }

  global.qrMarcaSVG = qrMarcaSVG;
})(typeof window !== 'undefined' ? window : globalThis);
