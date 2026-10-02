# TERRENO PERDIDO, CULTIVOS VARIADOS, PERRO Y BIENVENIDA

## 1. «Se ha vuelto a perder el renderizado del terreno» — causa raíz

No era el pintado: era el **arranque**. En `init()`, la elección de mundo era:

```js
if (forceNewGame) { ...generar mundo... }
else if (window._externalMenu && autoRestaurarPartida) { ...cargar guardado... }
if (!window._externalMenu) { mostrar menú interno; return; }
```

Con el **menú externo** (`index.html`, o sea el juego de verdad) y sin
`meso.forceNew`, si `autoRestaurarPartida` era `false` —guardado existe pero la
última sesión es de hace **más de 10 minutos**— **ninguna rama se ejecutaba**: la
función llegaba al final y seguía con `updateUI()`, `setupCharacterSelection()`…
El motor ya venía con `window._gameStarted = true` puesto por la página, así que
el bucle de dibujado corría sobre una rejilla **vacía de arena** (21600 celdas
`sand`, sin biomas, sin río, sin árboles) con «Debug HUD: initializing...» para
siempre. Eso es exactamente lo que se veía como «el terreno no se renderiza».

Y lo peor: ese mundo vacío **se guardaba** con el autoguardado y **pisaba la
partida buena**, así que a partir de ahí *todas* las cargas salían sin terreno
(«se ha vuelto a perder»).

### Los tres arreglos

1. **Nunca se sale de `init()` sin mundo.** Nueva rama final:
   `else if (window._externalMenu)` → `asegurarMundoCargado()`: carga el guardado
   y, si no hay o viene vacío, **genera un mundo nuevo**.
2. **Un guardado sin mundo ya no envenena la partida.** `asegurarMundoCargado()`
   comprueba `mundoTieneContenido()` (≥3 biomas distintos): si el guardado es la
   arena vacía, se descarta y se regenera.
3. **Nunca se guarda un mundo vacío.** `saveAppState()` hace la misma comprobación
   y omite el guardado (`save: se omite el guardado (mundo vacio)`).

Además, «Cargar partida» (menú externo) ahora marca `window._forceLoadSave`, así
que **restaura el guardado aunque la sesión sea vieja** — antes el criterio de
«sesión reciente» también lo bloqueaba.

**Verificado en vivo** (consola del navegador):

```
save: se omite el guardado (mundo vacio)
boot: el guardado no trae mundo jugable (vacio), se genera uno nuevo
[mundo] caminantes en el yermo: 15
[mundo] pescadores en la orilla: 13
```

Mundo resultante: 11 biomas, semilla real, **2.539 entidades**, 4 pueblos, agua
1.268 celdas. La partida rota se autoreparó sola.

## 2. Los cultivos ya no son todos iguales

Basado en la referencia de pixel-art de huerto cenital: cada parcela tiene su
**familia** y cada familia su arte de 4 fases (la fase 0 es común: terrón de
tierra volteada con las semillas a la vista).

| Familia | Fase 1 | Fase 2 | Fase 3 |
| --- | --- | --- | --- |
| `wheat` Trigo | tallos | espigando | espigas doradas |
| `vine` Vid | brote + **tutor** | vid trepando | tutor + **racimos de uva morada** |
| `bush` Mata | brote doble | mata frondosa | mata con **frutos amarillos** |
| `leafy` Col | brote doble | roseta de hojas | roseta con **cogollo blanco** |

* La familia se elige **de forma determinista** por celda (hash de columna, fila y
  semilla del mundo) → un campo grande sale variado y cada parcela mantiene su
  tipo aunque recargues la partida.
* Según el terreno: **junto al agua** mandan las hortalizas (col, mata) y **lejos**
  el cereal y la vid.
* Arte en `engine/plant-art.js` (`CROP_TYPES`, `CROP_TYPE_NAMES`,
  `buildCropStages`, `cropSpriteKey`); el motor guarda
  `window._CROP_SPRITE_KEYS[familia][fase]` y `drawCropsVisible` usa el sprite de
  cada parcela.

