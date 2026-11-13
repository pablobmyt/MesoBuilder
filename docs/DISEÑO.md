# DISEÑO — MesoBuilder (colonia en tiempo real)

> **Decisión del 2026-10-13.** Se retira toda la narrativa (prólogo, actos, cinemáticas,
> NPCs de guion, misiones de historia) y el juego pasa a ser **una colonia en tiempo real
> en Mesopotamia**: construir, producir, crecer y defender. Las épocas soviética y
> medieval quedan congeladas.
>
> Este documento manda: si algo del juego no está aquí, está **congelado** o pendiente de
> decidir. Sustituye en la práctica a `docs/GUION-NARRATIVO.md` y `docs/IDEAS-Y-BOCETOS.md`
> (se conservan sólo como archivo de lo que hubo).

---

## 1. El juego en una frase

> *Funda una aldea junto al Éufrates, hazla crecer con tus manos y aguanta la crecida y
> los saqueos.*

Sin protagonista con nombre, sin profecía y sin diálogos que cuenten una historia: **el
mundo es el contenido** y lo que cuenta es lo que el jugador construye.

## 2. Bucle

| Escala | Bucle | Duración |
|---|---|---|
| **Corto** | Ver un hueco → colocar un edificio → la producción sube → vuelvo a mirar | 20-60 s |
| **Día** | El sol se pone y sale: se recolecta la producción y, cada 6 días, **sube el río** | 120 s reales (`DAY_SECONDS`) |
| **Sesión** | Aldea → Villa → Ciudad → Capital; cada hito desbloquea edificios y el agua aprieta más | 30-60 min |

**Recursos:** cebada (comida) y adobe (construcción), más **población**, que es la
puntuación de la partida. La población es **capacidad** (lo que alojan tus casas) y crece
hacia ella +3/día mientras haya cebada; cada habitante come 0,25 de cebada al día.

**Regla de oro del bucle:** todo lo que el jugador hace debe poder medirse en esas tres
cifras o en "cabe/cabe menos".

**La colonia es lo que construyes TÚ.** Sólo producen y dan población los edificios
colocados a mano (marca `playerBuilt` en sus celdas): las ciudades que genera el mundo son
escenario, no tu economía. Sin esto la partida se "ganaba" sola con las ciudades del mapa.

## 2.b Hitos y amenaza

| Sistema | Regla |
|---|---|
| **Hitos** | Aldea (0) → **Villa 20** (mercado, pozo, alfarería, red, **muro/dique**) → **Ciudad 50** (templo, villa, observatorio, atalaya, muelle) → **Capital 100** (zigurat, baños, torre). Al subir avisa y la paleta se abre. |
| **La crecida** | Cada **6 días** el río sube: el agua entra hasta 4 celdas en la vega baja y se queda **2 días**, llevándose las parcelas labradas. Aviso el día anterior. |
| **Diques** | **Cualquier edificio frena el agua**: el río no pasa por su celda ni más allá. El muro (`wall_segment`) se desbloquea en la Villa justo para esto. |
| **Reloj del HUD** | `Día N · CRECIDA` cuando el agua está dentro. |

## 3. Sistemas: qué vive, qué está congelado y qué está muerto

| Sistema | Estado | Nota |
|---|---|---|
| Mundo procedural, ríos, biomas, mundo que crece, niebla | **VIVO** | es el escenario y ya funciona |
| Asentamientos planificados, murallas, puertas, calles | **VIVO** | el escenario que se recorre |
| Edificios, producción diaria, población, costes | **VIVO** | es el motor del bucle |
| Construir / demoler **en partida** (no sólo en modo edición) | **VIVO** (nuevo) | antes estaba encerrado en modo edición |
| Día/noche, clima, sonidos, partículas, caballos, perro | **VIVO** | ambiente |
| Agricultura (labrar, sembrar, cosechar) | **VIVO** | primer "edificio" a mano del jugador |
| Interiores, observatorio, editor de entidades y de mapas | **VIVO** | herramientas y detalle |
| Combate básico (golpe, huir) y lobos de noche | **VIVO** | amenaza personal, no de ciudad |
| Narrativa: prólogo, actos, cinemáticas, intros, NPCs de guion | **MUERTO** | apagado por el interruptor, no borrado |
| Misiones de historia y encargos de guion | **MUERTO** | no se ofrecen |
| Época soviética y medieval | **CONGELADO** | no se eligen en el menú (una sola época: Mesopotamia) |
| Modo historia / modo libre | **CONGELADO** | el menú va directo a colonia |
| Sigilo (zona vigilada, vigías, coberturas) | **CONGELADO** | se queda el recinto como sitio del mundo, sin misión |
| Acción-RPG (Dash/Heal/Beacon, nivel, SPECIAL) | **CONGELADO** | candidato a borrar |
| Turnos/AP a mano («Siguiente Turno», 9 acciones de turno) | **CONGELADO** | el día ya pasa solo: el botón sobra |
| Torre de defensa por oleadas (`startEnemyWaves`) | **MUERTO** | código sin interfaz |
| Minijuego UR (`miniJuegos/ur`) | **MUERTO** | a `experimentos/` |
| Segunda vista (ortogonal/isométrica) y filtro de pixelado | **VIVO** pero secundario | una vista por defecto |

