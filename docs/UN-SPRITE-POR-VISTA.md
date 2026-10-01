# Un sprite por vista: TECHO (arriba) + ISOMÉTRICA

> Añadido: 2026-10-01 · Revisado: 2026-10-01 (la planta de arriba queda APAGADA)
> Código: `engine/building-volume.js` (las dos técnicas de dibujado y sus ajustes),
> `engine/game-engine.js` (`drawBuilding` elige técnica y variante de sprite).
> Relacionado: `docs/EDIFICIOS-VOLUMEN-Y-CRECIMIENTO.md`,
> `docs/EDITOR-DE-ENTIDADES.md`, `tools/build-mesopotamia-sprites.js`.

## 0. Estado actual: qué está encendido y qué no

| Vista | Qué se dibuja hoy |
| --- | --- |
| **Ortogonal** (por defecto) | el **sprite de siempre** (el alzado del JSON). Nada automático. |
| **Isométrica** | el alzado **+ volumen 2.5D** (`VOLUMEN.activo`). |
| Cualquiera, si hay recorte en `data/entity-views.json` | el **sprite dibujado a mano** (`<clave>_sup` / `<clave>_iso`). Manda sobre todo lo demás. |
| **Árboles** (`tree0`…`tree4`), si hay recorte | el **arte del PNG**, tanto en los árboles del **bosque** (`drawTreesVisible`, celdas de bioma bosque) como en los árboles que son **entidad** (`resolveTreeSpriteVariant`). |

Ojo con los árboles: el motor pide el sprite por su clave **con** sufijo de vista
(`tree1_sup` / `tree1_iso`), nunca `tree1`. Si recortas **un** árbol, se usa en el
bosque entero (variantes con nombre: `oak`, `birch`… se mapean al índice de plantilla
que les toca, 0-4). Los que no tienen recorte siguen con el arte de
`entity-pixels.json`.

**El volumen 2.5D no se aplica al arte `_iso`** (2026-10-01): las variantes que
terminan en `_iso` ya vienen dibujadas en isométrico, y extruirlas les inventaba
caras laterales encima y las deformaba (era el «en isométrico las cosas se ven mal»).
`getSpriteSourceBitmap` excluye `/_iso$/` del volumen, igual que excluye a los
personajes.

**La PLANTA procedural de la vista de arriba se apagó** (`VISTAS.superior = false`):
la idea era buena sobre el papel (cada edificio caía clavado en su huella), pero en
pantalla cada casa dejaba de ser *la casa dibujada* y pasaba a ser una tapa gris con
pretil — se perdía todo el arte del sprite y el juego parecía roto. El código sigue
ahí detrás de la bandera, por si se quiere volver a mirar con
`MESO_DEBUG.testDraw.vistas({ superior: true })`.

## 1. El problema (y por qué no se arreglaba con retoques)

El arte de los edificios es un **alzado** (visto de frente) y **un solo sprite se
usaba en las dos vistas** del juego:

| Vista | Cómo se mira el mundo | Qué necesita el edificio |
| --- | --- | --- |
| **Ortogonal** (la que viene por defecto) | desde arriba | su **planta**: el tejado visto desde arriba |
| **Isométrica** | en 3/4 | su **volumen**: alzado + tejado + costado |

Dibujar el alzado en la vista de arriba ya era raro (parecían recortes planos) y, en
cuanto se le dio volumen para arreglar el isométrico, en la vista de arriba el
edificio salía con pico: **una tienda de campaña**. Retocar el ángulo no lo arregla:
**un sprite no puede ser las dos cosas a la vez**.

## 2. La solución: dos técnicas de dibujado y una variante por vista

La hoja de arte de referencia lo deja claro: cada edificio se dibuja en **ORTOGONAL
(N/S/E/O/TECHO)** e **ISOMÉTRICO (NE/NO/SE/SO)**. De esas sólo hacen falta dos:

### a) Vista de arriba → **PLANTA (TECHO)**, dibujada por el motor · **APAGADA**

> `VISTAS.superior = false` desde 2026-10-01. Lo que sigue describe la técnica, que
> sigue en el código y se enciende con `T.vistas({ superior: true })`.

`drawPlantaTecho(ctx, x, y, w, h, mat)` pinta el edificio dentro de **su huella
exacta** (`size.w × size.h` celdas), así que encaja con la rejilla cuadrada:

