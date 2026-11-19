"""Ilustración decorativa (NO es el logo; el logo es siempre el PNG original del restaurante).
Dibuja la mantarraya en estilo grabado de carta náutica (SVG propio).

Genera:
  - ../mantarraya-links/assets/icons/mantarraya-grabado.svg  (trazo, para la animación)
  - salida/raya-inline.svg (fragmento con clases para incrustar en index.html)
La raya mira hacia arriba; viewBox 0 0 400 340. El eje central es x = 200.
"""
import math, os

OUT_ICONS = os.path.join(os.path.dirname(__file__), '../mantarraya-links/assets/icons/')
OUT_TMP = os.path.join(os.path.dirname(__file__), 'salida/')
os.makedirs(OUT_ICONS, exist_ok=True)
os.makedirs(OUT_TMP, exist_ok=True)

def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
            u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1])

def f(n):
    return ('%.1f' % n).rstrip('0').rstrip('.')

def mirror(p):
    return (400 - p[0], p[1])

# Contorno del ala izquierda (de la cabeza a la punta y de regreso a la cola)
CAB = (200, 70)
HOMBRO = (174, 80)
PUNTA = (22, 184)
ANCA = (166, 214)
COLA = (200, 226)
BORDE_ATAQUE = (HOMBRO, (122, 84), (50, 112), PUNTA)   # borde delantero, convexo
BORDE_FUGA = (PUNTA, (74, 174), (126, 178), ANCA)      # borde trasero, cóncavo

def ala_path(lado):
    m = (lambda p: p) if lado == 'izq' else mirror
    pts = lambda *ps: ' '.join(f(m(p)[0]) + ',' + f(m(p)[1]) for p in ps)
    return ('M' + pts(CAB) +
            ' C' + pts((190, 70), (181, 73), HOMBRO) +
            ' C' + pts(*BORDE_ATAQUE[1:]) +
            ' C' + pts(*BORDE_FUGA[1:]) +
            ' C' + pts((179, 220), (190, 225), COLA))

def lineas_sombreado(lado):
    """Líneas de contorno entre el borde de ataque y el de fuga (sombra hacia la fuga)."""
    m = (lambda p: p) if lado == 'izq' else mirror
    out = []
    niveles = [0.50, 0.60, 0.68, 0.75, 0.81, 0.86, 0.905, 0.945]
    for i, k in enumerate(niveles):
        t0 = 0.10 + i * 0.015
        t1 = 0.93 - (len(niveles) - i) * 0.03
        pts = []
        for s in range(0, 25):
            t = t0 + (t1 - t0) * s / 24
            a = bez(*BORDE_ATAQUE, t)
            b = bez(*BORDE_FUGA, 1 - t)
            pts.append(m((a[0] * (1 - k) + b[0] * k, a[1] * (1 - k) + b[1] * k)))
        out.append('M' + ' L'.join(f(x) + ',' + f(y) for x, y in pts))
    # dos líneas de luz cerca del borde de ataque
    for k, t0, t1 in [(0.07, 0.16, 0.74), (0.14, 0.22, 0.6)]:
        pts = []
        for s in range(0, 19):
            t = t0 + (t1 - t0) * s / 18
            a = bez(*BORDE_ATAQUE, t)
            b = bez(*BORDE_FUGA, 1 - t)
            pts.append(m((a[0] * (1 - k) + b[0] * k, a[1] * (1 - k) + b[1] * k)))
        out.append('M' + ' L'.join(f(x) + ',' + f(y) for x, y in pts))
    return out

def punteado(lado):
    """Manchas de los hombros, como punteado de grabado."""
    m = (lambda p: p) if lado == 'izq' else mirror
    pts = []
    for fila in range(5):
        for col in range(6 - fila):
            x = 152 - col * 9 - fila * 4
            y = 98 + fila * 7 + col * 3.2
            pts.append(m((x, y)))
    return pts

