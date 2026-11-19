// Servidor local que imita al hosting real (compresión brotli/gzip y caché como en .htaccess).
// Uso: node servidor.mjs [puerto]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const RAIZ = new URL('../mantarraya-links/', import.meta.url).pathname;
const PUERTO = +process.argv[2] || 8090;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.vcf': 'text/vcard; charset=utf-8', '.pdf': 'application/pdf', '.json': 'application/json' };
const COMPRIMIBLE = /\.(html|css|js|svg|vcf|json)$/;

http.createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = path.join(RAIZ, path.normalize(ruta).replace(/^(\.\.[/\\])+/, ''));
  if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404');
  }
  const ext = path.extname(archivo);
  const cabeceras = { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' };
  cabeceras['Cache-Control'] = /\.(woff2)$/.test(ext) ? 'public, max-age=31536000, immutable'
    : /\.(png|jpg|webp|avif)$/.test(ext) ? 'public, max-age=2592000' : 'no-cache';
  let cuerpo = fs.readFileSync(archivo);
  const acepta = req.headers['accept-encoding'] || '';
  if (COMPRIMIBLE.test(ext)) {
    if (/\bbr\b/.test(acepta)) { cuerpo = zlib.brotliCompressSync(cuerpo); cabeceras['Content-Encoding'] = 'br'; }
    else if (/gzip/.test(acepta)) { cuerpo = zlib.gzipSync(cuerpo, { level: 9 }); cabeceras['Content-Encoding'] = 'gzip'; }
    cabeceras['Vary'] = 'Accept-Encoding';
  }
  cabeceras['Content-Length'] = cuerpo.length;
  res.writeHead(200, cabeceras);
  res.end(req.method === 'HEAD' ? undefined : cuerpo);
}).listen(PUERTO, '127.0.0.1', () => console.log('http://127.0.0.1:' + PUERTO + '/'));
