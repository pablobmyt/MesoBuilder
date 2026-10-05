# Sigilo, coberturas y zonas vigiladas

> Sistema «a lo mafia»: una zona acotada con gente vigilando, coberturas por las
> que esconderse y un medidor de sospecha. Hecho el 2026-10-05.
> Código: `engine/stealth.js` (todo el sistema) + el enganche en
> `engine/game-engine.js` (entrada, dibujo, trazos y misión).

---

## 1. Por qué así

La petición fue: *«una zona para la primera misión, tengamos que hacer algo de
sigilo, un sistema similar al mafia, con coberturas, gente vigilando y que se vea
hacia dónde están mirando (un haz como las linternas de los juegos), y las
coberturas con Ctrl»*.

De ahí salen las tres decisiones que gobiernan todo lo demás:

1. **El cono es la interfaz, pero se ve a voluntad.** No hay iconos de
   «vigilancia»: el ángulo con el que mira cada enemigo se recorta contra lo que
   bloquea el paso. Eso sí: **el usuario pidió después que ese rango no se vea en
   partida**, así que el cono se enseña con la tecla `U` (2 s, 10 s de cooldown) y
   durante el juego normal sólo queda el medidor de sospecha de los vigías de la
   zona (ver §4 y §4-ter). Si el cono no se pudiera ver de ninguna forma, el
   sistema sería invisible y parecería aleatorio.
2. **Una sola definición de cobertura.** No hay lista de «objetos cobertura»: es
   cobertura **cualquier celda que tenga al lado algo que corta la vista** (tapia,
   muro, caja, árbol, roca). Así vale cualquier rincón del mapa, no sólo los que
   están dentro de la zona, y no hay que etiquetar el mundo entero.
3. **Ctrl = sigilo.** Con Ctrl el personaje va agachado (más lento, más difícil de
   ver) y, si tiene una tapia o una caja al lado, queda **arrimado** solo. Ctrl y
   clic cerca de una cobertura te lleva a ella. Es un estado, no una tecla que
   haya que recordar.

---

## 2. La zona (recinto)

`construirZona()` busca un claro (ni en el agua, ni encima de un pueblo) a entre
16 y 46 celdas del jugador y levanta un recinto de **26×20**:

* **Cerco de `wall_segment`** con dos vanos: la puerta sur (vigilada) y una
  tronera al norte (para escapar).
* **Naves** del catálogo de la época (`granary`/`state_warehouse` y una o dos
  casas) que valen de cobertura grande.
* **Coberturas repartidas**: `crate_stack`, rocas y árboles (marcados
  `_cobertura`). Son celdas que cortan la vista *y* el paso.
* **El botín** en el centro: es el objetivo de la misión y va marcado con un
  rombo dorado que late.
* **4 vigías** (`npcType: 'guard'`, `_vigia: true`, `_keepPost: true`) con sus
  rutas: el portero en la puerta, dos rondas por dentro y la del almacén. Usan el
  paseo normal de los NPC (`patrolRoute`), así que no hay un segundo sistema de
  movimiento: cuando hay que mandarlos a mirar algo, se les cambia la ruta por un
  punto y el bucle de entidades los lleva.

La zona se levanta **al empezar la partida** (`postMapInit`): es un sitio del
mundo al que se puede ir cuando se quiera. La misión la ofrece el primer vecino
con el que se habla (ver §5).

---

## 3. Visión, sospecha y alarma

Cada vigía tiene **ángulo** (0,95 rad ≈ 54°; 1,75 rad cuando sospecha) y
**alcance** (8,5 celdas; 11,5 en alerta). Estar dentro del cono no basta:

* **La vista no atraviesa lo que bloquea el paso** (`bloqueaVistaDeSigilo`:
  edificios, muros, árboles, rocas, cajas). El segmento se muestrea cada 0,4
  celdas. El agua **no** corta la vista (por el agua se ve).
