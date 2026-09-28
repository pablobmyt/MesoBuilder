# Modo Debug / Inspector visual — MesoBuilder

> Añadido: 2026-09-25
> Archivos: `engine/game-engine-debug-utils.js` (nuevo) + enganches en `engine/game-engine.js`

Sirve para **ver y ajustar el juego sin recompilar y sin editar JSON a ciegas**.
Nace de una necesidad concreta: es muy difícil colocar sprites (escalas, anclas,
desplazamientos) probando in-situ sin referencia visual.

---

## 1. Cómo entrar

| Vía | Cómo |
|---|---|
| Tecla | **F9** (activa / desactiva) |
| Botón | Barra superior → grupo **Dev** → `🔧 Debug (F9)` |
| URL | `http://localhost:4321/?debug=1` (arranca ya activo — requiere el servidor de desarrollo) |

Al activarse:

* se **pausa el mundo** (`window._timeScale = 0`) para que nada se mueva mientras ajustas;
* aparece un **canvas transparente** encima del juego con rejilla, cajas y etiquetas;
* aparece el **panel del inspector** arriba a la derecha.

Al salir (F9) se restaura la velocidad de tiempo que tuvieras.

---

## 2. Atajos

| Atajo | Acción |
|---|---|
| **Clic** | Selecciona lo que hay bajo el cursor (edificios primero) |
| **Arrastrar** | Mueve la selección en vivo |
| **Alt + Clic** | Cicla entre elementos solapados |
| **Flechas** | Ajuste fino: ±0,125 tile |
| **Shift + Flechas** | Mueve 1 casilla |
| `[` / `]` | Escala del sprite −/+ 0,05 |
| `,` / `.` | Offset vertical −/+ 0,01 (fracción de la altura) |
| `;` / `'` | Offset horizontal −/+ 0,01 |
| `G` | Rejilla / cajas de depuración |
| `P` | Pausar / reanudar el mundo |
| `H` | Centrar la cámara en la selección |
| `Supr` | Borrar la entidad seleccionada |
| `Ctrl+Z` | Deshacer el último movimiento |
| `Esc` | Quitar la selección |

---

## 3. Qué se puede ajustar

### 3.1 Por sprite (afecta a todas las copias)

Al seleccionar cualquier cosa con sprite (árbol, recurso, NPC, edificio, mobiliario
de interior, sprite de previsualización) el panel muestra **Ámbito: sprite (todas las
copias): `clave`**. Los cambios se aplican a **todas** las instancias de esa clave.

* `scale` — multiplicador de tamaño (0,1 – 4)
* `offsetX` / `offsetY` — desplazamiento en fracción del propio sprite (0,05 = 5 %)
* `alpha` — opacidad

Los offsets son **relativos al sprite**, no píxeles absolutos: por eso el ajuste
sigue siendo correcto al hacer zoom.

### 3.2 Por tipo de edificio

Selecciona un edificio → **Ámbito: tipo de edificio: `tipo`** → `scale`, `offsetX`,
`offsetY`. Ideal para corregir edificios que "flotan" o se salen de su huella.

### 3.3 Por entidad concreta

Si algo no tiene clave de sprite, el ajuste se guarda solo en esa entidad (`ent._dbg`).
El botón **Aplicar a todas las copias** traslada el ajuste de la instancia a la clave
de sprite compartida.

### 3.4 Colocar sprites de prueba

Sección **Colocar sprite**: escribe o elige una clave (`date_palm`, `tree3`, `house`…)
y pulsa **Colocar**. Después, cada clic en el mapa coloca ese sprite como entidad de
previsualización, que puedes mover y ajustar inmediatamente. Es la forma más rápida
de responder a "¿cómo se ve este sprite en el mundo, a este zoom?".

> Con el modo colocar activo, usa **Alt+Clic** para seleccionar/mover lo que ya existe.
> Vuelve a pulsar **Colocar** (botón "Colocando…") para desactivarlo.
>
> Si la clave no existe en `data/entity-pixels.json` se dibuja una **caja roja**:
> señal de que ese nombre de sprite no está registrado.

### 3.5 Mundo

* Botones de velocidad `0× / 0.5× / 1× / 2× / 4×` (equivale al widget de tiempo).
* **Traer jugador aquí**: teletransporta al jugador al punto del cursor.
* **Centrar sel.**: centra la cámara en la selección.

---

## 4. Guardar los ajustes

Los ajustes se guardan solos en `localStorage` (`meso.debug.overrides.v1`) mientras
trabajas. Para que formen parte del juego:

1. **Exportar JSON** → descarga `sprite-adjustments.json`.
2. Muévelo a `data/sprite-adjustments.json` del proyecto.

A partir de ahí el motor aplica los ajustes **siempre**, incluso sin modo debug
(se leen al arrancar por `__mesoPreload.spriteAdjustments` en Electron o por `fetch`
en navegador). Si el archivo no existe, no pasa nada.

Formato:

```json
{
  "version": 1,
  "sprites":   { "date_palm": { "scale": 1.1, "offsetX": 0, "offsetY": 0.04, "alpha": 1 } },
  "buildings": { "house_isolated": { "scale": 0.95, "offsetX": 0, "offsetY": 0.02 } }
}
```

**Importar JSON** permite recuperar un conjunto de ajustes exportado previamente
(útil para probar variantes). **Reset todo** deja todo por defecto.

> Nota: el ajuste se expresa como **multiplicador**, no como valor absoluto. Un
> `scale: 1.1` significa "10 % más grande que lo que pida el motor".

---

## 5. Detalles de implementación

* `drawEntitySpriteAt(names, …, { ent })` es el único punto por el que pasan todos los
  sprites del mundo. Ahí se aplican los ajustes (por sprite y por entidad) y, en modo
  debug, se **registra el rectángulo real dibujado** (`ent._dbgRect`) para que las cajas
  del overlay sean exactas y no una estimación.
* En modo debug se permite **escala fraccionaria** (`window._mesoDbgPrecise`), porque
  normalmente el motor cuantiza la escala a enteros (pixel-perfect). Así se pueden
  afinar tamaños intermedios mientras se prueba; al desactivar F9 vuelve al
  comportamiento pixel-perfect original.
* Los eventos de puntero se capturan en fase de captura sobre `window` y se cortan
  (`stopPropagation`) cuando el modo debug está activo, de modo que **no interfieren**
  con la construcción, el movimiento ni los clics del juego.
* Todo el módulo está envuelto en `try/catch`: un fallo del inspector nunca debe
  tumbar el juego.

---

## 6. Servidor de desarrollo

Para probar en un navegador sin Electron:

```bat
node scripts\dev-server.js
:: http://localhost:4321/          menú normal
:: http://localhost:4321/?debug=1  entra con el inspector activo
:: http://localhost:4321/?editor=1&debug=1  editor de mapas + inspector
```
