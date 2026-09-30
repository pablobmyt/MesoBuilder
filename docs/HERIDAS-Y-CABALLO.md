# Heridas del jugador, ficha (Tab) y caballo

> Añadido: 2026-09-30
> Código: `engine/game-engine.js` (heridas, ficha, caballo, postes),
> `engine/animal-art.js` (arte del caballo), `styles.css` (`#player-info-panel`).
> Relacionado: `docs/ACCIONES-Y-ANIMACIONES.md`, `docs/HUD-DINAMICO.md`.

## 1. Heridas por zona del cuerpo

Cada ataque deja marca en una zona concreta (`head`, `torso`, `lArm`, `rArm`,
`lLeg`, `rLeg`), con cuatro grados: **Sano · Leve · Grave · Critico**.

* Quien reparte la zona: `rollWoundPart(kind)`. Un **animal** (lobo) muerde sobre
  todo piernas y brazos; un **NPC** con arma pega al torso, los brazos o la cabeza.
* Cuando pega: los tres sitios donde el jugador pierde vida (NPC a distancia, NPC
  cuerpo a cuerpo y enemigos/animales) llaman a `applyPlayerWound(part, gravedad)`
  con una probabilidad del 55-70 % (si no, es sólo daño).
* **Efectos reales** (no decorativos):

| Zona | Efecto |
| --- | --- |
| Piernas | `velocidad x(1 - 0,16 · grado)` (hasta x0,55) |
| Brazos | `ataque x(1 - 0,12 · grado)` (hasta x0,5) |
| Torso | **sangrado** `0,22 · grado` vida/s (avisa cada 12 s) |
| Cabeza | `stamina x(1 - 0,14 · grado)` |

* **Curación**: una gravedad por día al cerrar el día (`healWounds(1)`, siempre la
  peor primero) y aviso «Una herida ha curado con el descanso». La acción
  *Sentarse* también descansa.
* La velocidad del jugador sale ahora de **una sola función** (`updatePlayerSpeed`:
  hambre/sed + heridas + caballo). Antes cada sitio que la tocaba pisaba a los
  demás (montar y quedarse sin comer se anulaban).

## 2. Ficha del jugador (Tab)

Panel flotante (`#player-info-panel`) con:

* **Esquema del cuerpo** en SVG: cabeza, torso, brazos y piernas coloreados por
  gravedad (verde → amarillo → naranja → rojo) y con `title` al pasar el ratón.
* **Vitales**: vida, stamina, hambre y sed.
* **Lista de zonas** con el grado y el efecto concreto («sangrado 0,43 vida/s»,
  «velocidad x0,84»...).
* Cabecera con nombre, época, día y si vas a caballo.

## 3. Caballo

* Arte generado en `engine/animal-art.js` (spec `horse`, 30x21, estados
  `idle/walk/run`, patas alternas, crin y cola). Se revisa con
  `node tools/preview-animals.js horse`.
* **Montar/bajar**: con **E** junto a un caballo (o desde la lista de acciones,
  gestos *Montar / bajar* y *Amarrar caballo*). Montado vas **x1,75** más rápido.
  Estando montado, `E` cerca de un poste lo deja amarrado; en campo abierto y sin
  nada más que hacer, también te bajas.
* **Dibujado**: el caballo va debajo del jinete y el personaje sube 0,34 del
  sprite («sentado»), tanto en vista ortogonal como isométrica.
* **Postes de amarre**: al empezar la partida se colocan junto al **35 % de las
  casas** (nunca en todas; hasta 40 postes) buscando una celda libre al lado.
  Se dibujan con madera y una anilla dorada, y cuando el caballo queda amarrado se
  ve la **cuerda** hasta el poste.
* Caballos: uno junto a la puerta de casa y varios por los postes (máx. 8), todos
  separados entre sí. Al arrancar avisa de cuántos hay.

## 4. Gráficos: espaldas y círculo de transparencia

* **De espaldas**: cuando el personaje camina hacia arriba (`dir === 'up'`), en el
  cráneo se pinta la piel y los ojos con el color del **pelo** (`drawCharacterPixels`
  → `colorPixel`), así que se ve la nuca en vez de una cara que mira al revés.
* **Círculo de transparencia**: el pase diferido apunta los rectángulos de pantalla
  de lo que se dibuja DELANTE del jugador (murallas, casas, copas). Si la caja del
  jugador choca con alguno, `drawOccludedReveals()` recorta un **círculo** sobre el
  obstáculo y redibuja al personaje translúcido dentro (más un aro suave para que se
  lea). Los NPCs, perros y caballos tapados reciben un disco suave.

## 5. Agua y crecimiento del mundo (arreglos)

* El mundo sólo miraba el **bioma** para pintar agua; el minimapa lee
  `window._RIVER_FULL_MAP`. Ahora los dos caminos de pintado (caché y celda a celda)
  usan **`isWaterPaintCell()`**: agua si el bioma lo dice **o** si el mapa de ríos lo
  marca. Eso arregla «el agua sale en el mapa (M) pero no en el mundo».
* **Vigilante de caché**: `terrainCacheFingerprint()` guarda una huella barata (nº de
  celdas de agua + muestreo de biomas + tamaño) cada vez que se repinta el terreno;
  cada 2 s se compara y, si cambió (mundo que crece, pasada de coherencia, partida
  cargada con otro mapa), se marca sucia y se repinta sola.
* **Crecimiento del mundo**: `maybeGrowWorld` ahora admite un escape por tiempo
  (más de 3 minutos jugando ⇒ crece aunque el prólogo siga marcado activo) y deja el
  motivo en `window._growBlockReason`. Diagnóstico:
  `MESO_DEBUG.testDraw.world.growDiag()` devuelve el motivo, el tamaño actual,
  el margen, tu distancia al borde y si el prólogo lo está bloqueando.

## 6. Pruebas desde consola

```js
const T = window.MESO_DEBUG.testDraw;
T.wounds.apply('torso', 2);      // herida directa; tambien .apply() al azar
T.wounds.list(); T.wounds.speed(); T.wounds.bleed();
T.wounds.heal(1); T.wounds.reset(); T.wounds.panel(true);   // abre la ficha
T.horses.spawnNear(2); T.horses.mount(); T.horses.mounted(); T.horses.dismount(true);
T.horses.list(); T.horses.posts();
T.world.growDiag();              // por que no crece el mundo
window.horses.interact();        // mismo camino que la tecla E
```