* A menos de 1,6 celdas te ve aunque no mire de frente (te oye).
* El **medidor** sube según lo cerca que esté y si corres (×1,4), y baja si vas
  agachado (×0,45), en cobertura (×0,5) o de noche (×0,82). Se llena en ~1 s a
  media distancia y en ~0,4 s pegado.
* A partir de 0,34 el vigía pasa a **sospecha**: se gira hacia donde te vio, avisa
  con un sonido y se acerca. Al llegar a 1 → **alarma**.
* Con la alarma, **todos** van al último sitio donde te vieron y hay 18 s de
  cuenta atrás. La alarma se apaga cuando expira **y** has salido de la zona: ahí
  vuelven a su ronda y se puede reintentar.
* Si te alcanzan (1,25 celdas) pegan (4 de daño, cada 2,2 s) por el mismo camino
  que el resto de golpes del juego (`golpearAlJugadorDesde`).

La comprobación de visión va a **~7 Hz** (`CFG.cadaDeteccion = 150 ms`) aunque la
mirada se reoriente en cada fotograma: a 60 fps comprobar 4 vigías con rayos
sería tirar CPU sin que se note.

---

## 4. Qué se dibuja en partida (y qué NO)

> **Cambio del 2026-10-05 (séptima pasada), por petición expresa:** «el rango de
> visión no se debería ver en ningún modo que no sea el que se activa pulsando la
> U». Así que **los conos ya NO se dibujan en el juego normal**. Antes cada vigía
> llevaba su haz de luz permanente (abanico de 18 rayos recortados contra los
> muros, degradado radial en modo `lighter`); aquello se midió en **10.124 píxeles
> distintos, 8.040 de ellos más claros**, y ahora no queda nada de eso en partida:
> la diferencia de brillo del fotograma con la zona y sin ella es de **0,011 por
> canal y píxel** (sólo los sprites de los vigías y sus marcadores).

Lo que sí se sigue dibujando en partida (nada de esto revela dónde alcanza la
vista):

* **Medidor de sospecha** sobre la cabeza del vigía: una barra de 3 px que sólo
  aparece cuando `deteccion > 0,02` (es decir, cuando ya te está viendo). Su color
  dice el estado: hueso tranquilo, ámbar al sospechar, rojo en alerta.
* **Corchetes de cobertura** tenues en las coberturas a menos de 5,5 celdas, y el
  de la que estás usando en azul (es la mecánica de `Ctrl`).
* **Marcador del botín** (rombo dorado latiendo) y un **cartel de estado**
  centrado: «Objetivo: …», «Te están mirando… busca una cobertura (Ctrl)»,
  «¡ALARMA! Sal de la zona…». Como los conos ya no se ven, **la primera vez** que
  se entra en la zona con la misión viva el cartel añade una línea de una sola vez:
  «Pulsa U para ver su campo de visión» (se deja de decir en cuanto se usa la U:
  `window._visionUsada`).

Los conos se ven **sólo** con la tecla `U`: ver §4-ter.

Comprobado por píxeles (mismo vigía, mismos 3 puntos dentro de su campo de
visión a 1,5 / 2,2 / 3 celdas):

| Punto | Modo normal | Modo U |
|---|---|---|
| 1 | `[97,65,30]` (suelo) | `[215,67,67]` (rojo) |
| 2 | `[99,80,30]` (suelo) | `[122,35,35]` (rojo) |
| 3 | `[58,41,20]` (suelo) | `[173,89,86]` (rojo) |

Cero rojos en partida, tres de tres en modo U.

---

## 4-bis. Quién tiene visión (y quién no)

La visión **no** es para cualquier vecino. Un aldeano, un mercader, un escriba o
un pescador pasean sin cono: si todo el mundo te viera, el mundo sería un
campo de minas y no habría forma de distinguir el peligro. Tienen cono:

