# Diálogos con opciones y encargos sorpresa

Pedido del usuario (2026-10-05):

1. Que **en mitad de una conversación** con un NPC te asigne una misión **sin
   aviso** (ni marcador encima del vecino ni panel que salte antes de hablar),
   para dar sensación de inmersión y aleatoriedad.
2. Poder **elegir lo que dice el personaje**, con **dos o tres** respuestas.

Las dos cosas se apoyan en el sistema de opciones que ya tenía el panel de
diálogo del lienzo.

---

## 1. El modelo

Un diálogo es `window._activeDialogue`:

```js
{
  lines: ['…', '…'],     // lo que se va mostrando, línea a línea
  idx: 0,                // por dónde va
  npcName: 'Ciudadano',
  npcType: 'villager',
  npcRef: <entidad>,
  options: [{ num, text, action }],  // se eligen con 1/2/3
  choiceAt: 3,           // índice de `lines` en el que se ACTIVAN las opciones
  missionOffer: {…}      // (sólo si la conversación trae encargo)
}
```

**`choiceAt` es la pieza nueva clave.** Antes, en cuanto `options` existía, se
podía contestar desde la primera línea (y pulsar **E** cerraba el diálogo,
perdiendo la elección). Ahora:

- `opcionesDialogoActivas(dlg)` devuelve `false` hasta que `idx >= choiceAt`.
- `advanceDialogue()` **no avanza** mientras haya una decisión activa.
- El panel (`drawDialoguePanel`) y el atajo de teclado usan **la misma** función,
  así que lo que se ve y lo que se puede pulsar siempre coinciden.

---

## 2. Encargo sorpresa dentro de la conversación

`colarMisionEnDialogo(npc, dlg)` (desde `prepararConversacionConOpciones`):

- Sólo con NPCs «con encargo» (`isSideMissionEligibleNpc`, ~15 % por hash del id)
  y **nunca** con NPCs de guion.
- Ni si ya tiene una misión secundaria activa, ni si rechazó una hace menos de
  3 minutos, ni si le han contado un encargo en los últimos 8 minutos.
- **Aleatorio**: ~2 de cada 3 encuentros con alguien «con encargo».
- La charla empieza **normal** (el saludo de siempre) y a mitad cambia de tema:

  ```
  Los últimos meses han sido tranquilos. Demasiado, quizás.
  Guardia de Nínagara se acerca y baja la voz.
  «Oye… ya que estás aquí: Se me escapó la cabra y no la encuentro…»
  ¿Aceptas el encargo?          ← aquí salen las opciones
  ```

- Opciones (`opcionesDeMision`): **[1] Aceptar**, **[2] ¿Y qué gano?** (dice la
  recompensa y vuelve a ofrecer) y **[3] Ahora no puedo** (rechazo con calma de
  3 minutos). Aceptar mete la misión en `window._missions` y llama a
  `renderMissions()`, igual que hacía el panel antiguo.

### Se quitó el aviso previo

- `getNpcMissionMarkerType()` **ya no devuelve `'secondary'`**: no hay «!» dorado
  encima de los vecinos con encargo. Si lo hubiera, el mundo sería una lista de
  tareas y la sorpresa se perdería.
- Se eliminó la llamada a `maybeOfferSideMission(npc)` al abrir el diálogo: ese
  panel DOM (`#side-mission-offer`) saltaba **antes** de hablar. El código se
  conserva como respaldo manual, pero no es la vía normal.

---

## 3. Respuestas del jugador (2-3)

`adjuntarRespuestasAlDialogo(npc, dlg)` pone las opciones en la **última línea**
de una conversación normal (no de guion):

- `RESPUESTAS_POR_TIPO` (mercader, guardia, pescador, escriba) o, si no hay,
  `RESPUESTAS_POR_EPOCA` (Mesopotamia / URSS / medieval).
- `dlg.options[i].text` es **lo que dice el jugador**; al elegir,
  `decirDelJugadorYResponder()` cambia el encabezado a su nombre, muestra esa
  línea y deja `_respuestaPendiente`.
- Al avanzar, el NPC contesta a lo que se ha dicho (`_respuestaDeNpc` devuelve el
  nombre y el tipo) y la conversación se cierra. La elección **cambia el
  diálogo**, no es decorativa.

Los NPCs de guion y las cinemáticas **no** se tocan: su avance de capítulo
depende de terminar las líneas y añadirles opciones lo rompería.

---

## 4. Panel: las opciones ya no se cortan

El panel dibujaba cada opción en **una sola línea** a 12 px: una respuesta de más
de ~90 caracteres se salía por la derecha y se cortaba a media palabra. Ahora:

- Las opciones se **envuelven** a `panW - 46` (con sangría en las continuaciones).
- El panel **crece** con ellas (`120 + optLines*17 + 26`) y el texto del NPC se
  limita a la zona de arriba.
- El alto se **recorta al del lienzo** (`H - 20`) y `py` nunca baja de 10: en
  ventanas pequeñas el nombre del NPC ya no queda fuera de la pantalla.

---

## 5. Cómo probarlo sin depender del azar

