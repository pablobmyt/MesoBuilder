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