def cuerpo():
    p = []
    # disco central
    p.append('M186,90 C181,118 181,170 189,214')
    p.append('M214,90 C219,118 219,170 211,214')
    # cresta dorsal
    p.append('M200,92 C201,130 199,175 200,214')
    # aletas cefálicas (cuernos enrollados)
    p.append('M180,79 C173,70 173,58 181,53 C186,58 189,66 190,74')
    p.append('M220,79 C227,70 227,58 219,53 C214,58 211,66 210,74')
    # boca: borde frontal entre las aletas cefálicas
    p.append('M190,74 C196,77 204,77 210,74')
    # cola
    p.append('M200,226 C203,256 197,292 205,334')
    # pequeña aleta dorsal
    p.append('M195,222 L200,233 L205,222')
    return p

def svg_grabado(clases=True):
    c = (lambda n: ' class="%s"' % n) if clases else (lambda n: ' class="t"' if 'trama' in n or 'puntos' in n else '')
    pl = ' pathLength="1"' if clases else ''
    partes = []
    for lado in ('izq', 'der'):
        g = ['<g%s>' % c('raya__ala raya__ala--' + lado)]
        g.append('<path%s%s d="%s"/>' % (c('raya__borde'), pl, ala_path(lado)))
        for d in lineas_sombreado(lado):
            g.append('<path%s%s d="%s"/>' % (c('raya__trama'), pl, d))
        g.append('<g%s>' % c('raya__puntos') + ''.join(
            '<circle cx="%s" cy="%s" r="1.1"/>' % (f(x), f(y)) for x, y in punteado(lado)) + '</g>')
        g.append('</g>')
        partes.append(''.join(g))
    cu = ['<g%s>' % c('raya__cuerpo')]
    for d in cuerpo():
        cu.append('<path%s%s d="%s"/>' % (c('raya__linea'), pl, d))
    cu.append('<circle cx="181" cy="86" r="2.2"/><circle cx="219" cy="86" r="2.2"/>')
    cu.append('</g>')
    partes.append(''.join(cu))
    return ''.join(partes)

def silueta_path():
    izq = ala_path('izq')
    der = ala_path('der')
    return izq, der

# --- Archivo de trazo (independiente) ---
grabado = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 340" fill="none" '
           'stroke="#1c708b" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">'
           '<style>.t{stroke-width:.75}g.t{fill:#1c708b;stroke:none}</style>' + svg_grabado(clases=False) + '</svg>')
open(OUT_ICONS + 'mantarraya-grabado.svg', 'w').write(grabado)


# --- Fragmento para incrustar: tres capas SVG (ala izq., ala der., cuerpo) para que
#     el aleteo se anime con transform en la tarjeta gráfica, sin repintar el dibujo. ---
def capas():
    partes = []
    for lado in ('izq', 'der'):
        g = ['<svg class="raya__capa raya__ala raya__ala--%s" viewBox="0 0 400 340" fill="none" focusable="false">' % lado]
        g.append('<path class="raya__borde" pathLength="1" d="%s"/>' % ala_path(lado))
        for d in lineas_sombreado(lado):
            g.append('<path class="raya__trama" pathLength="1" d="%s"/>' % d)
        g.append('<g class="raya__puntos">' + ''.join(
            '<circle cx="%s" cy="%s" r="1.1"/>' % (f(x), f(y)) for x, y in punteado(lado)) + '</g>')
        g.append('</svg>')
        partes.append(''.join(g))
    cu = ['<svg class="raya__capa raya__cuerpo" viewBox="0 0 400 340" fill="none" focusable="false">']
    for d in cuerpo():
        cu.append('<path class="raya__linea" pathLength="1" d="%s"/>' % d)
    cu.append('<circle cx="181" cy="86" r="2.2"/><circle cx="219" cy="86" r="2.2"/>')
    cu.append('</svg>')
    partes.append(''.join(cu))
    return ''.join(partes)

inline = '<div class="raya">' + capas() + '</div>'
open(OUT_TMP + 'raya-inline.svg', 'w').write(inline)
print('raya inline bytes:', len(inline))