| Quién | Cómo se le reconoce |
|---|---|
| Guardias, soldados, oficiales, comisarios, milicias, patrullas, vigilantes | `npcType` (lista `TIPOS_PELIGROSOS` + respaldo por expresión regular) |
| Los 4 vigías de la zona de sigilo | `_vigia` |
| Enemigos de la historia | `_enemigoHistoria` |
| Enemigos «de torre» | `kind === 'enemy'`, `isEnemy`, id `enemy-…`, `raider`/`beast` |
| **Cualquier NPC al que agredas o que se enfade** | `_hostile`, `_angry`, `_alertedAt` (los pone la reacción al disparo y la alerta de vecinos) |

Los que están fuera de la zona viven en `campo` (se crean y se retiran solos: si
un aldeano se calma pierde el cono, si le pegas lo recupera). La diferencia con
los de la zona es que **no hay alarma que disparar**: al llenarse el medidor se
avisa al motor (`enemigoTeVe`) y él decide:

* si el NPC ya es hostil o eres buscado (`_wantedLevel > 0`) → `_hostile`, viene a
  por ti;
* si sólo es un guardia en su puesto → `_vigilandoAlJugadorHasta` (12 s), se gira
  hacia ti y te avisa («te ha visto, no hagas nada raro»), **sin abandonar el
  puesto** (movía el `moveTarget` y dejaba la puerta sin guardia). El aviso sale
  como mucho cada 30 s por guardia: cruzar una ciudad con 170 guardias no puede
  ser una lluvia de tostadas.

Medido en el navegador del mundo de pruebas: 218 NPJ, de los que tienen cono 125
`guard` + 97 `gate_guard` + 1 `commander`, y **0** entre aldeanos, mercaderes,
agricultores, pastores, pescadores, escribas y supervivientes. Un aldeano al que
se le marca `_hostile` gana cono en el acto y lo pierde al calmarse.

### Coste (y cómo se arregló)

Con 200+ vigilantes, la primera versión costaba **~22 ms por fotograma**. La
culpa no era el número de vigilantes sino `isStaticEntityBlockingTile`, que
recorría **todas** las entidades por cada celda muestreada de cada rayo (medio
millón de comprobaciones por segundo). Ahora:

* `indiceCeldasBloqueantes(minC,minR,maxC,maxR)` construye, de **una pasada**, la
  lista de celdas que cortan la vista alrededor del jugador (±26 celdas); el
  sigilo la refresca cada 250 ms y consulta un `Set`.
* Los vigilantes a más de 18 celdas del jugador se saltan (ni se les mueve la
  mirada ni se les comprueba la visión).
* La lista de vigilantes de fuera se rehace 4 veces por segundo, no cada
  fotograma, y su comprobación va a 260 ms (la de la zona sigue a 150 ms).
* Si nadie te ve, el medidor sólo decae: no se pregunta si vas agachado, si
  corres o si es de noche.

Coste medido después: **0,1 ms por fotograma** (dentro del ruido de la medición).

---

## 4-quater. CUÁNDO son peligrosos (la regla que pidió el usuario)

*«En los momentos normales, que no estén en una misión… los enemigos sólo deberían
perseguir y atacarme si estoy agrediendo a alguien o haciendo algo».* (Le pasó
entrando por las murallas: le persiguieron y le atacaron sin haber hecho nada.)
De ahí salen tres reglas:

**1. Ver no es motivo.** Que un guardia te vea (aunque te complete el medidor) no
te persigue, no avisa a nadie y no sube el nivel de búsqueda: sólo se gira hacia ti
y queda apuntado con `_vigilandoAlJugadorHasta` durante 12 s. Sin tostada y sin
registro: es información, no castigo. Para que venga a por ti tiene que haber
**motivo**:

| Motivo | Quién |
|---|---|
| El jugador está buscado (`_wantedLevel > 0`, sube al disparar o agredir) | ese enemigo **y** los de al lado (`alertNearbyNPCs`) |
| El PNJ ya era hostil (`_hostile`) | él |
| Enemigo del guion o de torre (`_enemigoHistoria`, `isEnemy`, `kind: 'enemy'`, id `enemy-…`) | siempre: es su papel |

Medido: en partida normal, un guardia completa el medidor (`deteccion: 1`) y queda
`_hostile: false`, `moveTarget: false`, `_wantedLevel: 0` y **el mismo número de
hostiles en el mundo antes y después** (0 → 0). Con `_wantedLevel = 2`, el mismo
guardia pasa a `_hostile: true` con `_nextAttack` y persigue, y se le suman los de
alrededor (1 → 4 hostiles, indicador «ALERTA»).

> El fallo de origen: la reacción llamaba a `alertNearbyNPCs`, que pone `_hostile`
> a **todos** los NPC armados en 7 celdas y sube el nivel de búsqueda. Un guardia
> viéndote bastaba para que el barrio entero se te echara encima.

**2. La ciudad se calma.** El `_hostile` no se borraba nunca: un solo disparo
dejaba a media ciudad persiguiéndote para siempre. Ahora, cuando el nivel de
búsqueda llega a **0** (decae un nivel cada 14 s desde el último aviso), se
liberan los que se habían sumado al alboroto (`_hostile`, `_alertedAt`,
`_nextAttack`, `moveTarget`) menos los enemigos de verdad, y sale el aviso «La
ciudad se ha calmado.». Medido: 3 guardias hostiles + nivel 1 → 0 y 0 al vencer.

**3. La zona vigilada sólo es peligrosa si la misión está en marcha.** La zona se
levanta al empezar la partida porque es un sitio del mundo (un almacén cercado),
pero hasta que no **aceptas** la misión de sigilo sus cuatro guardias son guardias
normales: te miran, pero no dan la alarma y no te pegan por acercarte. El corte es
`zona.sigilo && !zona.completada` (`actualizar()`); sin misión, además, se apaga
cualquier alarma que estuviera viva y todos vuelven a su ronda. Medido: puesto
delante de un vigía, dentro de su cono, sin misión → detección `[0,0,0,0]`, sin
alarma y **sin perder vida** (110 → 110); con la misión aceptada → detecciones a 1,
alarma y golpes (110 → 0).

De paso, los vigías de la zona ya no se evalúan dos veces (se saltan en el
`sincronizarCampo` de los de fuera) y al construir una zona nueva se **suelta** a
los vigías de la anterior: la partida guardada conserva a sus guardias, así que si
no se hace eso se acumulan guardias «vigías» sin zona que nadie evalúa.

---

## 4-ter. Modo VISIÓN DE ENEMIGOS (tecla `U`)

*«La visión del campo de visión se debería activar pulsando la U: se pondría el
juego en blanco y negro a 0,25 de tiempo con algo de difuminado, mostrando esa
área de visión en rojo; tiene que durar unos 2 segundos y tener un cooldown de
10 segundos.»*

* **2 s** de efecto, **10 s** de cooldown (el cooldown empieza a contar al
  terminar, así que se puede volver a usar 12 s después de pulsar).
* Mientras dura, `window._timeScale` pasa a **0,25** (cámara lenta; al acabar se
  devuelve **la escala que hubiera puesta**, no un 1 fijo).
* Post-proceso del fotograma ya pintado: `grayscale(1) blur(2px)` (volcando el
  propio lienzo con filtro), una viñeta radial y encima los **conos de todos los
  enemigos en rojo**: relleno translúcido + segunda pasada en modo aditivo (con
  una sola pasada al 20 % sobre gris el rojo se quedaba en un gris rosado), borde
  marcado, la línea de la mirada a trazos y un círculo con el nombre del enemigo
  que te tiene localizado.
* Un cartel centrado dice cuántos enemigos te tienen localizado («Ningún enemigo
  te ve» / «2 enemigos te han localizado») y abajo hay una barra fina con lo que
  queda del efecto.
