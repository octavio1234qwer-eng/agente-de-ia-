// Genera la guía rápida (PDF) para el cliente.  Uso: node guia-rapida.cjs <qr.png> <salida.pdf>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SITIO = path.resolve(__dirname, '../mantarraya-links');
const CAP = path.resolve(__dirname, '../entrega/Bio-link-La-Casa-de-la-Mantarraya/4 - Así se ve (fotos)');
const [,, qr, salida] = process.argv;
(async () => {
  let html = fs.readFileSync(path.join(__dirname, 'plantillas/guia-rapida.html'), 'utf8')
    .split('{{SITIO}}').join('file://' + SITIO).split('{{CAP}}').join('file://' + CAP).split('{{QR}}').join('file://' + path.resolve(qr));
  const tmp = path.join(__dirname, 'salida/guia-rapida.html');
  fs.writeFileSync(tmp, html);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + tmp, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: salida, format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await b.close(); console.log('guía rápida lista');
})();
