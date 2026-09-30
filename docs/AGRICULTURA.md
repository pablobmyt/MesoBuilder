# Agricultura y cultivos (trigo por fases)

> Añadido: 2026-09-30
> Código: `engine/plant-art.js` (arte), `engine/game-engine.js` (estado y dibujado),
> `tools/preview-plants.js` (vista ASCII).
> Relacionado: `docs/RENDIMIENTO.md` (coste de dibujar cientos de plantas),
> `docs/ARTE-ARBOLES-Y-ANIMALES.md` (mismo criterio de arte generado).

## 1. Cómo funciona ahora

1. **Labrar** con la azada de piedra (arrastrando) coloca una parcela
   (`farm_plot`, 1 celda) y **siembra** trigo en fase 0. Sigue costando 1 semilla
   por celda.
2. **Crecer**: al cerrar el día (`applyDailyProduction`) cada parcela avanza una
   fase. Tarda **2 días por fase** y **1 día** si la parcela está junto al agua
   (bonus de humedad). Cuatro fases:
   `brote` → `tallos` → `espigando` → `maduro`.
3. **Cosechar**: al **pisar** una parcela madura se recoge sola: **2 + 1 (agua) +
   1 (cada 3 días)** de trigo, a veces una semilla de vuelta, XP, texto flotante y
   aviso. La parcela **desaparece** (el terreno queda libre para volver a labrar).

Cuando hay trigo maduro, el juego avisa una sola vez
(`Trigo maduro en N parcela(s): pisa la parcela para cosechar`).

## 2. El arte (`engine/plant-art.js`)

Mismo espíritu que los árboles y los animales: el arte se **genera** con código en
vez de vivir suelto en el JSON, así que se retoca en un sitio y se revisa sin
abrir el juego:

```
node tools/preview-plants.js      # imprime las 4 fases en ASCII
```

* Cuatro fases: `wheat0..wheat3` (8x6, 9x9, 11x12 y 13x14 píxeles).
  Brote = dos briznas verdes (a propósito, parecido al sprite `weed` del que
  hablaba el encargo); maduro = espigas doradas con los tallos vencidos y algún
  grano caído en el suelo.
* `registerPlantSprites(libreria)` las mete en `ENTITY_PIXEL_LIBRARY` al cargar
  los sprites, así que las dibuja el camino normal del motor: **caché de bitmaps**
  y **balanceo por viento** (`sway`), igual que la vegetación.
* En pantalla la planta ocupa más celda según la fase (`escala = 0.62 + fase * 0.13`),
  que es lo que hace que se vea crecer.

## 3. Pruebas desde la consola

```js
const C = window.MESO_DEBUG.testDraw.crops;
C.sprites();       // ['wheat0','wheat1','wheat2','wheat3']
C.list();          // [{ at:'100,50', stage:1, nextAt:5, moist:false }, ...]
C.stageAt(100,50); C.name(3);            // 'Maduro'
C.plant(100,50); C.advance();            // avanzar a mano (normalmente lo hace el día)
C.harvest(100,50); C.harvestUnderPlayer();
```

Y para probar rápido el ciclo completo: labrar con
`window.MESO_DEBUG.testDraw.till(100,50,103,51)` y pulsar «Siguiente Turno» unas
cuantas veces (cada día es una fase).

## 4. Qué se puede mejorar todavía

* **Regar**: hoy la humedad sale de estar junto al río; un cubo con acción de
  regar sería el siguiente paso natural (la acción «Beber» ya comprueba el agua).
* **Rotación de cultivos** (cebada, lino) reutilizando `plant-art.js`: basta con
  añadir un generador por especie y una clave por parcela.
* **Herramientas**: la hoz (cosecha más trigo) y el azadón (labra 2x2).
