# Subconjunto de fuentes: solo caracteres de español/inglés y ejes acotados.
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

FS = 'node_modules/@fontsource-variable/'
OUT = '../mantarraya-links/assets/fonts/'
UNICODES = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + [
    0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x2022, 0x2192, 0x2190,
    0x2116, 0x2605, 0x00B7, 0x2009, 0x202F, 0x2032, 0x20AC, 0x2715, 0x2191, 0x2197]

def hacer(src, dst, limites):
    f = TTFont(FS + src)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['kern', 'liga', 'tnum', 'lnum', 'pnum', 'onum', 'case', 'ss01', 'ss02', 'calt', 'ccmp', 'locl', 'mark', 'mkmk']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=UNICODES)
    s.subset(f)
    f = instancer.instantiateVariableFont(f, limites)
    f.flavor = 'woff2'
    f.save(OUT + dst)
    import os
    print(dst, os.path.getsize(OUT + dst))

hacer('fraunces/files/fraunces-latin-full-normal.woff2', 'fraunces.woff2',
      {'wght': (380, 480), 'SOFT': 50, 'WONK': 0, 'opsz': 72})
hacer('fraunces/files/fraunces-latin-full-italic.woff2', 'fraunces-italic.woff2',
      {'wght': 380, 'SOFT': 50, 'WONK': 1, 'opsz': 72})
hacer('bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2', 'bricolage.woff2',
      {'wght': (400, 700), 'wdth': 100, 'opsz': 14})
