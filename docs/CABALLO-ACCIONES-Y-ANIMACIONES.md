# Caballo: animaciones y acciones (como el jugador)

> Añadido: 2026-10-01
> Código: `engine/animal-art.js` (arte y poses del caballo),
> `engine/game-engine.js` (`HORSE_ACTIONS`, `runHorseAction`, panel de acciones,
> `window._horseBoost`), `engine/sound-manager.js` (5 sonidos nuevos).
> Relacionado: `docs/HERIDAS-Y-CABALLO.md`, `docs/EDIFICIOS-VOLUMEN-Y-CRECIMIENTO.md`,
> `docs/ARTE-ARBOLES-Y-ANIMALES.md`.

## 1. El arte del caballo, rehecho

Antes el caballo era un bloque con patas y tres estados (`idle/walk/run`). Ahora
tiene proporciones de caballo de verdad y **11 estados**. Rejilla **40×26**
(antes 36×25) con el suelo en `y = 24`:

| Zona | Cuánto ocupa | Comentario |
| --- | --- | --- |
| Patas (suelo → barriga) | 8 de 15 filas (53 %) | caña fina de 3 px + casco casi negro; el casco NO sube con el balanceo del cuerpo (el caballo oscila, no flota) |
| Tronco (barriga → cruz) | 7 filas (47 %) | barriga clara, lomo iluminado y cuello aparte para que el degradado no oscurezca la cruz |
| Cuello y cabeza (cruz → orejas) | 7 filas | cuello que se estrecha del pecho a la nuca, hocico largo, belfo, ollar, orejas y mechón de crin |

| Estado | Qué se ve |
| --- | --- |
| `idle` | Quieto, respirando, con un cabeceo lento. |
| `walk` | Paso: las cuatro patas en diagonal, el cuerpo balancea poco. |
| `trot` | Trote: zancada más corta y rápida, crin y cola sueltas. |
| `gallop` | Galope: el cuerpo se estira (rejilla 27), el cuello se alarga y las manos se adelantan. |
| `rear` | **Encabritado**: medio cuerpo en el aire, rejilla 36 para que no se corte la cabeza. |
| `neigh` | **Relincho**: cabeza alta, belfo abierto y crin al viento (rejilla 31). |
| `paw` | **Piafar**: escarba el suelo con una mano. |
| `graze` | **Pastar**: baja la cabeza a la hierba, cuello estirado. |
| `drink` | **Beber**: cabeza por debajo del pecho, hocico largo. |
| `shake` | **Sacudirse**: el lomo se retuerce y la cola barre los lados. |
| `lie` | **Echado**: patas recogidas (`legShort`) y cuerpo bajo, en el suelo. |

### Cómo está montado (para tocar el arte sin romperlo)

* El caballo se dibuja **en coordenadas relativas al suelo**: `F = 24` es la línea
  donde apoyan los cascos. Las poses que necesitan más alto no deforman al resto;
  sólo piden una rejilla más alta con `hFor(state)` (`gridHFor()` la consulta).
* `makeGrid` tiene `setOffset(dx, dy)`: la rejilla extra se compensa bajando el
  cuerpo (`S = g.h - 26`), así los cascos siguen en el mismo píxel del suelo y el
  sprite crece **hacia arriba** (es lo que el motor espera de un sprite más alto).
* ⚠️ **`bitmapFor` debe usar la rejilla real**: el lienzo del fotograma medía
  `spec.h` (26) y las poses altas usan hasta 36 filas → todo lo que sobresalía se
  **recortaba** y el caballo encabritado perdía la cabeza y el cuello. Ahora el
  lienzo mide `gridHFor(spec, state)`.
* **Nada de 1–2 px de ancho**: `finishGrid` pone contorno en toda celda que toca
  aire, así que una pata o una cola de 2 px sale **negra** (contorno por los dos
  lados). Patas y cola van a 3 px.
* Tags con color propio: `mane` (crin y cola) y `hoof` (casco) tienen su tono fijo
  en la paleta; `body` se sombrea por filas (claro arriba) y `neck` va aparte para
  que el degradado de la cabeza no apague el lomo.
* Cada estado es una envolvente de `p` (0..1) con `Math.sin(min(1,p)·π)` en
  `animFor('horse', estado, p)`, de modo que la pose **entra y sale** suave. OJO al
  revisarla: **la fase 0 es la pose neutra**; hay que mirar la 0,5.

