// Texturas de grano de papel (ruido) como imágenes pequeñas: más baratas de pintar que un filtro SVG.
import sharp from 'sharp';
const OUT = new URL('../mantarraya-links/assets/img/', import.meta.url).pathname;
const L = 96;
function ruido(r, g, b, alfaMax, semilla) {
  let s = semilla;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const px = Buffer.alloc(L * L * 4);
  for (let i = 0; i < L * L; i++) {
    const v = rnd();
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b;
    // grano disperso y en pocos niveles: se ve igual y pesa mucho menos
    px[i * 4 + 3] = v < 0.55 ? 0 : Math.round(Math.ceil((v - 0.55) / 0.45 * 3) / 3 * alfaMax);
  }
  return sharp(px, { raw: { width: L, height: L, channels: 4 } });
}
await ruido(255, 242, 220, 30, 7).webp({ quality: 40, alphaQuality: 40 }).toFile(OUT + 'grano-claro.webp');
await ruido(50, 38, 20, 34, 11).webp({ quality: 40, alphaQuality: 40 }).toFile(OUT + 'grano-oscuro.webp');
console.log('grano listo');
