#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera `data/horse-sheet.json` (formato 2) a partir de la hoja de caballos.

LA HOJA (rejilla 4 x 8, celdas de 128x128)
==========================================
    filas 1-3  ->  ciclo de GALOPE, 11 fotogramas seguidos (4 + 4 + 3),
                   el caballo de perfil mirando a la DERECHA
    fila  4    ->  QUIETO, una vista por direccion: [arriba, izquierda, abajo, derecha]
    fila  5    ->  ANDAR visto por DETRAS (direccion «arriba»), 4 fotogramas
    fila  6    ->  ANDAR de perfil mirando a la IZQUIERDA, 4 fotogramas
    fila  7    ->  ANDAR de FRENTE (direccion «abajo»), 4 fotogramas
    fila  8    ->  ANDAR de perfil mirando a la DERECHA, 4 fotogramas

Lo que hace este script
=======================
1. Detecta el fondo: si el PNG trae canal alfa, ese alfa manda; si no (hoja con el
   damero «cocido», como la clasica), se separa con un relleno por difusion desde
   los bordes.
2. Mide cada fotograma por pixeles (caja del contenido, ignorando motas de 1 px).
3. Calcula UN lienzo comun para todos los recortes: misma anchura y altura, con
   la base (los cascos) en el borde inferior y el contenido centrado. Asi el
   caballo no cambia de tamano ni «baila» al pasar de andar a galopar.
4. Escribe el JSON que consume `engine/horse-sheet-art.js`.

Uso:
    python tools/build-horse-sheet.py [ruta_hoja] [ruta_salida]

Requiere Pillow (`python -m pip install pillow`). Es una herramienta de PREPARACION
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

ALFA_MIN = 24          # por debajo de esto el pixel es fondo
MIN_PX_FILA = 2        # motas de 1 px (restos de la rejilla) no cuentan como contenido
COLUMNAS = 4
FILAS = 8

FILAS_GALOPE = 3                       # las tres primeras filas son el ciclo de galope
VISTAS_IDLE = ["up", "left", "down", "right"]
FILAS_ANDAR = ["up", "left", "down", "right"]

FPS = {"idle": 4, "walk": 9, "gallop": 18}


