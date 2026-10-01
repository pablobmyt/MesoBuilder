# Edificios con volumen (2.5D) y crecimiento del mundo

Dos cosas de la misma tanda:

1. Los sprites de los edificios tenían un punto **plano** (alzado de frente): en
   vista isométrica parecían recortes pegados al suelo.
2. El mundo **no crecía** al llegar a los bordes (y no avisaba de nada).

---

## 1. Volumen isométrico de los edificios

El arte de los edificios se escribe a mano en `tools/build-mesopotamia-sprites.js`
(rejillas de texto) y se vuelca en `data/entity-pixels.json` con:

```bash
node tools/build-mesopotamia-sprites.js            # escribe el JSON
node tools/build-mesopotamia-sprites.js --dry      # sólo valida
node tools/build-mesopotamia-sprites.js --novolume # sin volumen (comparar)
node tools/build-mesopotamia-sprites.js --pendiente 0.45  # más volumen (y más pico)
node tools/build-mesopotamia-sprites.js --arista   # tejado con vértice detrás
node tools/preview-sprites.js house --step 2       # ver un sprite en ASCII
```

> **Ojo con la vista**: el juego arranca en vista **ortogonal** (de arriba) y en el
> menú «Ver» no había ningún botón para cambiarla, así que la vista isométrica (y
> con ella todo el volumen) era **inalcanzable**. Ahora el menú «Ver» lleva
> *Ortogonal / Isométrica* (`#btn-menu-view-ortho` / `#btn-menu-view-iso`) y desde
> las pruebas se cambia con `MESO_DEBUG.testDraw.world.view('iso')`.
>
> **Estado (2026-10-01)**: el volumen se aplica **sólo en la vista isométrica**. En la
> vista de arriba (la de por defecto) los edificios se dibujan con su sprite de
> siempre: la PLANTA procedural que se probó para arriba quedó **apagada**
> (`VISTAS.superior = false`) porque sustituía el arte por una tapa gris con pretil.
> Ver `docs/UN-SPRITE-POR-VISTA.md` §0.

### Qué añade `addIsometricVolume()`

El arte es un ALZADO (visto de frente). En la vista isométrica el motor proyecta el
eje de profundidad **en diagonal 2:1** (`ISO_RATIO = 0.6`): al alejarse, un punto
sube 0,6 px por cada px que se desplaza de lado. Extruir en vertical o en horizontal
—lo que hacían el antiguo «zócalo» y su «cara lateral»— NO da ninguna sensación
isométrica: deja el alzado como un recorte plano. El volumen se construye así:

| Paso | Efecto |
|---|---|
| **El alzado baja `T` filas** | Queda sitio para el tejado encima. El pie del edificio no se mueve: el motor ancla por la huella. |
| **El pretil se levanta en las esquinas** | La franja de arriba del arte (el pretil) sube `VOL_EDGE_SLOPE` px por px hacia los lados (`L = 0,17 × ancho`). Así el alero dibuja la «V» en vez de una raya horizontal. |
| **Se rellena el hueco que deja** | Debajo del pretil levantado, con el material del muro y las hiladas del adobe: son las paredes laterales, que suben hacia las esquinas. |
| **Tejado con CUMBRERA PLANA** | Todo lo que queda por encima (`T = 0,35 × ancho`): una franja horizontal arriba y el alero en «V» abajo, con las filas de esteras paralelas al alero, luz cerca del borde y sombra hacia atrás. |
| **Luz y detalle** | Luz de arriba (cresta iluminada, sombra bajo el alero), degradado vertical en el alzado, sillería de esquina (`quoin`) y dithering del pretil (`roofDither`). |

Lo importante es que **la puerta y las ventanas NO se deforman**: sólo se toca el
pretil y lo que hay por encima. El resultado es el edificio mesopotámico de tejado
plano subido sobre su solar, con las paredes laterales a la vista.

### Las dos trampas del volumen (las dos costaron una vuelta)