* **Tejado**: material del propio edificio (sacado de su arte), con la trama de
  esteras cada 4 px y un degradado suave.
* **Pretil**: marco del material claro (arriba-izquierda con luz, abajo-derecha en
  sombra) y una línea de sombra por dentro.
* **Respiradero** con su filo iluminado, y **contorno** oscuro para separarlo del
  suelo y del vecino.

No es un sprite del JSON: se pinta con rectángulos en el momento, así que **siempre
cae clavado en su huella** (con el sprite no se puede: el motor dibuja todos los
edificios un 25 % más grandes que su solar, `BUILDING_VISUAL_SCALE`).

### b) Vista isométrica → **ALZADO + VOLUMEN 2.5D**, generado al vuelo

`addIsometricVolume(pixels, gw, gh)` (ver `docs/EDIFICIOS-VOLUMEN-Y-CRECIMIENTO.md`)
baja el alzado, levanta el pretil hacia las esquinas y pinta el tejado encima. Se
aplica **dentro del motor** (`getSpriteSourceBitmap`) y **sólo si `viewMode === 'iso'`**.

## 3. Traer arte dibujado a mano (como la hoja de referencia)

El motor ya busca variantes por vista antes de generar nada:

```
<clave>_sup   →  se usa en la vista de arriba (planta / TECHO dibujado)
<clave>_iso   →  se usa en la vista isométrica (3/4 dibujada)
```

Es decir: dibujar el edificio en la rejilla de la vista, meterlo en
`data/entity-pixels.json` con ese sufijo y ya sale en el juego **sprite a sprite**,
sin tocar código. Si la variante no existe, se dibuja el alzado de siempre (y, en
isométrico, con el volumen).

Para dibujarlos desde un PNG en vez de pixel a pixel en el JSON está el **editor de
entidades** (`npm run editor` → `tools/Support/entity-sheet-editor.html`), que
recorta cada vista de la hoja y escribe `data/entity-views.json`.

## 4. Ajustes desde la consola

```js
const T = window.MESO_DEBUG.testDraw;
T.vistas();                        // ver los ajustes actuales
T.vistas({ superior: true });      // ENCENDER la planta de arriba (experimento)
T.vistas({ volumetrico: false });  // isométrico sin volumen
T.vistas({ pendiente: 0.5, tejado: 0.5 });   // más volumen en isométrico
T.vistas({ arista: true });        // tejado isométrico con vértice detrás (el «tipi»)
```

Los edificios que van **pegados unos a otros** (murallas, arcos de puerta, caminos,
módulos de fábrica, farol) se quedan fuera de la planta: una planta por celda los
convertiría en una fila de tapas. La lista es `PLANTA_SKIP` en el motor.

## 5. Por qué esto y no «un poco menos de ángulo»

Se probó antes aflojando la inclinación del volumen (0,6 → 0,5 → 0,38) y quitando
el pico de la cumbrera: mejoraba algo, pero seguía sin resolverse, porque el
problema no era el ángulo sino **que se estaba usando la técnica equivocada en la
vista de arriba**. Con la planta, la vista de arriba queda limpia (cada edificio
ocupa su solar, como en el mapa) y el isométrico se queda con su volumen.

## 6. Si prefieres dibujarlas tú: editor de entidades

Las técnicas anteriores son automáticas (y la de arriba está apagada). Cuando
quieras mandar tu propio arte (un PNG con la casa vista de arriba y en 3/4), el
**editor de entidades** recorta cada vista de ese PNG y las registra como las
variantes `<clave>_sup` y `<clave>_iso` que ya busca `drawBuilding`: en cuanto
existen, **tienen prioridad** sobre todo lo demás. También sirve para los personajes
(`character_<dirección>`). La asignación se guarda en `data/entity-views.json`, en el
proyecto. Ver `docs/EDITOR-DE-ENTIDADES.md`.

Y si la hoja es una cuadrícula clásica (una fila por dirección, los fotogramas de
una acción en una fila…), el editor la **parte solo**: «Detectar la rejilla» mide
las líneas de corte con el fondo entre sprites, «Repartir filas en las vistas»
coloca cada vista en su fila y, desde ahí, se montan **animaciones** (`andar_sur`,
`bucle_sup`…) con fps y bucle, que el motor reproduce al dibujar. Está explicado en
`docs/EDITOR-DE-ENTIDADES.md` (§ «Separar la hoja automáticamente» y § «Animaciones»).
