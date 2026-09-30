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

## Cómo comprobarlo

1. `node scripts/dev-server.js` → `http://localhost:4321/?debug=1` → Nueva partida.
2. Arriba a la derecha debe verse la pastilla con el reloj y tres barras finas
   (con F9 cerrado, para que el inspector de debug no la tape).
3. Abajo al centro, el hotbar en píldora; abajo a la izquierda, `GUÍA RÁPIDA`.
4. Para verificar por píxeles (sin depender de la vista):
   `ctx.getImageData(W-192, 14, 178, 75)` debe contener píxeles verdes, ámbar y
   azules de las tres barras.