```js
MESO_DEBUG.testDraw.crops.types()          // ['wheat','vine','bush','leafy']
MESO_DEBUG.testDraw.crops.plant(72, 45, 'vine')
MESO_DEBUG.testDraw.crops.list()           // at, stage, tipo, sec, moist
```

Medido: fase 3 de cada familia = 145 px / 47 px / 60 px / 77 px de arte y 5-8
tonos distintos por planta (antes las cuatro eran el mismo trigo).

## 3. Sonidos del perro

Nueve efectos nuevos (el catálogo pasa a **90**):

| Sonido | Cuándo |
| --- | --- |
| `dogBark`, `dogBark3` | ladrido normal y ladrido corto (cuando va contigo) |
| `dogBark2` | ladrido grave: al quedarse atrás (recall) y al atacar |
| `dogGrowl` | gruñido al morder a un enemigo (`Grr!`) |
| `dogWhimper` | gimoteo cuando le bajan la vida |
| `dogHappy` | al acariciarlo (con corazones) |
| `dogSniff`, `dogPant`, `dogHowl` | olfateo, jadeo y aullido en su ronda |

Los ladridos sueltos van con freno aleatorio (4-13 s) y sólo si está cerca, para
que no empalaguen.

## 4. Introducción progresiva y la azada hay que fabricarla

* **Escena de bienvenida «Adapa llega a casa en el carruaje»**: cinemática
  dibujada sobre el mundo (amanecer con degradado, camino de tierra con matojos,
  el carro con toldo tirado por el caballo que llega desde la derecha, con sus
  ruedas girando y polvo, y **Adapa y el carretero sentados** dentro), con rótulos
  por tiempos:

  1. «Ur, año 2 de la siembra.»
  2. «Adapa vuelve a casa en el carro de su padre.»
  3. «El río Don sigue dando de comer a quien lo trabaja.»
  4. «Ya se ve el humo de la chimenea…»

  Bloquea el movimiento (`cinematicActive`), se puede **saltar con cualquier tecla
  o clic** y al terminar deja el primer objetivo real del prólogo.
  Se lanza al empezar el prólogo (`postMapInit`) y una sola vez por sesión.

* **La azada ya no se regala.** El prólogo entregaba `stone-hoe` equipada, así que
  la misión «Craftea stone-hoe» (que ya existía, con `watch: 'craft.stone-hoe'`)
  se completaba sola sin jugar. Ahora hay que fabricarla (2 de madera + 2 de
  piedra) y al acabar la escena aparece el objetivo «Fabricar una azada» con sus
  pasos.

```js
MESO_DEBUG.testDraw.scene.cart(9000)    // lanza la escena de bienvenida
MESO_DEBUG.testDraw.scene.activa()      // ¿está en marcha?
MESO_DEBUG.testDraw.scene.saltar()
```

## Segunda pasada: intro que no se veía y terreno en Electron

**La introducción no se veía** porque arrancaba en `postMapInit`, mientras el
cartel de carga (`#global-loading-overlay`) seguía tapando la pantalla. En
Electron el precargado de sprites tarda, así que la cinemática de 12 s se
consumía **entera detrás del cartel** y al desaparecer éste ya no había nada.
Ahora `programarEscenaBienvenida()` espera (hasta 14 s) a que el cartel esté
oculto y sólo entonces lanza la escena. Se programa desde `postMapInit` y también
desde `setupHomePrologueSpawn`, así que da igual el orden.

**`cinematicActive` no existía como variable del módulo.** El motor lo usa suelto
en varias partes, pero en un módulo ES (modo estricto) asignar a un identificador
inexistente **lanza** y el `try/catch` se lo tragaba: la cinemática no bloqueaba
el movimiento. Ahora la escena escribe `window.cinematicActive`.

**Terreno en Electron: vigilante y respaldo.** Se añaden dos redes de seguridad:

