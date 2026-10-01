# Editor de entidades (elegir sistema y recortar las vistas del PNG)

Herramienta: `tools/Support/entity-sheet-editor.html`

Sirve para dos cosas:

1. Decidir **por entidad** si usa el **sistema antiguo** (un solo sprite, el alzado
   de siempre) o el **sistema nuevo** (un sprite distinto por vista).
2. Recortar sobre un PNG **qué trozo de la imagen es cada vista**: en edificios,
   *arriba* (planta / techo) e *isométrica*; en personajes, las cuatro direcciones.

Lo que guarda es **mínimo**: la ruta del PNG y un rectángulo por vista. El juego
extrae los píxeles al arrancar. No se copia ninguna imagen.

## Abrirlo

```
npm run editor
```

Ese comando levanta un servidor que sirve el proyecto **y guarda en él**: abre el
navegador en el editor (puerto 4321; si está ocupado, coge el siguiente libre, y
con `npm run editor -- 4400` se fija uno).

**Lo que guardas va al fichero, no al navegador.** Es a propósito: el juego puede
estar abierto en otro sitio (Electron, otro puerto, otro navegador, `file://`) y
un `localStorage` se queda encerrado en un origen concreto. Con `npm run editor`,
«Guardar en el proyecto» escribe `data/entity-views.json` y cualquiera que cargue
el juego ve lo mismo. El servidor expone la API (`scripts/entity-views-api.js`, la
misma que usa el dev-server):

```
GET  /api/estado   -> identifica la API (el editor la busca así)
GET  /api/vistas   -> devuelve data/entity-views.json
POST /api/vistas   -> escribe data/entity-views.json
POST /api/hoja     -> copia el PNG elegido a data/sheets/
```

### «Guardar en el proyecto» escribe el fichero, siempre

El botón **nunca** se limita a descargar el JSON. Al arrancar, el editor busca la API
(primero en el mismo servidor que sirve la página; si ahí no hay, en los puertos
4321-4330 y 4400) y lo dice en el panel **5 · Guardar**:

- `✔ Guardado directo activo en <servidor> → data/entity-views.json`.
- `✖ No encuentro la API de guardado…` → falta arrancar el servidor; «Guardar en el
  proyecto» lo explica en rojo y **no descarga nada**. La búsqueda se repite al
  pulsar el botón, así que puedes arrancar `npm run editor` **después** y guardar
  sin recargar la página.

La API la traen los dos servidores del proyecto: `npm run editor` y
`node scripts/dev-server.js` (el que se usa para abrir el juego en el navegador),
así que guardar funciona venga la página de donde venga. Ojo: si tenías un
dev-server arrancado de antes, reinícialo para que traiga la API.

**Red de seguridad:** si el editor no ha podido LEER `data/entity-views.json` (por
ejemplo abierto con `file://`), guardar pediría confirmación antes de sobrescribir,
para que un clic con la lista vacía no deje el fichero en blanco.

### El PNG que ves en el lienzo se copia solo al proyecto

Los recortes son sólo coordenadas: el juego **necesita el PNG dentro del proyecto**
(`data/sheets/`). Si no está, el motor no encuentra la hoja y sigue dibujando el
sprite viejo, con ese aviso de `no encuentro en el proyecto: data/sheets/X.png`.

Eso ya no puede pasar:

1. **«Desde mi equipo…»** copia el PNG a `data/sheets/` en el momento (`POST /api/hoja`).
2. Si esa copia falla (no había servidor, se cayó la conexión…), el editor **se guarda
   los bytes en memoria** y volverá a intentarlo.
3. Al pulsar **«Guardar en el proyecto»**, si el servidor contesta que falta alguna
   hoja (`hojasQueFaltan`), el editor **copia ahí mismo** el PNG que tiene —el del
   lienzo o el que cargaste del disco— y **vuelve a guardar** el JSON. El mensaje lo
   dice: `… y copiadas al proyecto: data/sheets/Murallas.png`. Si el PNG tampoco está
   en memoria (lo escribiste a mano, o la sesión es nueva), avisa de que lo cargues
   con «Desde mi equipo…».

Resumiendo: guardar deja el juego funcionando. Recarga el juego (F5) y se ve.

Y el aviso **dice quién usa** la hoja que falta, para que no haya dudas cuando estás
mirando otra entidad: el fichero se guarda ENTERO, así que si `wall_tower` apunta a
`data/sheets/Murallas.png` y ese PNG no está, el editor lo avisa aunque tú estés
recortando `tree1`:

```
⚠ El fichero del proyecto apunta a hojas que NO están en data/sheets/:
  data/sheets/Murallas.png (la usa wall_tower). Selecciona esa entidad en la lista
  y carga el PNG con «Desde mi equipo…»: al guardar se copia solo.
```

Ese aviso sale **al abrir el editor** (pregunta a `/api/estado`, que devuelve
`hojasQueFaltan` y el detalle con las entidades), y al guardar si sigue faltando algo.

## Estilo clásico o nuevo (no se pierde nada)

**Los sprites originales no se borran nunca.** `data/entity-pixels.json` es intocable:
el editor no lo escribe jamás. Lo que hace es AÑADIR variantes en memoria al
cargar el juego (`<clave>_sup`, `<clave>_iso`, `character_<dir>`), y el motor las
prefiere si existen. Eso significa que volver al arte de siempre es un interruptor.

**El interruptor está EN EL JUEGO, no en el editor** (a propósito: es cosa del
jugador, no del que recorta los sprites): en el menú principal,
**Nueva partida → Opciones → «Estilo de arte»**:

| Opción | Qué hace el juego |
| --- | --- |
| **Nuevo · arte recortado del PNG** | usa las vistas de `data/entity-views.json` |
| **Clásico · sprites originales** | los sprites de siempre |

Se guarda en `localStorage['meso.spriteStyle']` (`'clasico'` / `'nuevo'`) y se
escribe al pulsar **Comenzar**, así que el motor lo lee al cargar la librería. Si
cambias el desplegable con la partida ya abierta, se aplica **en caliente**
(llama a `MesoEntityViews.estilo(...)`), sin recargar y sin tocar el JSON.

El editor no tiene ese desplegable y **no escribe `estilo`** en el fichero: si el
JSON ya trae un `estilo`, lo conserva tal cual (lo trata como un dato extra). Los
rectángulos siguen guardados pase lo que pase: volver a «Nuevo» los recupera enteros.

`"estilo"` también puede ponerse a mano en `data/entity-views.json` para fijar el
valor por defecto del proyecto (sin el campo se entiende `nuevo`).

Orden de prioridad del estilo (de más a menos):

1. `MesoEntityViews.estilo(v)` en caliente / consola (`window._mesoEstiloForzado`).
2. La elección del jugador en el menú (`localStorage['meso.spriteStyle']`).
3. `"estilo"` de `data/entity-views.json` (lo que dice el proyecto).
4. `'nuevo'`.

El desplegable del menú nunca modifica `data/entity-views.json`.

Y sin recargar, desde la consola del juego:

```js
MesoEntityViews.estilo('clasico')   // sprites de siempre, ya mismo
MesoEntityViews.estilo('nuevo')     // los recortes del PNG
MesoEntityViews.actual()            // qué estilo está puesto
```

El cambio en caliente manda sobre el fichero y sobre el menú
(`_mesoEstiloForzado`), así que `estilo('nuevo')` no se deshace al releer el JSON.
Con `estilo(null)` vuelve a obedecer al menú (y, si no hay nada guardado, al
fichero).

Si abres el editor con un servidor que sólo lee ficheros (VS Code Live Server,
`python -m http.server`…), el panel 5 lo avisa en rojo: arranca `npm run editor` (o
el dev-server) y vuelve a pulsar «Guardar en el proyecto»; el editor encuentra la API
sola, sin recargar. «Exportar JSON» descarga una copia, sólo si la quieres a mano.

### El PNG tiene que estar EN EL PROYECTO

Que se vea en el editor no basta: si cargas la hoja desde tu disco, el juego no
la encuentra y sus recortes no se aplican. **«Desde mi equipo…» ahora copia el PNG
a `data/sheets/`** (con `POST /api/hoja`) y deja la ruta puesta sola. Al guardar, el
servidor comprueba que las hojas existen y, si no, lo dice en el aviso.

### Una hoja POR ENTIDAD (el lienzo cambia al cambiar de entidad)

Cada entidad tiene **su** hoja. El campo «Ruta dentro del PNG» es siempre la de la
entidad seleccionada, y al cambiar de entidad el lienzo carga la suya: si dos
edificios vienen en PNG distintos, se recorta cada uno sobre el suyo sin mezclarlos.

| Caso | Qué hace el editor |
| --- | --- |
| La entidad tiene `hoja` propia | carga **ese** PNG al seleccionarla |
| Tiene recortes pero no hoja | carga la **compartida** y encuadra sus recortes |
| **No tiene nada asignado** | **vacía el lienzo** y enseña el sprite que hay ahora en el juego |
| Pulsas «Cargar PNG» / «Desde mi equipo…» | la hoja que cargas se asigna a la entidad seleccionada |
| Pulsas **«Usar la compartida»** | la entidad vuelve a heredar la compartida y el lienzo la carga |

