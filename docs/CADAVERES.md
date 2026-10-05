# Cadáveres: descomposición y esqueletos

> Pedido: *«cuando se muere alguien, debe aparecer un cuerpo descomponiéndose poco
> a poco quedando al final un esqueleto; si el asesinato es dentro de una
> estructura, tiene que aparecer la tumba que ya aparece»*.
> Hecho el 2026-10-05.

## 1. Las cuatro etapas

Un cuerpo no desaparece: se **descompone**. Desde el instante de la muerte
(`_deadAt`) y en tiempo real:

| Etapa | Cuándo | Qué se ve |
|---|---|---|
| **0 · Fresco** | 0-8 s | El cuerpo como estaba (tumbado, con su charco). |
| **1 · Descomponiéndose** | 8-22 s | Se apaga a verde-gris (`paletaPodrida`) y salen **moscas** (2-3 puntos que revolotean). |
| **2 · Huesos y jirones** | 22-34 s | Los **huesos asoman** bajo la carne, que pasa al 42 % de opacidad; quedan jirones de ropa. |
| **3 · Esqueleto** | 34-40 s | Sólo huesos: la carne ya no se dibuja. |
| **Esqueleto fijo** | a los 40 s | El cuerpo se **convierte** en una entidad inerte que se queda ahí para siempre. |

Los tiempos están en `ETAPAS` (`engine/corpse-art.js`) y el total es
`DESCOMPOSICION_MS = 40000`, que es lo que usa el motor como
`CORPSE_LINGER_MS` (antes 5,5 s: el cuerpo se borraba de golpe y aparecía una
tumba).

### El esqueleto es LA FIGURA del muerto (2026-10-05)

> Pedido: *«el esqueleto cuando muere alguien tiene que tener la misma forma que
> el personaje y tiene que estar en la misma posición (tumbado)»*.

Antes los huesos eran un sprite genérico (una calavera con costillar), dibujado
en horizontal y **sin relación con el cuerpo**: el esqueleto no se parecía al
muerto y quedaba un poco desplazado respecto al cadáver.

Ahora el esqueleto es **el mismo muñeco** del personaje, pintado con la **paleta
de huesos** y **en la misma postura** que el cadáver (tumbado y girado igual,
`rotate(-π/2.2)`), así que conserva su forma —cabeza, brazos, piernas y la ropa
que llevaba— y cae **exactamente donde estaba el cuerpo**:

```js
// engine/corpse-art.js — `huesos()`
ctx.translate(cx, cy);
ctx.rotate(-Math.PI / 2.2);
D.drawCharacterPixels(ctx, paletaHuesos(palette),
  Math.floor(-w * 0.5), Math.floor(-h * 0.65), escala, { dir: 'right', frame: 0 });
```

La paleta (`paletaHuesos`) traduce los cuatro tonos del personaje a hueso: piel →
hueso claro (`#EDE6D2`), pelo → hueso oscuro (contorno y cuencas), ropa → hueso
medio y remates → hueso en sombra **tintado con la ropa que llevaba**, para que
dos esqueletos no salgan calcados.

Que el paso de cadáver a esqueleto **no mueva nada de sitio** está garantizado
porque la posición sale de una única cuenta, `geometriaDeCuerpoCaido(x, y,
tileSize)` en `game-engine.js`, que usan las dos: el bucle de entidades (cadáver)
y el bucle de esqueletos. El esqueleto guarda además **la paleta del muerto**
(`palette` y `figura` en la entidad `kind: 'skeleton'`), que se salva con la
partida.

El sprite `esqueleto_humano` NO se borra: sigue siendo el respaldo de los
esqueletos de **partidas antiguas** (guardados sin paleta) y el de los **bichos**
(`figura: false`): los conejos y los zorros siguen dejando su montón de huesos
(`esqueleto_animal`). Los dos se registran en la librería de sprites igual que
los cultivos (`registerCorpseSprites()`), así que se pintan con la tubería normal
del motor y salen en el editor de entidades.