1. **La pendiente.** La diagonal del rombo del terreno es 0,6 (2:1) y al principio el
   volumen la copiaba tal cual (el tejado como rombo entero, `0,6 × ancho`). En
   pantalla salía **picudo**. Ahora la pendiente del volumen es más suave y se ajusta
   con `--pendiente`.
2. **La cumbrera.** Dibujar la **arista de atrás** del rombo (la «Λ» que sube hacia
   el centro) es lo que remataba el efecto **tienda de campaña**: en la vista de
   arriba —la que viene por defecto— un edificio con pico parece un tipi, y eso es
   lo que se veía raro. Con la **cumbrera plana** se lee como tejado plano, que es lo
   correcto en Mesopotamia, y la «V» del alero sigue dando el volumen. `--arista`
   recupera el vértice detrás para comparar.

Resultado: **26 sprites con volumen**. `house` pasa de 96×96 a 96×130 (34 px de
tejado + pretil levantado); el ancho no cambia, así que la escala del motor sigue
siendo la misma y el edificio llena su solar.

Detalles que importan (además de las dos trampas de arriba):

- **Copiar el arte píxel a píxel en la diagonal NO vale**: el detalle de 1 px se
  intercala consigo mismo al desplazarse (+1, −1) y sale un tablero de ajedrez. Las
  caras nuevas se pintan con el **material** del propio edificio (color medio del
  pretil y del muro, saltando los contornos oscuros) y su propia textura.
- **Se saltan las piezas que van pegadas**: `wall_segment_h/v`,
  `mesopotamian_arch`, `mesopotamian_gate_v`, `foundry_module`, `lamp_post`,
  `dock`, `farm`, `farm_plot`, `cueva`, `mountain` y `ziggurat`. Si cada celda de
  muralla llevara su tejado, la muralla saldría coronada de pirámides.
- El **paso de alineación** de todos los iconos (`alignIcon`) sigue siendo opt-in
  (`--align`): se ejecutaba en cada generación y movía árboles, ensuciando el diff.

Resultado: **26 sprites con volumen**. `house` pasa de 96×96 a 96×144 (48 px de
tejado + pretil levantado); el ancho no cambia, así que la escala del motor sigue
siendo la misma y el edificio llena su solar.

**`VOL_ROOF_SLOPE` (0,5) es la pendiente del volumen, NO la diagonal del rombo del
terreno (0,6).** Al principio copiaba la diagonal tal cual y en pantalla el edificio
salía **picudo** (parecía una tienda de campaña); probado con 0,38 el volumen se
aplana tanto que vuelve a leerse como un alzado de frente. 0,5 es el punto medio.

### Que el volumen no encoja el edificio (motor de sprites)

El tejado y el pretil levantado **salen fuera de la caja `gridW × gridH`** del
sprite (la huella). Tres piezas del motor lo sostienen:

* `getSpriteBitmap(name, gw, gh, ...)` dimensiona el canvas con la **extensión
  real de píxeles** del sprite (`src.w × src.h`) y guarda la escala en la caché
  (`name|WxH`), de modo que lo que sobresale se pinta a la **misma escala**.
* `drawEntitySpriteAt()` sigue anclando por la **huella** (`spriteW = gw·scale`,
  `spriteH = gh·scale`), no por el tamaño del bitmap: el pie del edificio no se
  mueve y el volumen crece hacia arriba.
* **`freeHeight`**: el tope de alto (`maxH = ×2,5` de la caja del solar) es una red
  de seguridad para arte heredado con proporciones absurdas; si se pasa, el motor
  **encoge** el sprite entero y el edificio deja de llenar su solar. Los sprites
  generados con volumen llevan `"freeHeight": true` en el JSON y su tope es ×5,5
  (un edificio alto debe sobresalir hacia arriba, no encogerse).
* Tope duro: si el bitmap pasara de 4096 px de lado se rechaza y se cae al camino
  píxel a píxel (que también existe como red de seguridad).

### Comprobarlo

- Sin abrir el juego: `node tools/preview-sprites.js house --step 2` (ASCII, con la
  rejilla y cuánto sobresale el arte).