En el lienzo hay un rótulo que siempre aclara de quién es lo que estás viendo
(`house_isolated · hoja PROPIA: data/sheets/casa.png` en verde, `… hoja COMPARTIDA:
data/sheets/Choza.png` en dorado), y al seleccionar una entidad que ya tiene
recortes el visor **encuadra el zoom** sobre ellos. Si la entidad no tiene hoja, el
lienzo lo dice en rojo en vez de quedarse con la imagen de la anterior.

### El sprite que hay EN EL JUEGO, siempre a la vista

Abajo, en «Vista previa», el **primer marco es siempre el sprite que dibuja el
juego ahora** (`data/entity-pixels.json`), con su rejilla. Sirve para comparar lo
que hay contra lo que vas a poner. Y cuando la entidad no tiene nada asignado, ese
mismo sprite se pinta en el centro del lienzo —al desaparecer el PNG anterior— con
la etiqueta «así se ve en el juego ahora».

### También salen los árboles y la vegetación

La lista incluye **todo** el arte del mundo: `tree0`..`tree6` (las plantillas de
árbol), `weed`, `wheat`, `tree*`, matas, cañas… Sólo se filtran los iconos que no
son arte del mundo (`icon*`, banderas, `interior_*`).

La mayoría de las veces basta con la compartida: tu hoja de referencia trae todos
los edificios juntos y las entidades sin `hoja` la heredan. El JSON sólo guarda
`hoja` dentro de una entidad cuando es distinta de la compartida.

Guarda el PNG en el proyecto, por ejemplo `data/sheets/casa.png`, y escribe esa
ruta en «Ruta del PNG» → **Cargar PNG**.

## Uso

1. **Ruta del PNG + Cargar PNG.** Zoom con el control de la izquierda.
2. Elige la entidad en la lista (arriba `PERSONAJE`, `CABALLO`… y luego los
   edificios de `data/entity-pixels.json`).
3. **Antiguo** / **Nuevo (por vistas)**.
   - *Antiguo*: el juego la dibuja como hasta ahora (su sprite de siempre; en
     isométrico, con el volumen 2.5D).
   - *Nuevo*: manda el PNG. Las vistas sin recortar se siguen generando solas.
4. Elige el hueco (en edificios: *arriba* / *isométrica*) y arrastra sobre la
   imagen para marcar el rectángulo → **Capturar recorte aquí**.
5. **Guardar en el proyecto**: escribe `data/entity-views.json`; recarga el juego
   (F5) y ya se ve. **Exportar JSON** descarga una copia del mismo fichero (sólo
   para tenerla a mano; no hace falta para nada).

## «Ajustar a la huella»

El motor dibuja todos los edificios un 25 % más grandes que su solar (para que el
volumen 2.5D se salga un poco de la casilla). Si recortas el techo a ras del
dibujo, el techo tapa la casilla del vecino. Con esta opción activada (por
defecto) se añade un 12,5 % transparente alrededor de la vista de *arriba*, así el
techo cae justo sobre la huella. Desactívala si el PNG ya viene con ese margen.

## Formato del fichero

`data/entity-views.json`

```json
{
  "hoja": "data/sheets/casa.png",
  "entidades": {
    "house": {
      "sistema": "nuevo",
      "ajusteHuella": true,
      "vistas": {
        "sup": { "x": 4,  "y": 4, "w": 24, "h": 24 },
        "iso": { "x": 36, "y": 4, "w": 24, "h": 24 }
      }
    },
    "PERSONAJE": {
      "sistema": "nuevo",
      "vistas": {
        "sur":   { "x": 0,  "y": 0, "w": 16, "h": 24 },
        "norte": { "x": 16, "y": 0, "w": 16, "h": 24 },
        "este":  { "x": 32, "y": 0, "w": 16, "h": 24 },
        "oeste": { "x": 48, "y": 0, "w": 16, "h": 24 }
      }
    }
  }
}
```

En edificios, `sup` e `iso`. En personajes, `sur`, `norte`, `este`, `oeste`.

`hoja` en la raíz es la **compartida**; dentro de una entidad, `hoja` es la suya
(opcional, y manda sobre la compartida):

```json
{
  "estilo": "nuevo",
  "hoja": "data/sheets/Choza.png",
  "entidades": {
    "house": { "sistema": "nuevo", "vistas": { "sup": { }, "iso": { } } },
    "templo": { "sistema": "nuevo", "hoja": "data/sheets/Designer.png", "vistas": { } }
  }
}
```