## 2. Dentro de una estructura: la tumba

Si el cuerpo cae **dentro de una estructura** no hay descomposición: se levanta la
**tumba** de siempre (`createGrave`, con su epitaﬁo). Se considera «dentro» si:

* el jugador está en un interior (`window.currentInterior`),
* la entidad estaba oculta por estar dentro de una casa (`col`/`row` = -999), o
* la celda del cuerpo es de un **edificio habitable** (casa, cabaña, villa…, vía
  `isShelterBuildingType`/`interiorIdForBuilding`).

La decisión se toma **al morir** y se guarda en `_murioEnInterior`, para que el
cuerpo no cambie de idea si el jugador entra o sale de una casa mientras se
descompone.

El jugador no muere del todo (se reincorpora a los 4,5 s): sólo deja tumba si
cayó dentro de una estructura. Al raso no queda nada suyo.

### La lápida es un sprite: `tumba`

Los píxeles de la lápida estaban **a mano dentro del bucle de dibujo**
(`render()`), así que la tumba no existía en la librería del motor: no salía en el
editor de entidades y no se le podía asignar una hoja. Ahora vive en
`engine/grave-art.js` (`TUMBA_DEF`, clave **`tumba`**, 16×16, 90 píxeles: 44 de
borde negro y 46 de relleno gris) y se registra al arrancar junto a los
esqueletos y los cultivos (`registerGraveSprites()` → `registerGraveSprite()`),
así que se dibuja con la tubería normal:

```js
drawEntitySpriteAt('tumba', gx + tileSize * 0.5, gy + tileSize * 1.02,
                   tileSize * 1.15, tileSize * 1.15, { ignoreEntityScale: true });
```

El dibujo es **idéntico** al de antes (los mismos 90 píxeles, con el mismo tamaño
en pantalla: `floor(1.15 · ladoDelTile / 16)` = `floor(ladoDelTile / 14)`, el pie a
la misma altura, centrada en su casilla). La única diferencia es la sombra suave
que llevan todos los sprites del mundo. Y si en el editor le recortas una lápida
propia, el juego usa la tuya.

## 3. Dónde está cada cosa

| Función | Fichero | Qué hace |
|---|---|---|
| `markEntityDowned` | `game-engine.js` | Marca el cadáver: `_deadAt`, `_deadUntil`, `_murioEnInterior`, suelta el botín. |
| `cleanupExpiredCorpses` | `game-engine.js` | Al acabar: **tumba** (si fue dentro) o **esqueleto** (`convertirEnEsqueleto`). |
| `convertirEnEsqueleto` | `game-engine.js` | Sustituye el cuerpo por una entidad `kind: 'skeleton'` (sin IA, sin colisión, sin botín). |
| `createGrave` | `entities.js` | La tumba de siempre (array `graves`). |
| `TUMBA_DEF`, `registerGraveSprite` | `grave-art.js` | El sprite de la lápida (clave `tumba`). |
| `etapaDeCadaver`, `dibujarHumanoide`, `dibujarAnimal`, `dibujarEsqueletoFijo`, `paletaHuesos` | `corpse-art.js` | Las etapas y todo el dibujo. |
| `geometriaDeCuerpoCaido` | `game-engine.js` | Dónde va un cuerpo tumbado: la usan el cadáver y el esqueleto fijo, así que no salta de sitio. |

Los esqueletos viven en `entities` como `kind: 'skeleton'` (se guardan con la
partida, se desplazan con el mundo que crece y no bloquean el paso). El cadáver
que se está descomponiendo **sigue siendo la entidad original** (NPC, conejo,
zorro o enemigo), marcada con `_deadUntil`, y todos los bucles ya saltan las
entidades caídas (`isDownedEntity`). OJO: `tickEntities` (entities.js) no lo
miraba y el cadáver se iba a pasear; ahora también lo salta.

## 4. Saquear un cadáver (y contagiarse)

Pedido: *«se puedan saquear los cadáveres… y si el cadáver está en un momento de
putrefacción, deberíamos contagiarnos de algo y perder vida estando infectado»*.

