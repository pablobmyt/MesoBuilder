# Interiores de los edificios — MesoBuilder

> Añadido: 2026-09-30
> Código: `engine/game-engine.js` (§ «INTERIORES: QUÉ EDIFICIO TIENE UNO»,
> `enterInterior`, `exitInterior`, `rebuildInteriorDoorsFromGrid`),
> `tools/build-interiors.js` (generador), `data/interiors/*.json` (12 ficheros).
> Docs relacionadas: `docs/PUERTAS-Y-CONTROL.md`, `docs/ESTRUCTURAS.md`,
> `docs/RENDIMIENTO.md`.

## 1. El problema

Sólo **seis** tipos de edificio tenían interior y, además, la puerta de entrada se
creaba únicamente para los tipos "habitables" (`isShelterBuildingType`, pensado
para *dormir*, no para *entrar*). Resultado: el templo, el mercado, el granero, el
taller, el cuartel o los baños **no tenían ni puerta ni interior**: se veían desde
fuera y no se podía entrar. De ahí el «no aparece ningún interior».

## 2. Qué hace ahora el motor

### 2.1 Tabla única edificio → interior

```js
const INTERIOR_BY_BUILDING = {
  // Viviendas
  house_isolated: 'house_player_home',
  house: 'house', stone_house: 'house', mesopotamian_house: 'house',
  house_small: 'house-small', hut: 'house-small', reed_hut: 'house-small', checkpoint_gate: 'house-small',
  house_large: 'house_large', mesopotamian_villa_detailed: 'house_large', party_hq: 'house_large', state_clinic: 'house_large',
  house_garden: 'house_garden',
  soviet_block: 'residential_tower', soviet_superblock: 'residential_tower', soviet_superblock_b: 'residential_tower',
  // Cívicos y de trabajo
  temple: 'temple', mesopotamian_temple: 'temple',
  market: 'market',
  granary: 'granary', state_warehouse: 'granary',
  pottery: 'workshop', factory: 'workshop', steel_foundry: 'workshop',
  longhouse: 'barracks', barracks: 'barracks',
  mesopotamian_baths: 'baths'
};
```

`interiorIdForBuilding(type)` resuelve la tabla y, si el tipo no está listado,
cae a `house` para cualquier `*house*`/`*villa*` y a `residential_tower` para
cualquier `*block*`. Si no hay coincidencia devuelve `null` (edificio sin
interior: muros, calzadas, decoración).

`isShelterBuildingType` **no** se toca: sigue siendo "aquí se duerme".

### 2.2 Puertas de entrada

`rebuildInteriorDoorsFromGrid()` recorre la rejilla y, **para cada celda base**
cuyo tipo tenga interior, apunta una puerta en el muro sur:

```
window.INTERIOR_DOORS = [
  { col, row, interiorId, buildingType, buildingBase: { col, row } }, …
]
```

Antes el filtro era `isShelterBuildingType`; ahora es `interiorIdForBuilding`, así
que templos, mercados, graneros, talleres, cuarteles y baños también tienen
entrada. En un mapa recién generado se pasa de ~28 puertas de 8 tipos a **67
puertas de 11 tipos** (medido con `?debug=1`).

Coste: es un escaneo completo de la rejilla (~0,3 ms). Por eso **no** se ejecuta
por celda dentro de un bloque de construcción masiva (ver `docs/RENDIMIENTO.md`).

### 2.3 Entrar y salir

* `window.enterInterior(id, doorRef)` carga `data/interiors/<id>.json` (por
  `window.__mesoPreload.interiors` en Electron, o `fetch` en el navegador),
  guarda el estado exterior en `window._savedExterior` (posición + entidades),
  aplica la planta (`applyInteriorFloor`), monta los muebles
  (`buildInteriorFurniture`) y los NPCs del piso
  (`spawnInteriorNpcsForCurrentFloor`).
* `window.exitInterior()` hace un fundido y restaura el exterior desde
  `_savedExterior` (`onDone` protegido con `try/catch`).
* Edificios con varias plantas (p. ej. `residential_tower`): ascensor con
  `moveToInteriorFloor` / `openInteriorElevatorSelector`.

### 2.4 Puerta del prólogo

La casa del jugador (`house_player_home`) está **bloqueada a propósito** durante
el prólogo hasta que se cumplen los hitos, y en su lugar se muestra un aviso:

