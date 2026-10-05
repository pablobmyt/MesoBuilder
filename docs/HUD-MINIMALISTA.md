# HUD minimalista y moderno

Antes el HUD era «bronce y madera»: bordes de 2 px, tipografía **monoespaciada**,
dorados saturados (`#C8A84B`, `#FFD27A`), cajas cuadradas (radio 4 px) y etiquetas
de texto dentro de las barras («♥ Vida», «✦ Hambre», «≋ Sed»). Esta capa lo cambia
por **vidrio translúcido, radios grandes, hairlines, tipografía de sistema y
acentos suaves**, sin tocar la lógica: sólo la piel.

## Dónde vive cada cosa

| Elemento | Dónde | Cómo se ha cambiado |
|---|---|---|
| Barra superior (título, recursos, turno) | `styles.css` §HUD MINIMALISTA | Franja fina con desenfoque, título 12,5 px sin brillo, recursos en píldoras, «Siguiente Turno» en píldora ámbar suave |
| Ficha de objetivo (misión/prólogo) | `styles.css` + panel DOM de `drawStoryObjectiveHUD` | Tarjeta de vidrio radio 14 px, filo `rgba(255,255,255,.075)`, chapa «PRÓLOGO/CASA» neutra en vez de marrón |
| HUD de misión (`#quest-hud`) | `styles.css` | Igual que la ficha, con una línea de acento de 2 px degradada; baja a `top: 100px` para no pisar el HUD de supervivencia |
| Barra de habilidades / hotbar | `styles.css` | Píldora de vidrio radio 20 px; casillas 54×54 radio 13 px, hover con elevación de 2 px, tecla en chip pequeño |
| Guía rápida (lienzo) | `drawCompactGuideOverlay` | Vidrio + hairline + tipografía de sistema; el título pasa a `GUÍA RÁPIDA` en versalitas |
| HUD de supervivencia (lienzo) | `drawSurvivalHud` | **Rediseñado**: pastilla de vidrio radio 12 px con sombra suave, reloj 12 px, tres barras de 4 px con icono a la izquierda y valor a la derecha |
| Etiquetas de nombre sobre los personajes (lienzo) | `dibujarEtiquetaMundo` | **Sin recuadro**: letra blanca en negrita con contorno negro, posiciones a píxel entero. La usan jugador, NPCs, perro, conejos, zorros y tumbas |
| Panel lateral y toolbar | `styles.css` | Vidrio, títulos en versalitas 9,5 px, botones en píldora |

## Las dos trampas del HUD del lienzo

1. **Se dibujaba antes que el terreno.** El bloque estaba justo después del cielo
   y la noche, y las teselas lo pintaban por encima: nunca se vio. Ahora es la
   función `drawSurvivalHud(ctx, W, H)`, que se **llama al final del fotograma**,
   junto a `drawMiniMap` y `drawStoryObjectiveHUD`.
2. **`window._hudVisible` sólo se activaba en el menú interno del motor**, que no
   se usa (el juego arranca con el menú externo de `index.html`). Ahora
   `postMapInit()` lo pone a `true`, así que el HUD aparece siempre.

## Detalles de estilo

- Tokens en `:root`: `--hud-glass`, `--hud-glass-strong`, `--hud-line`,
  `--hud-text`, `--hud-dim`, `--hud-accent`, `--hud-radius`, `--hud-shadow`.
- Tipografía: `system-ui, -apple-system, "Segoe UI", Inter, Roboto, sans-serif`.
- El HTML de la ficha de objetivo se genera con estilos **en línea** (versión
  antigua), así que sus reglas en `styles.css` van con `!important`.
- El HUD de supervivencia respeta el tema claro/oscuro del juego: sólo usa color
  en las barras (verde/ámbar/azul) y blanco con alfa para el resto.

## Etiquetas de nombre del mundo (2026-10-05)

Antes, el nombre de encima de cada personaje se dibujaba dentro de un **recuadro
negro translúcido** (`rgba(10,10,12,.66)`): tapaba el terreno y la propia cabeza
del personaje, y el rectángulo cantaba mucho en un mundo de píxeles.

Ahora el nombre va **sin fondo**: letra blanca con **contorno negro** que se lee
igual sobre arena clara que sobre hierba, piedra, agua o la noche. Está todo en
`dibujarEtiquetaMundo` (`engine/game-engine.js`), que es la única función que
pinta nombres en el mundo (jugador, NPCs, perro, conejos, zorros y tumbas):

- se fijan `textAlign`/`textBaseline` a mano (antes `fillText` heredaba el
alineado del HUD y el nombre salía desplazado respecto a su recuadro);
- fuente del sistema en **negrita** (700) y posiciones redondeadas a píxel
  entero, que es lo que hace que el texto se vea nítido;
- el contorno se traza **antes** y con `lineWidth` mayor que el relleno, así el
  borde queda por fuera de la letra y no se comen los huecos (la `a`, la `e`);
- se sigue partiendo en dos líneas como mucho y la etiqueta se recorta al ancho
  del lienzo, para que un nombre largo no se salga de la pantalla.

La caja oscura no se ha borrado del todo: sigue disponible con la opción
`{ fondo: '...' }` por si algún día hace falta, pero **ningún** nombre la usa.

Para mirarlo sin pelearse con la cámara, el modo debug expone
`MESO_DEBUG.testDraw.etiqueta('Adapa')`, que devuelve un lienzo con la etiqueta
pintada sobre un fondo tipo hierba.

## Cómo comprobarlo

1. `node scripts/dev-server.js` → `http://localhost:4321/?debug=1` → Nueva partida.
2. Arriba a la derecha debe verse la pastilla con el reloj y tres barras finas
   (con F9 cerrado, para que el inspector de debug no la tape).
3. Abajo al centro, el hotbar en píldora; abajo a la izquierda, `GUÍA RÁPIDA`.
4. Para verificar por píxeles (sin depender de la vista):
   `ctx.getImageData(W-192, 14, 178, 75)` debe contener píxeles verdes, ámbar y
   azules de las tres barras.
