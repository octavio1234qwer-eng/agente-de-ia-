// QR y tarjetón que apuntan al enlace en vivo (https://lacasadelamantarraya.vercel.app).
// Uso: node qr-vivo.mjs <carpeta-salida>
import sharp from 'sharp';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const SITIO = new URL('../mantarraya-links/', import.meta.url).pathname;
const SALIDA = process.argv[2];
const URL_VIVO = 'https://lacasadelamantarraya.vercel.app/?src=qr';
fs.mkdirSync(SALIDA, { recursive: true });

const ctx = { globalThis: {} };
ctx.globalThis = ctx; ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(SITIO, 'qr/qrcode.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(SITIO, 'qr/qr-marca.js'), 'utf8'), ctx);
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(SITIO, 'assets/img/logo-mantarraya.png')).toString('base64');
const svg = ctx.qrMarcaSVG(URL_VIVO, logo);
fs.writeFileSync(path.join(SALIDA, 'qr.svg'), svg);
await sharp(Buffer.from(svg), { density: 1200 }).resize(1600, 1600).png().toFile(path.join(SALIDA, 'qr.png'));

// Tarjetón: la página /qr/mesa.html publicada ya usa la dirección en vivo.
const b = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const p = await b.newPage();
await p.goto('https://lacasadelamantarraya.vercel.app/qr/mesa.html', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
console.log('el tarjetón apunta a:', await p.textContent('#url'));
await p.emulateMedia({ media: 'print' });
await p.pdf({ path: path.join(SALIDA, 'tarjeton.pdf'), width: '100mm', height: '150mm', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await b.close();
console.log('listo:', URL_VIVO);
