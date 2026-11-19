"""Íconos propios en estilo grabado (trazo fino + achurado). viewBox 0 0 24 24.

Genera un SVG por ícono en ../mantarraya-links/assets/icons/ y el sprite
salida/sprite.svg para incrustar en index.html.
Clase .h = achurado (trazo más fino).
"""
import math, os

OUT = os.path.join(os.path.dirname(__file__), '../mantarraya-links/assets/icons/')
TMP = os.path.join(os.path.dirname(__file__), 'salida/')

def pinata():
    cx, cy, r, R = 12, 10.5, 3.4, 9.2
    partes = ['<circle cx="12" cy="10.5" r="3.4"/>']
    for k in range(7):
        a = math.radians(-90 + k * 360 / 7)
        if 2 <= k <= 5 and k in (3, 4):
            continue  # dos conos de abajo se cambian por listones
        b1 = a - 0.32
        b2 = a + 0.32
        p1 = (cx + r * math.cos(b1), cy + r * math.sin(b1))
        p2 = (cx + r * math.cos(b2), cy + r * math.sin(b2))
        tip = (cx + R * math.cos(a), cy + R * math.sin(a))
        partes.append('<path d="M%.2f %.2fL%.2f %.2fL%.2f %.2f"/>' % (p1 + tip + p2))
        mid = (cx + (r + R) / 2 * math.cos(a), cy + (r + R) / 2 * math.sin(a))
        ox, oy = -math.sin(a) * 0.9, math.cos(a) * 0.9
        partes.append('<path class="h" d="M%.2f %.2fL%.2f %.2f"/>' % (mid[0] - ox, mid[1] - oy, mid[0] + ox, mid[1] + oy))
    partes.append('<path class="h" d="M10.6 14c-.6 2.4-.2 4.6 1 7M13.4 14c.7 2.3.4 4.4-.6 6.6M12 13.9v8"/>')
    partes.append('<path class="h" d="M10.4 9.6h3.2M10.4 11.4h3.2"/>')
    return ''.join(partes)

