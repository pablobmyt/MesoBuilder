// tools/build-docs-index.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Genera `docs/indice.json`: la lista de documentos que la GUÍA DE JUEGO enseña
// dentro del juego (ver engine/guia.js). El juego no puede listar un directorio
// (ni por HTTP ni en Electron), así que la lista se materializa aquí.
//
// Uso:  node tools/build-docs-index.mjs
//
// Qué entra: TODOS los `.md` de la raíz del proyecto y de `docs/` (es lo que
// pidió el usuario: «una guía con todos los markdown que hay»). Cada uno se
// clasifica en un grupo para que la lista no sea un chorizo:
//
//   · «Cómo jugar»    MANUAL.md, README.md
//   · «Sistemas»      docs/*.md de mecánicas (por defecto)
//   · «Desarrollo»    notas de desarrollo, auditorías, ideas, TODO…
//
// El título sale del primer `# ` del fichero (si no hay, del nombre) y la
// descripción del primer párrafo en prosa.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'docs', 'indice.json');

// Ficheros que NO son para jugar (notas internas, histórico, borradores).
const DESARROLLO = new Set([
  'ideas.md', 'TODO.md', 'ACTUALIZACIONES.md', 'CINEMATICAS_README.md', 'CLAUDE.md', 'AGENTS.md',
  'docs/AUDITORIA.md', 'docs/IDEAS-Y-BOCETOS.md', 'docs/MODO-DEBUG.md', 'docs/EDITOR-DE-ENTIDADES.md',
  'docs/RENDIMIENTO.md', 'docs/ARRANQUE-GUARDADO-E-INTERFAZ.md'
]);
// Los primeros de la lista, en este orden.
const PRIMEROS = ['MANUAL.md', 'README.md'];
const TITULOS = {
  'MANUAL.md': 'Manual del jugador',
  'README.md': 'Qué es MesoBuilder'
};
// Descripciones a mano para los documentos que más se consultan (si no, se saca
// del primer párrafo en prosa, que en algunos ficheros es poca cosa).
const DESCRIPCIONES = {
  'MANUAL.md': 'Controles, supervivencia, construcción, agricultura, edición y problemas conocidos.',
  'docs/EDITOR-DE-ENTIDADES.md': 'La lista completa de sprites, los grupos, recortar cada vista y montar animaciones.',
  'docs/GUIA-EN-EL-JUEGO.md': 'Cómo se abre esta guía (F1), qué enseña y cómo se genera la lista de documentos.',
  'docs/MODO-DEBUG.md': 'Herramientas de depuración: inspector, MESO_DEBUG y atajos de pruebas.',
  'docs/IDEAS-Y-BOCETOS.md': 'Ideas y bocetos pendientes de decidir.',
  'TODO.md': 'Pendientes anotados del proyecto.'
};

function tituloDe(texto, archivo) {
  const limpio = String(texto || '').replace(/\r\n/g, '\n');
  const m = limpio.match(/^\s*#\s+(.+)$/m);
  if (m && m[1]) return m[1].trim().replace(/[*_`]/g, '');
  const base = path.basename(archivo, '.md').replace(/[-_]/g, ' ');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function descripcionDe(texto) {
  const lineas = String(texto || '').replace(/\r\n/g, '\n').split('\n');
  let enBloque = false;
  for (const cruda of lineas) {
    const l = cruda.trim();
    if (l.startsWith('```')) { enBloque = !enBloque; continue; }
    if (enBloque) continue;
    if (!l) continue;
    if (l.startsWith('#') || l.startsWith('|') || l.startsWith('>') || l.startsWith('-') || l.startsWith('*')) continue;
    if (/^\[.+\]\(.+\)$/.test(l)) continue;          // sólo un enlace
    if (/^[-=]{3,}$/.test(l)) continue;
    if (/^\d+[.)]\s/.test(l)) continue;              // «3. Controles del jugador»
    if (/^[IVX]+\.\s/.test(l)) continue;             // índices romanos
    if (/[(:]$/.test(l) || /^[(«"']/.test(l)) continue;   // continuaciones, citas y notas
    const limpia = l.replace(/[*_`]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
    if (limpia.length < 24) continue;                 // un título corto pegado, no prosa
    // Sólo la primera frase: la descripción es para la lista, no un resumen.
    const frase = limpia.split(/(?<=\.)\s/)[0];
    const texto = frase.length >= 24 ? frase : limpia;
    return texto.length > 150 ? texto.slice(0, 147).trimEnd() + '…' : texto;
  }
  return '';
}

function listaDeMd() {
  const fuera = [];
  const raiz = fs.readdirSync(RAIZ, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.md'))
    .map(e => e.name);
  const docs = fs.existsSync(path.join(RAIZ, 'docs'))
    ? fs.readdirSync(path.join(RAIZ, 'docs'), { withFileTypes: true })
        .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.md'))
        .map(e => 'docs/' + e.name)
    : [];
  const todos = [...raiz, ...docs];
  const orden = (a, b) => {
    const ia = PRIMEROS.indexOf(a), ib = PRIMEROS.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    const da = DESARROLLO.has(a) ? 1 : 0, db = DESARROLLO.has(b) ? 1 : 0;
    if (da !== db) return da - db;
    return path.basename(a).localeCompare(path.basename(b), 'es');
  };
  for (const rel of todos.sort(orden)) {
    const texto = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    const grupo = PRIMEROS.includes(rel) ? 'Cómo jugar' : (DESARROLLO.has(rel) ? 'Desarrollo' : 'Sistemas');
    fuera.push({
      archivo: rel,
      titulo: TITULOS[rel] || tituloDe(texto, rel),
      grupo,
      descripcion: DESCRIPCIONES[rel] || descripcionDe(texto),
      lineas: texto.replace(/\r\n/g, '\n').split('\n').length
    });
  }
  return fuera;
}

const docs = listaDeMd();
const salida = {
  generado: new Date().toISOString(),
  nota: 'Generado por tools/build-docs-index.mjs. Es la lista que enseña la guía del juego (F1).',
  docs
};
fs.writeFileSync(SALIDA, JSON.stringify(salida, null, 2) + '\n', 'utf8');
const porGrupo = {};
for (const d of docs) porGrupo[d.grupo] = (porGrupo[d.grupo] || 0) + 1;
console.log('[docs-index] ' + docs.length + ' documentos → docs/indice.json');
for (const g of Object.keys(porGrupo)) console.log('   · ' + g + ': ' + porGrupo[g]);