`estilo` es opcional (el editor no lo escribe, pero lo respeta si ya estaba): sin él
se entiende `nuevo`. El interruptor para el jugador está en el menú del juego
(ver arriba).

Arriba: `house` recorta de `Choza.png` (compartida) y `templo` de `Designer.png`
(suya). El motor pregunta primero por la de la entidad y, si no la hay, usa la
compartida.

## Los árboles también (2026-10-01, corregido)

Recortar `tree0`…`tree4` **sí** cambia los árboles del juego, en los dos sitios donde
se dibujan:

- los árboles del **bosque** (celdas de bioma bosque, `drawTreesVisible`),
- los árboles que son **entidad** (`ent.kind === 'tree'`, `resolveTreeSpriteVariant`).

El motor pide el sprite por su clave **con** sufijo de vista (`tree1_sup` para la vista
ortogonal, `tree1_iso` para la isométrica). Antes preguntaba por `tree1` a secas, que
es el arte de `entity-pixels.json`, así que **las ediciones de los árboles no se veían**
y parecía que el editor no hacía nada.

Dos detalles prácticos:

- Si recortas **uno** de los siete árboles, se usa en el bosque entero (no hace falta
  recortarlos todos). Los que no tengan recorte siguen con el arte de siempre.
- Los árboles de tipo `weed`/`hedge` (matojo y seto, `tree5`/`tree6`) van por su propio
  camino y sólo usan sprite si existe la clave `weed`.

Recuerda: el cambio se ve **al recargar el juego** (F5), que es cuando se registran
las variantes.

## El SUELO también (2026-10-01)

La hoja de sprites trae una sección **«SUELOS Y TERRENOS (TILES)»** (arena, suelo de
tierra, pavimentado, arcilla, agua) y el mundo seguía pintando el suelo con colores
planos procedurales: esas son «las texturas antiguas del suelo» que se veían por
debajo. Ahora se pueden sustituir por baldosas de la hoja.

**Cómo**: en el editor, recorta estos nombres (van los primeros de la lista):

| Clave | Se usa en |
| --- | --- |
| `suelo_arena` | desierto, aluvial, salino |
| `suelo_tierra` | estepa, hierba, ribera, marisma, bosque y corredor de tierra |
| `suelo_arcilla` | colinas |
| `suelo_agua` | agua y agua profunda |

Cómo funciona por dentro (motor):

- `SUELO_POR_BIOMA` traduce bioma → clave de suelo y `claveDeSueloPara()` resuelve el
  sufijo de vista **igual que los árboles** (`suelo_arena_sup` / `suelo_arena_iso`, con
  la otra vista como respaldo si sólo hay una).
- Se pinta en **la caché de terreno** (`paintTerrainCellInCache`), que es de donde sale
  el suelo del mundo: la baldosa **sustituye** al relleno plano, a las transiciones
  entre biomas y a la capa de detalle procedural (si no, se seguirían mezclando los
  dos estilos). Sin recortes, todo sigue exactamente como antes.
- En ortogonal se dibuja en el cuadro de la celda; **en isométrico** se deforma al rombo
  y se enmascara al rombo, con una caché por clave y tamaño. Cada celda usa uno de
  **cuatro volteos** (normal, espejo X, espejo Y y ambos) elegidos con el ruido de su
  posición, para que el suelo no se vea como el mismo dibujo repetido.
- El agua conserva su animación: las ondas se pintan **encima** de la caché en cada
  fotograma, así que la baldosa se sigue viendo por debajo.
- Los **caminos** (`road`/`concrete_road`) se quedan como están a propósito: llevan
  empedrado por piezas, bordillos automáticos y puentes de madera. Para el pavimento
  está el nombre `suelo_pavimento` (recortable), pendiente de decidir cómo combinarlo
  con los bordillos.

**Comprobar que ha entrado**: `MESO_DEBUG.testDraw.perf.info().suelo` devuelve qué
baldosa usa cada bioma ahora mismo (`null` = relleno procedural). Si acabas de
recortar, recarga el juego: el cambio de estilo se registra al arrancar.

### Tamaño: igual que el árbol clásico (y ajustable)

El árbol con arte nuevo mide **lo mismo que el árbol clásico de esa celda**: altura de
la plantilla (`16`-`20` px) × la escala del bosque (`tileSize / 4.8`). Antes se dibujaba
a un tamaño fijo (~`tileSize × 1,28 × 0,85` ≈ 26 px con celdas de 24), así que salía
**unas tres veces y media más pequeño** y parecían matas.

