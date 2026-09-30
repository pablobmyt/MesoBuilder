# Estructuras (conjuntos de edificios) — MesoBuilder

> Añadido: 2026-09-25
> Módulo: `engine/game-engine-structures.js` · Datos: `data/structures.json` (opcional)
> Editor visual: panel del **modo debug (F9) → sección «Estructuras»**

## 1. Por qué existe

Antes, un ziggurat, un templo o un mercado podían aparecer sueltos o "como
cayera": cada edificio se colocaba por su cuenta y el resultado era un conjunto
sin forma reconocible. Ahora los edificios singulares se levantan **como
conjuntos plantilla**: una forma preparada, con sus calles, su plaza y su
decoración, que se replica igual (o girada/espejada) en cualquier parte del mapa.

El núcleo cívico del **capital** también sale de una plantilla (`zigurat_complejo`),
y si por falta de sitio no cupiera, el motor cae al trazado clásico de respaldo.

## 2. Cómo se describe un conjunto

```json
{
  "version": 1,
  "structures": {
    "zigurat_complejo": {
      "name": "Complejo del Zigurat",
      "epochs": ["mesopotamia"],      // "*" = todas; en URSS se traducen los tipos
      "weight": 3,                    // peso relativo al repartir por el mapa
      "maxPerMap": 1,                 // cuántos puede haber
      "minSpacing": 28,               // separación mínima con villas/otros conjuntos
      "biomes": ["alluvial", "steppe"],        // biomas admitidos bajo el ancla
      "nearRiver": [3, 22],           // [min,max] distancia al agua (opcional)
      "allowWater": false,            // true para embarcaderos
      "roadToNearest": true,          // carretera de acceso a la villa más cercana
      "anchor": "center",             // center | topleft
      "pieces": [
        { "type": "ziggurat", "dc": 0, "dr": 0, "required": true },
        { "type": "temple",   "dc": -1, "dr": -9 },
        { "type": "market",   "dc": 9, "dr": 5, "chance": 0.85 }
      ],
      "terrain":  [ { "terrain": "road", "dc": -1, "dr": 6 } ],
      "entities": [ { "kind": "ambient", "subtype": "date_palm", "dc": -7, "dr": -8 } ],
      "npcs":     [ { "npcType": "priestess", "name": "Sacerdotisa", "dc": -1, "dr": -6 } ]
    }
  }
}
```

### Campos de una pieza

| Campo | Significado |
|---|---|
| `type` | Tipo de edificio (`ziggurat`, `temple`, `market`, `soviet_block`, `checkpoint_gate`…) |
| `dc` / `dr` | Desplazamiento en casillas respecto al ancla (`anchor: center` → la pieza se centra; `topleft` → esquina) |
| `chance` | 0..1 — probabilidad de aparecer (da variación entre copias) |
| `required` | Si no se puede colocar, se descarta el conjunto entero |

### Otros campos útiles

* `terrain`: pinta bioma (`road`, `concrete_road`, `canal_road`, `alluvial`…). En URSS `road` se convierte en `concrete_road` automáticamente.
* `entities`: decoración (`ambient`) o vegetación/recursos (`tree`, `resource`) con `subtype` = clave de sprite.
* `npcs`: habitantes del conjunto (`npcType`, `name`).
* `transform` (al colocar, no en el JSON): `none`, `mirrorX`, `mirrorY`, `rot90`, `rot180`, `rot270`. El generador elige uno al azar, así el mismo conjunto aparece con orientaciones distintas sin dibujarlo cuatro veces.

Los tipos de edificio en **época URSS no hay que escribirlos**: el mapa de épocas
(`EPOCH_BUILDING_MAP`) traduce `temple → factory`, `ziggurat → steel_foundry`,
`market → state_warehouse`, `farm → collective_farm`, `mesopotamian_arch → checkpoint_gate`, etc.

## 3. Conjuntos incluidos de serie