### Verlo sin abrir el juego

```bat
node tools\preview-animals.js horse "idle,walk,trot,gallop,rear,neigh,paw,graze,drink,shake,lie" --una
node tools\preview-animals.js horse rear --fase 0.5    REM la pose en su punto máximo
node tools\preview-animals.js horse gallop --vertical  REM una pose, fase a fase
```

## 2. Acciones: la misma idea que las del jugador

`HORSE_ACTIONS` es una tabla de definiciones (`{ id, icon, label, key, state, ms,
sfx, hint }`) y `runHorseAction(id)` es el único ejecutor. Se usan de tres formas:

1. **Panel de Acciones (V / clic sobre el jugador)**: sección **«Caballo»**. Sale
   si vas montado **o** si tienes un caballo a menos de 4,5 celdas. Al ir montado,
   los botones de las cuatro acciones con tecla muestran su letra.
2. **Teclado** (sólo montado, para no pisar los atajos del juego):
   **X** encabritarse · **Z** relinchar · **B** piafar · **N** galopar.
3. **API de pruebas**: `window.horses.act('relinchar')` o
   `MESO_DEBUG.testDraw.horses.act(...)`.

| Acción | Tecla (montado) | Estado | Dur. | Sonido | Efecto real |
| --- | --- | --- | --- | --- | --- |
| Encabritarse | X | `rear` | 1,5 s | `whinny` | — |
| Relinchar | Z | `neigh` | 1,8 s | `horseNeigh` | — |
| Piafar | B | `paw` | 1,8 s | `horsePaw` | — |
| Galopar | N | `gallop` | 2,6 s | `gallop` | **+35 % de velocidad 4 s** (`window._horseBoost`) |
| Pastar | — | `graze` | 5 s | `horseChew` | — |
| Beber | — | `drink` | 3,5 s | `drink` | Exige estar **junto al agua** |
| Sacudirse | — | `shake` | 1,3 s | `horseSnort` | — |
| Echarse | — | `lie` | 6 s | `sleep` | Sólo **si no vas montado** |

* Las dos condiciones (beber junto al agua, echarse desmontado) **avisan** por
  `notify()` en vez de fallar en silencio.
* Desmontado, la acción lanza un texto flotante sobre el caballo («¡Relinchó!»).
* La acción en curso **manda** sobre el aire: `horseStateFor()` mira primero
  `ent._act` y sólo después la velocidad.

## 3. Qué estado le toca en cada momento

* **Caballo suelto** (`horseStateFor`, con `_act` primero):
  `> 2,2` celdas/s ⇒ `gallop`; `> 1,2` ⇒ `trot`; moviéndose ⇒ `walk`; parado ⇒
  `idle`. La velocidad sale de `ent._speedNow` (media suavizada 0,7/0,3 del salto
  de posición por fotograma).
* **Montado** (`mountedHorseState(now)`): lo marca el jinete —si ha avanzado este
  fotograma (`player._walkTime` contra `window._mountStrideSeen`)— y si va
  esprintando ⇒ `gallop`, si no `trot`; parado ⇒ `idle`; y por encima, la acción.
* El **galope** del jugador montado no se anima con `ent._speedNow` porque el
  caballo montado no es una entidad con `moveTarget`: se mueve con el jugador.

## 4. Pruebas desde consola

```js
const T = window.MESO_DEBUG.testDraw;
T.horses.actions();                       // las 8 con su tecla y su estado
T.horses.spawnNear(2); T.horses.mount();
T.horses.act('encabritar'); T.horses.state(); T.horses.actNow();
T.horses.act('galopar'); window.player.speed;   // sube ~35 % durante 4 s
T.horses.dismount(); T.horses.act('pastar');    // desmontado: pastar/echarse
T.sounds.has('horseNeigh');               // los 5 sonidos nuevos
```

## 5. Trampa que costó un rato

`filasCaballoHtml()` **tiene que ser una función**, no un `const` de módulo: un
`const filasCaballo = (()=>{...})()` se evalúa **al cargar el módulo**, cuando
todavía no hay caballos ni jugador montado, y se queda vacío para siempre (el
panel salía sin la sección «Caballo» aunque `estaMontado()` fuese `true` después).
La sección se genera dentro de `renderPlayerActionsPanel()`.
