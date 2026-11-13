// tools/refactor-deps.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Andamiaje para partir el monolito: dice QUÉ HAY QUE INYECTAR antes de mover
// una función a su propio fichero.
//
// Enumera las **variables libres** de una función o de un grupo de funciones (las
// que no declara ella misma), que son exactamente las que hay que pasarle por
// `deps` si se extrae a otro módulo. Sin esto, la extracción se hace a ojo y se
// cuela un `ReferenceError` que sólo aparece al jugar.
//
// Uso:
//   node tools/refactor-deps.mjs engine/game-engine.js createMenuBar
//   node tools/refactor-deps.mjs engine/game-engine.js --todas      (todas, con su nº de deps)
//   node tools/refactor-deps.mjs engine/game-engine.js --grupo 12000 12600
//
// No se usa en el juego: es sólo para planificar refactorizaciones.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// ── 1. Quitar comentarios, cadenas y plantillas (con ${} anidado) ───────────
export function limpiarCodigo(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const pilaPlantilla = [];   // profundidad de llaves por cada plantilla abierta
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (c === '/' && c2 === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && c2 === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === "'" || c === '"') {
      const q = c; i++;
      while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; out += ' __str__ '; continue;
    }
    if (c === '`') {
      i++; pilaPlantilla.push(0);
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') { pilaPlantilla[pilaPlantilla.length - 1]++; i += 2; out += ' ( '; continue; }
        if (src[i] === '}' && pilaPlantilla[pilaPlantilla.length - 1] > 0) { pilaPlantilla[pilaPlantilla.length - 1]--; i++; out += ' ) '; continue; }
        if (src[i] === '`' && pilaPlantilla[pilaPlantilla.length - 1] === 0) { pilaPlantilla.pop(); i++; break; }
        i++;
      }
      out += ' __str__ '; continue;
    }
    out += c; i++;
  }
  return out;
}

// ── 2. Trozo de código de una función (por balance de llaves) ──────────────
function trozoFuncion(src, nombre) {
  const re = new RegExp('^(?:export\\s+)?(?:async\\s+)?function ' + nombre + '\\b', 'm');
  const m = re.exec(src);
  if (!m) return null;
  let i = src.indexOf('{', m.index);
  let d = 0, fin = -1;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') d++;
    else if (ch === '}') { d--; if (d === 0) { fin = i; break; } }
  }
  const linea = src.slice(0, m.index).split('\n').length;
  return { nombre, linea, finLinea: src.slice(0, fin).split('\n').length, texto: src.slice(m.index, fin + 1) };
}

const GLOBALES = new Set(['window', 'document', 'globalThis', 'Math', 'Number', 'String', 'Boolean', 'Array', 'Object', 'JSON', 'Date', 'Set', 'Map', 'WeakMap', 'WeakSet', 'Promise', 'Proxy', 'Reflect', 'Symbol', 'Infinity', 'NaN', 'undefined', 'console', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'localStorage', 'sessionStorage', 'Image', 'Blob', 'URL', 'FileReader', 'fetch', 'parseInt', 'parseFloat', 'isFinite', 'isNaN', 'encodeURIComponent', 'decodeURIComponent', 'Error', 'RegExp', 'Path2D', 'DOMParser', 'structuredClone', 'queueMicrotask', 'MessageChannel', 'Audio', 'OffscreenCanvas', 'getComputedStyle', 'alert', 'confirm', 'prompt', 'arguments', 'eval', 'Function', 'Uint8Array', 'Uint8ClampedArray', 'Float32Array', 'Int32Array', 'BigInt', 'async', 'await', 'yield', 'new', 'typeof', 'instanceof', 'in', 'of', 'delete', 'void', 'this', 'super', 'class', 'extends', 'static', 'get', 'set', 'let', 'const', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'import', 'export', 'from', 'as', 'true', 'false', 'null', '__str__']);