## 4. Cómo está implementado el corte

Un solo interruptor, arriba del todo en `engine/game-engine.js`:

```js
const MODO_COLONIA = true;        // colonia en tiempo real
const NARRATIVA = !MODO_COLONIA;  // false: sin historia
const CONSTRUIR_EN_JUEGO = MODO_COLONIA;  // se construye sin entrar en modo edición
```

Con `NARRATIVA = false`:

* el prólogo en casa **no arranca** (la casa del jugador sí se construye: es su punto de
  partida), y con él se caen la familia, la patrulla, el aviso de "prepara un cultivo" y
  el bloqueo de movimiento;
* las dos intros (carruaje y relato de texto) no se programan;
* `advanceStoryChapter()` no hace nada y no se inyectan misiones de guion;
* los NPCs de guion vuelven a ser **vecinos normales** (dicen sus frases genéricas): la
  limpieza se hace en `postMapInit()`, así que también vale para partidas guardadas viejas;
* los vecinos no reparten encargos (`colarMisionEnDialogo` sale de inmediato);
* el menú fuerza una sola época (Mesopotamia) y oculta el modo historia.

## 5. Hoja de ruta

### Hecho (etapa 2, 2026-10-13)

* **HUD único de colonia** (`#colonia-hud`): hito · día · adobes · cebada · población/capacidad
  · barra hacia el siguiente hito. Se retira el cromo del otro juego (botón «Editar»,
  lista de gestos, panel de objetivo y el panel flotante de recursos duplicado).
* **Hitos por población** con desbloqueo de edificios en la paleta y aviso al subir.
* **Economía de colonia**: sólo produce y da población lo construido por el jugador;
  población = capacidad, +3/día, y sin cebada se marcha gente.
* **La crecida** cada 6 días (aviso, 2 días de agua, parcelas perdidas, diques con edificios)
  + limpieza del agua si la partida se guardó a medias.
* **Construir y demoler en partida**, con costes, sin pasar por modo edición.
* **Objetivos encadenados** (`OBJETIVOS_COLONIA`, 7 pasos): Asienta tu aldea → Aloja a tu gente
  → Villa → Levanta un dique → Aguanta la primera crecida → Ciudad → Capital. El panel muestra
  «▸ objetivo actual» + «Objetivo X de 7»; al cumplir uno avisa, suena y explica el siguiente.
* **Briefing de entrada** (`#colonia-briefing`): qué es el juego, las 3 reglas y el objetivo
  de ahora. Sale una vez por navegador (`localStorage meso.coloniaIntroVista`) y se reabre con
  el botón «?» del panel.
* API de comprobación: `MESO_COLONIA` (estado, desbloqueos, `evaluarObjetivos`, `briefing`,
  `capacidad`, `fijarPoblacion`) y `MESO_CRECIDA` (estado, `mapa`, `forzar`, `retirar`).

### Siguiente (etapa 3)

1. **Balance de la crecida**: hoy anega ~1.630 celdas de vega. Decidir si daña edificios,
   si sube de nivel cada ciclo y si el aviso del día anterior debe ser más visible.
2. **Parcelas y agricultura con el agua**: que labrar cerca del río sea una apuesta
   (más comida, más riesgo) y que las parcelas perdidas se avisen bien.
3. **Enemigos que respeten el mundo**: hoy los saqueadores **atraviesan las murallas** y sólo
   atacan al jugador (el dique ya frena el agua, pero no a un hombre). Alternativa más barata:
   que la amenaza siga siendo el río y los lobos de noche.
4. **Guardado por celdas no vacías + semilla** (hoy ~900 KB en cada autoguardado).
5. **Limpieza**: barra de habilidades (Dash/Heal/Beacon), 9 acciones de turno, oleadas sueltas
   (`startEnemyWaves`), minijuego UR y sigilo como sistema.

### Qué NO se hace (para no volver al caos)

* No se añaden sistemas nuevos de otra fantasía hasta cerrar los tres primeros puntos.
* No se escribe guion.
* No se toca el generador de mundo ni el arte mientras el bucle no esté completo.