Si quieres más (o menos), hay dos mandos:

```js
window._mesoEscalaArboles = 1.4          // en caliente, desde la consola del juego
localStorage.setItem('meso.treeScale', '1.4'); location.reload();   // queda guardado
```

Por defecto `1.15` (un pelín más que el clásico). `1` = exactamente el clásico, `2` = el
doble. El ajuste sólo afecta a los árboles que usan recortes del PNG; los demás siguen
con su tamaño de siempre.

## Muros: el arte va por ORIENTACIÓN, no por tipo

En el juego el muro es **un solo tipo de edificio** (`wall_segment`), pero el arte se
recorta por **orientación**: `wall_segment_h` (el muro corre de este a oeste) y
`wall_segment_v` (de norte a sur). El motor elige la clave según la orientación de la
celda y luego aplica la vista (`_sup` / `_iso`).

Cosas que conviene saber:

- Si recortas **sólo** `wall_segment_v`, los muros horizontales seguirán con el sprite
  de siempre. Hay que hacer los dos (y la torre, `wall_tower`, que sí es su propio tipo).
- Cada entidad tiene su interruptor **Antiguo / Nuevo**: si `wall_segment_h` está en
  «Antiguo», el juego lo dibuja con el sprite de siempre aunque le hagas recortes.
  Es la causa típica de «se ven los dos estilos a la vez» en una partida.
- Lo mismo vale para `wall_tower`, `mesopotamian_arch` y el resto: el arte nuevo manda
  en cuanto la entidad está en «Nuevo» y tiene recortes.

## Qué hace el juego con esto

`cargarVistasDeEntidades()` (en `engine/game-engine.js`, dentro de
`ensureEntityPixelsLibrary`) lee `data/entity-views.json` (fichero y ya está: es la
única fuente de verdad) y de cada rectángulo saca los píxeles con un canvas, que
registra en `window.ENTITY_PIXEL_LIBRARY`:

| Recorte | Clave registrada | Quién la dibuja |
|---|---|---|
| `sup` | `<clave>_sup` | `drawBuilding` en vista ortogonal |
| `iso` | `<clave>_iso` | `drawBuilding` en vista isométrica |
| `sur/norte/este/oeste` | `character_<dir>` | `drawCharacterPixels` |

Las variantes **tienen prioridad**: `drawBuilding` busca `<clave>_iso` /
`<clave>_sup` antes de decidir, y sólo si no existen cae en lo automático (el
alzado de siempre, más el volumen 2.5D en isométrico). Ver
`docs/UN-SPRITE-POR-VISTA.md`.

Los personajes con vistas recortadas se dibujan con el PNG y **sin volumen** (no
se extruyen), anclados al mismo hueco que el muñeco procedural (24 px de ancho,
pies abajo). Si sólo hay arte para un lado, se espeja hacia el contrario.

## Recargar sin reiniciar

Desde la consola del juego:

```js
MesoEntityViews.recargar()   // vuelve a leer data/entity-views.json en caliente
```

Que es útil si has editado el JSON a mano o si el editor acaba de guardarlo y no
quieres recargar la pestaña.

## Problemas típicos

- **No aparece el recorte**: lo primero, mira la consola del juego: si falta la
  hoja avisa (`[vistas] no encuentro la hoja …`). El PNG debe estar **en el
  proyecto** (`data/sheets/…`); cárgalo con «Desde mi equipo…» y se copia solo. Con
  `file://` el navegador bloquea la lectura de píxeles: usa `npm run editor`,
  el dev-server o Electron.
- **En Electron salía `Error: net::ERR_FILE_NOT_FOUND`**: el protocolo `meso-local`
  no comprobaba si el fichero existía y `net.fetch` reventaba. Ahora devuelve un 404
  normal y avisa por consola de qué fichero falta (`electron/main.js`).
- **Sale desplazado o gigante**: el sprite se escala por el ancho del recorte, así
  que recorta ajustado al dibujo (sin aire) y usa «Ajustar a la huella».
- **No se aplica al juego**: mira el aviso del editor. Si dice que ha guardado
  `data/entity-views.json`, el fichero ya está escrito: recarga el juego (F5) y
  mira la consola del juego, que avisa de cuántas vistas ha registrado
  (`[vistas] N vistas de entidad registradas desde PNG`).
- **Sigue viéndose el sprite de siempre**: el JSON tiene esa entidad con
  `"sistema": "antiguo"`, o le falta el recorte de esa vista concreta.