ICONOS = {
    'pin': '<path d="M12 21.5c-3.9-4.5-6.6-8.1-6.6-11.3a6.6 6.6 0 0 1 13.2 0c0 3.2-2.7 6.8-6.6 11.3z"/><circle cx="12" cy="10.2" r="2.4"/><path class="h" d="M6.9 12.6l1.7-1.7M7.9 14.7l2.4-2.4M9.2 16.7l2.2-2.2M10.6 18.5l1.6-1.6"/>',
    'maracas': '<ellipse cx="9.5" cy="8.6" rx="4.6" ry="5.4" transform="rotate(-28 9.5 8.6)"/><path d="M12.2 13.2l4.3 7.6"/><path class="h" d="M6.3 6.1c1.6.4 3.6 1.7 5 3.4M5.4 8.6c1.5.5 3.3 1.8 4.6 3.6M8.7 4.1c1.3.6 2.7 1.8 3.6 3.1"/><path d="M17.4 3.6c.9.5 1.5 1.3 1.7 2.3M19.3 2.2c1.3.8 2.1 2 2.3 3.4"/>',
    'sol': '<path d="M2.8 17h18.4M7 17a5 5 0 0 1 10 0"/><path d="M12 6.4v2.2M5.3 9.3l1.5 1.5M18.7 9.3l-1.5 1.5M2.9 13.4h2M19.1 13.4h2"/><path class="h" d="M5.5 19.6h13M8.5 21.8h7M9.4 15h5.2M10.5 13.2h3"/>',
    'pinata': pinata(),
    'estrella': '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.1 6-.8z"/><path class="h" d="M12 6.4v10M13.4 9.2v6.4M14.9 10.3v4.6M16.4 11.2l-.2 2.2"/>',
    'huella': '<path d="M12 12.4c-2.6 0-5.2 2.9-5.2 5.4 0 1.7 1.4 2.6 3 2.3.9-.2 1.4-.6 2.2-.6s1.3.4 2.2.6c1.6.3 3-.6 3-2.3 0-2.5-2.6-5.4-5.2-5.4z"/><ellipse cx="6.1" cy="10.6" rx="1.7" ry="2.2" transform="rotate(-20 6.1 10.6)"/><ellipse cx="9.6" cy="6.6" rx="1.8" ry="2.4" transform="rotate(-8 9.6 6.6)"/><ellipse cx="14.4" cy="6.6" rx="1.8" ry="2.4" transform="rotate(8 14.4 6.6)"/><ellipse cx="17.9" cy="10.6" rx="1.7" ry="2.2" transform="rotate(20 17.9 10.6)"/><path class="h" d="M10 15.6h4M9.2 17.4h5.6"/>',
    'parasol': '<path d="M3 10.4C3.8 6.3 7.6 3.4 12 3.4s8.2 2.9 9 7z"/><path d="M12 3.4v17.4M8 20.8h8"/><path class="h" d="M7.6 10.2c.4-3 1.9-5.4 4.4-6.8M16.4 10.2c-.4-3-1.9-5.4-4.4-6.8M5.2 12.6c-.3 1.6.6 2.4 1.6 2.4M18.8 12.6c.3 1.6-.6 2.4-1.6 2.4"/>',
    'auto': '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4"/><path d="M9.6 17V7.4h3.3a2.9 2.9 0 0 1 0 5.8H9.6"/><path class="h" d="M5.8 20.4l14.6-14.6M8.4 20.4l12-12"/>',
    'rehilete': '<path d="M12 11.2V4.6c2.8 0 4.6 1.9 4.6 4.3zM12.8 12h6.6c0 2.8-1.9 4.6-4.3 4.6zM12 12.8v6.6c-2.8 0-4.6-1.9-4.6-4.3zM11.2 12H4.6c0-2.8 1.9-4.6 4.3-4.6z"/><circle cx="12" cy="12" r=".9"/><path d="M12.6 13.6l3.1 8.2"/><path class="h" d="M13.4 6.6l1.7 1.6M17.4 13.4l-1.6 1.7M10.6 17.4l-1.7-1.6M6.6 10.6l1.6-1.7"/>',
    'pastel': '<path d="M4.4 20.6h15.2M5.6 20.6v-5.4h12.8v5.4M7.4 15.2v-3.6h9.2v3.6M12 11.6V8.8"/><path d="M12 8.4c-.9-.6-1-1.7-.4-2.6l.4-.6.4.6c.6.9.5 2-.4 2.6z"/><path class="h" d="M5.6 17.4c1.1 1 2.1 1 3.2 0s2.1-1 3.2 0 2.1 1 3.2 0 2.1-1 3.2 0M9 13.4h6"/>',
    'balon': '<circle cx="12" cy="12" r="8.6"/><path d="M12 8.6l3.1 2.3-1.2 3.6h-3.8l-1.2-3.6z"/><path d="M12 8.6V3.4M15.1 10.9l4.9-1.6M13.9 14.5l3 4.2M10.1 14.5l-3 4.2M8.9 10.9L4 9.3"/><path class="h" d="M11 10.4h2M10.6 12.4h2.8"/>',
    'moneda': '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="6.2"/><path d="M14.2 9.6c-.4-.8-1.2-1.2-2.2-1.2-1.3 0-2.2.7-2.2 1.7 0 2.4 4.6 1.3 4.6 3.8 0 1-1 1.8-2.4 1.8-1.1 0-2-.5-2.4-1.3M12 7.2v1.2M12 15.6v1.2"/>',
    'ig': '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5"/><circle cx="12" cy="12" r="3.9"/><circle cx="16.9" cy="7.1" r=".6" fill="currentColor"/><path class="h" d="M5.6 15.4c.5 1.6 1.4 2.6 3 3.1"/>',
    'fb': '<circle cx="12" cy="12" r="8.6"/><path d="M15 7.4h-1.6c-1.4 0-2.2.8-2.2 2.2v11M8.8 12.6h5.6"/>',
    'wa': '<path d="M4.4 19.8l1.3-3.9a8.2 8.2 0 1 1 2.8 2.7z"/><path d="M9.2 8.6c.3-.5.7-.6 1-.6h.4c.2 0 .4.1.5.4l.7 1.7c.1.2 0 .5-.1.7l-.6.6c.6 1.2 1.6 2.2 2.8 2.8l.6-.6c.2-.1.5-.2.7-.1l1.7.7c.3.1.4.3.4.5v.4c0 .3-.2.7-.6 1-.6.4-1.6.5-2.8 0-2-.8-3.6-2.4-4.4-4.4-.5-1.3-.4-2.3-.1-2.9z"/>',
    'web': '<circle cx="12" cy="12" r="8.6"/><ellipse cx="12" cy="12" rx="3.8" ry="8.6"/><path d="M3.6 9.2h16.8M3.6 14.8h16.8"/>',
    'compartir': '<path d="M8.4 9.6H6.6v10.6h10.8V9.6h-1.8M12 3.6v11M8.6 7L12 3.6 15.4 7"/>',
    'contacto': '<rect x="3" y="5" width="18" height="14" rx="2.4"/><circle cx="8.8" cy="10.6" r="2.2"/><path d="M5.6 16.2c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.4 9.8h4M14.4 12.8h3"/>',
    'tel': '<path d="M6.6 3.8h2.6l1.5 4.2-2 1.4a11 11 0 0 0 5.9 5.9l1.4-2 4.2 1.5v2.6a2.2 2.2 0 0 1-2.4 2.2C10.9 19.1 4.9 13.1 4.4 6.2a2.2 2.2 0 0 1 2.2-2.4z"/>',
    'flecha': '<path d="M4.6 12.2c4.6-.4 9.2-.4 14.2 0M13.4 6.6l5.6 5.6-5.6 5.6"/>',
    'externo': '<path d="M7 17L17.2 6.8M9.2 6.8h8v8"/>',
    'cerrar': '<path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"/>',
    'mas': '<path d="M12 5.6v12.8M5.6 12h12.8"/>',
    'menos': '<path d="M5.6 12h12.8"/>',
    'personas': '<circle cx="9" cy="8.4" r="3"/><path d="M3.6 19c.5-3.2 2.6-5 5.4-5s4.9 1.8 5.4 5"/><path d="M15.4 5.8a2.8 2.8 0 0 1 0 5.4M16.6 14.4c2 .6 3.4 2.2 3.8 4.6"/>',
    'calendario': '<rect x="3.8" y="5.2" width="16.4" height="15" rx="2.4"/><path d="M3.8 9.8h16.4M8.2 3.4v3.4M15.8 3.4v3.4"/><path class="h" d="M7.6 13.2h1.6M11.2 13.2h1.6M14.8 13.2h1.6M7.6 16.6h1.6M11.2 16.6h1.6"/>',
    'reloj': '<circle cx="12" cy="12" r="8.6"/><path d="M12 7v5.2l3.4 2"/><path class="h" d="M12 4.6v1M19.4 12h-1M12 19.4v-1M4.6 12h1"/>',
    'giro': '<rect x="8" y="4" width="8" height="16" rx="2" transform="rotate(-14 12 12)"/><path d="M3.2 9.4a9.4 9.4 0 0 1 3-4.8M20.8 14.6a9.4 9.4 0 0 1-3 4.8"/><path d="M4.4 4.2l1.9.4-.3 2M19.6 19.8l-1.9-.4.3-2"/>',
}

def svg_suelto(nombre, cuerpo):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
            '<style>.h{stroke-width:.85}</style>' + cuerpo + '</svg>')

os.makedirs(OUT, exist_ok=True)
os.makedirs(TMP, exist_ok=True)
for n, c in ICONOS.items():
    open(OUT + n + '.svg', 'w').write(svg_suelto(n, c))
sprite = ['<svg class="sprite" aria-hidden="true" focusable="false" width="0" height="0">']
for n, c in ICONOS.items():
    sprite.append('<symbol id="i-%s" viewBox="0 0 24 24">%s</symbol>' % (n, c.replace('class="h"', 'class="h" stroke-width=".85"')))
sprite.append('</svg>')
open(TMP + 'sprite.svg', 'w').write(''.join(sprite))
print(len(ICONOS), 'íconos;', len(''.join(sprite)), 'bytes de sprite')