1. `vigilanteTerreno()` (se llama al final de cada fotograma, con freno de 5 s):
   si 5 s después de tener mundo la caché de terreno no está lista, la
   reconstruye (hasta 3 intentos). Y una comprobación de color, una vez pasados
   unos segundos: si el lienzo sale de **un solo color** (nada pintado, un cartel
   encima o una caché a medias), reconstruye; y si vuelve a salir plano,
   **desactiva el volcado de la caché** (`window._noTerrainCacheBlit`) y pinta el
   terreno celda a celda, que siempre se ve. Es el caso de las GPU donde un
   `drawImage` de un lienzo enorme (5760×3840) falla en silencio.
2. `MESO_DEBUG.testDraw.world.diag()` devuelve de una vez todo lo necesario para
   diagnosticar: tamaño del lienzo, vista y zoom, estado y tamaño de las dos
   cachés, vigilante, semilla, biomas, entidades y si el cartel de carga sigue
   puesto.

También se ha hecho más tolerante la detección de guardados: `mundoTieneContenido()`
ya **no exige `terrain.seed`** (las partidas antiguas no lo tenían y se estaban
descartando, regenerando el mundo). Si falta, se deriva una semilla estable del
propio mundo guardado.

## Textos de arranque por época + introducción al mundo + música apagada (2026-10-02)

Pedido: el texto con el que arranca una partida de **Mesopotamia** no era
coherente con la historia, y hacía falta una breve **introducción al mundo** con
los sitios importantes; además, dejar la música en silencio mientras se
desarrolla.

**Por qué no era coherente.** El relato de arranque (`drawIntroSequence`) tenía
la rama de Mesopotamia rellenada con texto soviético: en la primera fase decía
«Entre el Río Don y el Río Ob Nord, bajo el hielo perpetuo…», y la tarjeta de
título mostraba **«OPERACIÓN SOMBRA FRÍA — Un thriller de espionaje en tierra
hostil»** (el modo prólogo pintaba siempre ese cartel, fuera cual fuera la
época). También se dibujaba la **bandera soviética** como última fase en todas
las épocas, y el relato repetía dos veces la frase de presentación de Adapa.
Los rótulos del carruaje (`cartSceneLines()`, antes `CART_SCENE_LINES`) hablaban
de «Ur» y del «río Don».

**Qué se ha hecho.**

* `cartSceneLines()` devuelve los rótulos **por época** (Mesopotamia: Kidu-Lam y
  el Éufrates) y usa el nombre real del jugador.
* La fase 0 (sitio y momento), la fase 1 (relato) y la fase 2 (título) van por
  época y por modo; el prólogo en casa ya no dice que la aldea está arrasada
  (el canon la mantiene en pie: ver `docs/GUION-NARRATIVO.md`).
* **Fase 3 nueva: introducción al mundo.** `introWorldBriefing(epoch)` devuelve
  un contexto breve y una lista de **sitios importantes** (Kidu-Lam, el Éufrates,
  Nínagara, el templo de Enlil…), y `dibujarBriefingDelMundo()` lo pinta centrado
  y escalado con la altura del lienzo (no se sale en ventanas pequeñas).
* La **bandera soviética** sólo se iza en la URSS; en las demás épocas la última
  fase es la tarjeta «Comienza el viaje».

**Música desactivada de momento.** Interruptor único:
`window.MESO_MUSICA_ACTIVA` (lo fija `MENU_MUSIC_ENABLED` en `index.html` y lo lee
`musicaActiva()` en el motor). Con `false` no suena la música del menú
(`March_of_the_Vanguard.mp3`) ni la de la intro (`ussr.wav` y el MIDI). **Ningún
fichero se borra**: poner el interruptor a `true` la vuelve a activar. Los SFX
(`SoundManager`) siguen funcionando. El desplegable «Volumen música» se conserva,
con una nota en Configuración de que está desactivada.

## Pendiente

* Los cultivos dan **trigo** al cosechar, sea cual sea su familia (la apariencia ya
  es distinta): falta dar uvas/pimientos/coles como objetos propios, con su icono
  y su uso en recetas.