```js
MESO_DEBUG.testDraw.dialogo.npcCerca(14)       // entidad NPC más próxima
MESO_DEBUG.testDraw.dialogo.abrirCerca()       // abre su diálogo
MESO_DEBUG.testDraw.dialogo.forzarMision()     // mete el encargo sorpresa
MESO_DEBUG.testDraw.dialogo.forzarRespuestas() // mete las 2-3 respuestas
MESO_DEBUG.testDraw.dialogo.estado()           // líneas, opciones, choiceAt…
MESO_DEBUG.testDraw.dialogo.avanzar() · .elegir(2)
MESO_DEBUG.testDraw.dialogo.rects()            // zonas clicables de las opciones
MESO_DEBUG.testDraw.dialogo.opcionEn(x, y)     // nº de opción bajo ese punto
```

Para que `rects()` devuelva algo hace falta que el panel **se haya dibujado**:
en una pestaña que no compone fotogramas hay que forzar uno antes
(`MESO_DEBUG.testDraw.perf.frame(1)`).

Y sin el objeto de depuración: `window.MESO_DIALOGO` (`activo`, `opcionesActivas`,
`colarMision(npc)`, `respuestas(npc)`).

Verificado en vivo (navegador, partida con 1.850 entidades): el encargo sale
tras el saludo y sólo en la pregunta se puede contestar; «¿Y qué gano?» muestra
la recompensa y vuelve a ofrecer; «Aceptar» añade la misión a `window._missions`;
en una conversación normal, elegir una respuesta pone el nombre del jugador en el
encabezado y el NPC contesta a lo elegido.

---

## Frases base por época (hecho el 2026-10-05)

`data/npc-dialogues.json` estaba escrito **entero para la URSS**: en una partida
 de Mesopotamia un aldeano decía «¿Has visto pasar los camiones de abastecimiento
por la ruta norte?» o un granjero «la tierra negra de Novozarya es bendición del
suelo».

Ahora cada tipo puede traer **`phrasesPorEpoca`**:

```json
"villager": {
  "phrases": [ "…los de la URSS, respaldo…" ],
  "phrasesPorEpoca": {
    "mesopotamia": [ "El barro del río da casas y da cebada…" ],
    "medieval":   [ "Los caminos están revueltos…" ]
  }
}
```

Y el motor elige con `frasesDeNpc(tipo, época)` / `fraseAleatoriaDeNpc(tipo, época)`
(expuestas en `window` porque `entities.js`, otro módulo, también hace hablar a los
caminantes): si la época no tiene juego propio se usa `phrases`, así **ningún tipo
se queda sin hablar**. Escriben por ahí: los bocadillos de los NPC que pasean, el
auto-discurso, la frase al hablar de lejos y la conversación completa.

Los 12 tipos (villager, farmer, shepherd, merchant, guard, elder, scribe,
priestess, storyteller, survivor, oficial_estraperlo, fisher) tienen juego de
**mesopotamia** y **medieval** (4-5 frases cada uno).

---

## Elegir con el ratón (hecho el 2026-10-05)

Las opciones se podían contestar con el teclado (1/2/3) pero el ratón no hacía
nada: el panel era «pintura» y el clic caía en los manejadores del mundo (se
disparaba el arma o se abría la lista de acciones).

Cómo queda:

- Al dibujar el panel se guardan las **zonas clicables**:
  `_opcionesDialogoRects = [{ num, x, y, w, h }]` (todo el ancho del panel, alto
  de la línea + un poco de aire). Se recalculan en cada fotograma, así que
  siguen bien si el panel cambia de tamaño o de posición.
- `opcionDialogoEn(px, py)` devuelve la opción (o `null`) para un punto **en
  coordenadas del lienzo**; se usa igual para el clic y para el resalte.
- El lienzo escucha `pointerdown` **en fase de captura** y, si el punto cae en
  una opción, hace `preventDefault()` + `stopPropagation()` y ejecuta su
  `action()`. En captura se adelanta a cualquier otro manejador del juego.
- El `click` llega **después**, como evento aparte, y se le escapaba: por eso al
  elegir se abría además la lista de acciones. Ahora `pointerdown` deja
  `_dialogoTragarClicHasta = now + 600 ms` y `clicConsumidoPorDialogo()` (que
  también devuelve `true` mientras haya opciones activas) corta los dos
  manejadores de `click` del lienzo: el del arma y el de «pulsar al jugador».
- `mousemove` (pasivo) pone `cursor: pointer` cuando se está encima de una
  opción, para que se vea que se puede pulsar.
- El pie del panel lo dice: *«Elige con el ratón o pulsa el número»*.

Probado en el navegador con clics reales (eventos `pointerdown`/`pointerup`/
`click` sobre el centro de la opción): la opción se ejecuta (contestación del NPC
o recompensa y reoferta del encargo) y **no** se abre el panel de acciones ni se
dispara el arma.

---

## La primera misión de sigilo pasa por aquí (2026-10-05)

La zona vigilada y su misión (ver `docs/SIGILO.md`) no tienen panel propio: la
ofrece **el primer vecino con el que se habla**, a mitad de conversación, con las
mismas tres opciones que cualquier encargo. En `colarMisionEnDialogo` va **antes**
de los encargos corrientes y se salta el reparto aleatorio de «quién puede dar
encargos»: es la puerta de entrada al sigilo, no un recado cualquiera. Al aceptar
(`opción 1`) la misión entra en `window._missions` con `sigilo: true` y eso es lo
que enciende la zona (vigías, botín y objetivo con sus pasos).

Los **vigías del recinto no reparten encargos** (`npc._vigia`): si les hablas
contestan su ronda, que es justo lo que se espera de ellos.

