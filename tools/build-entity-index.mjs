// tools/build-entity-index.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Genera `data/entity-index.json`: LA LISTA COMPLETA DE SPRITES QUE EL JUEGO SABE
// DIBUJAR, con su grupo y de dónde sale cada uno.
//
// Uso:  node tools/build-entity-index.mjs      (o: npm run entity-index)
//
// ¿Por qué existe? El editor de entidades (`npm run editor`) listaba sólo las
// claves de `data/entity-pixels.json` y **excluía** algunas por nombre (`interior_*`,
// `ma_g`, iconos…), así que sprites que el juego dibuja no aparecían por ningún
// lado: las tumbas, los esqueletos, los cultivos por fases y catorce muebles de
// interior. Con este índice la lista es la MISMA que la librería del motor al
// arrancar:
//
//   · claves de `data/entity-pixels.json`              → origen «json»
//   · las que registra el motor en marcha (cultivos,  → origen «motor»
//     esqueletos, tumba, observatorio…)
//   · las que el editor necesita aunque no estén en   → origen «fijo»
//     el JSON (los suelos y los personajes)
//
// Los registros del motor se obtienen IMPORTANDO sus módulos y llamando a sus
// funciones de registro con un objeto vacío: no se adivina nada por el nombre,
// se pregunta al propio código (si mañana se añade una fase de cultivo, aparece
// sola al regenerar).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'data', 'entity-index.json');

const cargar = (rel) => import(pathToFileURL(path.join(RAIZ, rel)).href + '?t=' + Date.now());

// ── Grupos ──────────────────────────────────────────────────────────────────
// Se clasifica por nombre. El orden IMPORTA: gana el primer grupo que encaje.
const GRUPOS = [
  { nombre: 'Suelos (baldosas)', re: /^suelo_/ },
  { nombre: 'Personajes y animales', re: /^(PERSONAJE|NPC|PERRO|CABALLO|LOBO|CONEJO|ZORRO)$|^(pet_dog|horse|detailed_fox|detailed_rabbit|beast|raider|commissar|wolf|caballo)/i },
  { nombre: 'Cadáveres y tumbas', re: /^(tumba|esqueleto_)/i },
  { nombre: 'Cultivos (fases de crecimiento)', re: /^(wheat|vine|bush|leafy)[0-3]?$/i },
  { nombre: 'Vegetación', re: /^(tree\d|gallery_tree|date_palm|euphrates_poplar|tamarisk|reed_cluster|typha|steppe_shrub|barley|weed|plant\d|flower\d|grass)/i },
  { nombre: 'Interiores (muebles y adornos)', re: /^interior_/i },
  { nombre: 'Iconos e interfaz', re: /^(icon|flag|ma_g|makarov)/i },
  { nombre: 'URSS', re: /^(soviet|ussr|party_hq|state_|collective_farm|steel_foundry|commissar)/i },
  { nombre: 'Edificios', re: /^(house|hut|temple|market|granary|well|wall|tower|watchtower|ziggurat|longhouse|sheepfold|dock|factory|pottery|stone_house|reed_hut|mesopotamian|farm|foundry|cueva|fountain|mountain|checkpoint|guard_booth|concrete_road|road|barn|pixel_building|stone$|wood$)/i }
];
const GRUPO_POR_DEFECTO = 'Otros / decoración';

function grupoDe(clave) {
  for (const g of GRUPOS) if (g.re.test(clave)) return g.nombre;
  return GRUPO_POR_DEFECTO;
}

// Nombres «bonitos» para las claves del motor (en la lista se ve el nombre y la
// clave; sin esto hay que adivinar qué es `leafy2`).
const NOTAS = {
  'suelo_arena': 'baldosa de desierto, aluvial y salino',
  'suelo_tierra': 'baldosa de estepa, hierba, ribera, marisma y bosque',
  'suelo_arcilla': 'baldosa de colinas',
  'suelo_agua': 'baldosa de agua',
  'observatory': 'observatorio (recortes: observatory_sup / observatory_iso)'
};

const docs = [];

// ── 1. La librería base (data/entity-pixels.json) ───────────────────────────
function desdeJson() {
  const ruta = path.join(RAIZ, 'data', 'entity-pixels.json');
  if (!fs.existsSync(ruta)) return [];
  const j = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const lib = j.icons || j;
  return Object.keys(lib).map(clave => ({
    clave,
    grupo: grupoDe(clave),
    origen: 'json',
    pixels: Array.isArray(lib[clave].pixels) ? lib[clave].pixels.length : null
  }));
}