| id | Época | Contenido |
|---|---|---|
| `nucleo_capital` | Todas | **Núcleo de una capital**: ziggurat + explanada + vía procesional + palmeras + sacerdotisa/escriba. Está dimensionado para el rectángulo reservado de 17×17 del planificador urbano, así que las manzanas se construyen justo alrededor (en URSS se traduce a complejo metalúrgico) |
| `zigurat_complejo` | Mesopotamia | Ziggurat + templo + puerta monumental + granero + mercado + baños + pozo + palmeras + sacerdotisa/escriba |
| `recinto_de_templo` | Mesopotamia | Templo + arco de entrada + casas + pozo + devota |
| `plaza_de_mercado` | Mesopotamia | Mercado + granero + pozo/fuente + cajas + mercader y campesino |
| `granja_compleja` | Mesopotamia | Granja + granero + casa + redil/alfarería + pozo + campesino |
| `embarcadero` | Todas | Muelle + granero + casa + mercado, junto al agua |
| `atalaya_frontera` | Todas | Atalaya + choza + redil + vigía |
| `bloque_vecinal` | URSS | Bloques + almacén + clínica + farolas + monumento + vecinos |
| `puesto_de_control` | URSS | Puerta de control + garitas + farola + cajas + centinelas |
| `granja_colectiva` | URSS | Granja colectiva + almacén + bloque + cultivo + brigadistas |
| `nucleo_industrial` | URSS | Complejo metalúrgico + fábrica + almacén + bloque + vigilante |

## 4. Cómo se reparten por el mapa
Durante la generación (`generateMap`, paso **8b**), el motor:

1. Ordena los conjuntos por peso.
2. Busca una posición válida: dentro del mapa, sin agua en la huella (salvo `allowWater`), sin construcciones, con el bioma adecuado, a la distancia pedida del agua y **a `minSpacing` de villas, del jugador y de otros conjuntos**.
3. Prueba hasta 320 posiciones por conjunto, hasta `maxPerMap` copias (con un tope global de 8, 7 en URSS).
4. Coloca las piezas, pinta caminos, añade decoración y NPCs, y por último **traza una carretera de acceso** hasta la villa más cercana si `roadToNearest` es true.
5. Registra el conjunto en `window._STRUCTURES` (persistido con la partida) para poder localizarlo, borrarlo o volver a él.

Lo que no quepa se registra como aviso en consola con el motivo dominante, por ejemplo:

```
[estructuras] sin sitio: embarcadero (límite alcanzado) · recinto_de_templo (demasiado cerca de villa Nínagara (×114))
```

## 5. Editor visual (F9 → «Estructuras»)

| Control | Para qué |
|---|---|
| **desplegable** | Catálogo válido para la época actual (`★` = creada por ti) |
| **Colocar aquí** | Levanta el conjunto en la casilla del cursor (limpia lo que hubiera debajo) |
| **Borrar aquí** | Deshace el conjunto que esté bajo el cursor (edificios, caminos y decoración) |
| **Generar en el mapa** | Reparte conjuntos por el mapa sin regenerar la partida |
| **Radio + Capturar zona** | Toma los edificios/caminos/decoración de alrededor y los convierte en una plantilla con offsets |
| **Guardar** | Añade el JSON de abajo al catálogo con el `id` indicado |
| **Exportar catálogo** | Descarga `structures.json` (guárdalo en `data/`) |
| **Importar** / **Recargar** / **Borrar def.** | Gestiona el catálogo |
| **Conjuntos colocados** | Lista con `→` (ir) y `×` (quitar) |

### Flujo recomendado para crear un conjunto nuevo

1. Activa **F9** y usa *Colocar sprite* / el editor de mapas para montar el
   conjunto a mano en un hueco libre (puedes mover cada edificio arrastrándolo).
2. Coloca el cursor en el **centro** del conjunto y pulsa **Capturar zona** con el
   radio adecuado (por defecto 14).
3. Ajusta el JSON: renombra, pon `epochs`, `weight`, `maxPerMap`, `minSpacing`,
   biomas, y marca con `"required": true` las piezas imprescindibles.
4. Ponle un `id`, pulsa **Guardar** y luego **Colocar aquí** para probarlo.
5. Cuando te guste, **Exportar catálogo** → guarda el archivo como
   `data/structures.json` y el conjunto pasará a formar parte del juego
   (el ejecutable lo lee por el preload; el navegador por `fetch`).

Las definiciones propias se guardan además en `localStorage` (`meso.structures`),
así que sobreviven a recargas aunque no exportes el archivo.

## 6. API para automatizar

```js
window.MESO_STRUCTURES.list()                        // catálogo de la época actual
window.MESO_STRUCTURES.listPlaced()                  // conjuntos colocados
window.MESO_STRUCTURES.validate('zigurat_complejo', 40, 60)
window.MESO_STRUCTURES.place('zigurat_complejo', 40, 60, { clear: true })
window.MESO_STRUCTURES.removeAt(40, 60)
window.MESO_STRUCTURES.capture(40, 60, { radius: 12 })   // → { draft, stats }
window.MESO_STRUCTURES.generatePass({ cap: 4 })
window.MESO_STRUCTURES.exportJSON() / importJSON(text) / addDef(id, def) / removeDef(id)
```