- En la consola del juego: `window.ENTITY_PIXEL_LIBRARY['house']` (gridW × gridH,
  `freeHeight` y `pixels`), o el visor del modo DEBUG (F9 → «Ver biblioteca de
  sprites»).
- En el juego: **cambia a vista isométrica** (menú «Ver» → *Isométrica*); a zoom
  ≥ 1,5 se ve el tejado, las paredes laterales y cómo los edificios altos proyectan
  su silueta sobre los de detrás.
- Para fotografiar un sprite concreto sin que el bucle de dibujado lo borre:
  `MESO_DEBUG.testDraw.perf.pausar(true)` → `testDraw.drawSprite(nombre, x, y, w, h)`
  → captura → `perf.pausar(false)`.

---

## 2. El mundo vuelve a crecer al llegar a los bordes

`maybeGrowWorld()` (llamado desde `render()`) dispara una banda de terreno nueva
cuando el jugador entra en `WORLD_EDGE_MARGIN` (10 celdas) de un borde. **El
mecanismo funcionaba**, pero había dos bloqueos que lo hacían invisible en la
partida real:

### a) El prólogo lo bloqueaba

```js
if (hp && hp.active && !hp.slept && !(player._walkTime > 120)) { ... return null; }
```

En el prólogo el mundo **no crecía** hasta dormir o hasta llevar 3 minutos
jugando. Como la casa del prólogo está cerca del borde del mapa, el jugador
llegaba al límite y no pasaba nada: «no se genera nuevo terreno cuando llegamos a
los bordes». **Eliminado**: bastan las guardas que quedan (el jugador tiene que
haberse movido y tiene que haber pasado el margen de gracia de 3 s desde que se
generó el mundo).

### b) El enfriamiento era de 20 s

Una banda son 24 celdas y a ~4,3 celdas/s se cruzan en ~6 s: con 20 s el jugador
veía crecer el mundo una vez y luego caminaba 80 celdas sin que pasara nada.
Bajado a **8 s** (`WORLD_GROW_COOLDOWN_MS`).

### c) No avisaba

`expandWorld()` era **completamente silencioso**. Ahora avisa (como mucho una vez
cada 45 s, para no repetir mientras caminas pegado al borde):

> «Terreno nuevo hacia el sur (252×264 celdas).»

`MESO_DEBUG.testDraw.world.growDiag()` dice por qué **no** ha crecido:
`_growBlockReason` (`jugador parado o cargando`, `espera entre crecimientos`,
`lejos del borde (23 > 10)`, `dentro de una casa`), más jugador, margen y banda.
`testDraw.world.grow()` fuerza un crecimiento (pone el enfriamiento a cero).

### Coste

Una banda en un mundo ya grande (252×216) cuesta **~52 ms** síncronos (generar la
banda, redimensionar rejillas y desplazar todo). La ampliación de las cachés de
terreno sí está diferida (`_pendingCacheGrow` + `setTimeout 0`) y el repintado de
la banda va por trozos. Medido en un mundo 252×288 con 4.719 entidades: zócalo de
la caché correcto (8064×9216) y borde nuevo pintado (106 tonos distintos, 1,7 %
de píxeles oscuros).

---

## 3. Extra: el volcado de la caché de terreno ya no recorre el mundo entero

Al probar el crecimiento apareció el precio de los mundos grandes: `drawImage`
volcaba la caché **completa** (en un mundo 252×288 son 8064×9216 = **74 Mpx**)
cada fotograma, aunque en pantalla sólo se vea un trozo. Ahora se recorta el
origen al rectángulo visible (`window._terrainBlitRect` lo deja a la vista): en
ese mundo se pasan **377×247 px** en vez de 74 Mpx, y el coste del fotograma pasa
a depender de la pantalla, no del tamaño del mundo.

## 4. Pendiente (anotado en `TODO.md`)

- La banda de crecimiento (52 ms en un mundo grande) podría hacerse por trozos.
- Al **cargar** una partida de un mundo crecido, la caché de terreno se
  reconstruye entera (74 Mpx = varios segundos): ahí sí toca pintar primero la
  zona visible y el resto por regiones.
