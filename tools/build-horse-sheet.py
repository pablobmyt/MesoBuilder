#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera `data/horse-sheet.json` a partir de una hoja de sprites de caballos.

La hoja de caballos del usuario ("Pixel Art Horse Sprite Sheet") NO es una rejilla
uniforme: los sprites van empaquetados a mano. Este script la mide por píxeles:

  1. Detecta el fondo (el damero claro que algunas hojas traen "cocido" en el PNG,
     sin canal alfa) y lo separa con un relleno por difusión desde los bordes: así
     los caballos blancos NO se confunden con el fondo (están encerrados por su
     contorno y el relleno no llega a ellos).
  2. Etiqueta cada sprite por componentes conexas y fusiona las piezas sueltas
     (alguna crin separada, sombras pegadas…).
  3. Agrupa los sprites en BANDAS (filas de la hoja).
  4. Escribe el JSON que consume `engine/horse-sheet-art.js`: las bandas con el
     rectángulo de cada variante y la tabla de animaciones (banda/fps/bucle).

La limpieza real del damero (quitarle el fondo) la hace el MOTOR al cargar, en el
navegador (`engine/horse-sheet-art.js`), para no duplicar el PNG en disco.

Uso:
    python tools/build-horse-sheet.py [ruta_hoja] [ruta_salida]

