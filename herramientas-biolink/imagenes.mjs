// Genera las fotos optimizadas del bio link (AVIF + WebP) con un mismo tratamiento de color.
// Uso: node imagenes.mjs   (lee ./originales, escribe ../mantarraya-links/assets/img)
// Si existe ../mantarraya-links/assets/mis-fotos con un archivo del mismo nombre que la
// clave (por ejemplo "platillo-taco.jpg"), esa foto propia tiene prioridad.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ORIG = new URL('./originales/', import.meta.url).pathname;
const SALIDA = new URL('../mantarraya-links/assets/img/', import.meta.url).pathname;
const MIS_FOTOS = new URL('../mantarraya-links/assets/mis-fotos/', import.meta.url).pathname;
fs.mkdirSync(SALIDA, { recursive: true });

// Tratamiento común: un poco más cálido, más contraste y negros profundos.
function tratamiento(img) {
  return img
    .recomb([
      [1.05, 0.03, 0.0],
      [0.0, 1.0, 0.0],
      [-0.02, 0.0, 0.93],
    ])
    .linear(1.09, -11)
    .modulate({ saturation: 1.05 });
}

// extract: recorte en píxeles del original. anchos: tamaños de salida sin ampliar nunca.
const FOTOS = {
  'platillo-taco': { src: 'taco-mantarraya-cancun.webp', extract: { left: 330, top: 0, width: 623, height: 748 }, anchos: [400, 600] },
  'platillo-pescadillas': { src: 'pescadillas-mantarraya-cancun.webp', extract: { left: 300, top: 0, width: 615, height: 738 }, anchos: [400, 600] },
  'platillo-tostadas': { src: 'tostadas-mantarraya-cancun.webp', extract: { left: 380, top: 0, width: 631, height: 758 }, anchos: [400, 600] },
  'platillo-ceviche': { src: 'ceviche-negro.jpg', extract: { left: 300, top: 0, width: 2480, height: 2976 }, anchos: [400, 600] },
  'platillo-chilaquiles': { src: 'desayunos-chilaquiles-rojos-960.webp', extract: { left: 0, top: 70, width: 853, height: 1024 }, anchos: [400, 600] },
  'mesa-servida': { src: 'mesa-servida.jpg', extract: { left: 0, top: 250, width: 853, height: 460 }, anchos: [400, 600, 800] },
  'fachada': { src: 'fachada-mantarraya-cancun.webp', extract: { left: 30, top: 0, width: 960, height: 542 }, anchos: [400, 600, 800] },
};

async function procesar(clave, cfg) {
  const propia = ['.jpg', '.jpeg', '.png', '.webp']
    .map((ext) => path.join(MIS_FOTOS, clave + ext))
    .find((p) => fs.existsSync(p));
  let base = propia ? sharp(propia).rotate() : sharp(path.join(ORIG, cfg.src)).extract(cfg.extract);
  const buf = await tratamiento(base).toBuffer();
  const meta = await sharp(buf).metadata();
  const ratio = cfg.extract.height / cfg.extract.width;
  for (const w of cfg.anchos) {
    if (w > meta.width + 2) continue; // nunca ampliar
    const h = Math.round(w * ratio);
    const r = sharp(buf).resize(w, h, { fit: 'cover', position: 'attention' });
    await r.clone().avif({ quality: 52, effort: 6 }).toFile(path.join(SALIDA, `${clave}-${w}.avif`));
    await r.clone().webp({ quality: 74, effort: 6 }).toFile(path.join(SALIDA, `${clave}-${w}.webp`));
  }
  console.log(clave, propia ? '(foto propia)' : '', meta.width + 'x' + meta.height);
}

for (const [k, v] of Object.entries(FOTOS)) await procesar(k, v);

// Fondo de escritorio: terraza de noche muy difuminada (el desenfoque oculta la baja resolución
// y a las personas). Se tiñe hacia el verde de la marca.
const fondo = sharp(path.join(ORIG, 'terraza-noche.jpg'))
  .resize(1600, 960, { fit: 'cover' })
  .blur(26)
  .modulate({ brightness: 0.78, saturation: 0.75 })
  .composite([{ input: { create: { width: 1600, height: 960, channels: 4, background: { r: 25, g: 63, b: 48, alpha: 0.45 } } }, blend: 'multiply' }]);
await fondo.clone().avif({ quality: 40 }).toFile(path.join(SALIDA, 'fondo-terraza.avif'));
await fondo.clone().webp({ quality: 55 }).toFile(path.join(SALIDA, 'fondo-terraza.webp'));

// Logo: el PNG original tal cual (no se redibuja) + versiones reducidas para el encabezado.
fs.copyFileSync(path.join(ORIG, 'logo-mantarraya.png'), path.join(SALIDA, 'logo-mantarraya.png'));
for (const w of [92]) {
  await sharp(path.join(ORIG, 'logo-mantarraya.png')).resize(w, w, { kernel: 'lanczos3' }).webp({ lossless: true, effort: 6 }).toFile(path.join(SALIDA, `logo-mantarraya-${w}.webp`));
}
console.log('listo');
