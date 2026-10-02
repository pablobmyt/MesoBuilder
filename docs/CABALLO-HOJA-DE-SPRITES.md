# El caballo con hoja de sprites (un solo caballo, animado por partes)

El caballo se dibujaba **procedural**: `engine/animal-art.js` lo generaba por
formas. Ahora se recorta de la hoja del usuario y se anima **por partes**, como un
muñeco articulado. Si la hoja falta, está rota o el jugador eligió el arte clásico,
el caballo vuelve a ser el procedural: **nunca te quedas sin caballos**.

## Piezas

| Pieza | Qué hace |
| --- | --- |
| `data/sheets/Caballos.png` | La hoja original (con el damero y las sombras cocidos, sin alfa). |
| `data/horse-sheet.json` | El contrato: bandas con rectángulos por pelaje, rig base y tabla de animaciones. |
| `tools/build-horse-sheet.py` | Mide la hoja y escribe ese JSON (herramienta de arte, se ejecuta a mano). |
| `engine/horse-sheet-art.js` | Limpia el fondo al vuelo, construye el **rig** y compone cada fotograma. |
| `engine/animal-art.js` | `setAnimalArtProvider()`: el arte procedural pasa a ser el respaldo. |
| `tools/preview-horse.py` | Montaje con los rectángulos de la hoja (comprobar sin abrir el juego). |

## La hoja NO es una tira de fotogramas (dos sustos)

1. **Las columnas son PELAJES (20), no fotogramas.** Lo delata el color medio del
   cuerpo: del castaño al pinto y al blanco a lo largo de las columnas, el mismo
   degradado en todas las filas. Un modelo de visión confunde "cambia de color" con
   "cambia de pose"; esto se zanja midiendo.
2. **Las filas parecen un ciclo… y no lo son.** Las bandas 0-3 son el MISMO caballo
   con variaciones mínimas (no un ciclo) y las **7-10 son el mismo caballo con
   CUATRO SILLAS DISTINTAS** (rojiza, roja y oro, perfilada, manta clara).

Recorrer esas bandas como "fotogramas" hacía que el caballo pareciese **ir rotando
entre varios caballos**: al ir montado cambiaba de silla en cada fotograma. Por eso
el motor usa **un único dibujo base** (`base` = banda 0 sin silla, `baseMontura` =
banda 7 con silla) y anima por partes.

3. **Susto extra:** el motor pedía el arte "de espaldas" al caminar hacia arriba
   (`back`) y ahí caía al caballo **procedural**. Al cambiar de dirección aparecía
   OTRO caballo. Ahora la hoja se usa en todas las direcciones (sólo hay perfil; se
   espeja al ir hacia la izquierda).

## El fondo: ni sólo el damero, ni sólo un croma por color

El damero va cocido en el PNG (252 y 233 de brillo) **y cada caballo trae una
sombra gris debajo**. La sombra va de ~110 a ~250 de brillo, y es la que **tapa los
huecos entre las patas**: sin quitarla, el caballo es una mancha maciza de la que no
se pueden separar las patas para animarlas.

La limpieza es en **tres pasadas** (`_quitarDamero`, en `engine/horse-sheet-art.js`):

1. **Fondo y sombra.** Candidato = **gris neutro y no muy oscuro** (`sat < 30`,
   `lum > 105`), y después **propagación desde los bordes**: sólo desaparece lo que
   se alcanza desde fuera. Así entra el damero y la sombra, y NO entran el contorno
   del caballo (brillo < 60) ni su pelo (saturado) — y el blanco de un pinto se
   salva porque está encerrado por su contorno.
2. **Halo.** Entre el caballo y el damero quedan píxeles de MEZCLA (el contorno
   marrón fundido con el gris del fondo) que no cumplen el criterio anterior y se
   pegaban al borde: en el juego se veían como un reborde blanquecino y, alrededor
   del hocico, daban la impresión de un manchón blanco en la cara. Se comen **dos
   pasadas de borde**, sólo donde el píxel es claro (una mezcla con un fondo casi
   blanco). El contorno de verdad es oscuro y no se toca.
3. **Bolsas encerradas.** La crin, las riendas o el hueco entre las patas pueden
   CERRAR un trozo de damero: como no se alcanza desde fuera, sobrevive y se ve como
   un manchón claro (en el caballo con silla, justo en la garganta). Se quitan las
   regiones claras encerradas **pequeñas** (tope `fondo.bolsasMaxPx`, 120 px por
   defecto). Medido en esta hoja: las bolsas de damero miden 21-72 px y las manchas
   blancas pintadas 143-426 px, así que el tamaño las separa bien.
   ⚠ Ese tope es el único ajuste delicado: **subirlo** si desaparecen manchas
   blancas de un pelaje pinto, **bajarlo** si quedan manchones claros.

Los umbrales están en el JSON (`fondo`) y se pueden retocar sin tocar código.

Comprobación rápida: en la consola del juego, contar los píxeles claros del sprite
(`lum > 190 && sat < 40` con alfa > 30). El castaño (pelaje 0) tiene que dar **0**
en las dos versiones (con y sin silla).

## El rig

Del sprite base se sacan las piezas **midiendo la máscara de alfa**:

- `lineaPatas` = la fila donde aparecen **más manchas separadas** (donde las patas se
  sueltan del cuerpo). Las manchas de 1 px son ruido del PNG (viene de un JPEG) y se
  ignoran.
- **Tronco** = el sprite entero **menos las patas**. Así la cola, el cuello y la
  cabeza se quedan con el cuerpo y se mecen con él.