// ── 3. Identificadores libres de un trozo ──────────────────────────────────
export function libresDe(texto) {
  const code = limpiarCodigo(texto);
  const locales = new Set();
  const patrones = [
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /\bfunction\s+([A-Za-z_$][\w$]*)/g,
    /\bclass\s+([A-Za-z_$][\w$]*)/g,
    /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g,
  ];
  for (const p of patrones) { let x; while ((x = p.exec(code))) locales.add(x[1]); }
  // parámetros: (a, b) => / function (a, b) / (a, b) {
  { let x; const p = /\(([^()]*)\)\s*(?:=>|\{)/g; while ((x = p.exec(code))) x[1].split(',').forEach(s => { const q = s.replace(/[:={}].*$/, '').trim().replace(/^\.\.\./, ''); if (/^[A-Za-z_$][\w$]*$/.test(q)) locales.add(q); }); }
  { let x; const p = /([A-Za-z_$][\w$]*)\s*=>/g; while ((x = p.exec(code))) locales.add(x[1]); }
  { let x; const p = /\bfor\s*\(\s*(?:const|let|var)?\s*([A-Za-z_$][\w$]*)\s+(?:of|in)\b/g; while ((x = p.exec(code))) locales.add(x[1]); }
  // etiquetas de objeto ({ clave: ... }) y miembros (obj.prop) no son variables
  const esClave = new Set();
  { let x; const p = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*:/g; while ((x = p.exec(code))) esClave.add(x[1]); }
  const usos = new Map();
  { let x; const p = /(?<![.\w$])([A-Za-z_$][\w$]*)/g; while ((x = p.exec(code))) {
    const k = x[1];
    if (locales.has(k) || GLOBALES.has(k)) continue;
    // ¿es miembro/etiqueta?  .k  ·  k:  ·  k =  (asignación a algo ya libre: cuenta)
    const antes = code.slice(Math.max(0, x.index - 2), x.index);
    const despues = code.slice(x.index + k.length, x.index + k.length + 1);
    if (/[.?]$/.test(antes)) continue;                 // obj.k
    if (despues === ':' && esClave.has(k)) continue;    // { k: }
    usos.set(k, (usos.get(k) || 0) + 1);
  } }
  return [...usos.entries()].sort((a, b) => b[1] - a[1]);
}

const [, , ruta, arg2, arg3] = process.argv;
if (ruta) ejecutar(ruta, arg2, arg3);

function ejecutar(ruta, arg2, arg3) {
const src = fs.readFileSync(ruta, 'utf8');
const nombres = [...src.matchAll(/^(?:export\s+)?(?:async\s+)?function ([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);

if (arg2 === '--todas' || arg2 === '--faciles') {
  // `--faciles [maxDeps]`: las funciones que se pueden extraer sin arrastrar medio
  // módulo (pocas variables libres). Es lo primero que hay que mirar al partir.
  const maxDeps = Number(arg3) || 8;
  const filas = nombres.map(n => {
    const f = trozoFuncion(src, n);
    const d = libresDe(f.texto);
    return { Nombre: n, Linea: f.linea, Lineas: f.finLinea - f.linea + 1, Deps: d.length, Lista: d.map(x => x[0]).join(' ') };
  }).filter(r => arg2 === '--todas' || r.Deps <= maxDeps).sort((a, b) => a.Linea - b.Linea);
  // Salida en texto (una función por línea) para poder filtrarla con findstr/grep.
  for (const r of filas) {
    console.log([r.Linea, r.Lineas, r.Deps, r.Nombre, '|', r.Lista].join('\t'));
  }
  console.log(`# TOTAL con <= ${maxDeps} deps: ${filas.length} funciones · ${filas.reduce((s, r) => s + r.Lineas, 0)} líneas`);
} else if (arg2 === '--rango') {
  // Deps de un GRUPO de funciones (el bloque que se piensa extraer a un módulo).
  const desde = Number(process.argv[4]), hasta = Number(process.argv[5]);
  const dentro = nombres.map(n => trozoFuncion(src, n)).filter(f => f.linea >= desde && f.linea <= hasta);
  const l = libresDe(dentro.map(f => f.texto).join('\n'));
  const propias = new Set(dentro.map(f => f.nombre));
  const fuera = l.filter(([n]) => !propias.has(n));
  console.log(`# rango ${desde}-${hasta}: ${dentro.length} funciones, ${fuera.length} deps externas`);
  console.log(fuera.map(([n, c]) => `${n}(${c})`).join(', '));
} else {
  const f = trozoFuncion(src, arg2);
  if (!f) { console.error('no encuentro ' + arg2); process.exit(1); }
  const l = libresDe(f.texto);
  console.log(`# ${f.nombre}()  líneas ${f.linea}-${f.finLinea} (${f.finLinea - f.linea + 1}), ${l.length} variables libres`);
  console.log(l.map(([n, c]) => `${n}(${c})`).join(', '));
}
}
