# El Observatorio

La cúpula desde la que se mira el cielo de Mesopotamia. No es un panel del HUD: es
una **vista** que sustituye al mundo, se apunta con el ratón y va contando lo que se
mira **de forma progresiva**, como si un escriba lo copiase en una tablilla.

Todo el sistema vive en `engine/observatory.js`. El motor sólo aporta el edificio, la
interacción (`E`), el apuntado con el ratón/teclado y el sitio donde dibujar.

## Cómo se usa

1. **Construir**: el botón *Observatorio* (al final del panel de construcción) o el
   editor de mapas. Cuesta 26 ladrillos y 8 de trigo, ocupa 3×3 y sólo existe en la
   época **Mesopotamia** (en la URSS el botón se oculta solo). El mundo, además, ya
   trae **uno** puesto (ver «El observatorio del mundo»).
2. **Entrar**: con `E` al lado de la cúpula. Aparece «Observar el cielo» en el aviso
   de interacción, igual que en las puertas.
3. **Apuntar** moviendo el cielo dentro del ocular:

| control | qué hace |
| --- | --- |
| arrastrar con el ratón | mover la bóveda celeste (con inercia) |
| `WASD` / flechas | lo mismo, con el teclado |
| rueda | acercar/alejar (más aumento = mira más estricta) |
| `E` | cerrar el anillo de la figura que se está mirando, o **terminar la lectura** ya |
| `R` | volver al reencuadre inicial |
| `Esc` | cerrar la cúpula |

Mientras está abierto, la interfaz del mundo se apaga entera (clase
`body.observatorio-abierto` en `styles.css`): en la cúpula no se construye, no se
tala y no se abre el mapa, así que el motor se queda con todas las teclas y el ratón.

## El observatorio del mundo: hay UNO (2026-10-07)

> Pedido: *«los observatorios no aparecen, tiene que haber 1 observatorio»*.

No había ninguno: hasta ahora la cúpula sólo existía si el jugador la construía a
mano, así que un mundo recién generado no tenía ninguna.

Ahora **todo mundo de Mesopotamia trae exactamente una**, levantada por el
generador junto a la **capital** (o al poblado de origen si el mapa no tuviera
capital). La coloca `asegurarObservatorioDelMundo()` (`engine/game-engine.js`), que
busca un hueco de 3×3 en anillos de 12, 15, 19, 25, 33 y 44 celdas alrededor del
centro del pueblo, y descarta cualquier sitio que pise un edificio o un río
(`canPlaceAt`), que sea agua o marisma, o que caiga **encima de una calzada** (que
no se plante la cúpula en medio de la avenida).

Dos detalles importantes:

- **Es idempotente**: antes de nada cuenta los observatorios del mundo
  (`contarObservatorios()`, que cuenta EDIFICIOS, no las 9 celdas de su huella) y,
  si ya hay uno, sale sin tocar nada. Si el jugador levanta otro con el botón, se
  respeta: la regla es «al menos uno del mundo», no «exactamente uno y punto».
- **También se repasa al CARGAR una partida**, con la época ya restaurada: el mapa
  no se regenera al cargar, así que una partida guardada antes de esto recibe su
  cúpula la primera vez que se abre. En la URSS no se levanta (el botón también se
  oculta: las tablillas están en un museo).

En el **minimapa y el mapa grande** (`M`) el observatorio se pinta en azul claro
(`#8FD0E8`) para poder encontrarlo de un vistazo, como el templo y el zigurat van en
crema.

Para probarlo sin jugar: `MESO_DEBUG.observatorio.construirAlLado()` levanta otro
al lado del jugador.

## Lo «progresivo»: qué pasa al apuntar a una constelación

1. Se ve el nombre moderno con `alineando… N %` y un **anillo** alrededor de la mira
   que se cierra solo mientras la figura siga centrada. Si se escapa, el anillo se
   abre. Al cerrarse queda **fijada**.
2. Se encienden sus estrellas una a una y sus **líneas se van dibujando**.
3. En la tablilla aparece primero el nombre **sumerio** (`MUL.MUL`, `GÍR.TAB`…),
   luego la traducción y el nombre de hoy.
