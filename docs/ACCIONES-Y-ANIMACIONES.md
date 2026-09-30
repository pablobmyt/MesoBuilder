# Acciones y animaciones del personaje

> Añadido: 2026-09-30
> Código: `engine/game-engine.js` (`PLAYER_GESTURES`, `characterAnimState`,
> `drawCharacterPixels`, `createPlayerActionsPanel`), `styles.css` (`#action-list-panel`).
> Relacionado: `docs/HUD-DINAMICO.md` (estado tranquilo del HUD), `docs/AGRICULTURA.md`.

## 1. Lista de acciones (panel flotante)

Se abre con **V** o con el botón flotante **🎭 Acciones** (abajo a la izquierda).
Tiene dos bloques:

* **Gestos** (gratis, con animación propia): coger del suelo, hablar, saludar,
  festejar, bailar, sentarse, pensar, acariciar, llamar al perro, comer, beber.
* **Acciones de turno**: las de siempre (Explorar, Recolectar, Construir,
  Comerciar, Ritual, Investigar) leídas de `ACTIONS`, para no tener dos listas.

**Configurable**: el botón ⚙ del panel entra en modo personalización, donde se
puede marcar/desmarcar cada gesto y reordenarlos con ▲▼. Todo se guarda en
`localStorage` (`meso.playerActions` → `{ order, hidden }`).

Cada gesto con efecto real lo comprueba antes de actuar y avisa si no se puede
(«No hay nada que coger aquí», «Kidu no está cerca»…). «Coger del suelo» y
«Hablar» reutilizan el sistema de interacción que ya existía (el mismo que la
tecla E) en vez de duplicar reglas.

## 2. Animación

`characterAnimState(ent, now)` traduce el estado del personaje a desplazamientos
de **píxel entero** (nada de rotar ni reescalar: eso emborrona el pixel art):

| Estado | Qué hace |
| --- | --- |
| Andar | ciclo de 4 pasos con rebote; en esprint rebota más y se inclina hacia delante |
| Quieto | respiración lenta (sube/baja 1 px cada ~1 s) |
| Nadar | la cabeza asoma y baja con la corriente |
| Golpe/tajo | brazos y tronco van y vienen ~0,3 s (`triggerCharacterSwing`) |
| Recibir daño | se aplasta 1 px mientras dura la sacudida |
| Gestos | `wave` (brazo arriba moviéndose), `cheer`, `dance` (balanceo + brazos alternos), `sit` (se agacha y las piernas hacia delante), `pick` / `pet` (se inclina), `eat` |

Las **bandas del cuerpo** (cabeza 0-8, torso y brazos 9-15, sayo 16-20, piernas
21-23 de la rejilla 24×24) reaccionan distinto: las piernas quedan clavadas en el
suelo y alternan, el sayo sigue a medias, el torso se inclina y los brazos se
levantan al saludar. Las posturas se marcan con
`player._pose = { name, until, ms, side }` (o desde consola:
`MESO_DEBUG.testDraw.pose('dance', 3000)`).

Los **animales** ya usaban este mismo criterio en `engine/animal-art.js`:
`idle · walk · run · hurt · dead`, patas alternas, rabo y orejas, con un lienzo
por (animal, estado, fotograma) para que dibujar un bicho sea un `drawImage`.

## 3. Pruebas desde la consola

```js
window.MESO_DEBUG.testDraw.action('bailar');   // ejecuta un gesto
window.MESO_DEBUG.testDraw.pose('sit', 3000);  // pose directa
window.playerActions.gestures();               // lista visible (según config)
window.playerActions.toggle();                 // abre/cierra el panel
window.MESO_DEBUG.testDraw.animState(window.player);  // {bob, lean, swing, pose...}
```
