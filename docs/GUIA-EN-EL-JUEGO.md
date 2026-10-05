# Guía dentro del juego (todos los markdown, a un F1)

> Pedido del usuario: *«pon una guía con todos los markdown que hay para ver
> dentro del juego si alguien tiene alguna duda»*. Hecho el 2026-10-05.

## 1. Cómo se abre

| Cómo | Qué hace |
|---|---|
| **F1** | Abre y cierra la guía (también `Esc` para cerrarla) |
| Botón **Guía (F1)** del menú superior | Lo mismo, para quien no se sepa la tecla. El menú se despliega acercando el ratón al borde de arriba, con la pestaña **☰ MENÚ** o con **F10** |
| Guía rápida (**Enter**) | Su última línea avisa: «¿Tienes dudas de algo? Pulsa F1…» |
| Menú **Ventanas** | La guía queda registrada como panel, así que se puede ocultar y volver a enseñar desde ahí |

## 2. Qué se ve

Un panel de dos columnas:

* **Izquierda**: todos los documentos, agrupados y con buscador (filtra por
  título, por fichero y por la descripción).
  * **Cómo jugar** — `MANUAL.md` (el manual del jugador).
  * **Sistemas** — los `docs/*.md` de mecánicas (agricultura, caballo, sigilo,
    cadáveres, interiores, agricultura, ríos, HUD…).
  * **Desarrollo** — notas internas, auditorías, ideas y pendientes.
* **Derecha**: el documento, traducido de markdown a HTML.

El documento abierto se recuerda entre sesiones (`localStorage`), y los enlaces
**entre documentos funcionan**: `docs/OTRO.md` se abre en la misma ventana
(también si están escritos como `OTRO.md` desde dentro de `docs/`, que es lo que
hace el manual), `#un-ancla` salta al título correspondiente y las direcciones
`http(s)` van al navegador (en Electron, fuera del juego).

El buscador **filtra en vivo** y la ventana se cierra con `✕`, con `Esc` o con
`F1` otra vez. Está por encima del resto de paneles (z-index 4600, por encima del
botón **Editar** de 4400).

## 3. De dónde sale la lista

El juego no puede listar un directorio (ni por HTTP ni en Electron), así que la
lista se **materializa** en `docs/indice.json` con:

```bash
node tools/build-docs-index.mjs        # o: npm run docs-index
```

Recorre todos los `.md` de la raíz y de `docs/`, saca el título del primer `# `
de cada uno, la descripción del primer párrafo en prosa, cuenta las líneas y los
clasifica en los tres grupos. **Si añades un documento, vuelve a ejecutarlo**; si
el índice no existe, la guía avisa de cómo generarlo y enseña una lista mínima
(`MANUAL.md`) para que no se quede en blanco.

## 4. Cómo está montado

| Fichero | Qué hace |
|---|---|
| `engine/markdown.js` | Traductor markdown → HTML, sin dependencias: títulos, párrafos, negrita/cursiva, `código`, bloques con lenguaje, listas (anidadas por sangría), casillas `- [ ]`, tablas con separador, citas, reglas, enlaces e imágenes. **Todo se escapa**: un `<div>` dentro de un bloque de código se VE, no se ejecuta |
| `engine/guia.js` | El panel: lista + buscador + contenido, caché de documentos, enlaces internos, anclas y estado para las pruebas |
| `tools/build-docs-index.mjs` | Genera `docs/indice.json` |
| `game-engine.js` | Le presta a la guía el estilo/registro de paneles y `leerTextoDelProyecto()` (que en Electron usa `meso-local://`, como el resto de ficheros del proyecto), más la tecla F1, `Esc` y el botón del menú |

El buscador **no deja pasar las teclas al juego** (`stopPropagation` en el
`input`): si no, escribir «inventario» abriría media docena de paneles detrás.

## 5. Comprobado

* Los **36 documentos** del proyecto se traducen sin un solo error, sin HTML sin
escapar y sin marcadores internos sin resolver (comprobado fichero a fichero:
`<script`, `<div style` y `\u0000` no aparecen nunca).
* `MANUAL.md` (1.605 líneas) sale con 26 tablas, 104 listas, 9 bloques de código
y 19 enlaces; los docs con tablas (SIGILO, CADAVERES, RENDIMIENTO…) también.
* En el navegador: `F1` abre el panel con los 36 documentos en tres grupos, el
documento se pinta con sus tablas (cabecera + filas alternas), listas y códigos;
el buscador filtra; los enlaces cambian de documento (probado con
`docs/CADAVERES.md` escrito desde la raíz y con `SIGILO.md` escrito relativo);
las anclas del propio documento hacen scroll; `Esc` cierra; y el juego sigue
dibujando sin un solo error con la guía abierta.
* Escribir en el buscador **no dispara las teclas del juego** (probado con `i`,
`v` y `m`: no se abrió ningún panel detrás).

### Lo que se arregló de camino

* **Enlace con código dentro**: `[`docs/X.md`](docs/X.md)` (el patrón que usa el
  manual en «Documentación relacionada») salía como un `0` en vez del texto. El
  texto del enlace se formatea ahora antes de guardarlo y los marcadores internos
  del traductor se resuelven en varias pasadas, no en una.
* **Ruta de los enlaces**: un enlace escrito desde la raíz (`docs/X.md`) dentro de
  un documento que ya vive en `docs/` se resolvía como `docs/docs/X.md`. Ahora se
  prueban las dos lecturas y se queda con la que exista en la lista.
* **Teclas del buscador**: sin frenarlas, escribir «inventario» abría media docena
  de paneles detrás de la guía.
* **El botón Editar** (4400) quedaba por encima del panel: la guía sube a 4600.
