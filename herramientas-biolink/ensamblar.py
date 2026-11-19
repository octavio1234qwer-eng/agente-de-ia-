"""Inserta el sprite de íconos y la mantarraya en index.html (entre marcadores)."""
import os, re
BASE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(BASE, '../mantarraya-links/index.html')
h = open(INDEX).read()
sprite = open(os.path.join(BASE, 'salida/sprite.svg')).read()
raya = open(os.path.join(BASE, 'salida/raya-inline.svg')).read()
h = re.sub(r'<!-- sprite:inicio -->.*?<!-- sprite:fin -->', lambda m: '<!-- sprite:inicio -->' + sprite + '<!-- sprite:fin -->', h, flags=re.S)
h = re.sub(r'<!-- raya:inicio -->.*?<!-- raya:fin -->', lambda m: '<!-- raya:inicio -->' + raya + '<!-- raya:fin -->', h, flags=re.S)

open(INDEX, 'w').write(h)
print('index.html', len(h), 'bytes')
