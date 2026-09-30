# Interfaz superior (tarjeta del título, barra de menú y botón de edición)

Notas de la corrección «arriba no deja hacer clic». Todo esto vive en
`engine/game-engine.js` (`createMenuBar`, `createEditModeButton`,
`positionEditModeButton`).

## Problema que había

- La barra de menú (`#top-menubar`) se abría en `top: 0`, **encima** de la tarjeta
  `#topbar` (★ MESOBUILDER ★, contadores, «Turno N», «Siguiente Turno ▶» y ✕).
  Con la barra abierta, los clics en esos botones los recibía la barra.
- El botón **✏️ Editar** estaba fijo en la esquina superior izquierda
  (`#btn-editmode` en `10,8`), justo encima de «Ver»/«📷» y dentro de la franja
  que revela la barra. Resultado: clics que no llegaban a los menús y una barra
  que aparecía «sola» al pasar por encima.

## Cómo funciona ahora

### Barra de menú

- `topBarVisibleTop()` devuelve el borde inferior de la tarjeta
  (`#topbar.getBoundingClientRect().bottom`, 34 px de reserva si no existe).
- `showTopBar()` coloca la barra en esa Y ⇒ **se abre justo debajo de la tarjeta**,
  nunca encima. `hideTopBarNow()` la manda a `-44px` con `opacity: 0` y
  `pointer-events: none`.
- Se revela al acercar el ratón al borde superior (`clientY <= 10`), al pasar por
  el asa `☰ MENÚ` o con `F10`; se oculta sola al bajar el ratón
  (`clientY > 120`), salvo si está fijada (📌) o hay un menú abierto.
- Los botones (Ver/Ventanas/Partida/Dev/Ajustes y 📌/▴) y el asa ☰ tienen zona
  de clic de 40×27 px y `padding: 6px 10px` para que se pulsen a la primera.
- Los desplegables (`.meso-menu`) siguen naciendo en `top: 34px` dentro de la
  barra, así que ahora aparecen a `tarjeta.bottom + 34`.

### Botón ✏️ Editar

- `positionEditModeButton(btn)` lo coloca en
  `left = topbar.left + 6`, `top = topbar.bottom + 8` (76 px con la tarjeta normal)
  ⇒ **queda debajo de la tarjeta de MesoBuilder**.
- Si la barra de menú está abierta, se aparta hacia abajo
  (`+ alto de la barra + 2`) para no quedar tapado por «Ver»/«📷». Para saberlo se
  miran los **estilos en línea** de la barra (`pointerEvents === 'auto' || opacity === '1'`),
  no `getComputedStyle`: al abrir, la opacidad calculada todavía vale 0 por la
  transición de 220 ms.
- Se recoloca con `window.resize`, con un `ResizeObserver` sobre `#topbar`, con un
  `MutationObserver` sobre el estilo de la barra, con un intervalo de seguridad de
  500 ms y con temporizadores `[200, 800, 2500, 6000]` ms (la tarjeta cambia de alto
  por avisos de misión / pantalla pequeña).
- Tiene `transition: top 200ms ease`, así que el desplazamiento se ve como un
  deslizamiento, no como un salto.

### ✕ «Cerrar Barra superior»

- Es un botón `.ui-close-btn` creado por `makeUiElementClosable()`: nace con
  `opacity: 0` y `pointer-events: none` y solo se activa con `mouseenter` sobre la
  tarjeta. Es intencionado (patrón «aparece al pasar el ratón»): si se inspecciona
  la página sin hover, `elementFromPoint` no lo devuelve.

## Cómo comprobarlo

1. `node scripts/dev-server.js` y abre `http://localhost:4321/?debug=1`.
2. Con el ratón en el borde superior: la barra debe quedar **debajo** de la tarjeta
   y «Ver» debe abrir su menú al primer clic.
3. Con la barra abierta, el botón ✏️ Editar se desliza debajo de ella y sigue
   pulsándose; al cerrarse la barra vuelve a 76 px.
4. En la consola del navegador, sin `hover` no cuenta: usa
   `document.elementFromPoint(x, y)` para confirmar quién recibe el clic.
