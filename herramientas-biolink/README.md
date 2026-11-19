# Herramientas del bio link · La Casa de la Mantarraya

Scripts para regenerar los recursos de `../mantarraya-links/`. **No se suben al hosting.**
El cliente solo necesita `entrega/ENTREGA-bio-link-La-Casa-de-la-Mantarraya.zip` y editar `js/data.js`.

```bash
npm install                 # sharp, qrcode-generator, fuentes, lighthouse
pip install fonttools brotli zxing-cpp markdown
```

| Script | Qué hace |
|---|---|
| `python3 fuentes.py` | Subconjunto de Fraunces y Bricolage (solo español/inglés, ejes acotados). |
| `node imagenes.mjs` | Fotos AVIF + WebP con un mismo tratamiento de color. Prioriza `assets/mis-fotos/<clave>.jpg` si existe. |
| `node grano.mjs` | Texturas de grano de papel. |
| `python3 raya.py` | Ilustración decorativa de la mantarraya (NO es el logo). |
| `python3 iconos.py` | Íconos propios en estilo grabado + sprite. |
| `python3 ensamblar.py` | Inserta sprite e ilustración en `index.html`. |
| `node recursos.mjs` | Favicons (logo original), `og.jpg`, `contacto.vcf`, QR (SVG/PNG) y PDF del tarjetón. Requiere `node servidor.mjs 8090` y `LOCAL_URL=http://127.0.0.1:8090/`. |
| `node servidor.mjs 8090` | Servidor local con compresión y caché como el hosting real. |
| `./lh.sh <url> <nombre> [mobile|desktop]` | Lighthouse. |
| `python3 guia_pdf.py` | Convierte `entrega/GUIA-DE-ENTREGA.md` en PDF. |

`originales/` guarda las fotos tomadas del sitio oficial y de Reservándonos.
