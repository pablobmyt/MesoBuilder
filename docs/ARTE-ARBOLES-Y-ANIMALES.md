# Árboles y animales — arte y animación

> Añadido: 2026-09-30
> Código: `engine/tree-art.js` (generador de árboles), `engine/animal-art.js`
> (animales animados), `engine/game-engine.js` (dibujado, viento y enganche).
> Herramientas: `tools/build-trees.js`, `tools/preview-animals.js`.
> Docs relacionadas: `docs/RENDERIZADO-PIXEL.md`, `docs/INTERIORES.md`.

## 1. El problema

* Los árboles del mundo eran 7 plantillas diminutas de verde plano (la mitad del
  bosque, además, caía en la plantilla de manojo de hierba, así que se veía
  ralo) y **no se movían**.
* Los animales no tenían animación: el perro (Kidu) y el lobo eran un mapa de
  bits **fijo** que se deslizaba por el mapa, y el conejo y el zorro eran
  elipses vectoriales suaves, sin nada de pixel-art.

## 2. Árboles (`engine/tree-art.js`)

El arte de los árboles es **generado por código** (no dibujado a mano sprite a
sprite) con un RNG determinista por especie. Así hay variedad sin repetir, la
paleta es la misma en todos y el arte se puede volcar a datos:

```
node tools/build-trees.js --preview   # los dibuja en ASCII para revisarlos
node tools/build-trees.js             # los escribe en data/entity-pixels.json
node tools/build-trees.js --dry       # sólo dice qué cambiaría
```

* `buildTreeTemplates()` devuelve los 7 sprites, en el orden que espera el motor:
  **0** árbol ancho · **1** árbol alto · **2** conífera · **3** olivo/sauce ·
  **4** arbolillo · **5** seto · **6** manojo de hierba.
* El motor los usa como respaldo (`BUILTIN_TREE_TEMPLATES`) y toma los definitivos
  de `data/entity-pixels.json` (`tree0..tree6`), de donde salen tanto el bosque
  del mapa como los árboles-entidad. Al ser el mismo volcado, el editor de
  píxeles y el juego ven el mismo arte.
* Cada árbol se pinta como píxeles con `drawTreePixels(ctx, tpl, sx, sy, escala,
  { bend })`: el **pie queda clavado** y la copa se desplaza fila a fila, así que
  el árbol se dobla en vez de moverse en bloque.

### Viento

* `windStrength()` (en el motor) da una fuerza global con rachas lentas.
* `treeSwayPhase(col, row)` da una fase propia a cada árbol: el bosque no se
  mueve al unísono.
* El bosque del mapa, las matas de hierba y los árboles-entidad usan el mismo
  criterio: **un solo camino de dibujado**, `drawTreeTemplateSway(tpl, escala,
  cx, cy, bendPx)`. Pre-renderiza cada plantilla por fase de viento y la pega con
  **un `drawImage`** por árbol (antes eran cientos de `fillRect`), con la escala
  **entera**, las coordenadas enteras y `imageSmoothingEnabled = false`.

### Por qué NO se usa el atlas (los árboles salían borrosos)

Antes, los árboles-entidad lejanos (`zoom < smoothingThreshold`) se dibujaban
desde el atlas del árbol con

```js
ctx.translate(sx + destW / 2, sy + destH);
ctx.rotate(ang);                       // balanceo...
ctx.drawImage(atlas.canvas, meta.x, meta.y, meta.w, meta.h, -destW / 2, -destH, destW, destH);
```

y eso se ve **borroso**, por tres motivos que se suman: (1) el `rotate()` obliga al
canvas a remuestrear (`imageSmoothingEnabled` estaba activo en ese punto), (2)
`destW / 2` con ancho impar desplaza medio píxel, y (3) el atlas está a una escala
base fija, así que el destino (`destW`) casi nunca es un múltiplo entero suyo y el
reescalado interpola con manchas irregulares.

Ahora ese camino no existe: todos los árboles van por el bitmap de balanceo (arte
a 1 px por píxel, escalado por un entero, sin suavizado) y el viento se aplica
doblando filas, que es lo que se espera de pixel art. Se gana nitidez **y** tiempo
(un `drawImage` igual que el atlas).

### Reparto de especies

`pickForestTreeTemplateIndex` reparte las variantes del mapa entre los árboles
**de verdad** (0-4) con algo de azar por celda; antes devolvía el índice 6 (hierba)
para la mitad del bosque. Los setos (5) y la hierba (6) se reservan a las
variantes pequeñas.

Además, cada árbol del bosque recibe un **tamaño distinto** (±15 % según el ruido
de la celda) para que la masa forestal no parezca calcada.

## 3. Animales (`engine/animal-art.js`)

Cuatro animales: `rabbit`, `fox`, `dog` (Kidu) y `wolf` (lobo de estepa).
Cada uno se compone de formas (cuerpo, barriga, cabeza, hocico, orejas, cola y
patas) sobre una rejilla de arte; el contorno y el sombreado por franjas se
calculan solos, así que todos quedan con el mismo estilo.

* **Estados**: `idle` · `walk` · `run` · `hurt` · `dead`.
* **Animación por partes**: las patas van en dos pares alternos, el cuerpo
  rebota, la cola se menea y las orejas se mueven. El conejo tiene su ciclo de
  salto (arco del cuerpo, patas recogidas y orejas hacia atrás) en vez de trote.
* **Rendimiento**: el resultado se cachea en un lienzo por (animal, estado,
  fotograma); en pantalla sólo se hace **un `drawImage`** por bicho. 8 fotogramas
  por ciclo (medido: los 4 animales dan 7 fotogramas distintos de 8, que es lo
  esperable porque la fase 0 y 1 son el mismo punto del ciclo).
* Previsualización sin abrir el juego:

```
node tools/preview-animals.js            # los 4 animales, 3 estados, 4 fases
node tools/preview-animals.js dog wolf    # sólo algunos
```

### Dónde se dibujan

| Bicho | En el motor | Estado |
| --- | --- | --- |
| Conejo | bucle de `rabbits` | `run` si tiene `moveTarget`, si no `idle` |
| Zorro | bucle de `foxes` | igual |
| Kidu (perro) | bucle de entidades (`kind === 'pet'`, `petType === 'dog'`) | `run` si se mueve o va a buscar algo |
| Lobo | enemigos de la torre de defensa (`sprite === 'beast'`) | `run` si persigue |

Los cuatro llevan sombra de contacto en el suelo (el lobo antes era una elipse
roja).

## 4. Qué mirar si algo se rompe

* Si los árboles del bosque salen sin hojas o rarísimos: `GLOBAL_TREE_TEMPLATES`
  se quedó con el respaldo. Comprobar que `data/entity-pixels.json` tiene
  `tree0..tree6` con `grid` 16/19/20/16/12/7/5.
* Si un animal se queda quieto: comprobar que `drawAnimal` recibe `state` y que
  el módulo tiene el `kind` (los `kind` válidos están en `ANIMAL_KINDS`).
* Si aparece un `#` cuadrado de un color raro: es un píxel del arte con un color
  que no está en la paleta del animal (revisar con `tools/preview-animals.js`).