// ── 2. Lo que registra el MOTOR al arrancar ─────────────────────────────────
// Se llama a las funciones de registro con una librería falsa y se leen las
// claves que han añadido (y sus PÍXELES: así el editor puede enseñar el sprite
// que hay ahora mismo en el juego aunque no esté en el JSON). Si un módulo no se
// puede importar (necesita DOM), se queda anotado en el JSON para que se vea.
function defLimpia(d) {
  if (!d || !Array.isArray(d.pixels)) return null;
  return {
    grid: d.grid || Math.max(d.gridW || 0, d.gridH || 0) || null,
    gridW: d.gridW || d.grid || null,
    gridH: d.gridH || d.grid || null,
    pixels: d.pixels
  };
}

async function desdeMotor() {
  const claves = [];
  const fallos = [];
  const recoger = (lib, grupo, nota) => {
    for (const clave of Object.keys(lib)) claves.push({ clave, grupo, origen: 'motor', nota, def: defLimpia(lib[clave]) });
  };

  // Cultivos: todas las familias × todas sus fases.
  try {
    const m = await cargar('engine/plant-art.js');
    const lib = {};
    m.registerPlantSprites(lib);
    recoger(lib, 'Cultivos (fases de crecimiento)', 'fase generada por el motor');
    // Nombres de familia en la nota (Trigo · fase 0, Vid · fase 2…).
    const nombres = m.CROP_TYPE_NAMES || {};
    for (const c of claves) {
      const tipo = (m.CROP_TYPES || []).find(t => c.clave.indexOf(t) === 0);
      if (tipo) c.nota = (nombres[tipo] || tipo) + ' · fase ' + c.clave.slice(tipo.length);
    }
  } catch (e) { fallos.push('plant-art.js: ' + e.message); }

  // Esqueletos de los cadáveres.
  try {
    const m = await cargar('engine/corpse-art.js');
    const lib = {};
    m.createCorpseArt({}).registrarSprites(lib);
    recoger(lib, 'Cadáveres y tumbas', 'esqueleto');
    for (const c of claves) {
      if (c.grupo !== 'Cadáveres y tumbas') continue;
      // Los esqueletos de personas se dibujan con la FIGURA del muerto (misma
      // silueta y postura, ver `paletaHuesos` en corpse-art.js): este sprite es
      // el respaldo de los bichos y de los esqueletos guardados sin paleta.
      c.nota = c.clave.indexOf('animal') >= 0
        ? 'esqueleto de bicho (conejos y zorros)'
        : 'esqueleto genérico: respaldo de los que no tienen la paleta del muerto';
    }
  } catch (e) { fallos.push('corpse-art.js: ' + e.message); }

  // Lápida de las tumbas.
  try {
    const m = await cargar('engine/grave-art.js');
    const lib = {};
    m.registerGraveSprite(lib);
    recoger(lib, 'Cadáveres y tumbas', 'lápida de las tumbas');
  } catch (e) { fallos.push('grave-art.js: ' + e.message); }

  // Observatorio (no está en el JSON: su sprite provisional lo registra el motor).
  try {
    const m = await cargar('engine/observatory.js');
    const lib = {};
    m.registerObservatorySprite(lib);
    recoger(lib, 'Edificios', 'observatorio');
  } catch (e) { fallos.push('observatory.js: ' + e.message); }

  return { claves, fallos };
}

