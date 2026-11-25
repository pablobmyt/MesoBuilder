#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Previsualiza los clips de `data/horse-sheet.json` (herramienta de apoyo).

Dibuja una FILA por clip (galope, quieto y andar en las cuatro direcciones) y una
columna por fotograma, usando los rectángulos del JSON tal cual y el mismo lienzo
común que usa el motor. Sirve para comprobar de un vistazo que cada estado apunta
a los fotogramas correctos de la hoja antes de abrir el juego.

Uso:
    python tools/preview-horse.py [salida.png]
"""
import json
import os
import sys
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAIZ_JSON = os.path.join(RAIZ, "data", "horse-sheet.json")
SALIDA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "tools", "_horse_anims.png")
ESC = 3

with open(RAIZ_JSON, encoding="utf-8") as fh:
    datos = json.load(fh)

if datos.get("formato") != 2:
    print("Este previsualizador es para horse-sheet.json formato 2.",
          "Regenera con: python tools/build-horse-sheet.py")
    sys.exit(1)

im = Image.open(os.path.join(RAIZ, datos["hoja"])).convert("RGBA")
LW, LH = datos["lienzo"]["w"], datos["lienzo"]["h"]
clips = datos["clips"]

# Orden de lectura: primero el galope y luego cada dirección con su quieto.
orden = ["gallop"]
for vista in ("up", "left", "down", "right"):
    for prefijo in ("idle_", "walk_"):
        if prefijo + vista in clips:
            orden.append(prefijo + vista)

max_cols = max(len(clips[k]["cuadros"]) for k in orden)
CW, CH = (LW + 6) * ESC, (LH + 6) * ESC
ancho = 190 + CW * max_cols
alto = CH * len(orden) + 16
sal = Image.new("RGB", (ancho, alto), (255, 255, 255))
d = ImageDraw.Draw(sal)

for f, nombre in enumerate(orden):
    clip = clips[nombre]
    y = 8 + f * CH
    d.text((6, y + CH // 2), "%s · %d fps" % (nombre, clip["fps"]), fill=(0, 0, 0))
    for c, (x0, y0, w, h) in enumerate(clip["cuadros"]):
        t = im.crop((x0, y0, x0 + w, y0 + h))
        bg = Image.new("RGBA", t.size, (222, 226, 230, 255))
        bg.alpha_composite(t)
        bg = bg.convert("RGB").resize((w * ESC, h * ESC), Image.NEAREST)
        sal.paste(bg, (190 + c * CW, y))
        d.rectangle([190 + c * CW, y, 190 + c * CW + w * ESC, y + h * ESC], outline=(210, 214, 218))
    d.line([(0, y + CH - 3), (ancho, y + CH - 3)], fill=(228, 228, 228))

sal.save(SALIDA)
print("ok", SALIDA, sal.size)
