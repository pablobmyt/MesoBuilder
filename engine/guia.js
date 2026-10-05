/* ═══════════════════════════════════════════════════════════════════════════
   GUÍA DEL JUEGO — todos los markdown del proyecto, dentro del juego

   Pedido del usuario: «pon una guía con todos los markdown que hay para ver
   dentro del juego si alguien tiene alguna duda».

   Qué es: un panel (DOM, no lienzo) con la lista de documentos a la izquierda y
   el documento a la derecha, traducido de markdown a HTML con engine/markdown.js.
   La lista sale de `docs/indice.json`, que genera `tools/build-docs-index.mjs`
   recorriendo MANUAL.md, los .md de la raíz y los de `docs/`.

   Se abre con F1 o desde el menú superior (Guía), y el buscador filtra por
   título, fichero y descripción. Los enlaces entre documentos (`docs/X.md`,
   `#ancla` o direcciones http) funcionan: los internos se abren aquí mismo y los
   externos van al navegador.

   Este módulo no toca el motor: todo lo que necesita (leer ficheros, estilo de
   panel, registrar el panel flotante, avisar) entra por `deps`, igual que en
   engine/stealth.js.
   ═══════════════════════════════════════════════════════════════════════════ */

import { mdAHtml, slugNormalizado } from './markdown.js';
import { icono } from './icons.js';

const CSS = `
#guia-docs { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: min(980px, 94vw); height: min(660px, 88vh); display: none; flex-direction: column;
  z-index: 4600; overflow: hidden; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
#guia-docs .gd-cab { display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  border-bottom: 1px solid rgba(255,210,122,0.18); flex: 0 0 auto; }
#guia-docs .gd-titulo { font-weight: 700; color: #FFD27A; display: flex; align-items: center; gap: 8px; font-size: 14px; }
#guia-docs .gd-busca { flex: 1; margin-left: 8px; background: rgba(0,0,0,0.35); color: #F2EFE6;
  border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; padding: 6px 10px; font-size: 12.5px; outline: none; }
#guia-docs .gd-busca:focus { border-color: rgba(255,210,122,0.5); }
#guia-docs .gd-x { background: transparent; color: #c8c8c8; border: none; cursor: pointer; font-size: 15px; padding: 4px 8px; border-radius: 6px; }
#guia-docs .gd-x:hover { background: rgba(255,255,255,0.08); color: #fff; }
#guia-docs .gd-cuerpo { display: flex; min-height: 0; flex: 1 1 auto; }
#guia-docs .gd-lista { width: 268px; flex: 0 0 auto; overflow: auto; padding: 8px 6px 16px 8px;
  border-right: 1px solid rgba(255,255,255,0.07); }
#guia-docs .gd-grupo { margin: 10px 6px 4px 6px; font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color: rgba(255,210,122,0.75); }
#guia-docs .gd-item { display: block; width: 100%; text-align: left; background: transparent; color: #E8E2D4;
  border: none; border-radius: 7px; padding: 6px 8px; cursor: pointer; font-size: 12.5px; line-height: 1.25; }
#guia-docs .gd-item:hover { background: rgba(255,255,255,0.06); }
#guia-docs .gd-item.on { background: rgba(255,210,122,0.14); color: #FFE9B8; }
#guia-docs .gd-item small { display: block; color: rgba(232,226,212,0.5); font-size: 10.5px; margin-top: 2px; }
#guia-docs .gd-vacio { color: rgba(232,226,212,0.5); font-size: 12px; padding: 10px; }
#guia-docs .gd-doc { flex: 1 1 auto; overflow: auto; padding: 16px 26px 40px 22px; color: #EAE6DC; font-size: 13.5px; line-height: 1.55; }
#guia-docs .gd-doc::-webkit-scrollbar, #guia-docs .gd-lista::-webkit-scrollbar { width: 10px; }
#guia-docs .gd-doc::-webkit-scrollbar-thumb, #guia-docs .gd-lista::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 6px; }
#guia-docs .gd-ruta { font-size: 10.5px; color: rgba(232,226,212,0.45); margin: -6px 0 12px 2px; }
.md-h { color: #FFD27A; line-height: 1.25; margin: 20px 0 8px 0; }
.md-h1 { font-size: 21px; margin-top: 0; border-bottom: 1px solid rgba(255,210,122,0.22); padding-bottom: 6px; }
.md-h2 { font-size: 17px; }
.md-h3 { font-size: 14.5px; color: #FFE0A0; }
.md-h4, .md-h5, .md-h6 { font-size: 13px; color: #F0DCAE; }
.md-p { margin: 8px 0; }
.md-list { margin: 8px 0 8px 20px; padding: 0; }
.md-list li { margin: 3px 0; }
.md-code { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.07); border-radius: 4px;
  padding: 0.5px 5px; font-family: Consolas, "Courier New", monospace; font-size: 12.2px; color: #FFE6B0; }
.md-pre { background: rgba(0,0,0,0.42); border: 1px solid rgba(255,255,255,0.09); border-radius: 8px;
  padding: 10px 12px; overflow: auto; margin: 10px 0; }
.md-pre code { font-family: Consolas, "Courier New", monospace; font-size: 12.2px; color: #D8E8D0; white-space: pre; }
.md-tabla-caja { overflow: auto; margin: 10px 0; }
.md-table { border-collapse: collapse; font-size: 12.5px; min-width: 60%; }
.md-table th, .md-table td { border: 1px solid rgba(255,255,255,0.12); padding: 5px 9px; vertical-align: top; }
.md-table th { background: rgba(255,210,122,0.10); color: #FFE9B8; font-weight: 700; }
.md-table tr:nth-child(even) td { background: rgba(255,255,255,0.025); }
.md-quote { margin: 10px 0; padding: 6px 14px; border-left: 3px solid rgba(255,210,122,0.5);
  background: rgba(255,210,122,0.06); border-radius: 0 8px 8px 0; }
.md-quote .md-p { margin: 4px 0; }
.md-hr { border: none; border-top: 1px solid rgba(255,255,255,0.12); margin: 18px 0; }
.md-link { color: #8FD0FF; text-decoration: none; border-bottom: 1px dotted rgba(143,208,255,0.5); cursor: pointer; }
.md-link:hover { color: #BFE6FF; }
.md-img { max-width: 100%; border-radius: 6px; }
.md-check { color: rgba(232,226,212,0.5); }
.md-check.on { color: #8BD98B; }
`;

