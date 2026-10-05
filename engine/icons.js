// ═══════════════════════════════════════════════════════════════════════════
//  ICONOS DE LA INTERFAZ (SVG monocromo, sin emojis)
// ═══════════════════════════════════════════════════════════════════════════
// La interfaz usaba EMOJIS a color (⚔️ 💨 🩹 📍 🐕 🎭 🧭 🪓 …) y se veía
// inconsistente: cada uno con su estilo, su grosor y su paleta, y además
// distintos en Windows, Linux y macOS. Aquí hay un juego de iconos PROPIOS, de
// línea y monocromos:
//
//   · pintan con `currentColor`, así que heredan el color del HUD y del tema
//     (no hay dos paletas que se peleen);
//   · se ven igual en cualquier sistema, porque son trazados, no glifos;
//   · el mismo dibujo sirve en el DOM (`svg(nombre)`) y en el lienzo
//     (`dibujar(ctx, …)`, con `Path2D`), así que la barra de habilidades y los
//     corazones del perro comparten repertorio.
//
// Cada icono es una lista de trazados en una rejilla de 24×24. `fill: true`
// significa relleno macizo (huella, corazón, destello); el resto son de línea.
const ICONOS = {
  // ── Habilidades y acciones ──────────────────────────────────────────────
  golpear: { d: ['M12 2.8v3.4', 'M12 17.8v3.4', 'M2.8 12h3.4', 'M17.8 12h3.4', 'M5.5 5.5l2.4 2.4', 'M16.1 16.1l2.4 2.4', 'M18.5 5.5l-2.4 2.4', 'M7.9 16.1l-2.4 2.4', 'M12 9.2 14.8 12 12 14.8 9.2 12z'] },
  dash: { d: ['M2.6 8.4h8.6', 'M2.6 12.2h12.2', 'M2.6 16h6.4', 'M15.4 6.6 20.4 12l-5 5.4'] },
  heal: { d: ['M4.6 5.6h14.8v13.8H4.6z', 'M12 9v6', 'M9 12h6'] },
  beacon: { d: ['M12 21.6s6.6-6.5 6.6-11A6.6 6.6 0 0 0 5.4 10.6c0 4.5 6.6 11 6.6 11z', 'M12 8.4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'] },
  perro: { fill: true, d: ['M7 9.4a1.9 1.9 0 1 0 0 .01z', 'M10.6 6.8a1.9 1.9 0 1 0 0 .01z', 'M14.6 6.8a1.9 1.9 0 1 0 0 .01z', 'M18 9.4a1.9 1.9 0 1 0 0 .01z', 'M12.6 12.6c3 0 5.4 1.9 5.4 4.1 0 1.7-1.5 2.9-3.3 2.9-1 0-1.6-.5-2.6-.5s-1.6.5-2.6.5c-1.8 0-3.3-1.2-3.3-2.9 0-2.2 2.4-4.1 5.4-4.1z'] },
  hand: { d: ['M8.6 12.6V6.9a1.4 1.4 0 0 1 2.8 0v4.3', 'M11.4 11.2V5.5a1.4 1.4 0 0 1 2.8 0v5.7', 'M14.2 11.6V7.2a1.4 1.4 0 0 1 2.8 0v7.4', 'M8.6 13.3 7.1 11.8a1.4 1.4 0 0 0-2 2l1.6 1.7c.7.7 1.1 1.7 1.1 2.7 0 1.6 1.3 2.9 2.9 2.9h3.2c1.7 0 3.1-1.4 3.1-3.1v-3.4'] },
  compass: { d: ['M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2z', 'M15.4 8.6 13.6 13.6 8.6 15.4 10.4 10.4z'] },
  hacha: { d: ['M13.2 4.6 19.4 10.8l-3.4 1.2-4.2-4.2z', 'M12.1 9.6 4.8 16.9', 'M4.2 17.6l2.2 2.2'] },
  casa: { d: ['M3.8 11.2 12 4.2l8.2 7', 'M6.4 10.4v9.2h11.2v-9.2', 'M10.2 19.6v-4.6h3.6v4.6'] },
  trueque: { d: ['M12 4.2v15.6', 'M6.4 20h11.2', 'M4.6 8.2h14.8', 'M4.6 8.2 1.8 14.2h5.6z', 'M19.4 8.2l-2.8 6h5.6z'] },
  destello: { fill: true, d: ['M12 3.2 13.9 9.1 19.8 11 13.9 12.9 12 18.8 10.1 12.9 4.2 11 10.1 9.1z', 'M18.8 4.4 19.5 6.3 21.4 7 19.5 7.7 18.8 9.6 18.1 7.7 16.2 7 18.1 6.3z'] },
  pergamino: { d: ['M7 4.6h7.4L19 9.2v10.2H7z', 'M14.2 4.7v4.6h4.6', 'M9.6 13h6', 'M9.6 16h6'] },
  arco: { d: ['M6.6 4.4c5 0 9 4 9 9', 'M6.6 4.4 15.4 13.2', 'M9.2 17.6 19.6 7.2', 'M15.4 6.9h4.4v4.4'] },
  // ── Interfaz ────────────────────────────────────────────────────────────
  lista: { d: ['M9 6.6h11', 'M9 12h11', 'M9 17.4h11', 'M4.4 6.6h.3', 'M4.4 12h.3', 'M4.4 17.4h.3'] },
  lapiz: { d: ['M4 20h4L20 8l-4-4L4 16z', 'M14.6 5.4l4 4'] },
  jugar: { fill: true, d: ['M8 5.4 18.6 12 8 18.6z'] },
  llave: { d: ['M15.4 3.6a5 5 0 0 0-4.6 7.2L4 17.6 6.4 20l6.8-6.8a5 5 0 0 0 6.4-6.7l-3 3-2.6-2.6z'] },
  lupa: { d: ['M10.6 4.4a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4z', 'M15.2 15.2 20.4 20.4'] },
  corazon: { fill: true, d: ['M12 20.6C6.6 16.6 3.6 13.7 3.6 10.4 3.6 8 5.5 6.1 7.9 6.1c1.5 0 2.9.7 3.6 1.9l.5.8.5-.8a4.6 4.6 0 0 1 3.7-1.9c2.4 0 4.3 1.9 4.3 4.3 0 3.3-3 6.2-8.5 10.2z'] },
  agua: { d: ['M12 3.6s6 6.6 6 10.4a6 6 0 1 1-12 0C6 10.2 12 3.6 12 3.6z'] },
  comida: { d: ['M4.6 11.4h14.8a7.4 7.4 0 0 1-14.8 0z', 'M3.4 19.4h17.2'] },
  sol: { d: ['M12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2z', 'M12 2.4v2.2', 'M12 19.4v2.2', 'M2.4 12h2.2', 'M19.4 12h2.2', 'M5.2 5.2l1.6 1.6', 'M17.2 17.2l1.6 1.6', 'M18.8 5.2l-1.6 1.6', 'M6.8 17.2l-1.6 1.6'] },
  luna: { fill: true, d: ['M15.4 3.4a9 9 0 1 0 5 12.6A7.3 7.3 0 0 1 15.4 3.4z'] },
  camara: { d: ['M4.4 8.4h3.2l1.4-2.1h6l1.4 2.1h3.2v10.3H4.4z', 'M12 9.7a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z'] },
  disco: { d: ['M4.6 4.6h11L19.4 8.4v11H4.6z', 'M8.2 4.7v4.9h7.6V4.7', 'M8.2 19.3v-5.6h7.6v5.6'] },
  diana: { d: ['M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z', 'M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z', 'M12 11.4a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2z'] },
  libro: { d: ['M4.5 5.2c2.6-1 5-.6 7.5.8 2.5-1.4 4.9-1.8 7.5-.8v13c-2.6-1-5-.6-7.5.8-2.5-1.4-4.9-1.8-7.5-.8z', 'M12 6v13'] },
  altavoz: { d: ['M4.5 9.5h3.2L12 5.6v12.8L7.7 14.5H4.5z', 'M15.4 9.2a4 4 0 0 1 0 5.6', 'M17.8 7.2a7.2 7.2 0 0 1 0 9.6'] },
  altavozBajo: { d: ['M4.5 9.5h3.2L12 5.6v12.8L7.7 14.5H4.5z', 'M15.4 9.2a4 4 0 0 1 0 5.6'] },
  altavozMudo: { d: ['M4.5 9.5h3.2L12 5.6v12.8L7.7 14.5H4.5z', 'M15.8 10l4.4 4', 'M20.2 10l-4.4 4'] },
  puerta: { d: ['M5.4 4.4h8.4v15.2H5.4z', 'M13.8 12h6', 'M17.2 9.4 19.8 12l-2.6 2.6'] },
  pausa: { fill: true, d: ['M7 5.4h3.6v13.2H7z', 'M13.4 5.4H17v13.2h-3.6z'] },
  // ── Gestos del personaje y acciones del caballo ─────────────────────────
  hablar: { d: ['M4.6 5.6h14.8v10.4H10.4L6 19.4v-3.4H4.6z', 'M8.4 9.4h7.2', 'M8.4 12.4h4.4'] },
  saludo: { d: ['M12.4 11.4V6.2a1.4 1.4 0 0 1 2.8 0v5.2', 'M15.2 11.2V7.4a1.3 1.3 0 0 1 2.6 0v5.4c0 3.4-2.4 5.8-5.4 5.8-2.2 0-4-1.3-5-3.4l-1-2.4', 'M9.6 11.6V8.6a1.4 1.4 0 0 0-2.8 0v4.6', 'M3 7.6a6 6 0 0 1 2.2-3', 'M2.8 12.4c0-1 .2-2 .5-2.9'] },
  nota: { fill: true, d: ['M10.4 13.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z', 'M12.9 16V4.8l6.6 1.8v9.2', 'M17.6 15.8a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z'] },
  silla: { d: ['M8 4.8h8v7.2H8z', 'M6.4 12h11.2', 'M7.4 12v7.6', 'M16.6 12v7.6'] },
  bombilla: { d: ['M12 3.4a5.6 5.6 0 0 0-3.1 10.3c.6.4 1 1 1 1.8v.7h4.2v-.7c0-.8.4-1.4 1-1.8A5.6 5.6 0 0 0 12 3.4z', 'M10.2 18.4h3.6', 'M10.8 20.6h2.4'] },
  herradura: { d: ['M6.6 17V12a5.4 5.4 0 0 1 10.8 0v5c0 .9-.7 1.6-1.6 1.6h-1.6v-5a2.2 2.2 0 0 0-4.4 0v5H8.2c-.9 0-1.6-.7-1.6-1.6z', 'M8.2 8.6h.2', 'M15.6 8.6h.2', 'M12 6.6h.2'] },
  cuerda: { d: ['M9.4 9.2c-2.3 0-4.2 1.9-4.2 4.2s1.9 4.2 4.2 4.2h5.2c2.3 0 4.2-1.9 4.2-4.2s-1.9-4.2-4.2-4.2z', 'M9.4 9.2l5.2 8.4', 'M14.6 9.2 9.4 17.6'] },
  viento: { d: ['M3.4 8.4h11.2a3 3 0 1 0-3-3', 'M3.4 13h14a3 3 0 1 1-3 3', 'M3.4 17.6h8'] },
  // Infección: una gota con el bicho dentro. Se usa en el HUD de supervivencia
  // cuando te contagias al registrar un cadáver en descomposición.
  infeccion: { d: ['M12 3.6s6 6.6 6 10.4a6 6 0 1 1-12 0C6 10.2 12 3.6 12 3.6z', 'M12 9.4a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z', 'M9.2 10.4h5.6', 'M9.2 15.2h5.6'] },
  // Visión de enemigos (tecla U): un ojo dentro de un cono.
  vision: { d: ['M2.6 12s3.6-5.4 9.4-5.4S21.4 12 21.4 12s-3.6 5.4-9.4 5.4S2.6 12 2.6 12z', 'M12 9.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z', 'M12 19.6v1.8'] },
  ajustes: { d: ['M4 7.4h16', 'M4 12h16', 'M4 16.6h16', 'M9 5.4v4', 'M15 10v4', 'M7.6 14.6v4'] }
};