Requiere Pillow (`python -m pip install pillow`). Es una herramienta de PREPARACIÓN
de arte: se ejecuta a mano cuando cambia la hoja, no en el arranque del juego.
"""
import json
import os
import sys
from collections import deque

try:
    from PIL import Image
except ImportError:
    print("Falta Pillow: python -m pip install pillow")
    sys.exit(1)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOJA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "data", "sheets", "Caballos.png")
SALIDA = sys.argv[2] if len(sys.argv) > 2 else os.path.join(RAIZ, "data", "horse-sheet.json")

# Umbrales del fondo. OJO: no es sólo el damero. Cada caballo trae una SOMBRA
# gris debajo, y esa sombra es la que TAPA los huecos entre las patas (y por eso
# el caballo parecía una mancha maciza sin patas que separar). La sombra va de
# ~110 a ~250 de brillo, así que el fondo es "gris neutro y no muy oscuro":
# así entra el damero Y la sombra, y NO entran ni el contorno del caballo
# (brillo < 60) ni su pelo (saturado).
LUM_FONDO = 105      # brillo mínimo para considerar "fondo o sombra"
SAT_FONDO = 30       # diferencia máx/mín de canales (fondo y sombra son grises)
# Tope de tamaño (px) de una "bolsa" de damero encerrada dentro del caballo. Las
# bolsas medidas miden 21-72 px y las manchas blancas pintadas 143-426, así que
# 120 las separa. Si salen manchones claros en el caballo, bajar este número; si
# desaparecen manchas blancas del dibujo, subirlo.
BOLSAS_MAX_PX = 120

# ── Tabla de animaciones ─────────────────────────────────────────────────────
# El motor pide estos nombres desde `horseStateFor()` (game-engine.js).
#
# OJO, LECCIÓN APRENDIDA: las bandas 0-3 son el MISMO caballo con variaciones
# mínimas (no un ciclo) y las bandas 7-10 son el MISMO caballo con CUATRO SILLAS
# DISTINTAS. Recorrerlas como "fotogramas" hacía que el caballo pareciese ir
# ROTANDO entre varios caballos (y al ir montado, cambiaba de silla en cada
# fotograma). Por eso:
#
#   · `tipo: rig`  → se dibuja UNA sola banda (`base` / `baseMontura`) y el motor
#     la anima POR PARTES (patas + tronco): el caballo es siempre el mismo dibujo.
#   · `tipo: hoja` → poses completas y distintas de verdad (pastar, encabritarse,
#     tumbarse): ahí sí se cambia de banda, porque es el mismo caballo en otra pose.
ANIMS = [
    # nombre        tipo    fps  bucle  modo        (hoja: filas)
    ("idle",        "rig",   4,   True,  "reposo",   None),
    ("walk",        "rig",   9,   True,  "paso",     None),
    ("trot",        "rig",  13,   True,  "trote",    None),
    ("gallop",      "rig",  18,   True,  "galope",   None),
    ("paw",         "rig",  10,   True,  "piafar",   None),
    ("shake",       "rig",  12,   True,  "sacudir",  None),
    ("graze",       "hoja",  2,   True,  "pastar",   [4]),
    ("drink",       "hoja",  2,   True,  "beber",    [4]),
    ("rear",        "hoja",  4,   False, "encabritar", [5]),
    ("neigh",       "hoja",  4,   False, "relinchar",  [5]),
    ("lie",         "hoja",  2,   True,  "tumbarse", [6]),
]

# Bandas que sirven de DIBUJO BASE para el rig (la pose neutra, de perfil).
BANDA_BASE = 0            # sin montura
BANDA_BASE_MONTURA = 7    # con montura (silla rojiza)

# Pelaje por defecto: el MISMO caballo para todos (lo pidió el usuario).
PELAJE_POR_DEFECTO = 0

# Nombre legible de cada banda (para documentar y para la API de depuración).
POSES = {
    0: "de pie (base del rig)", 1: "de pie, variante 2", 2: "de pie, variante 3",
    3: "de pie, variante 4",
    4: "pastando", 5: "encabritado", 6: "tumbado",
    7: "con silla rojiza (base del rig montado)", 8: "con silla roja y oro",
    9: "con silla perfilada en rojo", 10: "con manta clara",
    11: "con brida de gala", 12: "con silla sencilla",
    13: "potros y objetos", 14: "potros y objetos (2)",
}


def main():
    im = Image.open(HOJA).convert("RGB")
    W, H = im.size
    px = im.load()
    print(f"Hoja: {os.path.relpath(HOJA, RAIZ)}  {W}x{H}")

    # 1 · mapa de "esto parece damero"
    fondo = bytearray(W * H)
    for y in range(H):
        base = y * W
        for x in range(W):
            r, g, b = px[x, y]
            if (max(r, g, b) - min(r, g, b)) < SAT_FONDO and (r + g + b) / 3 > LUM_FONDO:
                fondo[base + x] = 1

    # 2 · relleno por difusión desde el borde: sólo el damero EXTERIOR es fondo
    marca = bytearray(W * H)
    cola = deque()
    for x in range(W):
        for y in (0, H - 1):
            i = y * W + x
            if fondo[i] and not marca[i]:
                marca[i] = 1
                cola.append((x, y))
    for y in range(H):
        for x in (0, W - 1):
            i = y * W + x
            if fondo[i] and not marca[i]:
                marca[i] = 1
                cola.append((x, y))
    while cola:
        x, y = cola.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H:
                j = ny * W + nx
                if fondo[j] and not marca[j]:
                    marca[j] = 1
                    cola.append((nx, ny))

    # 3 · componentes conexas de lo que NO es fondo
    comp = [0] * (W * H)
    cajas = []
    actual = 0
    for y in range(H):
        for x in range(W):
            i = y * W + x
            if marca[i] or comp[i]:
                continue
            actual += 1
            comp[i] = actual
            cola = deque([(x, y)])
            x0 = x1 = x
            y0 = y1 = y
            n = 0
            while cola:
                cx, cy = cola.popleft()
                n += 1
                if cx < x0: x0 = cx
                if cx > x1: x1 = cx
                if cy < y0: y0 = cy
                if cy > y1: y1 = cy
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < W and 0 <= ny < H:
                        j = ny * W + nx
                        if not marca[j] and not comp[j]:
                            comp[j] = actual
                            cola.append((nx, ny))
            cajas.append([x0, y0, x1, y1, n])

    # 4 · fusionar piezas que casi se tocan (mismo bicho)
    def juntas(a, b, g=5):
        return not (a[2] + g < b[0] or b[2] + g < a[0] or a[3] + g < b[1] or b[3] + g < a[1])

    fusionando = True
    while fusionando:
        fusionando = False
        for i in range(len(cajas)):
            if cajas[i] is None:
                continue
            for j in range(i + 1, len(cajas)):
                if cajas[j] is None:
                    continue
                if juntas(cajas[i], cajas[j]):
                    a, b = cajas[i], cajas[j]
                    cajas[i] = [min(a[0], b[0]), min(a[1], b[1]),
                                max(a[2], b[2]), max(a[3], b[3]), a[4] + b[4]]
                    cajas[j] = None
                    fusionando = True
        cajas = [c for c in cajas if c is not None]

    # ruido (motas del damero que quedaron sueltas)
    cajas = [c for c in cajas if c[4] > 60]

    # 5 · agrupar en bandas por la fila
    cajas.sort(key=lambda c: c[1])
    bandas = []
    for c in cajas:
        for b in bandas:
            if c[1] >= b["y0"] - 8 and c[3] <= b["y1"] + 8:
                b["items"].append(c)
                b["y0"] = min(b["y0"], c[1])
                b["y1"] = max(b["y1"], c[3])
                break
        else:
            bandas.append({"y0": c[1], "y1": c[3], "items": [c]})
    for b in bandas:
        b["items"].sort(key=lambda c: c[0])
    bandas.sort(key=lambda b: b["y0"])

    # 6 · color "de pelo" de cada columna (media del cuerpo, sin contorno)
    variantes = []
    # Columnas = nº de pelajes de las bandas del caballo (las dos últimas traen
    # potros y objetos, que no forman parte de la rejilla de 20 pelajes).
    n_cols = max((len(b["items"]) for b in bandas[:13]), default=0)
    for col in range(n_cols):
        tot = [0, 0, 0]
        n = 0
        for b in bandas[:6]:                       # primeras poses: sin montura
            if col >= len(b["items"]):
                continue
            x0, y0, x1, y1, _n = b["items"][col]
            for y in range(y0, y1 + 1, 2):
                for x in range(x0, x1 + 1, 2):
                    r, g, b2 = px[x, y]
                    if (max(r, g, b2) - min(r, g, b2)) > 30 or (r + g + b2) / 3 < 140:
                        tot[0] += r; tot[1] += g; tot[2] += b2; n += 1
        if n:
            hexcol = '#%02x%02x%02x' % (tot[0] // n, tot[1] // n, tot[2] // n)
        else:
            hexcol = '#8e5a28'
        variantes.append({"id": "pelaje%d" % col, "col": col, "color": hexcol})

    salida = {
        "_nota": "Generado por tools/build-horse-sheet.py. Coordenadas en px sobre la hoja.",
        "hoja": "data/sheets/" + os.path.basename(HOJA),
        "ancho": W, "alto": H,
        "fondo": {"luminancia": LUM_FONDO, "saturacion": SAT_FONDO, "bolsasMaxPx": BOLSAS_MAX_PX},
        "columnas": n_cols,
        "variantes": variantes,
        "base": BANDA_BASE,
        "baseMontura": BANDA_BASE_MONTURA,
        "pelajePorDefecto": PELAJE_POR_DEFECTO,
        "bandas": [
            {"id": i, "pose": POSES.get(i, ""), "y0": b["y0"], "y1": b["y1"],
             "cuadros": [[c[0], c[1], c[2] - c[0] + 1, c[3] - c[1] + 1] for c in b["items"]]}
            for i, b in enumerate(bandas)
        ],
        "anims": {
            nombre: {"tipo": tipo, "fps": fps, "bucle": bucle, "modo": modo,
                     **({"filas": filas} if filas else {})}
            for (nombre, tipo, fps, bucle, modo, filas) in ANIMS
        },
    }

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, "w", encoding="utf-8") as fh:
        json.dump(salida, fh, ensure_ascii=False, indent=1)
    print(f"Bandas: {len(bandas)}  Columnas (pelajes): {n_cols}")
    for i, b in enumerate(bandas):
        print(f"  banda {i:2d}  y {b['y0']:4d}-{b['y1']:4d}  sprites={len(b['items']):2d}  {POSES.get(i, '')}")
    print("Escrito:", os.path.relpath(SALIDA, RAIZ))


if __name__ == "__main__":
    main()
