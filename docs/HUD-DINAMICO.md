# HUD dinámico y orden de capas

> Añadido: 2026-09-30
> Código: `engine/game-engine.js` (director del HUD, orden de dibujado),
> `styles.css` (§ «HUD DINÁMICO»).
> Docs relacionadas: `docs/HUD-MINIMALISTA.md`, `docs/RENDIMIENTO.md`.

## 1. La interfaz aparece cuando pasa algo

Antes había información fija en pantalla todo el rato (guía rápida, objetivo,
reloj, barras, minimapa, panel de debug). Ahora hay un **director del HUD** que
decide qué se enseña:

```js
despertarHud('objetivo', 9000);   // aparece 9 s y se retira solo
fijarHud('mapa', true);           // anclado (el jugador lo ha pedido)
hudOn('salud');                   // ¿toca pintarlo ahora?
```

* `HUD_DIR` guarda un tiempo global y otro por motivo (`objetivo`, `salud`,
  `aviso`, `guia`, `mapa`, `entrada`, `recursos`).
* La entrada del jugador (teclado, clic, rueda) despierta la interfaz 4,5 s con
  freno de 600 ms, así que «tocar el mando» la trae de vuelta al instante.
* Lo llaman `notify()`, `showInstruction()`, `setActiveObjective()` y el daño al
  jugador. Al empezar la partida se enseña 12-14 s.

### Qué se retira y qué no

| Bloque | Estado tranquilo |
| --- | --- |
| Guía rápida (`#game-guide`), ficha de objetivo, reloj/barras, minimapa, barra de habilidades, panel de construcción, panel de debug | se van (fundido) |
| Barra superior y barra de herramientas | se quedan, atenuadas al 42 % |
| Avisos (`#notif`) y caja de instrucciones | siguen su propio temporizador |

El estado tranquilo se aplica con **una sola clase** en `<body>` (`hud-idle`) que
pone el director desde el fotograma (con freno de 500 ms). El CSS hace los
fundidos de todos los paneles: no se toca ni un elemento por fotograma, y al
pasar el ratón por encima de un bloque retirado vuelve al instante.

Bloques que se retiran (ids): `#quest-hud`, `#story-objective-overlay`,
`#turn-info`, `#action-bar`, `#inventory-panel`, `#crafting-panel`, `#game-guide`,
`#meso-debug-panel`, `#panel`, `#task-panel`, `#ability-bar` y `#char-card`.

> **Trampa**: las reglas del estado tranquilo llevan `!important` porque varios
> paneles reciben su opacidad como **estilo en línea** desde el motor
> (`#quest-hud` → `style.opacity = '0.45'`, por ejemplo) y un estilo en línea
> gana a cualquier selector: sin `!important` el bloque se quedaba a la vista
> aunque el `<body>` tuviese `hud-idle`. Las reglas de `:hover` que lo recuperan
> también lo llevan.

En el lienzo, los bloques caros (reloj/barras con `shadowBlur`, ficha de
objetivo, guía, minimapa) además **dejan de dibujarse**, que es lo que se nota en
los FPS: de 2-11 ms a ~1,5 ms de sección HUD.

## 2. Orden de capas (profundidad)

Síntomas que había: árboles y murallas «con la capa confundida», cosas que los
atravesaban y sprites que parpadeaban (cambiaban de capa) al andar.

1. **Las entidades se ordenaban por `x+y`** (que es la proyección isométrica)
   también en vista de arriba: dos bichos en la misma diagonal se tapaban al
   revés. Ahora la clave es la **fila** en vista de arriba (`col+row` en
   isométrica) con desempate por `x` y por `id` (orden estable).
2. **El jugador se dibuja en su turno** dentro de esa misma lista: se inserta
   cuando aparece la primera entidad que va por delante de él (y en el mismo
   punto dentro de conejos y zorros). Antes se pintaba siempre al final, así que
   nada podía pasarle por delante.
3. **Una sola cola de profundidad** para lo diferido (edificios y árboles que van
   delante del jugador) ordenada por **fila de la base (entera)**, con desempate
   fijo (edificio antes que árbol, luego por posición). Antes eran dos listas
   seguidas y el criterio comparaba **decimales** de la posición del jugador: un
   árbol junto a él cambiaba de capa cada pocos fotogramas → parpadeo.

## 3. Cómo comprobarlo

```js
// ¿Está la interfaz despierta? ¿Y el estado tranquilo?
window.hudOn(null), document.body.classList.contains('hud-idle');
window.despertarHud('prueba', 5000);   // forzar que se enseñe 5 s
window.HUD_DIR;                        // tiempos por motivo

// Desglose de tiempos por sección del fotograma (árboles, entidades, HUD…)
window._perfSections = true;
window.MESO_DEBUG.testDraw.perf.frame(60);
window.MESO_DEBUG.testDraw.perf.sections();
window._perfSections = false;
```