* Sólo se dibujan los conos que caen en pantalla (±200 px del borde).
* Si estás en cooldown, la tecla avisa de cuántos segundos faltan en vez de no
  hacer nada (pulsar y que no pase nada parece un fallo).
* No se activa en modo edición, con el mapa abierto ni durante una cinemática.

Medido en el navegador: 0,04 % de píxeles grises antes → **92,7 %** durante el
efecto; el cono de un guardia pasa de gris `[127,127,127]` a rojo `[137,50,50]` en
sus primeros 1-2 tiles, y vuelve a la normalidad (y a `_timeScale = 1`) al
terminar.

---

## 5. La primera misión de sigilo

La ofrece **el primer vecino con el que se habla**, a mitad de conversación y sin
sorteo (`colarMisionEnDialogo` la antepone a los encargos corrientes y se salta el
reparto aleatorio de encargos). Los **vigías no reparten encargos**: ellos son el
obstáculo.

* Título: «El alijo del recaudador» (Mesopotamia) / «Los papeles del distrito» (URSS).
* Al aceptar (`stealth.misionAceptada()`): se enciende la zona (alarma a cero,
  vigías a su ronda), el botín queda marcado y se abre el objetivo con 4 pasos.
* Se completa al llegar al botín **sin alarma** (radio 1,7) → recompensa, XP y
  registro en el diario. Si te vieron, hay que salir y esperar.
* La misión entra en `window._missions` con `watch: 'stealth'` y `sigilo: true`
  (es lo que hace que al aceptarla se encienda la zona).

---

## 6. Lanzar piedras (lo que hace útil el sigilo)

Con una piedra u objeto contundente (o piedras en la mochila) se **pulsa, se
dibuja una trayectoria y se suelta**: el objeto recorre exactamente la línea
dibujada. Donde caiga hace **ruido**, y el ruido manda a los vigías a mirar allí:
es la forma de cruzar un vano vigilado, o de apartar a alguien de una puerta.

* Trazo: máximo 15 celdas desde el jugador, puntos cada 0,26 con suavizado, Esc
  cancela. Se dibuja como línea discontinua ámbar con aspas en la punta.
* Vuelo: `window._lanzamientos` (polilínea + duración por longitud), con arco y
  sombra al dibujar. Al caer: ruido (radio 9), polvo, se espantan conejos y
  zorros, y si es piedra **se queda en el suelo** para recuperarla.
* Si le da a alguien: 2 de daño y reacción del NPC.
* El ruido es `hacerRuidoEnElMundo()` → `stealth.hacerRuido()`, que sube el
  medidor de los vigías que lo oigan y los gira hacia el punto.

## 7. Ruta trazada del perro (Kidu)

Con Kidu en **modo ataque** se puede dibujar su ruta y la sigue punto a punto
(hasta que llega al final). Sirve para mandarlo a rodear un puesto sin cruzarse
por delante. La ruta se guarda como celdas caminables y **no se guarda en la
partida** (es una orden puntual).

Orden de prioridad del trazo (mismo gesto para las dos cosas):

| Situación | Qué hace el trazo |
|---|---|
| Llevas algo lanzable | Lanzas (lo que llevas manda) |
| **Alt** pulsado | Ruta del perro (aunque lleves piedras) |
| Ni piedras ni perro en ataque | El trazo ni empieza (el clic es lo de siempre) |

---

## 8. Cómo probarlo sin jugar