# ── Fondo ────────────────────────────────────────────────────────────────────
def quitar_damero(im, lum=105, sat=30, bolsas_max=120):
    """RGBA con el damero y la sombra del fondo en alfa 0.

    Se marca como candidato todo gris neutro y no oscuro y se propaga desde los
    bordes: el caballo (blanco incluido) queda encerrado por su contorno y no se
    alcanza. Despues se quitan las «bolsas» de damero encerradas dentro del
    dibujo (los huecos entre las patas).
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    candidato = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                candidato[y * w + x] = 1
                continue
            mx, mn = max(r, g, b), min(r, g, b)
            if (mx - mn) < sat and (r + g + b) / 3 > lum:
                candidato[y * w + x] = 1

    fondo = bytearray(w * h)
    cola = deque()

    def mete(x, y):
        p = y * w + x
        if candidato[p] and not fondo[p]:
            fondo[p] = 1
            cola.append(p)

    for x in range(w):
        mete(x, 0); mete(x, h - 1)
    for y in range(h):
        mete(0, y); mete(w - 1, y)
    while cola:
        p = cola.popleft()
        x, y = p % w, p // w
        if x > 0: mete(x - 1, y)
        if x < w - 1: mete(x + 1, y)
        if y > 0: mete(x, y - 1)
        if y < h - 1: mete(x, y + 1)

    visto = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            p = y * w + x
            if not candidato[p] or fondo[p] or visto[p]:
                continue
            grupo = []
            q = deque([p])
            visto[p] = 1
            while q:
                c = q.popleft()
                grupo.append(c)
                cx, cy = c % w, c // w
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        n = ny * w + nx
                        if candidato[n] and not visto[n]:
                            visto[n] = 1
                            q.append(n)
            if len(grupo) <= bolsas_max:
                for c in grupo:
                    fondo[c] = 1

    for y in range(h):
        for x in range(w):
            if fondo[y * w + x]:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)
    return im


def preparar(im):
    """Devuelve (imagen RGBA con fondo transparente, tenia_alfa)."""
    im = im.convert("RGBA")
    tenia_alfa = im.getchannel("A").getextrema()[0] < 250
    if tenia_alfa:
        return im, True
    return quitar_damero(im), False


# ── Medicion ─────────────────────────────────────────────────────────────────
def medir_celdas(im):
    """Caja del contenido de cada celda de la rejilla, en px de la hoja."""
    w, h = im.size
    cw, ch = w // COLUMNAS, h // FILAS
    alfa = im.getchannel("A").load()
    out = []
    for fy in range(FILAS):
        fila = []
        for fx in range(COLUMNAS):
            x0, y0 = fx * cw, fy * ch
            minx, miny, maxx, maxy = cw, ch, -1, -1
            for y in range(ch):
                n = sum(1 for x in range(cw) if alfa[x0 + x, y0 + y] > ALFA_MIN)
                if n < MIN_PX_FILA:
                    continue
                for x in range(cw):
                    if alfa[x0 + x, y0 + y] > ALFA_MIN:
                        if x < minx: minx = x
                        if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
            fila.append(None if maxx < 0 else (x0 + minx, y0 + miny, maxx - minx + 1, maxy - miny + 1))
        out.append(fila)
    return out, (cw, ch)


def local(caja, celda, f, c):
    """Caja del contenido en coordenadas DENTRO de su celda."""
    cw, ch = celda
    x, y, w, h = caja
    return (x - c * cw, y - f * ch, w, h)


def rects_de_clip(clip, cajas, celda, lienzo, anclaje):
    """Rectangulos de los fotogramas de un clip, TODOS con el mismo tamano y el
    mismo desplazamiento dentro de su celda.

    Asi el caballo no cambia de tamano ni de sitio al pasar de una animacion a
    otra, y el movimiento de las patas es el que dibujo el artista.
    """
    cw, ch = celda
    LW, LH = lienzo
    rx, ry = anclaje
    rects = []
    for f, c in clip:
        if not cajas[f][c]:
            continue
        rects.append([c * cw + rx, f * ch + ry, LW, LH])
    return rects


def anclaje_de_familia(clips, cajas, celda, lienzo):
    """Desplazamiento comun (rx, ry) dentro de la celda para una familia de clips.

    La base se alinea con el borde inferior del lienzo. OJO: las filas de la hoja
    no estan dibujadas exactamente a la misma altura (hasta 12 px de diferencia
    entre las tres filas del galope), asi que se toma la base de la familia
    entera; si no, el caballo pegaria saltos verticales al pasar de fila.
    """
    cw, ch = celda
    LW, LH = lienzo
    bases, minxs, maxxs = [], [], []
    for clip in clips:
        for f, c in clip:
            caja = cajas[f][c]
            if not caja:
                continue
            x, y, w, h = local(caja, celda, f, c)
            bases.append(y + h)
            minxs.append(x)
            maxxs.append(x + w)
    base = max(bases)
    centro = (min(minxs) + max(maxxs)) / 2
    rx = int(round(centro - LW / 2))
    ry = base - LH
    # Sin salirse de la celda (no puede comerse al vecino).
    rx = max(0, min(rx, cw - LW))
    ry = max(0, min(ry, ch - LH))
    return rx, ry


def main():
    im, tenia_alfa = preparar(Image.open(HOJA))
    cajas, celda = medir_celdas(im)
    print("hoja:", os.path.relpath(HOJA, RAIZ).replace("\\", "/"), im.size, "alfa:", tenia_alfa)

    todos = [c for fila in cajas for c in fila if c]
    LW = max(c[2] for c in todos)
    LH = max(c[3] for c in todos)
    lienzo = (LW, LH)

    # Cada familia agrupa los clips que se dibujan con la MISMA base y escala:
    # pasar de quieto a andar no puede mover ni encoger el caballo.
    clips_def = {}
    galope = [(f, c) for f in range(FILAS_GALOPE) for c in range(COLUMNAS) if cajas[f][c]]
    clips_def["gallop"] = (galope, FPS["gallop"])
    for i, vista in enumerate(VISTAS_IDLE):
        clips_def["idle_" + vista] = ([(FILAS_GALOPE, i)], FPS["idle"])
    for i, vista in enumerate(FILAS_ANDAR):
        fila = FILAS_GALOPE + 1 + i
        clips_def["walk_" + vista] = ([(fila, c) for c in range(COLUMNAS) if cajas[fila][c]], FPS["walk"])

    familias = {
        "side": ["gallop", "idle_left", "idle_right", "walk_left", "walk_right"],
        "up": ["idle_up", "walk_up"],
        "down": ["idle_down", "walk_down"],
    }
    anclaje = {}
    for nombre, miembros in familias.items():
        anclaje[nombre] = anclaje_de_familia([clips_def[m][0] for m in miembros], cajas, celda, lienzo)
        print("familia %-5s anclaje %s" % (nombre, anclaje[nombre]))

    familia_de = {}
    for nombre, miembros in familias.items():
        for m in miembros:
            familia_de[m] = nombre

    clips = {}
    for nombre, (fotos, fps) in clips_def.items():
        familia = familia_de.get(nombre, "side")
        clips[nombre] = {"fps": fps,
                         "cuadros": rects_de_clip(fotos, cajas, celda, lienzo, anclaje[familia])}

    datos = {
        "_nota": "Generado por tools/build-horse-sheet.py. Coordenadas en px sobre la hoja.",
        "formato": 2,
        "hoja": os.path.relpath(HOJA, RAIZ).replace("\\", "/"),
        "ancho": im.size[0],
        "alto": im.size[1],
        "alfa": bool(tenia_alfa),
        "lienzo": {"w": LW, "h": LH},
        "columnas": 1,
        "pelajePorDefecto": 0,
        "clips": clips,
    }

    with open(SALIDA, "w", encoding="utf-8") as fh:
        json.dump(datos, fh, ensure_ascii=False, indent=1)

    print("lienzo comun:", LW, "x", LH)
    for nombre, c in clips.items():
        print("  %-12s %2d fotogramas @ %d fps  primero=%s" %
              (nombre, len(c["cuadros"]), c["fps"], c["cuadros"][0] if c["cuadros"] else None))
    print("ok", os.path.relpath(SALIDA, RAIZ).replace("\\", "/"))


if __name__ == "__main__":
    main()
