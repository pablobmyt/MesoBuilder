# El caballo con hoja de sprites (formato 2: fotogramas de verdad, cuatro lados)

El caballo se dibujaba **procedural**: `engine/animal-art.js` lo generaba por formas.
Ahora se recorta de la hoja del usuario, que trae los **fotogramas dibujados** en las
cuatro direcciones. Si la hoja falta, está rota o el jugador eligió el arte clásico,
el caballo vuelve a ser el procedural: **nunca te quedas sin caballos**.

> Cambio del 2026-11-25: la hoja anterior (20 pelajes, poses sueltas y el caballo en
> perfil) se sustituyó por esta. El motor ya **no tiene «rig»**: no hay que partir el
> dibujo en tronco y patas, porque la animación viene pintada. La hoja vieja se
> conserva como `data/sheets/Caballos_clasico_20pelajes.png`.

## Piezas

| Pieza | Qué hace |
| --- | --- |
| `data/sheets/Caballos.png` | La hoja: **rejilla 4×8 de celdas de 128×128**, con canal alfa. |
| `data/horse-sheet.json` | El contrato: **clips** (nombre → fps + rectángulos) y lienzo común. |
| `tools/build-horse-sheet.py` | Mide la hoja y escribe ese JSON (herramienta de arte, se ejecuta a mano). |
| `engine/horse-sheet-art.js` | Elige el clip del estado y la dirección, recorta y (si hace falta) compone la pose. |
| `engine/animal-art.js` | `setAnimalArtProvider()`: el arte procedural pasa a ser el respaldo. |
| `tools/preview-horse.py` | Montaje con los rectángulos del JSON (comprobar sin abrir el juego). |

## Qué hay en la hoja

```text
filas 1-3   GALOPE, 11 fotogramas seguidos (4 + 4 + 3), de perfil a la DERECHA
fila  4     QUIETO: una vista por dirección → [arriba, izquierda, abajo, derecha]
fila  5     ANDAR por DETRÁS (dirección «arriba»), 4 fotogramas
fila  6     ANDAR de perfil a la IZQUIERDA, 4 fotogramas
fila  7     ANDAR de FRENTE (dirección «abajo»), 4 fotogramas
fila  8     ANDAR de perfil a la DERECHA, 4 fotogramas
```

Eso da **9 clips**: `gallop` (11 fotogramas), `idle_up/left/down/right` (1) y
`walk_up/left/down/right` (4). No hay pelajes: todos los caballos son el mismo.

## El lienzo común

Los recortes de todos los clips comparten **anchura y altura** (98×76 medidos) y se
alinean por la base. Sin eso el caballo cambiaría de tamaño al pasar de andar a
galopar, y «bailaría» al girarse.

Dos detalles que costaron una pasada:

1. **Las filas no están dibujadas a la misma altura.** Las tres filas del galope
   tienen la base hasta 12 px más arriba o más abajo, así que la herramienta toma la
   base de la **familia** entera (`side`, `up`, `down`) y compensa cada fila. Sin
   eso, el galope pegaba saltos verticales al cambiar de fila del ciclo.
2. **El recorte es el mismo dentro de cada clip.** El desplazamiento del rectángulo
   sobre la celda se repite en todos los fotogramas: el movimiento de las patas es el
   que dibujó el artista, sin reencuadres.

## Direcciones: quién manda

El motor dibuja con `drawAnimal(...)` y le pasa `dir` (`up` · `down` · `left` ·
`right`), además de `flip` / `back` para el respaldo procedural:

| `dir` | Qué se usa | `noFlip` |
| --- | --- | --- |
| `right` | `*_right` (perfil mirando a la derecha) | — |
| `left` | `*_left` (perfil mirando a la izquierda, **dibujado**) | **sí** |
| `up` | `*_up` (visto por detrás) | — |
| `down` | `*_down` (de frente) | — |

`noFlip` es la pieza clave: el motor voltea el sprite cuando `flip` es verdadero, y
si se volteara un perfil ya dibujado a la izquierda saldría mirando a la derecha. El
proveedor marca `noFlip` cuando el arte **ya** está en la dirección pedida y
`drawAnimal` no lo voltea. El **galope** es la excepción: sólo existe mirando a la
derecha, así que yendo a la izquierda se deja voltear.

De dónde sale `dir`:

- **Jugador montado**: `player.dir` (`drawPlayer`, en las dos vistas).
- **Caballos sueltos / NPC**: el eje en el que más se han movido ese fotograma
  (`game-engine.js`); quietos, conservan la última vista.
- **Carro de la intro**: `dir: 'left'`.

## Estados: qué dibuja cada uno

El motor pide `idle · walk · trot · gallop · paw · shake · graze · drink · rear ·
neigh · lie`. Lo que la hoja no trae se resuelve sin dibujos nuevos:

| Estado | Clip / pose | Nota |
| --- | --- | --- |
| `idle` | `idle_<dir>` | 1 fotograma por dirección |
| `walk` | `walk_<dir>` | 4 fotogramas, 9 fps |
| `trot` | `walk_<dir>` | los mismos fotogramas a **2,2×** fps |
| `gallop` `run` `sprint` | `gallop` | 11 fotogramas, 18 fps |
| galope en vertical | `walk_<dir>` a 2,4× | el galope sólo está de perfil |
| `paw` | `walk_<dir>` a 0,7× | se le ve levantar la mano |
| `rear` | pose `rear` | el quieto **inclinado 18°** sobre los cascos |
| `lie` | pose `lie` | el quieto **aplastado al 55 %** |
| `shake` | pose `shake` | el quieto con 2 px de margen (vibra) |
| `graze` `drink` `neigh` | `idle_<dir>` | **sin pose propia** en esta hoja (`info().sinPose`) |

Las tres últimas se ven como el caballo quieto. Está anotado en
`MESO_HORSESHEET.info().sinPose` para que no parezca un fallo: es lo que hay dibujado.

El `fps` del JSON se respeta de verdad: el fotograma sale del reloj
(`t/1000 * fps`). Si la animación viene de una **acción** (piafar, encabritarse…) se
usa su progreso (`phase01`) para que avance una vez en lugar de repetirse.

## El fondo

La hoja nueva **trae canal alfa**, así que no hay nada que limpiar: se copia tal
cual. `_quitarDamero()` sigue en el módulo como respaldo para hojas futuras con el
damero «cocido» (tres pasadas: fondo + sombra propagada desde los bordes, halo de
mezcla y bolsas encerradas), y sólo se ejecuta si el JSON dice `"alfa": false`.

## Un solo caballo

Sin pelajes: `horseSheetCoatCount()` devuelve 1 y `horseSheetDefaultCoat()` 0, así
que `horseCoatOf()` (game-engine.js) siempre pide el mismo. `window._caballoPelaje` y
`MESO_HORSESHEET.setPelaje()` se conservan por compatibilidad, pero no cambian nada:
la hoja no tiene variantes.

## Cambiar o retocar la hoja

```bash
python tools\build-horse-sheet.py      # regenera data/horse-sheet.json
python tools\preview-horse.py          # montaje de los clips (tools\_horse_anims.png)
```

`data/horse-sheet.json` es **texto** y es el contrato: subir el `fps` del galope,
cambiar un rectángulo o apuntar un clip a otra celda no necesita tocar código.

Si algún día la hoja cambia de rejilla, hay que ajustar `COLUMNAS`, `FILAS` y el
orden de filas al principio de `tools/build-horse-sheet.py`; el motor sólo lee
`clips`.

## Comprobar sin abrir el juego

En la consola del juego (F12):

```js
MESO_HORSESHEET.info()             // clips, fps, fotogramas, lienzo, estados sin pose
MESO_HORSESHEET.tira('walk', 'left')   // canvas con los 4 fotogramas en fila
MESO_HORSESHEET.frame('gallop', 'right', 5)  // un fotograma suelto (canvas)
```

Comprobaciones rápidas que se hicieron al integrarlo:

- Los cuatro `walk_*` dan firmas de píxeles **distintas** (no se repite una vista).
- `walk/left` devuelve `noFlip: true`; `gallop/left` devuelve `noFlip: false`.
- El galope tiene **11 fotogramas distintos** y ninguno nulo.
- `rear` mide más alto que el quieto (102×109) y `lie` más bajo (98×42).

## Ajustes y trampas

- **`estilo: 'clasico'`** elegido por el jugador (Crear partida ▸ Opciones ▸ Estilo
  de arte) devuelve el caballo procedural. Se mira `localStorage['meso.spriteStyle']`
  y **no** `window._mesoEstiloArte`: ese último lo fija también el `estilo` de
  `data/entity-views.json`, que en este proyecto viene siendo `"clasico"` y apagaría
  la hoja de caballos sin que nadie lo pida.
- En **Electron** la hoja y el JSON se piden por `meso-local://`. `electron/main.js`
  ya sirve cualquier fichero bajo la raíz del proyecto con cabeceras CORS.
- La URL de la hoja es **estable** (sin `?v=`): añadirlo en cada arranque anulaba la
  caché y volvía a bajar el PNG. Se decodifica con `img.decode()` al cargar.
- El proveedor **no se cachea en `BITMAPS`** de `animal-art.js` (esa clave no lleva
  la dirección ni la pose): cachea lo suyo por `clip|fotograma|pose`.
- `tools/build-horse-sheet.py` y `tools/preview-horse.py` necesitan **Pillow**
  (`python -m pip install pillow`). Son herramientas de arte: no se ejecutan en el
  arranque.

## Comprobado (2026-11-25)

- `MESO_HORSESHEET.info()`: 9 clips, galope de 11 fotogramas, lienzo 98×76.
- El motor dibuja el caballo **desde la hoja** (dos `drawImage` de fuente 98×76 en
  un fotograma: el caballo suelto y el que monta el jugador).
- Sin errores de página al arrancar; sección `animales` del perfilador: **0,27 ms**.