// Trazado completo (para `Path2D` en el lienzo).
function trazado(nombre) {
  const ic = ICONOS[nombre];
  return ic ? ic.d.join(' ') : '';
}

function esRelleno(nombre) {
  const ic = ICONOS[nombre];
  return !!(ic && ic.fill);
}

// `<svg>` listo para meter en un `innerHTML`. Hereda el color del contenedor
// (`currentColor`), así no hay que pasarle colores por parámetro.
function svg(nombre, opciones) {
  const op = opciones || {};
  const ic = ICONOS[nombre];
  if (!ic) return '';
  const size = Number(op.size) || 18;
  const grosor = Number(op.grosor) || 1.8;
  const relleno = !!ic.fill;
  const clase = op.clase ? ' class="' + op.clase + '"' : '';
  const estilo = op.estilo ? ' style="' + op.estilo + '"' : '';
  const cuerpo = ic.d.join(' ');
  if (relleno) {
    return '<svg' + clase + estilo + ' width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' +
      'fill="currentColor" aria-hidden="true"><path d="' + cuerpo + '"/></svg>';
  }
  return '<svg' + clase + estilo + ' width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="' + grosor + '" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true"><path d="' + cuerpo + '"/></svg>';
}

// Dibuja el icono en un lienzo, centrado en (cx, cy).
function dibujar(ctx, nombre, cx, cy, size, color) {
  const d = trazado(nombre);
  if (!d || typeof Path2D !== 'function') return false;
  const s = (Number(size) || 18) / 24;
  ctx.save();
  ctx.translate(cx - (Number(size) || 18) / 2, cy - (Number(size) || 18) / 2);
  ctx.scale(s, s);
  const p = new Path2D(d);
  if (esRelleno(nombre)) {
    ctx.fillStyle = color || 'currentColor';
    ctx.fill(p);
  } else {
    ctx.strokeStyle = color || '#fff';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(p);
  }
  ctx.restore();
  return true;
}

export { ICONOS, svg as icono, trazado, esRelleno, dibujar as dibujarIcono };
if (typeof window !== 'undefined') {
  window.MESO_ICONS = { ICONOS, svg, icono: svg, trazado, esRelleno, dibujar, dibujarIcono: dibujar };
}