| Estado | Aviso |
| --- | --- |
| `!fieldPrepared` | «Antes de dormir, prepara un cultivo cerca de casa usando la azada.» |
| `fieldPrepared` y `!sleepReady` | «Tu familia quiere hablar contigo primero.» |

Es el hilo narrativo del prólogo (labrar → familia → dormir → briefing militar),
no un fallo de interiores.

### 2.5 Cómo se dibuja la sala (y por qué antes no se veía)

Al entrar en una casa, la sección «TILES» del fotograma pintaba la habitación… y
justo DESPUÉS el motor volcaba la **caché de terreno del mundo** (un `drawImage`
que no respeta el rectángulo visible) sobre las mismas coordenadas. Resultado: la
sala quedaba tapada por la arena del exterior y sólo asomaba una esquina, que es
exactamente lo que se veía en el juego. Arreglado: ese volcado (y la animación
del agua) se salta cuando `window.currentInterior` está activo.

La sala se pinta con la misma tubería que el exterior (`getTileSize()` +
camX/camY centrados):

* **Suelo**: tablas largas. El tono se elige por tabla (no por celda) con `shade()
a partir de la paleta del interior, más la junta horizontal y la cabeza de tabla.
Antes era un damero de dos colores con el borde de cada celda marcado, y se leía
como una cuadrícula de baldosas.
* **Muros**: bloque con volumen → remate superior iluminado, cara frontal con
hiladas de adobe, zócalo oscuro y **sombra proyectada** sobre el suelo de la celda
de abajo (es lo que da sensación de sala).
* **Decoración**: cuadros, ventanas (con reflejo) y antorchas con halo
parpadeante montadas en el muro; el vano tiene marco, hoja y luz de fuera.
* **Muebles**: se dibujan con su sprite (`interior_*`) sobre una **sombra de
contacto**, para que no parezcan flotar.

Todos los tonos salen de `wallPalette` del JSON del interior (`back`, `backLight`,
`backDark`, `floor`, `floorDark`, `trim`, `baseboard`, `ceiling`), así que un
interior nuevo hereda el aspecto sin tocar el motor.

## 3. Añadir un interior nuevo

1. Escribe el arte ASCII en `tools/build-interiors.js` (mapa de caracteres en la
   cabecera del fichero: `#` muro, `.` suelo, `D` vano, `b` cama, `t` mesa…).
   Convenio obligatorio: anillo de muros de una celda en todo el perímetro, el
   vano `D` en el muro sur **y** en la fila de justo encima (el motor la usa para
   el cartel «Salir [E]»), y `entryCol`/`entryRow` en la raíz del JSON y en cada
   planta.
2. `node tools/build-interiors.js` (o `--dry` para validar sin escribir). El
   generador valida muros/muebles/puertas y escribe `data/interiors/*.json`.
3. Añade el tipo de edificio a `INTERIOR_BY_BUILDING` y, si es nuevo, el tipo al
   `BUILDINGS` correspondiente.
4. Recarga el juego: `rebuildInteriorDoorsFromGrid()` corre al generar el mapa y
   al colocar/mover un edificio con interior.

## 4. Comprobación rápida en el navegador (`?debug=1`)

```js
// ¿Cuántas puertas y de qué tipos?
window.INTERIOR_DOORS.length;
window.INTERIOR_DOORS.reduce((a, d) => (a[d.buildingType] = (a[d.buildingType] || 0) + 1, a), {});

// Entrar en el primero de un tipo concreto
const p = window.INTERIOR_DOORS.find(d => d.buildingType === 'temple');
window.enterInterior(p.interiorId, p);
window.currentInterior.width, window.currentInterior.height, window.currentInterior.npcs;
window.exitInterior();
```

## 5. Los 12 interiores

| id | tamaño | notas |
| --- | --- | --- |
| `house-small` | 9×7 | casa humilde (cabaña, choza de cañas, garita) |
| `house` | 11×9 | casa mesopotámica |
| `house_garden` | 11×9 | casa con jardín |
| `house_large` | 13×10 | vivienda grande / villa detallada / sede del partido |
| `house_player_home` | 11×9 | casa del jugador (prólogo) |
| `residential_tower` | 9×8 | 3 plantas + ascensor |
| `temple` | 13×10 | sacerdotisa y oferente |
| `market` | 13×10 | mercader y comprador |
| `granary` | 11×10 | almacenero |
| `workshop` | 11×10 | alfarero (pottery / factory / steel_foundry) |
| `barracks` | 13×10 | sargento y recluta (longhouse / barracks) |
| `baths` | 13×10 | bañista |