// ¿Ruta de un documento del proyecto? Se limpian `./`, `../` y el ancla.
function normalizarRuta(ruta, desde) {
  let r = String(ruta || '').split('#')[0].trim();
  if (!r) return null;
  if (/^(https?:|mailto:)/i.test(r)) return null;
  if (r.startsWith('/')) r = r.replace(/^\/+/, '');
  else if (desde && desde.indexOf('/') > 0) r = desde.replace(/[^/]+$/, '') + r;
  const partes = [];
  for (const p of r.split('/')) {
    if (!p || p === '.') continue;
    if (p === '..') partes.pop();
    else partes.push(p);
  }
  return partes.join('/');
}

export function createGuia(deps) {
  const D = deps || {};
  const call = (fn, ...args) => { try { return (typeof fn === 'function') ? fn(...args) : undefined; } catch (e) { return undefined; } };

  let panel = null;
  let lista = [];            // manifiesto
  let cargado = false;       // ¿ya se pidió el manifiesto?
  let docActual = null;
  const cache = new Map();   // ruta → html
  const filtro = { texto: '' };

  function asegurarEstilos() {
    try {
      if (document.getElementById('guia-estilos')) return;
      const s = document.createElement('style');
      s.id = 'guia-estilos';
      s.textContent = CSS;
      document.head.appendChild(s);
    } catch (e) {}
  }

  function construir() {
    if (panel) return panel;
    asegurarEstilos();
    panel = document.createElement('div');
    panel.id = 'guia-docs';
    panel.setAttribute('data-title', 'Guía del juego');
    call(D.estiloPanel, panel);
    panel.style.display = 'none';
    panel.innerHTML = `
      <div class="gd-cab">
        <span class="gd-titulo">${icono('pergamino', { size: 15 })} Guía del juego</span>
        <input class="gd-busca" type="search" placeholder="Buscar documento (título, fichero o descripción)…" autocomplete="off">
        <button class="gd-x" title="Cerrar (Esc)">✕</button>
      </div>
      <div class="gd-cuerpo">
        <div class="gd-lista"></div>
        <div class="gd-doc"></div>
      </div>`;
    document.body.appendChild(panel);
    // El buscador no debe dejar pasar las teclas al juego (con «i» se abriría el
    // inventario detrás de la guía, con WASD el personaje andaría).
    const busca = panel.querySelector('.gd-busca');
    for (const tipo of ['keydown', 'keyup', 'keypress']) {
      busca.addEventListener(tipo, (e) => { e.stopPropagation(); }, false);
    }
    busca.addEventListener('input', () => { filtro.texto = busca.value; pintarLista(); });
    panel.querySelector('.gd-x').addEventListener('click', () => cerrar());
    panel.querySelector('.gd-doc').addEventListener('click', alPulsarEnlace);
    call(D.registrarPanel, panel, 'Guía del juego');
    return panel;
  }

  function alPulsarEnlace(ev) {
    const a = ev.target && ev.target.closest ? ev.target.closest('a.md-link') : null;
    if (!a) return;
    const href = a.getAttribute('href') || '';
    ev.preventDefault();
    ev.stopPropagation();
    if (/^https?:/i.test(href)) { try { window.open(href, '_blank', 'noopener'); } catch (e) {} return; }
    if (href.startsWith('#')) { irAAncla(href.slice(1)); return; }
    // El enlace puede estar escrito desde la RAÍZ del proyecto («docs/X.md»,
    // como hacen el MANUAL y los docs) o RELATIVO al documento abierto
    // («X.md» desde docs/). Se prueban las dos lecturas y se queda con la que
    // corresponda a un documento de la lista.
    const candidatos = [];
    for (const c of [normalizarRuta(href, null), normalizarRuta(href, docActual)]) {
      if (c && candidatos.indexOf(c) < 0) candidatos.push(c);
    }
    if (!candidatos.length) return;
    const conocido = candidatos.find(c => lista.some(d => d.archivo === c));
    abrirDoc(conocido || candidatos[0]);
  }

  function irAAncla(ancla) {
    try {
      const cont = panel.querySelector('.gd-doc');
      const buscado = slugNormalizado(decodeURIComponent(ancla || ''));
      let objetivo = cont.querySelector('#' + CSSEscape(ancla));
      if (!objetivo) {
        const titulos = cont.querySelectorAll('[data-slug]');
        for (const t of titulos) { if (t.getAttribute('data-slug') === buscado) { objetivo = t; break; } }
      }
      if (objetivo && objetivo.scrollIntoView) objetivo.scrollIntoView({ block: 'start' });
    } catch (e) {}
  }
  function CSSEscape(t) {
    try { return (window.CSS && window.CSS.escape) ? window.CSS.escape(String(t)) : String(t).replace(/[^\w-]/g, '\\$&'); }
    catch (e) { return String(t); }
  }

  function pintarLista() {
    if (!panel) return;
    const cont = panel.querySelector('.gd-lista');
    const t = filtro.texto.trim().toLowerCase();
    const coincide = (d) => !t || (d.titulo + ' ' + d.archivo + ' ' + (d.descripcion || '')).toLowerCase().indexOf(t) >= 0;
    cont.innerHTML = '';
    if (!lista.length) {
      const v = document.createElement('div');
      v.className = 'gd-vacio';
      v.innerHTML = cargado
        ? 'No se encontró <b>docs/indice.json</b>.<br>Genera la lista con:<br><code class="md-code">node tools/build-docs-index.mjs</code>'
        : 'Cargando la lista de documentos…';
      cont.appendChild(v);
      return;
    }
    const grupos = [];
    for (const d of lista) if (coincide(d)) {
      let g = grupos.find(x => x.nombre === d.grupo);
      if (!g) { g = { nombre: d.grupo, docs: [] }; grupos.push(g); }
      g.docs.push(d);
    }
    if (!grupos.length) {
      const v = document.createElement('div');
      v.className = 'gd-vacio';
      v.textContent = 'Ningún documento coincide con «' + filtro.texto + '».';
      cont.appendChild(v);
      return;
    }
    for (const g of grupos) {
      const h = document.createElement('div'); h.className = 'gd-grupo'; h.textContent = g.nombre;
      cont.appendChild(h);
      for (const d of g.docs) {
        const b = document.createElement('button');
        b.className = 'gd-item' + (d.archivo === docActual ? ' on' : '');
        b.setAttribute('data-archivo', d.archivo);
        b.innerHTML = '<span>' + d.titulo + '</span><small>' + (d.descripcion || d.archivo) + '</small>';
        b.addEventListener('click', () => abrirDoc(d.archivo));
        cont.appendChild(b);
      }
    }
  }

  function pintarCargando(ruta) {
    if (!panel) return;
    const cont = panel.querySelector('.gd-doc');
    cont.innerHTML = '<div class="gd-vacio">Cargando <b>' + ruta + '</b>…</div>';
  }

  function pintarError(ruta, motivo) {
    if (!panel) return;
    const cont = panel.querySelector('.gd-doc');
    cont.innerHTML = '<div class="gd-vacio">No se pudo abrir <b>' + ruta + '</b>.<br>' + motivo + '<br><br>' +
      'Si estás en el juego de escritorio, comprueba que el fichero existe en la carpeta del proyecto.</div>';
  }

  function pintarDoc(ruta, html, info) {
    if (!panel) return;
    const cont = panel.querySelector('.gd-doc');
    cont.scrollTop = 0;
    cont.innerHTML = '<div class="gd-ruta">' + ruta + (info && info.lineas ? ' · ' + info.lineas + ' líneas' : '') + '</div>' + html;
    // Los enlaces externos, fuera (en Electron no deben navegar dentro del juego).
    cont.querySelectorAll('a.md-link').forEach(a => {
      const h = a.getAttribute('href') || '';
      if (/^https?:/i.test(h)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
    });
  }

  async function abrirDoc(ruta) {
    if (!panel) return false;
    const info = lista.find(d => d.archivo === ruta) || null;
    docActual = ruta;
    try { localStorage.setItem('meso.guiaDoc', ruta); } catch (e) {}
    for (const b of panel.querySelectorAll('.gd-item')) b.classList.toggle('on', b.getAttribute('data-archivo') === ruta);
    if (cache.has(ruta)) { pintarDoc(ruta, cache.get(ruta), info); return true; }
    pintarCargando(ruta);
    const texto = await call(D.obtenerTexto, ruta);
    if (texto == null) { pintarError(ruta, 'No se encontró o no se pudo leer.'); return false; }
    const html = mdAHtml(texto, { titulo: info ? null : undefined });
    cache.set(ruta, html);
    pintarDoc(ruta, html, info);
    return true;
  }

  async function cargarLista() {
    if (cargado) return lista;
    cargado = true;
    const bruto = await call(D.obtenerTexto, 'docs/indice.json');
    if (bruto) {
      try {
        const data = JSON.parse(bruto);
        lista = Array.isArray(data) ? data : (data.docs || []);
      } catch (e) { lista = []; }
    }
    if (!lista.length) {
      // Respaldo mínimo: lo indispensable para poder leer algo aunque falte el índice.
      lista = [
        { archivo: 'MANUAL.md', titulo: 'Manual del jugador', grupo: 'Cómo jugar', descripcion: 'Controles y sistemas' },
        { archivo: 'TODO.md', titulo: 'Pendientes del proyecto', grupo: 'Desarrollo', descripcion: '' }
      ];
    }
    return lista;
  }

  async function abrir(ruta) {
    const p = construir();
    p.style.display = 'flex';
    try { if (call(D.despertarHud)) call(D.despertarHud, 'entrada', 6000); } catch (e) {}
    await cargarLista();
    pintarLista();
    let destino = ruta || null;
    if (!destino) { try { destino = localStorage.getItem('meso.guiaDoc'); } catch (e) {} }
    if (!destino || !lista.some(d => d.archivo === destino)) destino = lista[0] && lista[0].archivo;
    if (destino) await abrirDoc(destino);
    return true;
  }

  function cerrar() {
    if (!panel) return false;
    panel.style.display = 'none';
    return true;
  }

  function estaAbierta() { return !!(panel && panel.style.display !== 'none'); }

  function alternar() { return estaAbierta() ? (cerrar(), false) : (abrir(), true); }

  return {
    abrir, cerrar, alternar, estaAbierta,
    abrirDoc,
    // Para las pruebas: qué documentos hay y cuál está abierto.
    estado: () => ({
      abierta: estaAbierta(),
      cargado,
      documentos: lista.map(d => ({ archivo: d.archivo, titulo: d.titulo, grupo: d.grupo })),
      actual: docActual,
      HTML: (() => { try { const c = panel && panel.querySelector('.gd-doc'); return c ? c.innerHTML.length : 0; } catch (e) { return 0; } })()
    }),
    docActual: () => docActual,
    buscar: (t) => { filtro.texto = String(t || ''); if (panel) { try { panel.querySelector('.gd-busca').value = filtro.texto; } catch (e) {} pintarLista(); } return true; },
    irAAncla
  };
}

export default { createGuia };
