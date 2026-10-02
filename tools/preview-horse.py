#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Previsualiza las animaciones de `data/horse-sheet.json` (herramienta de apoyo).

Dibuja un montaje con una FILA por animación y una columna por fotograma, usando
los rectángulos del JSON tal cual. Sirve para comprobar de un vistazo que cada
estado del motor apunta a las filas correctas de la hoja antes de abrir el juego.

Uso:
    python tools/preview-horse.py [salida.png] [pelaje]
"""
import json
import os
import sys
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAIZ_JSON = os.path.join(RAIZ, "data", "horse-sheet.json")
SALIDA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "tools", "_horse_anims.png")
PELAJE = int(sys.argv[2]) if len(sys.argv) > 2 else 0
ESC = 3

with open(RAIZ_JSON, encoding="utf-8") as fh:
    datos = json.load(fh)

im = Image.open(os.path.join(RAIZ, datos["hoja"])).convert("RGB")
anims = datos["anims"]
bandas = datos["bandas"]

filas = []
max_cols = 0
for nombre, a in anims.items():
    # Los estados de tipo `rig` NO se recortan de una banda: el motor los dibuja
    # animando por partes el dibujo base. Aquí se enseña ese dibujo base, que es lo
    # que hay que revisar a ojo (la animación real se ve con `MESO_HORSESHEET.tira`
    # en la consola del juego).
    if a.get("tipo") == "rig":
        lista = [datos["base"]]
        etiqueta = nombre + " · " + str(a["fps"]) + "fps · rig (" + str(a.get("modo")) + ")"
    else:
        lista = a["filas"]
        etiqueta = nombre + " · " + str(a["fps"]) + "fps" + ("" if a.get("bucle", True) else " · 1 vez")
    max_cols = max(max_cols, len(lista))
    filas.append((etiqueta, lista))

CW, CH = 78 * ESC, 78 * ESC
ancho = 150 + CW * max_cols
alto = CH * len(filas) + 20
sal = Image.new("RGB", (ancho, alto), (255, 255, 255))
d = ImageDraw.Draw(sal)

for f, (etiqueta, lista) in enumerate(filas):
    y = 10 + f * CH
    d.text((6, y + CH // 2), etiqueta, fill=(0, 0, 0))
    for c, idx_banda in enumerate(lista):
        b = bandas[idx_banda]
        cuadros = b["cuadros"]
        col = min(PELAJE, len(cuadros) - 1)
        x0, y0, w, h = cuadros[col]
        t = im.crop((x0, y0, x0 + w, y0 + h))
        t = t.resize((t.width * ESC, t.height * ESC), Image.NEAREST)
        px = 150 + c * CW + (CW - t.width) // 2
        py = y + (CH - t.height) // 2
        sal.paste(t, (px, py))
        d.text((150 + c * CW + 4, y + 2), "b" + str(idx_banda), fill=(180, 0, 0))
    d.line([(0, y), (ancho, y)], fill=(225, 225, 225))

sal.save(SALIDA)
print("ok", SALIDA, sal.size)