Un cuerpo **no suelta cosas al suelo**: guarda el botín **encima** y hay que
**registrarlo** con `E` (como se habla con alguien). El botín se decide **al
morir** (`generarBotinDeCadaver`, dentro de `markEntityDowned`) y no al abrirlo:
si se generase al abrir, guardar, cargar y volver a abrir daría otra cosa.

* **Quién guarda qué** (`TABLAS_BOTIN_CADAVER`, por perfil de `npcType`):
  * *armado* (guardias, soldados, milicias): munición, comida, agua, a veces palo,
    raro una Makárov o una espada de piedra;
  * *oficial* (comisarios, oficiales, comandantes): más munición, más opciones de
    pistola, adobe;
  * *bandido* (bandidos, matones, mercenarios, cazadores): munición, espada de
    piedra, comida, agua, piedra;
  * *campesino* (agricultores, pastores, esclavos, obreros): comida, agua,
    semillas, madera, adobe;
  * *común* (el resto): comida, agua, palo, madera, piedra.
  Cada línea tiene probabilidad y cantidad (`n: [min,max]`), y si un cuerpo no
  saca nada se le pone al menos 1 de comida (registrar un cuerpo y que no haya
  NADA nunca es una estafa).
* **Los bichos no guardan nada**: su recompensa ya cae al suelo con
  `dropCreatureLoot`, así que sus cuerpos no ofrecen «Saquear» (no se puede
  saquear dos veces lo mismo).
* El aviso de acción dice el estado del cuerpo: **«Saquear»** o
  **«Saquear (¡putrefacto!)»**, y **«Cuerpo ya registrado»** si ya lo abriste. Un
  cadáver **no** dice «Hablar» (antes sí: entraba por la rama de NPC vivos).
* Al saquear, un solo aviso con el resumen («Saqueas el cuerpo: 4 munición, 1
  comida»), no uno por objeto.
* Un cadáver tumbado **no te ve** y no cuenta para el escaneo de interacción más
  allá de los 1,45 tiles (hay que ponerse al lado, no vale tirarlo desde lejos).

### Infección

Según la etapa en que esté el cuerpo al hurgar en él
(`RIESGO_INFECCION_POR_ETAPA`):

| Etapa | Riesgo |
|---|---|
| 0 · Fresco | 0 % |
| 1 · Descomponiéndose | **65 %** |
| 2 · Huesos y jirones | 25 % |
| 3 · Esqueleto | 0 % |

* `infectarJugador()` guarda `char._infeccion = { desde, hasta, motivo, avisoAt }`:
  **45 s** perdiendo **0,55 de vida por segundo** (~25 de vida si no haces nada),
  con un aviso cada 9 s y otro al contagiarte. Si te pillan dos veces, la
  infección **se agrava** (no se reinicia a lo tonto).
* Mientras dura, la **regeneración pasiva no la tapa** (`char._lastHitTime` se
  refresca) y si la vida llega a 0 se cae con «La infección ha podido contigo».
* Se cura de tres maneras: con la habilidad **Curar** (tecla 3, que además
  limpia la infección al usarla), esperando a que pase el tiempo (avisa de que
  remite solo) o con `testDraw.infeccion.curar()`.
* El **HUD de supervivencia** gana una **cuarta fila** mientras estás infectado:
  icono `infeccion` (gota con bicho), barra verde pútrida que se vacía con el
  tiempo y los segundos que quedan en lugar del porcentaje. Sin infección el HUD
  vuelve a sus tres filas (no crece «por si acaso»).

---

## 5. Cómo probarlo