// ── 3. Los que el editor necesita aunque no tengan sprite todavía ───────────
// `observatory` es una clave «contenedora» del editor (sus recortes son
// observatory_sup / observatory_iso), y los suelos y personajes van fijos para
// tenerlos siempre arriba aunque el JSON no los traiga.
function fijos() {
  const lista = [
    { clave: 'suelo_arena', grupo: 'Suelos (baldosas)', nota: 'desierto, aluvial y salino' },
    { clave: 'suelo_tierra', grupo: 'Suelos (baldosas)', nota: 'estepa, hierba, ribera, marisma y bosque' },
    { clave: 'suelo_arcilla', grupo: 'Suelos (baldosas)', nota: 'colinas' },
    { clave: 'suelo_agua', grupo: 'Suelos (baldosas)', nota: 'agua' },
    { clave: 'PERSONAJE', grupo: 'Personajes y animales', nota: 'el jugador' },
    { clave: 'NPC', grupo: 'Personajes y animales', nota: 'aldeanos y PNJ' },
    { clave: 'PERRO', grupo: 'Personajes y animales', nota: 'Kidu' },
    { clave: 'CABALLO', grupo: 'Personajes y animales', nota: 'caballo' },
    { clave: 'LOBO', grupo: 'Personajes y animales' },
    { clave: 'CONEJO', grupo: 'Personajes y animales' },
    { clave: 'ZORRO', grupo: 'Personajes y animales' },
    { clave: 'observatory', grupo: 'Edificios', nota: 'recortes observatory_sup / observatory_iso' }
  ];
  return lista.map(x => ({ ...x, origen: 'fijo' }));
}

const vistos = new Set();
const todas = [];
// Orden de los grupos en el JSON y en la lista del editor.
const ordenGrupos = ['Suelos (baldosas)', 'Personajes y animales', 'Cultivos (fases de crecimiento)', 'Cadáveres y tumbas', 'Vegetación', 'Interiores (muebles y adornos)', 'Edificios', 'URSS', 'Iconos e interfaz', GRUPO_POR_DEFECTO];
let ordenManual = 0;   // los «fijos» guardan su orden (los suelos, tal cual se leen)
const anadir = (entrada) => {
  if (!entrada || !entrada.clave) return;
  const id = entrada.clave;
  if (vistos.has(id)) {
    // Ya estaba (por ejemplo, `suelo_arena` en el JSON o `observatory` en la
    // lista fija): se queda el de origen más «fuerte» y se copia lo que falte
    // (la nota, y los píxeles que sólo conoce el motor).
    const previa = todas.find(x => x.clave === id);
    if (previa) {
      if (!previa.nota && entrada.nota) previa.nota = entrada.nota;
      if (!previa.def && entrada.def) previa.def = entrada.def;
    }
    return;
  }
  vistos.add(id);
  todas.push({ ...entrada, grupo: entrada.grupo || grupoDe(id), nota: entrada.nota || NOTAS[id] || '' });
};

// Primero los json y los fijos (el orden de la lista), y encima lo del motor.
for (const x of desdeJson()) anadir(x);
for (const x of fijos()) { ordenManual += 1; anadir({ ...x, orden: ordenManual }); }
const motor = await desdeMotor();
for (const x of motor.claves) anadir(x);

// Orden dentro de cada grupo: primero los que traen orden a mano (los suelos, para
// que sigan leyéndose arena · tierra · arcilla · agua), luego los que genera el
// motor (los más buscados: cultivos, esqueletos, tumbas) y luego alfabético.
todas.sort((a, b) => {
  const ga = ordenGrupos.indexOf(a.grupo), gb = ordenGrupos.indexOf(b.grupo);
  if (ga !== gb) return (ga < 0 ? 99 : ga) - (gb < 0 ? 99 : gb);
  const oa = Number.isFinite(a.orden) ? a.orden : 9e9, ob = Number.isFinite(b.orden) ? b.orden : 9e9;
  if (oa !== ob) return oa - ob;
  const ma = a.origen === 'motor' ? 0 : 1, mb = b.origen === 'motor' ? 0 : 1;
  if (ma !== mb) return ma - mb;
  return a.clave.localeCompare(b.clave, 'es');
});

const porGrupo = {};
for (const d of todas) porGrupo[d.grupo] = (porGrupo[d.grupo] || 0) + 1;

const salida = {
  generado: new Date().toISOString(),
  nota: 'Generado por tools/build-entity-index.mjs. Es la lista que enseña el editor de entidades (npm run editor).',
  total: todas.length,
  grupos: ordenGrupos.filter(g => porGrupo[g]).map(g => ({ nombre: g, cuantos: porGrupo[g] })),
  problemas: motor.fallos,
  claves: todas
};
fs.writeFileSync(SALIDA, JSON.stringify(salida, null, 2) + '\n', 'utf8');

console.log('[entity-index] ' + todas.length + ' sprites → data/entity-index.json');
for (const g of salida.grupos) console.log('   · ' + g.nombre + ': ' + g.cuantos);
if (motor.fallos.length) console.log('   avisos: ' + motor.fallos.join(' | '));
