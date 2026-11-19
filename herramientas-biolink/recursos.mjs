// Genera favicons (con el logo ORIGINAL), og.jpg, contacto.vcf, QR (SVG/PNG) y el PDF del tarjetón.
// Requiere el servidor local:  python3 -m http.server 8080 --bind 127.0.0.1  (dentro de mantarraya-links)
// Uso: node recursos.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const SITIO = new URL('../mantarraya-links/', import.meta.url).pathname;
const LOCAL = process.env.LOCAL_URL || 'http://127.0.0.1:8080/';
const LOGO = path.join(SITIO, 'assets/img/logo-mantarraya.png');
const CREMA = { r: 243, g: 234, b: 219, alpha: 1 };

// --- Datos (data.js) ---
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(SITIO, 'js/data.js'), 'utf8'), ctx);
const D = ctx.window.DATOS;

// --- Favicons con el logo original ---
fs.mkdirSync(path.join(SITIO, 'assets/icons'), { recursive: true });
async function lienzo(lado, capa, top, left) {
  return sharp({ create: { width: lado, height: lado, channels: 4, background: CREMA } })
    .composite([{ input: capa, top, left }]).png();
}
// 180 (iPhone) y 192: logo completo a su tamaño real (154 px), sin ampliar.
await (await lienzo(180, LOGO, 13, 13)).toFile(path.join(SITIO, 'assets/icons/apple-touch-icon.png'));
await (await lienzo(192, LOGO, 19, 19)).toFile(path.join(SITIO, 'assets/icons/favicon-192.png'));
// 32: solo la mantarraya del logo (las letras no se leen a ese tamaño), recortada del mismo PNG.
const simbolo = await sharp(LOGO).extract({ left: 40, top: 18, width: 72, height: 74 }).resize(26, 26, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
const circulo = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="16" fill="#f3eadb"/></svg>');
await sharp(circulo).composite([{ input: simbolo, top: 3, left: 3 }]).png().toFile(path.join(SITIO, 'assets/icons/favicon-32.png'));
console.log('favicons listos');

// --- vCard estática (para navegadores dentro de Instagram/Facebook/TikTok) ---
{
  const n = D.negocio, d = n.direccion;
  const e = (s) => String(s).replace(/([,;\\])/g, '\\$1');
  const vcf = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `N:;${e(n.nombre)};;;`, `FN:${e(n.nombre)}`, `ORG:${e(n.nombre)}`,
    `TEL;TYPE=WORK,VOICE:${n.telefono}`,
    `item1.TEL;TYPE=CELL:+${n.whatsapp.replace(/^521/, '52')}`, 'item1.X-ABLabel:WhatsApp',
    `EMAIL;TYPE=INTERNET,WORK:${n.correo}`,
    `ADR;TYPE=WORK:;;${e(d.calle)};${e(d.ciudad)};${e(d.estado)};${d.cp};México`,
    `URL:${D.sitio.es.inicio}`,
    `X-SOCIALPROFILE;TYPE=instagram:${n.instagram}`,
    `X-SOCIALPROFILE;TYPE=facebook:${n.facebook}`,
    'END:VCARD', '',
  ].join('\r\n');
  fs.writeFileSync(path.join(SITIO, 'contacto.vcf'), vcf);
  console.log('contacto.vcf listo');
}

// --- QR estático ---
const qctx = { window: {}, globalThis: {} };
qctx.globalThis = qctx;
vm.createContext(qctx);
vm.runInContext(fs.readFileSync(path.join(SITIO, 'qr/qrcode.js'), 'utf8'), qctx);
qctx.window = qctx;
vm.runInContext(fs.readFileSync(path.join(SITIO, 'qr/qr-marca.js'), 'utf8'), qctx);
const urlQR = D.SITE_URL + (D.SITE_URL.includes('?') ? '&' : '?') + 'src=qr';
const logoData = 'data:image/png;base64,' + fs.readFileSync(LOGO).toString('base64');
const svgQR = qctx.qrMarcaSVG(urlQR, logoData);
fs.writeFileSync(path.join(SITIO, 'qr/qr-mantarraya.svg'), svgQR);
await sharp(Buffer.from(svgQR), { density: 1200 }).resize(1600, 1600).png().toFile(path.join(SITIO, 'qr/qr-mantarraya.png'));
console.log('QR listo →', urlQR);

// --- og.jpg (1200×630) y PDF del tarjetón, con el navegador ---
const b = await chromium.launch();
{
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto(LOCAL + 'qr/', { waitUntil: 'load' }); // mismo origen para fuentes e imágenes
  await p.setContent(fs.readFileSync(new URL('./plantillas/og.html', import.meta.url), 'utf8').replaceAll('{{BASE}}', LOCAL), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const png = await p.screenshot({ type: 'png' });
  await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(SITIO, 'assets/og.jpg'));
  console.log('og.jpg listo');
}
{
  const p = await b.newPage();
  await p.goto(LOCAL + 'qr/mesa.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: path.join(SITIO, 'qr/tarjeton-mesa-10x15.pdf'), width: '100mm', height: '150mm', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  console.log('tarjetón PDF listo');
}
await b.close();
