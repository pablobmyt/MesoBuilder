/* ═══════════════════════════════════════════════════════════════════════════
   TUMBAS — el sprite de la lápida, en la librería del motor

   La tumba se dibujaba con los píxeles METIDOS A MANO dentro del bucle de
   dibujo del motor (`if (grave) { … borderPixels … fillPixels … }`). Eso tenía
   dos consecuencias malas:

   · **No existía como sprite**: no estaba ni en `data/entity-pixels.json` ni
     registrada en la librería, así que en el editor de entidades (`npm run
     editor`) no aparecía por ningún lado y no había forma de recortarle un PNG.
   · El arte no se podía ver en la galería de sprites ni ajustar con el modo
     debug, y cada vista (orto/iso) pintaba lo mismo.

   Ahora la lápida es una clave más (`tumba`), registrada como los cultivos
   (`registerPlantSprites`) o los esqueletos (`corpseArt.registrarSprites`): si
   le asignas una hoja en el editor, manda tu arte; si no, se pinta esto.

   OJO: los píxeles son EXACTAMENTE los que ya se veían en el juego (cruz con
   borde negro y relleno gris). Este módulo no cambia el aspecto, sólo le da
   nombre, sitio en la librería y entrada en el editor.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CLAVE_TUMBA = 'tumba';

// Rejilla de 16×16, como estaba en el motor: borde negro + relleno gris.
const BORDE = [
  [2, 14], [13, 14], [2, 13], [13, 13], [2, 12], [13, 12], [2, 11], [13, 11], [2, 10], [13, 10], [2, 9], [13, 9], [2, 8], [13, 8],
  [3, 8], [12, 8], [3, 7], [12, 7], [3, 6], [12, 6], [3, 5], [12, 5], [4, 5], [11, 5], [4, 4], [11, 4], [5, 4], [10, 4],
  [5, 3], [10, 3], [6, 3], [9, 3], [7, 3], [8, 3], [3, 14], [12, 14], [4, 14], [11, 14], [5, 14], [10, 14], [6, 14], [9, 14], [7, 14], [8, 14]
];
const RELLENO = [
  [7, 10], [8, 10], [6, 10], [7, 11], [7, 9], [9, 10], [8, 11], [8, 9], [5, 10], [6, 11], [6, 9],
  [7, 12], [7, 8], [10, 10], [9, 11], [9, 9], [8, 12], [8, 8], [4, 10], [5, 11], [5, 9], [6, 12], [6, 8],
  [7, 13], [7, 7], [11, 10], [10, 11], [10, 9], [9, 12], [9, 8], [3, 11], [3, 9], [4, 12], [4, 8], [5, 13], [5, 7],
  [8, 13], [8, 7], [11, 11], [11, 9], [12, 10], [3, 10], [4, 11], [4, 9], [3, 12], [3, 8]
];

function aPixeles() {
  const out = [];
  for (const [x, y] of BORDE) out.push([x, y, '#000000']);
  for (const [x, y] of RELLENO) out.push([x, y, '#808080']);
  return out;
}

// Definición en el formato de `ENTITY_PIXEL_LIBRARY` (el mismo que usan los
// cultivos y los esqueletos: `grid`, `gridW`, `gridH` y `pixels`).
export const TUMBA_DEF = { grid: 16, gridW: 16, gridH: 16, pixels: aPixeles(), tumba: true };

export function registerGraveSprite(library) {
  try {
    const lib = library || (typeof window !== 'undefined' ? window.ENTITY_PIXEL_LIBRARY : null);
    if (!lib) return null;
    // Si ya hay algo con esa clave (una prueba, otro arte), se respeta.
    if (!lib[CLAVE_TUMBA]) lib[CLAVE_TUMBA] = { ...TUMBA_DEF, pixels: TUMBA_DEF.pixels.map(p => p.slice()) };
    return CLAVE_TUMBA;
  } catch (e) { return null; }
}

export default { CLAVE_TUMBA, TUMBA_DEF, registerGraveSprite };