4. El **relato se escribe letra a letra** (con el cursor del escriba parpadeando).
5. Los **datos de la tablilla** van cayendo de uno en uno.
6. Al terminar queda **registrada**: `UR.GU.LA · «El León»` pasa a `●` en el registro
   y la primera observación de cada figura da **+8 de experiencia**.

El registro estelar («REGISTRO · 3/9») se guarda en
`localStorage['meso.observatorio.estrellas']` y sobrevive a cerrar el juego. La
**carta estelar** de la esquina inferior izquierda sitúa la lente dentro del cielo y
marca con puntos dorados lo que ya está en las tablillas.

**De noche se lee mejor**: el juego tiene ciclo de día y noche, y con el sol fuera las
estrellas se lavan y la lectura avanza al 62 %. Es la única regla que depende del
reloj: nada queda bloqueado de día.

## Las nueve constelaciones

Son las de las tablillas **MUL.APIN**, con su nombre sumerio, su traducción y un
relato: Las Estrellas (Pléyades), El Toro del Cielo (Tauro), El Verdadero Pastor de
Anu (Orión), El Viejo (Perseo), El Cayado (Auriga), Los Grandes Gemelos (Géminis),
El León (Leo), El Surco (Virgo) y El Escorpión (Escorpio).

Están repartidas por un cielo de 4200 × 1150 (unidades de campo) a 340 unidades de
separación. Dos detalles que **no conviene romper** al añadir figuras:

- `CAMPO_ALTO` tiene que ser **igual o menor** que `VENTANA_BASE`. Si el cielo es más
  alto que la lente, el apuntado se recorta antes de llegar a los bordes y esas
  figuras **no se pueden centrar nunca** (el anillo no cierra): ya pasó con El León y
  El Surco.
- La coordenada `y` de las figuras debe caer dentro del tramo alcanzable. Con la vista
  sin acercar el apuntado vertical está clavado en el centro (575); al acercar se abre.

Para añadir una constelación basta con meter otra entrada en `CONSTELACIONES` con su
`patron` (puntos en ±90) y sus `enlaces` (pares de índices). El `patron` son datos: el
tamaño con el que se dibuja lo pone `ESCALA_FIGURA`.

## Ponerle los sprites en PNG

Igual que cualquier otro edificio. La clave es **`observatory`**:

1. Guarda el PNG en `data/sheets/` (por ejemplo `Observatorio.png`) y cárgalo en el
   editor de entidades (`npm run editor` →
   `http://localhost:4321/tools/Support/entity-sheet-editor.html`). En la lista de
   entidades ya aparece **`observatory`**, aunque no esté en `entity-pixels.json`.
2. Recorta `sup` (planta / TECHO) e `iso` (isométrica). Se guardan como
   `observatory_sup` y `observatory_iso` en `data/entity-views.json`.
3. Al arrancar, el motor prefiere esos recortes: el dibujo provisional que trae el
   juego (`registerObservatorySprite`) deja de usarse solo. No hay que tocar código.

Si algún día quieres que el observatorio no sea un caso aparte, mete su sprite base en
`data/entity-pixels.json` y borra `registerObservatorySprite`: el resto funciona igual.

## Desde la consola (pruebas y depuración)

El observatorio se cuelga de `window.MESO_DEBUG.observatorio`:

```js
MESO_DEBUG.observatorio.construirAlLado()      // levanta la cúpula junto al jugador
MESO_DEBUG.observatorio.abrir()
MESO_DEBUG.observatorio.lista()                // las 9 constelaciones y sus ids
MESO_DEBUG.observatorio.apuntarA('urgula')     // lleva la mira a una figura
MESO_DEBUG.observatorio.fijarAhora()           // fija la que esté bajo la mira
MESO_DEBUG.observatorio.revelarAhora()         // termina la lectura de golpe
MESO_DEBUG.observatorio.estado()               // alineación, revelado, registro…
MESO_DEBUG.observatorio.olvidarTodo()          // vacía el registro estelar
```

`estado()` devuelve, entre otras cosas, `objetivo` (la figura bajo la mira),
`alineacion` (0..1), `revelado` (0..1) y `descubiertas`.