## 7. Relación con los presets de zona que ya existían

Los editores `tools/Support/zone-spawn-preset-editor.html` y
`zone-layout-visual-editor.html` guardan en `meso.zoneSpawnPresets` plantillas
**ligadas al tipo de villa** (`origin`, `capital`, `military_base`, `trading_post`),
con la misma idea de offsets (`dc`/`dr`). Se siguen aplicando dentro de
`spawnVillage` y son compatibles con este sistema:

* *Preset de zona* → sustituye el interior de una villa concreta.
* *Estructura* → añade conjuntos nuevos por todo el mapa.

Se pueden usar los dos a la vez.

---

## 8. Distribución urbana: que se pueda CAMINAR por los pueblos (2026-09-30)

Queja del usuario: «están muy apelotonados y no se puede caminar por esos sitios,
la sensación de inmersión no es igual de buena». Al medirlo aparecieron **dos
defectos reales**, no sólo una impresión:

### 8.1 Edificios solapados (el gordo)

`fillBlock` intentaba primero una pieza monumental que ocupa la manzana entera…
pero **no cortaba ahí**: seguía con el relleno por bandas y levantaba casas
**encima** del monumento. El auditor lo veía como huellas solapadas
(`granary` + `house_small` con la misma celda) y en pantalla eran sprites
apilados. Ahora ese ramo hace `return out;`.

Segundo solape: **dos asentamientos encima**. `spawnVillage` sólo miraba que el
ancla estuviera seca; con el jitter de posiciones dos pueblos podían caer
prácticamente en el mismo sitio. Ahora, en el bucle de anclajes, se puntúa cada
candidato y se prefiere el que **no pisa el rectángulo de otro pueblo ya
levantado** (`settlementOverlapsExisting`) y no tiene agua
(`settlementWaterFraction`).

### 8.2 Más aire entre edificios (parámetros de las plantillas)

| Parámetro | Antes | Ahora | Por qué |
|---|---|---|---|
| `street` | 1 celda | **3** (capital/base) · **2** (aldea/puesto) | con 1 celda, y los sprites dibujados un 25 % más grandes que su huella, las fachadas de enfrente se tocaban: parecía que no se podía pasar |
| `block` | 5×5 / 4×4 | **6×6 / 5×5** | manzanas algo mayores para que las construcciones no vayan adosadas |
| `blockGap` | 1-2 | 1 (capital 2) | separación entre edificios de la misma manzana |
| `setback` | — | 0 (soportado) | retranqueo opcional respecto a la calle |
| bandas | pegadas (`r += bandH`) | con `gap` vertical (`r += bandH + gap`) | dos casas de bandas contiguas quedaban adosadas por el techo |
| manzana monumental | 60 % | 35 % | deja más manzanas para viviendas |
| manzana cívica | 34 % | 25 % | idem |

Además, al agrandarse los planos las cuatro posiciones planificadas del
`spawnPlan` chocaban entre sí (el rechazo de solapes empujaba tres pueblos al
borde oeste): ahora van a las cuatro esquinas del mapa con un jitter del ±5 %.

La casa aislada del prólogo también se benefició: `findHomeSpotForPrologue`
busca claros hasta 70 celdas (antes 30) porque junto a una capital de 69×69 no
encontraba ninguno y la casa acababa **en el centro del pueblo, encima del
zigurat** (6 celdas solapadas, `ziggurat` + `house_isolated`).

### 8.3 Resultado medido (mapa nuevo, 5 asentamientos)

| | Antes | Ahora |
|---|---|---|
| Densidad del casco (capital) | 0.257 | **0.104** |
| Densidad (base militar) | 0.372 | **0.211** |
| Celdas transitables dentro del casco (capital) | 72 % | **88 %** |
| Callejones sin salida (capital) | 40 | **18** |
| Huellas solapadas en todo el mapa | 2-6 | **0** |
| Asentamientos | 4-5 apelotonados al oeste | 5 repartidos (capital centro-norte, base al sureste, puesto al noreste, aldeas al noroeste y sur) |

La capital queda así (una letra por celda, `·` = calzada, `W` = muralla):
manzanas de 6×6 con uno o dos edificios y **avenidas de 3 celdas** que cruzan de
lado a lado, con el ziggurat y su explanada en el núcleo.