```js
MESO_DEBUG.testDraw.cadaveres.etapas()            // las etapas y sus tiempos
MESO_DEBUG.testDraw.cadaveres.matarCerca(40)      // mata al NPC más próximo
MESO_DEBUG.testDraw.cadaveres.matarBicho(60)      // mata un conejo/zorro (siempre al raso)
MESO_DEBUG.testDraw.cadaveres.lista()             // cadáveres con su etapa y si fue dentro
MESO_DEBUG.testDraw.cadaveres.envejecer(30000)    // adelanta 30 s todos los cadáveres
MESO_DEBUG.testDraw.cadaveres.esqueletos()        // esqueletos que han quedado
MESO_DEBUG.testDraw.cadaveres.tumbas()            // cuántas tumbas hay
MESO_DEBUG.testDraw.cadaveres.borrarEsqueletos()  // limpiar
MESO_DEBUG.testDraw.cadaveres.duracion()          // CORPSE_LINGER_MS
MESO_DEBUG.testDraw.cadaveres.saquables()         // cuerpo a cuerpo: botín y si ya está registrado
MESO_DEBUG.testDraw.cadaveres.cercano(4)          // el cadáver saqueable más próximo
MESO_DEBUG.testDraw.cadaveres.saquear(4)          // registra el más próximo (devuelve el detalle)
MESO_DEBUG.testDraw.cadaveres.forzarContagio()    // te infecta sin depender del azar
MESO_DEBUG.testDraw.infeccion.estado()            // infectado, segundos, VIDA actual y máxima
MESO_DEBUG.testDraw.infeccion.infectar(60000)     // infección de 60 s
MESO_DEBUG.testDraw.infeccion.adelantar(30000)    // adelanta el reloj de la infección
MESO_DEBUG.testDraw.infeccion.curar()
window.MESO_CADAVERES                             // el módulo de arte
```

`envejecer(ms)` es la clave para no esperar 40 s por etapa; con 45000 el cadáver
pasa a esqueleto fijo en el fotograma siguiente.

**Trampa del entorno:** con la pestaña en segundo plano no corre rAF; hay que
forzar fotogramas con `MESO_DEBUG.testDraw.perf.frame(1)` en bucle. Y una captura
de pantalla puede traer OTRA aplicación: para comprobar el dibujo, medir píxeles
del lienzo (diferencia antes/después de `borrarEsqueletos`) es más fiable que la
captura.

## 6. Comprobado

* El NPC muere → cadáver en `fresco` y las etapas avanzan con el tiempo
  (`fresco → hinchado → huesos → esqueleto`).
* A los 40 s aparece una entidad `kind: 'skeleton'` en su posición y el cuerpo ya
  no está (`lista()` vacía).
* El esqueleto **se dibuja**: llamando al dibujo a mano salen ~700 píxeles de
  color hueso en el sitio exacto; en el fotograma real, la diferencia con y sin
  el esqueleto es de ~2.200 píxeles.
* Cada etapa pinta cosas distintas (medido en un fotograma limpio): 587 px el
  cuerpo fresco, 592 el hinchado (con moscas), 517 los huesos con jirones y 439
  el esqueleto (menos tinta que el cuerpo, como debe ser). El montón de huesos de
  un zorro son 254 px.
* Un NPC que muere sobre una celda de casa deja **tumba** (no esqueleto), que es
  la regla pedida para las muertes dentro de una estructura.
* Conejos y zorros usan el esqueleto de animal (no traen `kind`, así que la
  variante se pasa explícita al convertir; el tamaño decide en el resto de casos).
* **Saqueo:** un guardia muerto genera `makarov_ammo×4 + food×1`; al ponerse al
  lado el aviso de acción es `cadaver:Saquear` (o `Saquear (¡putrefacto!)`) y al
  pulsar `E` de verdad el inventario sube (4→9 de munición) y el aviso pasa a
  `Cuerpo ya registrado`; un segundo intento contesta «Ese cuerpo ya lo has
  registrado».
* **Infección:** con 60 s de infección la vida baja de 110 a ~84 en pocos
  segundos de juego y **deja de bajar** en cuanto se cura; una infección de 4 s
  remite sola; el HUD pasa de 461 a 843 píxeles verdes al aparecer la cuarta fila
  (una franja nueva en la zona de la barra) y vuelve a 461 al curarse.