- **Patas** = cada mancha que **llega al suelo** (la cola cuelga por la misma franja
  pero se queda a media altura: si se colara, se menearía como una pata). Cada pata
  se recorta con su fila de arriba **estirada hacia arriba**; esa prolongación queda
  debajo del tronco, y es lo que permite levantar o adelantar la pata sin que se
  despegue del cuerpo.

Cada fotograma se compone dibujando **las patas primero** (desplazadas) y **el
tronco encima** (con su balanceo). El lienzo mide lo mismo en todos los fotogramas de
un estado: si no, el caballo cambiaría de tamaño entre fotogramas.

Modos de animación (`modo` en el JSON): `reposo` (respira), `paso` (4 tiempos, patas
repartidas), `trote` (2 tiempos, en diagonal), `galope` (zancada larga, con
suspensión y el tronco adelantándose), `piafar` (sólo la mano de delante) y
`sacudir` (el cuerpo se menea y las patas lo acompañan).

## Animaciones: rig + poses de la hoja

| Estado del motor | Tipo | De dónde sale |
| --- | --- | --- |
| `idle` `walk` `trot` `gallop` `paw` `shake` | `rig` | dibujo base animado por partes (4 fotogramas) |
| `graze` `drink` | `hoja` | banda 4 (pastando) |
| `rear` `neigh` | `hoja` | banda 5 (encabritado) |
| `lie` | `hoja` | banda 6 (tumbado) |

Las de tipo `hoja` son poses **de verdad** del mismo caballo, así que ahí sí se
cambia de banda. Si el caballo va **montado** y esa pose no tiene versión con silla
(pastar, tumbarse…), se usa el rig montado en reposo: así nunca pierde la silla.

El `fps` del JSON se respeta de verdad: el fotograma sale del reloj
(`t/1000 * fps`). Si la animación viene de una **acción** (piafar, encabritarse…) se
usa su progreso (`phase01`), no el reloj, para que se reproduzca una vez.

## Un solo caballo

El pelaje es **fijo** (`pelajePorDefecto` en el JSON; `window._caballoPelaje` o
`MESO_HORSESHEET.setPelaje(n)` lo cambian en caliente). Lo pidió el usuario: el
caballo no debe cambiar de aspecto. Para recuperar la variedad entre caballos, basta
con devolver en `horseCoatOf()` (game-engine.js) un hash del `id` de la entidad en
vez del valor fijo — el resto del camino ya soporta cualquier pelaje.

## Cambiar o retocar la hoja

```bash
python tools\build-horse-sheet.py      # regenera data/horse-sheet.json
python tools\preview-horse.py          # montaje de las bandas (tools\_horse_anims.png)
```

`data/horse-sheet.json` es **texto** y es el contrato: se puede editar a mano (subir
el `fps` del galope, cambiar `base`, apuntar un estado a otra banda…) sin tocar
código.

## Comprobar sin abrir el juego

En la consola del juego (F12):

```js
MESO_HORSESHEET.info()        // bandas, pelajes, base, rig (patas detectadas, corte)
MESO_HORSESHEET.tira('walk')  // canvas con los 4 fotogramas en fila (para mirarlo)
```

`info().rigPatas` debe salir 3 o 4 y `rigCorte` a media altura del sprite (~51 de
56). Si `rigCorte` sale pegado al borde de abajo, el fondo no se está quitando bien
(repasa `fondo.luminancia`/`saturacion`).

## Ajustes y trampas

- **`estilo: 'clasico'`** elegido por el jugador (Crear partida ▸ Opciones ▸ Estilo
  de arte) devuelve el caballo procedural. Se mira `localStorage['meso.spriteStyle']`
  y **no** `window._mesoEstiloArte`: ese último lo fija también el `estilo` de
  `data/entity-views.json`, que en este proyecto viene siendo `"clasico"` y apagaría
  la hoja de caballos sin que nadie lo pida.
- En **Electron** la hoja y el JSON se piden por `meso-local://`. `electron/main.js`
  ya sirve cualquier fichero bajo la raíz del proyecto con cabeceras CORS: no hay que
  tocar nada.
- La limpieza se hace **al cargar, en el navegador** (necesita `getImageData`, o sea
  `crossOrigin='anonymous'`), no en disco: la hoja original se conserva.
- El proveedor **no se cachea en `BITMAPS`** de `animal-art.js` (esa clave no lleva
  el pelaje): cachea lo suyo por `estado|fotograma|pelaje|montado`.
- `tools/build-horse-sheet.py` y `tools/preview-horse.py` necesitan **Pillow**
  (`python -m pip install pillow`). Son herramientas de arte: no se ejecutan en el
  arranque.
- El JSON guarda también las bandas 8-14 (las otras sillas, los potros y los objetos:
  cubos, toneles, bolsas y estandartes). Están medidos por si alguien quiere usarlos.

## Comprobado

- `MESO_HORSESHEET.info()`: 15 bandas, 20 pelajes, `rigPatas: 4`, `rigCorte: 50`.
- **Zonas blancas que sobraban (lo que reportó el usuario con una captura): 0
  píxeles claros** en el caballo castaño, con y sin silla (antes 65 y 21). El
  manchón estaba en la garganta (una bolsa de damero encerrada) y el reborde
  blanquecino era el halo de mezcla del contorno.
- `MESO_HORSESHEET.tira(...)` revisado a ojo: `walk` = paso a 4 tiempos, `trot` =
  trote diagonal, `gallop` = zancada larga; montado, la MISMA silla en los 4
  fotogramas. `graze` = cabeza al suelo, `rear` = encabritado, `lie` = tumbado.
- En la partida: el caballo del mapa se dibuja con la hoja y anda (capturas del
  lienzo del juego).