```js
MESO_DEBUG.testDraw.sigilo.construir()      // levanta la zona
MESO_DEBUG.testDraw.sigilo.mision()         // arma la misión
MESO_DEBUG.testDraw.sigilo.estado()         // vigías, detección, alarma, cobertura
MESO_DEBUG.testDraw.sigilo.vigias()
MESO_DEBUG.testDraw.sigilo.ir()             // a la puerta de la zona
MESO_DEBUG.testDraw.sigilo.irA(c, r)        // a una celda concreta
MESO_DEBUG.testDraw.sigilo.ruido(x, y, 9, 1)
MESO_DEBUG.testDraw.sigilo.cobertura(x, y) · .salirDeCobertura()
MESO_DEBUG.testDraw.sigilo.buscarCobertura(x, y, r)
MESO_DEBUG.testDraw.sigilo.perroAtaque(true) · .ruta([{c,r},…]) · .ruta()
MESO_DEBUG.testDraw.sigilo.items.dar('stone', 3) · .equipar('stone') · .ver()
MESO_DEBUG.testDraw.sigilo.lanzar(dx, dy)   // vuelo y ruido, sin ratón
MESO_DEBUG.testDraw.vision.lista()          // quién tiene cono, hacia dónde mira y cuánto te ve
MESO_DEBUG.testDraw.vision.activar()        // enciende el modo U (2 s + cooldown)
MESO_DEBUG.testDraw.vision.estado()         // activa, restante, cooldown, tiempo y enemigos
MESO_DEBUG.testDraw.vision.forzar(20000)    // el efecto durante 20 s (saltarse el cooldown)
MESO_DEBUG.testDraw.vision.apagar() · .enemigoConVision(ent) · .campo(true/false)
window.MESO_SIGILO                          // el sistema entero
window._trazoDiag · window._mouseDiag       // por qué no arranca un trazo/clic
```

**Trampa del entorno de pruebas:** con la pestaña en segundo plano no corre
`requestAnimationFrame`, así que `stealth.actualizar` no se llama nunca y parece
que «no funciona». Se fuerza con `MESO_DEBUG.testDraw.perf.frame(1)` en bucle: cada
llamada ejecuta el cuerpo del fotograma una vez (incluido el bloque de tick).

**Trampa del orden de llamadas:** `player._agachado` se calcula en
`actualizarTrazo()` y la visión de los vigías lo consulta, así que
`actualizarTrazo()` **va antes** que `stealth.actualizar()` en el bucle. Con el
orden inverso el medidor iba un fotograma por detrás (y al soltar Ctrl parecía que
seguías en cobertura).

---

## 9. Comprobado en el navegador

* 4 vigías con rutas, 10-11 coberturas, cerco con dos vanos.
* El medidor se llena y la alarma salta con la cadena completa (aviso, todos al
  último punto visto, y golpes si te alcanzan).
* `Ctrl` deja agachado al personaje (y deja de estarlo al soltar); con una tapia
  al lado queda arrimado solo, y al soltar Ctrl sale de la cobertura.
* Trazo con el ratón: `pointerdown` → línea → `mouseup` → piedra consumida y
  proyectil creado; a los ~0,5 s impacta (ruido, polvo).
* Con Alt: ruta del perro (la piedra **no** se gasta) y el perro recorre los puntos
  hasta el final.
* Misión: ofrecida a mitad de conversación por un aldeano, aceptada desde la
  opción 1, y completada al llegar al botín sin que te vean.
* El haz se dibujaba (10.124 píxeles de diferencia, 8.040 más claros); **ya no
  se dibuja en partida** y sólo aparece como cono rojo en el modo `U`.
* Sólo los enemigos tienen cono: un guardia te detecta si te pones delante
  (`deteccion` llega a 1 y `ve: true`) y no te detecta detrás ni con una pared en
  medio (los 2 casos que fallaron fueron poniendo al jugador… dentro del muro).
* Un guardia de fuera de la zona completa el medidor → `_vigilandoAlJugadorHasta`
  a 12 s y **sin** `_hostile` (te vigila, no te ataca).
* Modo `U`: 92,7 % de píxeles grises, cono en rojo sobre el gris, 2 s de efecto,
  `_timeScale` 0,25 durante y de vuelta a 1 al acabar, y 10 s de cooldown con
  aviso.
