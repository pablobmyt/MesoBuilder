/* ═══════════════════════════════════════════════════════════════════════════
   MARKDOWN → HTML (sin dependencias)

   Los documentos del proyecto (MANUAL.md y todo docs/*.md) se leen DENTRO del
   juego desde la guía (ver engine/guia.js). Esto es el traductor: convierte el
   markdown que se usa de verdad en estos ficheros a HTML.

   Cubre lo que hay en los docs: títulos (#…####), párrafos, negrita/cursiva,
   `código` en línea, bloques ```con lenguaje```, listas con y sin numerar
   (anidadas por sangría), casillas - [ ] / - [x], tablas con separador |---|,
   citas (>), reglas (---), enlaces [texto](url) e imágenes ![alt](src).

   No es CommonMark completo a propósito: es un traductor de una pasada, sin
   dependencias y sin sorpresas. TODO lo que se imprime va escapado, así que un
   `<div>` dentro de un bloque de código se VE, no se ejecuta.
   ═══════════════════════════════════════════════════════════════════════════ */

export function escaparHtml(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Ancla de un título, como las de GitHub: minúsculas, sin puntuación y con
// guiones. Se conservan los acentos (igual que GitHub) y además se guarda una
// versión sin acentos en `data-slug` para que los enlaces escritos «a mano»
// funcionen igual.
export function slugDe(texto) {
  return String(texto || '')
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function slugNormalizado(texto) {
  return slugDe(String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

// ── En línea: código, negrita, cursiva, enlaces, imágenes, tachado ──────────

// Negrita/cursiva/tachado sobre un texto YA escapado (y que puede llevar
// marcadores de código dentro, que se resuelven al final).
function negritaCursiva(salida) {
  return salida
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
}

function enLinea(texto) {
  let salida = escaparHtml(texto);
  const guardados = [];
  const guardar = (html) => {
    guardados.push(html);
    return '\u0000' + (guardados.length - 1) + '\u0000';
  };

  // 1. Código en línea: lo primero, para que su contenido no se toque más.
  salida = salida.replace(/`([^`]+)`/g, (m, c) => guardar('<code class="md-code">' + c + '</code>'));
  // 2. Imágenes ![alt](src) y enlaces [texto](url). El texto del enlace se
  //    formatea aquí dentro (negrita/cursiva): si no, `[**x**](url)` dejaría los
  //    asteriscos a la vista.
  salida = salida.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, src) =>
    guardar('<img class="md-img" alt="' + alt + '" src="' + src + '">'));
  salida = salida.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) =>
    guardar('<a class="md-link" href="' + url + '">' + negritaCursiva(txt) + '</a>'));
  // 3. Negrita, cursiva, tachado del resto
  salida = negritaCursiva(salida);
  // 4. Se devuelven los trozos protegidos. OJO: el HTML guardado puede llevar
  //    OTROS marcadores dentro (un enlace cuyo texto es `código`, por ejemplo),
  //    así que hay que resolverlo en varias pasadas hasta que no quede ninguno.
  for (let i = 0; i < 6; i++) {
    if (salida.indexOf('\u0000') < 0) break;
    const antes = salida;
    salida = salida.replace(/\u0000(\d+)\u0000/g, (m, n) => guardados[Number(n)] != null ? guardados[Number(n)] : '');
    if (salida === antes) break;
  }
  return salida;
}

const RE_TITULO = /^(#{1,6})\s+(.*)$/;
const RE_REGLA = /^\s*([-*_])(\s*\1){2,}\s*$/;
const RE_VALLA = /^\s*(```|~~~)\s*([\w+-]*)\s*$/;
const RE_CITA = /^\s*>\s?(.*)$/;
const RE_FILA_TABLA = /^\s*\|(.+)\|\s*$/;
const RE_SEP_TABLA = /^\s*\|?[\s:|-]+\|[\s:|-]*$/;
const RE_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

function esTabla(lineas, i) {
  return i + 1 < lineas.length && RE_FILA_TABLA.test(lineas[i]) && RE_SEP_TABLA.test(lineas[i + 1]) && lineas[i + 1].indexOf('-') >= 0;
}

function celdasDe(linea) {
  const m = linea.match(RE_FILA_TABLA);
  const cuerpo = m ? m[1] : linea;
  return cuerpo.split('|').map(c => c.trim());
}

function alineacionesDe(linea) {
  return celdasDe(linea).map(c => {
    const izq = c.startsWith(':'), der = c.endsWith(':');
    if (izq && der) return 'center';
    if (der) return 'right';
    return 'left';
  });
}

// Lista (con o sin numerar) empezando en `i`. Devuelve { html, siguiente }.
function listaEn(lineas, i) {
  const primera = lineas[i].match(RE_ITEM);
  const sangriaBase = primera[1].length;
  const ordenada = /\d/.test(primera[2]);
  const items = [];
  let j = i;
  while (j < lineas.length) {
    const m = lineas[j].match(RE_ITEM);
    if (!m) break;
    if (m[1].length < sangriaBase) break;
    if (m[1].length > sangriaBase) {
      // Sublista: se cuelga del último ítem.
      const sub = listaEn(lineas, j);
      if (!items.length) break;
      items[items.length - 1].hijos += sub.html;
      j = sub.siguiente;
      continue;
    }
    if (/\d/.test(m[2]) !== ordenada) break;
    let texto = m[3];
    // Casillas de tarea: - [ ] / - [x]
    let casilla = '';
    const mc = texto.match(/^\[([ xX])\]\s*(.*)$/);
    if (mc) {
      casilla = '<span class="md-check' + (mc[1].toLowerCase() === 'x' ? ' on' : '') + '">' + (mc[1].toLowerCase() === 'x' ? '☑' : '☐') + '</span> ';
      texto = mc[2];
    }
    // Continuación: líneas siguientes sin viñeta y con sangría.
    let extra = [];
    let k = j + 1;
    while (k < lineas.length && lineas[k].trim() && !RE_ITEM.test(lineas[k]) && !RE_TITULO.test(lineas[k]) &&
           !RE_FILA_TABLA.test(lineas[k]) && !RE_CITA.test(lineas[k]) && !RE_VALLA.test(lineas[k]) &&
           (lineas[k].match(/^\s*/)[0].length > sangriaBase)) {
      extra.push(lineas[k].trim());
      k++;
    }
    items.push({ texto: texto + (extra.length ? ' ' + extra.join(' ') : ''), casilla, hijos: '', siguiente: k });
    j = k;
  }
  const etiqueta = ordenada ? 'ol' : 'ul';
  const html = '<' + etiqueta + ' class="md-list">' + items.map(it =>
    '<li>' + it.casilla + enLinea(it.texto) + it.hijos + '</li>').join('') + '</' + etiqueta + '>';
  return { html, siguiente: j };
}

/**
 * Convierte markdown a HTML. `opts.titulo` (opcional) añade el título del
 * documento como <h1> si el texto no empieza ya por uno.
 */
export function mdAHtml(fuente, opts) {
  const o = opts || {};
  const lineas = String(fuente == null ? '' : fuente).replace(/\r\n?/g, '\n').split('\n');
  const trozos = [];
  const anclas = {};
  let i = 0;

  const titulo = (nivel, texto) => {
    const bruto = texto.trim();
    let id = slugDe(bruto);
    if (!id) id = 'seccion';
    if (anclas[id] != null) { anclas[id]++; id = id + '-' + anclas[id]; } else anclas[id] = 0;
    const n = Math.max(1, Math.min(6, nivel));
    return '<h' + n + ' class="md-h md-h' + n + '" id="' + id + '" data-slug="' + slugNormalizado(bruto) + '">' +
      enLinea(bruto) + '</h' + n + '>';
  };

  if (o.titulo) trozos.push('<h1 class="md-h md-h1 md-titulo">' + escaparHtml(o.titulo) + '</h1>');

  while (i < lineas.length) {
    const linea = lineas[i];

    // Bloque de código
    const mv = linea.match(RE_VALLA);
    if (mv) {
      const cierre = mv[1];
      const cuerpo = [];
      i++;
      while (i < lineas.length && !new RegExp('^\\s*' + cierre).test(lineas[i])) { cuerpo.push(lineas[i]); i++; }
      i++;   // saltar el cierre
      const lenguaje = mv[2] ? ' data-lenguaje="' + escaparHtml(mv[2]) + '"' : '';
      trozos.push('<pre class="md-pre"' + lenguaje + '><code>' + escaparHtml(cuerpo.join('\n')) + '</code></pre>');
      continue;
    }

    if (!linea.trim()) { i++; continue; }

    if (RE_REGLA.test(linea)) { trozos.push('<hr class="md-hr">'); i++; continue; }

    const mt = linea.match(RE_TITULO);
    if (mt) { trozos.push(titulo(mt[1].length, mt[2])); i++; continue; }

    if (esTabla(lineas, i)) {
      const cabecera = celdasDe(lineas[i]);
      const alineaciones = alineacionesDe(lineas[i + 1]);
      const filas = [];
      i += 2;
      while (i < lineas.length && RE_FILA_TABLA.test(lineas[i])) { filas.push(celdasDe(lineas[i])); i++; }
      const celda = (txt, k, etiqueta) => '<' + etiqueta + (alineaciones[k] ? ' style="text-align:' + alineaciones[k] + '"' : '') + '>' + enLinea(txt || '') + '</' + etiqueta + '>';
      trozos.push('<div class="md-tabla-caja"><table class="md-table"><thead><tr>' +
        cabecera.map((c, k) => celda(c, k, 'th')).join('') +
        '</tr></thead><tbody>' +
        filas.map(f => '<tr>' + cabecera.map((_, k) => celda(f[k], k, 'td')).join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }

    if (RE_CITA.test(linea)) {
      const cuerpo = [];
      while (i < lineas.length && RE_CITA.test(lineas[i])) { cuerpo.push(lineas[i].match(RE_CITA)[1]); i++; }
      trozos.push('<blockquote class="md-quote">' + mdAHtml(cuerpo.join('\n')) + '</blockquote>');
      continue;
    }

    if (RE_ITEM.test(linea)) {
      const res = listaEn(lineas, i);
      trozos.push(res.html);
      i = res.siguiente;
      continue;
    }

    // Párrafo: hasta la línea en blanco o el principio de otro bloque.
    const parrafo = [];
    while (i < lineas.length && lineas[i].trim() &&
           !RE_TITULO.test(lineas[i]) && !RE_REGLA.test(lineas[i]) && !RE_VALLA.test(lineas[i]) &&
           !RE_CITA.test(lineas[i]) && !RE_ITEM.test(lineas[i]) && !esTabla(lineas, i)) {
      parrafo.push(lineas[i].trim());
      i++;
    }
    if (parrafo.length) trozos.push('<p class="md-p">' + enLinea(parrafo.join(' ')) + '</p>');
  }

  return trozos.join('\n');
}

export default { mdAHtml, escaparHtml, slugDe, slugNormalizado };
