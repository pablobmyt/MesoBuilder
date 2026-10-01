// tools/build-mesopotamia-sprites.js
// ─────────────────────────────────────────────────────────────────────────────
// Generador del pixel-art de los edificios mesopotámicos de MesoBuilder.
//
// El arte se escribe aquí como rejillas de texto legibles y el script lo vuelca
// en data/entity-pixels.json. Así el arte queda versionado y editable en texto
// en lugar de en miles de [x,y,color] a mano.
//
// Reglas del arte (importantes):
//   1. DENSIDAD 4: cada celda de mapa son 4 píxeles de arte.
//   2. La rejilla tiene la MISMA proporción que la huella del edificio:
//        casa 3×3 → 12×12 · casa comunal 5×2 → 20×8 · arco 2×1 → 8×4
//   3. El arte OCUPA TODA la rejilla: arriba el alero, abajo el contacto con
//      el suelo. Los sprites antiguos usaban 6 filas de 9 y el edificio
//      flotaba una celda sobre su huella (con la sombra por debajo).
//   4. Se dibuja a escala entera desde el ANCHO (ver drawEntitySpriteAt), así
//      que el ancho de la rejilla manda y un sprite puede sobresalir hacia
//      arriba (torres, pozos, atalayas) sin deformarse.
//
// Uso:
//   node tools/build-mesopotamia-sprites.js            escribe data/entity-pixels.json
//   node tools/build-mesopotamia-sprites.js --dry      sólo valida e informa
//   node tools/build-mesopotamia-sprites.js --align    alinea TODOS los sprites
//   node tools/build-mesopotamia-sprites.js --dump house temple
//
// DOS VISTAS, DOS SPRITES: el juego tiene vista de arriba (ortogonal) y vista
// isométrica, y un alzado no sirve para las dos. El JSON guarda el ALZADO (que en
// la vista de arriba se sustituye por la vista TECHO) y el motor genera las otras
// dos formas al vuelo: ver `engine/building-volume.js`.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PIXEL_FILE = path.join(ROOT, 'data', 'entity-pixels.json');
const DENSITY = 4;

// ── Paleta ──────────────────────────────────────────────────────────────────
const PALETTE = {
  '.': null,                                 // transparente
  // adobe y ladrillo cocido
  w: '#C9A058', W: '#D8BE8A', d: '#A07838', b: '#B08040', B: '#8A6430',
  // encalado y yeso
  z: '#EDE2C4', Z: '#D9CBA6', y: '#FFF7E4',
  // cañas, esteras y madera
  r: '#A8865D', R: '#8B6914', k: '#6B4E10', m: '#6B4226', M: '#4A2F12',
  // huecos: puertas, ventanas, vanos
  p: '#4A2F12', P: '#2A1808', v: '#3E2A1A', V: '#DAA520', n: '#FFE9A8',
  // piedra
  s: '#9AA0A6', S: '#BEC4CB', t: '#6E7075', T: '#4E5054',
  // agua
  a: '#2A6FA3', A: '#5FB6E8', l: '#1B4062',
  // vegetación
  g: '#7EC96A', G: '#4A7C3F', c: '#67A84E', q: '#3A6631',
  // lana / ganado
  o: '#F2EFE6', O: '#CFC8B8',
  // metal, fuego, oro
  e: '#8A9099', E: '#B9C0C8', f: '#E06A2A', F: '#FFC04A', u: '#DAA520', U: '#B8860B',
  // ventanas soviéticas (el motor recolorea '#3A3F47' para las variantes de barrio)
  i: '#3A3F47', I: '#5F6B7A',
  // terreno
  h: '#C2B184', H: '#A89468', x: '#8E7C56', X: '#6E5F42'
};

// Fila simétrica: escribe la mitad y el script la refleja (menos errores de ancho).
const sym = (half) => half + half.split('').reverse().join('');

// ── Arte ────────────────────────────────────────────────────────────────────
const ART = {};

// ── Viviendas ───────────────────────────────────────────────────────────────

// Casa de adobe: tejado plano con pretil, esteras de caña, vigas a la vista,
// ventanas altas con marco y arco de entrada con umbral.
ART.house = {
  tiles: { w: 3, h: 3 },
  art: [
    sym('TWWWWW'),   // albardilla del pretil (clara) con remates oscuros
    sym('Bwwwww'),   // cara del pretil
    sym('wzzzzz'),   // tejado de yeso
    sym('wzrrrr'),   // esteras de caña tendidas en el tejado
    sym('wzzzvv'),   // escalera de tejado (bloque oscuro al centro)
    sym('bWbWbW'),   // vigas de palma a la vista bajo el alero
    sym('zwwwww'),   // muro de adobe
    sym('zvwvvw'),   // ventanas altas con marco oscuro
    sym('zwwwww'),
    sym('zwwwww'),
    sym('zwwwwP'),   // arco de la puerta (vano oscuro)
    sym('xxxxxP')    // umbral y contacto con el suelo
  ]
};

// Casa pequeña: una crujía, más baja, con la misma construcción.
ART.house_small = {
  tiles: { w: 2, h: 2 },
  art: [
    sym('TWWW'),
    sym('Bwww'),
    sym('wzrr'),
    sym('bWbW'),
    sym('zwww'),
    sym('zvwv'),
    sym('zwwP'),
    sym('xxxP')
  ]
};

// Casa grande: dos alturas, escalera exterior y palmera.
ART.house_large = {
  tiles: { w: 4, h: 4 },
  art: [
    sym('TWWWWWWW'),
    sym('Bwwwwwww'),
    sym('BBBBBBBB'),
    sym('wzzzzzzz'),
    sym('wzrrrrrr'),
    sym('wzzzzzvv'),
    sym('bWbWbWbW'),
    sym('zwwwwwww'),
    sym('zvwvvwww'),
    sym('zwwwwwww'),
    sym('zwwwwwww'),
    sym('zvwvvwww'),
    sym('zwwwwwww'),
    sym('zwwwwwwP'),
    sym('xxxxxxxP'),
    sym('HHHHHHHH')
  ]
};

// Casa con huerto: vivienda a la izquierda y parcela con valla a la derecha.
ART.house_garden = {
  tiles: { w: 3, h: 3 },
  art: [
    'TWWWWWWW....',
    'Bwwwwwww....',
    'wzrrrrrrBBBB',
    'bWbWbWbWxgq.',
    'zwwwwwwwggqg',
    'zvwvvwwwvgcG',
    'zwwwwwwwggqg',
    'zwwwwwwwgcgc',
    'zwwwwwPPzgcg',
    'xxxxxxPPxhch',
    'HHHHHHHHHgh.',
    'HHHHHHHHHHHH'
  ]
};

// Casa aislada (4×3): el refugio del protagonista del prólogo. Tiene arte
// propio porque antes sólo tenía un ALIAS a `pixel_building_isolated`, un icono
// que NO existe en el catálogo: el motor caía a su dibujo de reserva y la casa
// del jugador (¡la primera que se ve en la partida!) salía como una caja plana.
// Misma construcción que el resto de la familia: pretil, esteras, vigas, marco
// de ventanas y arco de entrada con umbral, más dos crujías.
ART.house_isolated = {
  tiles: { w: 4, h: 3 },
  art: [
    'TTWWWWWWWWWWWWTT',   // albardilla del pretil con remates oscuros
    'BBwwwwwwwwwwwwBB',   // cara del pretil en sombra
    'wzzzrrrrrrrrzzzw',   // tejado de yeso con esteras de caña tendidas
    'bWbWbWbWbWbWbWbW',   // vigas de palma a la vista bajo el alero
    'zwwwwwwwwwwwwwwz',   // muro de adobe (dos crujías)
    'zvwvvwwwwwwvvwvz',   // ventanas altas con marco oscuro
    'zwwwwwwwwwwwwwwz',
    'zwwwwwwvwwvwwwwz',   // ventanucos de la crujía trasera
    'zwwwwwwwwwwwwwwz',
    'zwwwPPPPwwwwwwzz',   // arco de entrada (vano oscuro) en la crujía delantera
    'xxxPPPPxxxxxxxxx',   // umbral de piedra y contacto con el suelo
    'HHHHHHHHHHHHHHHH'
  ]
};

// Casa de piedra: sillares regulares y dintel de piedra.
ART.stone_house = {
  tiles: { w: 3, h: 3 },
  art: [
    sym('SSSSSS'),
    sym('ssssss'),
    sym('ssssss'),
    sym('tttttt'),
    'stStStStStSt',
    sym('ssssss'),
    'tstststststs',
    'svssssssssvs',
    'svsssPPsssss',
    'sssssPPsssss',
    'tttttPPttttt',
    'THHHHHHHHHHH'
  ]
};

// Casa mesopotámica encalada: arco de entrada, ventanas altas y palmera.
ART.mesopotamian_house = {
  tiles: { w: 3, h: 3 },
  art: [
    sym('Tyyyyy'),   // albardilla encalada
    sym('Zyyyyy'),   // cara del pretil
    sym('yyyyyy'),
    sym('yzzzzz'),   // tejado
    sym('yzrrrr'),   // esteras de caña
    sym('yzzzvv'),   // escalera de tejado
    sym('bWbWbW'),   // vigas a la vista
    sym('yzzzzz'),   // muro encalado
    sym('zvwvvz'),   // ventanas con reja
    sym('yzzzzz'),
    sym('yzzzzP'),   // arco de entrada
    sym('xxxxxP')    // umbral
  ]
};

// Casa comunal larga (5×2): tres puertas y tejado de cañas.
// Casa comunal larga (5×2): tres puertas y tejado de cañas.
ART.longhouse = {
  tiles: { w: 5, h: 2 },
  art: [
    sym('TTWWWWWWWW'),   // albardilla de la cubierta
    sym('Bwwwwwwwww'),   // cara del pretil
    sym('wzrrrrrrrr'),   // esteras de caña
    sym('bWbWbWbWbW'),   // vigas a la vista
    sym('zwwwwwwwww'),   // muro
    'zwvvwwPPwwwwPPwvvwwz'.slice(0, 20),  // ventanas y dos puertas
    'xxxxxxxxxxxxxxxxxxxx',
    'HHHHHHHHHHHHHHHHHHHH'
  ]
};

// Choza de caña: cúpula de juncos tejida (muy común en la ribera).
ART.hut = {
  tiles: { w: 2, h: 2 },
  art: [
    '..RRRR..',
    '.RyyyyR.',
    'RRyRRyRR',
    'RyRRRRyR',
    'RRyRRyRR',
    'RRwwwwRR',
    'wwwppwww',
    'HHHHHHHH'
  ]
};

// Choza con toldo de estera y hogar exterior.
ART.reed_hut = {
  tiles: { w: 2, h: 2 },
  art: [
    '..RRR...',
    '.RyyyR..',
    'RRyRRyR.',
    'RRRRRRRR',
    'RrrrrrrR',
    'RwwwwwwR',
    'fwppwwfw',
    'HHHHHHHH'
  ]
};

// Parcela labrada (1×1).
ART.farm_plot = {
  tiles: { w: 1, h: 1 },
  art: [
    'cgcg',
    'HHHH',
    'ghgh',
    'HXXH'
  ]
};

// Campo de cereal: surcos y espigas.
ART.farm = {
  tiles: { w: 2, h: 2 },
  art: [
    'cgcGcgcG',
    'GcGcGcGc',
    'cgcGcgcG',
    'GcGcGcGc',
    'cgcGcgcG',
    'GcGcGcGc',
    'XHXXHXXH',
    'HXXHXXHX'
  ]
};

// ── Edificios singulares ────────────────────────────────────────────────────

// Templo: basamento escalonado, contrafuertes y coronación encalada.
ART.temple = {
  tiles: { w: 4, h: 4 },
  art: [
    '...yyyyyyyyyy...',
    '..yZZZZZZZZZZy..',
    '..ywwwwwwwwwwy..',
    '.mBBBBBBBBBBBBm.',
    '.mWWWWWWWWWWWWm.',
    '.mzZZZZZZZZZZzm.',
    '.mzvwwvvvvwwvzm.',
    '.mzvwwvvvvwwvzm.',
    'mmzzwwwwwwwwzzmm',
    'msszzwwppwwzzssm',
    'msszzwppppwzzssm',
    'msszzzwppwzzzssm',
    'mssszzzzzzzzsssm',
    'msssssssssssssm.',
    'ttsssssssssssstt',
    'HHHHHHHHHHHHHHHH'
  ]
};

// Mercado: nave con toldo de tela, puestos y cajas.
ART.market = {
  tiles: { w: 4, h: 3 },
  art: [
    'mmmmmmmmmmmmmmmm',
    'ffffffffffffffff',
    'FFFFFFFFFFFFFFFF',
    'rrrrrrrrrrrrrrrr',
    'wwcrrcwwwwcrrcww',
    'wwcrrcwwwwcrrcww',
    'bwwwwbbwwwwwwwwb',
    'wwwwwwwwwwwwwwww',
    'uwwwwwwwwwwwwwwu',
    'HhhhhhhhhhhhhhhH',
    'HHHHHHHHHHHHHHHH',
    'XXXHHHHHHHHHHXXX'
  ]
};

// Granero: silos de cúpula sobre plataforma (los «hornos» de adobe clásicos).
ART.granary = {
  tiles: { w: 3, h: 3 },
  art: [
    '.RRRR..RRRR.',
    'RRuuRRRRuuRR',
    'RuuuuRRuuuuR',
    'RRRRRRRRRRRR',
    'wwwwwwwwwwww',
    'wWWWWWWWWWWw',
    'wbwbwbwbwbwb',
    'wvwvwwwwvwvw',
    'wwwwwwwwwwww',
    'zwwppwwwppwz',
    'zzzppzzzppzz',
    'xHHHHHHHHHHx'
  ]
};

// Baños públicos: naves con bóveda y canal de agua.
ART.mesopotamian_baths = {
  tiles: { w: 3, h: 2 },
  art: [
    'wwAAwwwwAAww',
    'wAAAwwwwAAAw',
    'zzzzzzzzzzzz',
    'zvwwvvvvvvwz',
    'zvwwvvvvvvwz',
    'zaaaaaaaaaaz',
    'zzaaaaaaaazz',
    'xHHHHHHHHHHx'
  ]
};

// Arco monumental (2×1): dos torreones y vano adintelado. Es la PUERTA de la
// ciudad, así que se dibuja como decoración pasable (no es un edificio que
// bloquee el paso) desde `applySettlementPlan`.
ART.mesopotamian_arch = {
  tiles: { w: 2, h: 1 },
  art: [
    'WW....WW',   // almenas de los dos torreones (hueco abierto arriba)
    'ww.mm.ww',   // viga de madera tendida entre los torreones
    'wwWWWWww',   // dintel de piedra
    'wwzPPzww',   // vano
    'wwzPPzww',
    'wwzPPzww',
    'wwzPPzww',
    'wwzPPzww',
    'BBBBBBBB',   // zócalo
    'HHHHHHHH'    // contacto con el suelo
  ]
};

// Villa noble: dos alas alrededor del patio, terraza alta, palmeras y sócalo.
ART.mesopotamian_villa_detailed = {
  tiles: { w: 5, h: 5 },
  art: [
    'gWWWWWWWWWWWWWWWWWWg',
    'gwwwwwwwwwwwwwwwwwwg',
    'gwwwwwwwwwwwwwwwwwwg',
    'gmBBBBBBBBBBBBBBBBmg',
    'gmzzzzzzzzzzzzzzzzmg',
    'gmzvwwvvvvvvvvwwvzmg',
    'gmzvwwvvvvvvvvwwvzmg',
    'gmzzzzzzzzzzzzzzzzmg',
    'gmmwwwwwwwwwwwwwwmmg',
    'gmzzzzzzzzzzzzzzzzmg',
    'gmzwwppppwwppppwwzmg',
    'gmzwwppppwwppppwwzmg',
    'gmzwwwwwwwwwwwwwwzmg',
    'gmzzzzzzzzzzzzzzzzmg',
    'gmssssssssssssssssmg',
    'gmssssssssssssssssmg',
    'gmssssssssssssssssmg',
    'gttssssssssssssssttg',
    'gHHHHHHHHHHHHHHHHHHg',
    'gHHHHHHHHHHHHHHHHHHg'
  ]
};

// ── Servicios, industria y mobiliario ───────────────────────────────────────

// Pozo (1×1): brocal, poste y tejadillo de cañas. Sobresale hacia arriba.
ART.well = {
  tiles: { w: 1, h: 1 },
  art: [
    '.RR.',
    'RRRR',
    'RmmR',
    'TmmT',
    'AaaA',
    'TttT'
  ]
};

// Fuente: pila de piedra con agua (2×2).
ART.fountain = {
  tiles: { w: 2, h: 2 },
  art: [
    '..uAAu..',
    'ssssssss',
    'sAAAAAAs',
    'sAaaaaAs',
    'sAaaaaAs',
    'sAAAAAAs',
    'ssssssss',
    'HHHHHHHH'
  ]
};

// Alfarería (2×2): horno con boca encendida y vasijas apiladas.
ART.pottery = {
  tiles: { w: 2, h: 2 },
  art: [
    '...kk...',
    '..ffFF..',
    '.wfFFFFw',
    'wWWWWWWw',
    'wWWWWWWw',
    'pwWWWWwp',
    'ppwwwwpp',
    'HHHHHHHH'
  ]
};

// Redil (3×2): cerca de madera con el corral de tierra apisonada y ovejas.
// El corral NO puede ser transparente: dejaba ver el fondo y parecía un
// edificio agujereado.
ART.sheepfold = {
  tiles: { w: 3, h: 2 },
  art: [
    'mmmmmmmmmmmm',
    'mhhhhhhhhhhm',
    'mhhooohhoohm',
    'mhhooohhoohm',
    'mhhohhhhohhm',
    'mhhhhhhhhhhm',
    'mhmhmhmhmhmm',
    'HHHHHHHHHHHH'
  ]
};

// Embarcadero (2×1): tablones sobre el agua.
ART.dock = {
  tiles: { w: 2, h: 1 },
  art: [
    'mmmmmmmm',
    'mMmmMmmM',
    'wwwwwwww',
    'aaaaaaaa',
    'AAAAAAAA'
  ]
};

// Atalaya (1×1): torre alta con almenas. Sobresale hacia arriba.
ART.watchtower = {
  tiles: { w: 1, h: 1 },
  art: [
    '.WW.',
    'uWWu',
    'WWWW',
    'WPPW',   // tronera: oscura, nunca transparente
    'WwwW',
    'WbbW',
    'WwwW',
    'WbbW',
    'WwwW',
    'HHHH'
  ]
};

// Torre defensiva (1×1).
ART.tower = {
  tiles: { w: 1, h: 1 },
  art: [
    '.WW.',
    'WWWW',
    'WPPW',
    'sSSs',
    'sTTs',
    'sTTs',
    'sTTs',
    'HHHH'
  ]
};

// Zigurat (12×12, arte 48×52): el edificio más grande del juego y la única
// maravilla del mapa. Se construye por CÓDIGO (no a mano) y está pensado como
// una pirámide escalonada VISTA DESDE ARRIBA, como el resto del arte del juego:
// cada terraza es un anillo concéntrico de 4 px (1 celda de mapa) con su muro
// sur (fachada), sus costados en sombra y su azotea al norte; dentro va la
// terraza siguiente y, en el centro, el santuario.
//
// REGLA DE ORO: el recinto base ocupa TODO el rectángulo del sprite, así que no
// hay ni un píxel transparente dentro de la huella (el arte anterior dejaba
// huecos entre terrazas y el zigurat se veía "transparente" contra el suelo).
//
// Capas: 5 terrazas concéntricas · jardines colgantes en las dos intermedias ·
// hornacinas y contrafuertes en los muros · escalinata procesional con
// balaustradas y peldaños alternos · escaleras laterales en el recinto ·
// santuario con techo de oro, cuernos y estandartes · hiladas alternas, juntas
// de ladrillo, moldura dorada en las terrazas altas y sombra de contacto.
function buildZigguratArt() {
  const W = 48, H = 52;
  const grid = Array.from({ length: H }, () => new Array(W).fill('.'));
  const put = (r, c, ch) => { if (r >= 0 && r < H && c >= 0 && c < W && ch) grid[r][c] = ch; };
  const hline = (r, c0, c1, ch) => { const a = Math.min(c0, c1), b = Math.max(c0, c1); for (let c = a; c <= b; c++) put(r, c, ch); };
  const vline = (c, r0, r1, ch) => { const a = Math.min(r0, r1), b = Math.max(r0, r1); for (let r = a; r <= b; r++) put(r, c, ch); };
  const box = (r0, c0, r1, c1, ch) => { for (let r = r0; r <= r1; r++) hline(r, c0, c1, ch); };

  // Terrazas: píxeles que se mete cada una respecto al borde del sprite.
  // El salto entre terrazas es 4 px = 1 celda: el anillo es muro, no hueco.
  const RINGS = [0, 4, 9, 14, 19];
  const SHR = { r0: 19, r1: 28, c0: 19, c1: 28 };   // plataforma + santuario
  const STX0 = 21, STX1 = 26;                       // escalinata (6 px = 1,5 celdas)

  // ── 1. Terrazas concéntricas ────────────────────────────────────────────
  for (let i = 0; i < RINGS.length; i++) {
    const o = RINGS[i];
    const next = RINGS[i + 1];
    const r0 = o, r1 = H - 1 - o, c0 = o, c1 = W - 1 - o;
    const ir0 = (next === undefined) ? SHR.r0 : next;
    const ir1 = (next === undefined) ? SHR.r1 : H - 1 - next;
    const ic0 = (next === undefined) ? SHR.c0 : next;
    const ic1 = (next === undefined) ? SHR.c1 : W - 1 - next;
    const isTop = next === undefined;               // terraza del santuario
    const stone = i === 0;                          // el recinto base va en piedra
    const body = stone ? 's' : 'w';
    const bodyLit = stone ? 'S' : 'W';
    const bodyDark = stone ? 't' : 'd';

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (r > ir0 && r < ir1 && c > ic0 && c < ic1) continue;   // la cubre la terraza interior
        const north = r <= ir0;                                   // azotea (lado lejano)
        const south = r >= ir1;                                   // fachada (lado cercano)
        const side = c <= ic0 || c >= ic1;                        // costados en sombra
        let ch;
        if (north) ch = ((c % 4 === 0) ? bodyDark : (c % 8 === 0 ? body : bodyLit));
        else if (south) ch = (((r % 2 === 0) || (c % 6 === 0)) ? bodyDark : body);
        else if (side) ch = ((r % 2 === 0) ? bodyDark : body);
        else ch = ((c % 4 === 0) || (r % 4 === 0)) ? bodyLit : body;
        // Junta de ladrillo / losa: da textura de fábrica a todo el muro
        if ((r % 4 === 3) && !north && ((c + (r >> 2)) % 2 === 0)) ch = bodyDark;
        put(r, c, ch);
      }
      // Filo exterior de la terraza: 1 px oscuro (separa terraza de terraza) y,
      // en el lado sur, filo iluminado (el sol viene del norte-oeste).
      put(r, c0, bodyDark); put(r, c1, bodyDark);
      if (r < ir0 || r > ir1) { put(r, c0, bodyDark); put(r, c1, bodyDark); }
    }
    // Azotea de la terraza: banda norte más clara (superficie vista desde arriba)
    for (let c = c0 + 1; c < c1; c++) { put(r0 + 1, c, ((c % 4 === 0) ? body : bodyLit)); }
    // Fachada sur: filo superior iluminado (borde de la azotea sobre el muro)
    if (!isTop) hline(r1 - 3, c0 + 1, c1 - 1, bodyLit);

    // Moldura iluminada en el borde interior (donde arranca la terraza de dentro)
    if (!isTop) {
      hline(ir0 - 1, ic0, ic1, bodyLit);
      vline(ic0 - 1, ir0, ir1, bodyLit);
      vline(ic1 + 1, ir0, ir1, bodyLit);
      // Sombra de contacto de la terraza de dentro sobre la azotea
      hline(ir0 + 1, ic0 + 1, ic1 - 1, bodyDark);
    }

    // Hornacinas (vanos ciegos) repartidas por la fachada sur
    for (let c = c0 + 3; c <= c1 - 3; c += 8) {
      if (STX0 - 1 <= c && c <= STX1 + 1) continue;               // no tapar la escalinata
      put(r1 - 1, c, 'v'); put(r1 - 2, c, 'v'); put(r1 - 3, c, 'v');
    }
    // Contrafuertes en las cuatro esquinas de cada terraza
    for (const [rr, cc] of [[r1 - 1, c0 + 1], [r1 - 1, c1 - 2], [r1 - 2, c0 + 1], [r1 - 2, c1 - 2]]) {
      put(rr, cc, 'B'); put(rr, cc + 1, 'B');
    }
    // Orla dorada en las terrazas altas
    if (i >= 2 && !isTop) { hline(r1, c0 + 1, c1 - 1, 'V'); }
    // Jardines colgantes sobre la azotea de las terrazas intermedias
    if (i === 1 || i === 2) {
      const gy = ir0 - 1, gx0 = ic0 - 1, gx1 = ic1 + 1;
      for (let c = gx0; c <= gx1; c++) {
        if (c >= STX0 - 2 && c <= STX1 + 2) continue;             // hueco de la escalinata
        if (c % 3 === 0) put(gy, c, 'g');
        else if (c % 3 === 1) put(gy, c, 'c');
        else put(gy, c, 'G');
      }
      put(gy + 1, gx0, 'q'); put(gy + 1, gx1, 'q');               // raíces en sombra
      if (i === 2) { put(gy, gx0 + 2, 'g'); put(gy, gx1 - 2, 'g'); }
    }
    // Almenas en el recinto base
    if (i === 0) {
      for (let c = c0; c <= c1; c += 3) { put(r1 - 1, c, 'T'); put(r1 - 2, c, 'T'); }
    }
  }

  // ── 2. Santuario de la cima: techo de oro, vano, cuernos y estandartes ──
  box(SHR.r0 + 1, SHR.c0 + 1, SHR.r1 - 1, SHR.c1 - 1, 'z');       // templete encalado
  box(SHR.r0 + 1, SHR.c0 + 1, SHR.r0 + 3, SHR.c1 - 1, 'u');       // techo de oro
  hline(SHR.r0 + 1, SHR.c0 + 1, SHR.c1 - 1, 'U');
  hline(SHR.r0 + 2, SHR.c0 + 2, SHR.c1 - 2, 'V');                 // brillo del techo
  box(SHR.r1 - 4, SHR.c0 + 4, SHR.r1 - 1, SHR.c0 + 5, 'P');       // vano del santuario
  hline(SHR.r1 - 4, SHR.c0 + 3, SHR.c0 + 6, 'z');
  box(SHR.r1 - 2, SHR.c1 - 6, SHR.r1 - 1, SHR.c1 - 5, 'P');       // hornacina lateral
  for (const c of [SHR.c0 + 1, SHR.c1 - 1]) {                     // estandartes
    vline(c, SHR.r0, SHR.r0 + 5, 'm');
    put(SHR.r0, c, 'f'); put(SHR.r0 + 1, c, 'F'); put(SHR.r0 + 2, c, 'f');
  }
  // Cuernos del santuario (detalle clásico): 2×3 px de oro en las esquinas
  for (const [rr, cc] of [[SHR.r1 - 1, SHR.c0], [SHR.r1 - 1, SHR.c1 - 1]]) {
    put(rr, cc, 'V'); put(rr, cc + 1, 'V'); put(rr - 1, cc, 'V'); put(rr - 1, cc + 1, 'V'); put(rr - 2, cc, 'U'); put(rr - 2, cc + 1, 'U');
  }

  // ── 3. Escalinata procesional: peldaños alternos y balaustradas ─────────
  for (let r = H - 1; r >= SHR.r1 - 3; r--) {
    const ch = (r % 2 === 0) ? 'W' : 'd';
    hline(r, STX0, STX1, ch);
    if (r % 4 === 0) hline(r, STX0, STX1, 'B');                   // rellano cada 4 peldaños
  }
  vline(STX0 - 1, H - 1, SHR.r1 - 3, 'B');                        // balaustradas
  vline(STX1 + 1, H - 1, SHR.r1 - 3, 'B');
  vline(STX0 - 2, H - 1, SHR.r1 - 3, 'T');
  vline(STX1 + 2, H - 1, SHR.r1 - 3, 'T');
  // Remate de las balaustradas: dos pilares con capitel dorado
  box(H - 4, STX0 - 2, H - 1, STX0 - 1, 'T'); box(H - 4, STX1 + 1, H - 1, STX1 + 2, 'T');
  hline(H - 5, STX0 - 2, STX0 - 1, 'V'); hline(H - 5, STX1 + 1, STX1 + 2, 'V');
  // Puerta monumental del recinto, alrededor de la escalinata
  hline(H - 1, STX0 - 5, STX0 - 3, 'y');
  hline(H - 1, STX1 + 3, STX1 + 5, 'y');
  box(H - 4, STX0 - 5, H - 2, STX0 - 4, 'P'); box(H - 4, STX1 + 4, H - 2, STX1 + 5, 'P');
  // Estatuas guardianas a los lados del vano
  box(H - 6, STX0 - 8, H - 3, STX0 - 6, 'T'); box(H - 6, STX1 + 6, H - 3, STX1 + 8, 'T');
  put(H - 7, STX0 - 7, 'T'); put(H - 7, STX1 + 7, 'T');
  // Escaleras laterales del recinto (rampas cortas en los costados)
  for (let r = H - 8; r <= H - 1; r++) {
    hline(r, 3, 6, (r % 2 === 0) ? 'W' : 'd');
    hline(r, W - 7, W - 4, (r % 2 === 0) ? 'W' : 'd');
  }

  return grid.map(r => r.join(''));
}

ART.ziggurat = {
  tiles: { w: 12, h: 12 },
  art: buildZigguratArt()
};

// Farola (1×1).
ART.lamp_post = {
  tiles: { w: 1, h: 1 },
  art: [
    '.FF.',
    '.nn.',
    '.mm.',
    '.mm.',
    '.mm.',
    'HHHH'
  ]
};

// ── Murallas ────────────────────────────────────────────────────────────────
// Las murallas son estructuras FINAS: 4 px de ancho (1 celda × densidad 4) dan
// sólo 4 columnas de arte, así que toda la calidad va en el ALTO (el adarve,
// las almenas y las hiladas). Antes se dibujaban con rectángulos fraccionarios
// del ancho de la celda y se veían borrosos al lado de los sprites de verdad.
//
// Muro horizontal (corre de izquierda a derecha): se ve la cara frontal.
// IMPORTANTE: la silueta NO lleva transparencias. Con almenas separadas por
// huecos transparentes, dos celdas seguidas parecían bloques sueltos («hay
// separación entre las murallas»); ahora el parapeto es continuo y los vanos
// son aspilleras oscuras DENTRO del muro.
ART.wall_segment_h = {
  tiles: { w: 1, h: 1 },
  art: [
    'WWWW',   // parapeto: filo iluminado, continuo
    'wwww',
    'wvWv',   // aspilleras (vanos oscuros, no agujeros)
    'wvWv',
    'dddd',   // junta de hilada
    'bbbb',
    'wwww',
    'dddd',   // junta de hilada
    'BBBB',   // zócalo
    'HHHH'
  ]
};

// Muro vertical (corre de arriba a abajo): remate, costado y aspilleras.
ART.wall_segment_v = {
  tiles: { w: 1, h: 1 },
  art: [
    'WWWW',
    'bWwd',
    'bvvd',
    'bvvd',
    'bWwd',
    'dddd',
    'bWwd',
    'bwwd',
    'bWwd',
    'dddd',
    'BBBB',
    'HHHH'
  ]
};

// Puerta de muralla vista de lado (1×2 celdas → 4 columnas × 10 filas): dos
// pilares con el vano oscuro en medio y viga de madera. Es la pareja vertical
// de `mesopotamian_arch`, para las puertas de los lados este/oeste.
ART.mesopotamian_gate_v = {
  tiles: { w: 1, h: 2 },
  art: [
    'WWWW',   // cornisa
    'mmmm',   // viga de madera
    'WPPW',   // vano (paso oscuro)
    'WPPW',
    'WPPW',
    'WPPW',
    'zPPz',
    'zPPz',
    'BPPB',   // base de los pilares
    'HHHH'
  ]
};

// Torre de muralla (2×2 celdas → 8 columnas de arte). Cuatro almenas, adarve,
// tronera y zócalo. Sobresale hacia arriba (3 celdas y media de alto).
ART.wall_tower = {
  tiles: { w: 2, h: 2 },
  art: [
    'WW.WW.WW',
    'ww.ww.ww',
    'ww.ww.ww',
    'WWWWWWWW',
    'wwwwwwww',
    'bwwwwwwb',
    'dddddddd',
    'bwwPPwwb',
    'bwwPPwwb',
    'dddddddd',
    'bwwwwwwb',
    'dbbbbbbd',
    'dddddddd',
    'HHHHHHHH'
  ]
};

// ── Industria soviética ─────────────────────────────────────────────────────

// Cueva (1×1): montículo de piedra con la entrada oscura. Se levanta en el
// destino de la misión «¿qué hace mi hijo en la cueva?».
ART.cueva = {
  tiles: { w: 1, h: 1 },
  art: [
    'TTT.',
    'TssT',
    'ssss',
    'sPPs',   // entrada
    'sPPs',
    'HHHH'
  ]
};
// Los edificios industriales heredados tenían arte de 12×12 o 14×14 px para
// huellas de 4×3 a 5×5 celdas: al escalarlos a su caja, cada píxel de arte se
// convertía en un bloque enorme y el edificio se veía como un mosaico (y con
// huecos por donde asomaba el fondo). Ahora van a densidad 4 como el resto.

// Bloque soviético (3×3): vivienda de paneles con tres fajas de ventanas y
// portal. El arte heredado era de 44×44 px para 3 celdas (densidad 14,7 frente
// a las 4 del resto): cada píxel de arte salía a un tercio de tamaño y el
// bloque se veía de otra escala que sus vecinos.
ART.soviet_block = {
  tiles: { w: 3, h: 3 },
  art: [
    sym('SSSSSS'),   // cornisa
    sym('sSSSSs'),
    sym('siIiIi'),   // ventanas
    sym('siIiIi'),
    sym('sSSSSs'),   // faja de paneles
    sym('siIiIi'),
    sym('siIiIi'),
    sym('sSSSSs'),
    sym('siIiIi'),
    sym('sSSSpp'),   // portal (centro)
    sym('sSSSpp'),
    sym('TTTTTT')    // zócalo
  ]
};

// Módulo industrial (2×2): nave con chimenea, dientes de sierra, ventanales y
// zócalo. El módulo se REPITE en retícula, así que no puede tener ni una fila
// transparente (al repetirse se vería como un enrejado de huecos): todas las
// filas son macizas y el color oscuro hace las veces de sombra.
ART.foundry_module = {
  tiles: { w: 2, h: 2 },
  art: [
    'EEEEEEEe',   // alero superior + boca de la chimenea
    'EeEeEeEt',   // dientes de sierra (metal claro/oscuro alternos) + chimenea
    'EEEEEEEE',   // alero
    'sSSSSSSS',   // muro de hormigón
    'spEpEpEp',   // ventanales
    'spEpEpEp',
    'sSSSSSSS',
    'TTTTTTTT'    // zócalo (el terreno al pie lo pone el complejo entero)
  ]
};

// Fábrica (5×4): nave larga con chimenea y portón de carga.
ART.factory = {
  tiles: { w: 5, h: 4 },
  art: [
    'ee..................',
    'EtE.................',
    'EtE.................',
    'EtEE.E.E.E.E.E.E.E.E',   // chimenea + dientes de sierra
    'EEEEEEEEEEEEEEEEEEEE',   // alero
    'sSSSSSSSSSSSSSSSSSSS',   // muro
    'spEpEpEpEpEpEpEpEpEp',   // ventanales
    'spEpEpEpEpEpEpEpEpEp',
    'sSSSSSSSSSSSSSSSSSSS',
    'sSSSSSSSPPPSSSSSSSSS',   // portón de carga
    'sSSSSSSSPPPSSSSSSSSS',
    'sSSSSSSSSSSSSSSSSSSS',
    'TTTTTTTTTTTTTTTTTTTT',   // zócalo
    'tttttttttttttttttttt',
    'xhhhhhhhhhhhhhhhhhhh',   // terreno apisonado
    'HHHHHHHHHHHHHHHHHHHH'
  ]
};

// Almacén estatal (4×3): nave baja, ventanas y puerta corredera.
ART.state_warehouse = {
  tiles: { w: 4, h: 3 },
  art: [
    'EEEEEEEEEEEEEEEE',   // alero metálico
    'sSSSSSSSSSSSSSSs',
    'spEpEpSSSSSSSSSs',   // ventanas
    'spEpEpSSSSSSSSSs',
    'sSSSSSSSSSSSSSSs',
    'sSSSSSSSpppppSSs',   // puerta corredera
    'sSSSSSSSpppppSSs',
    'sSSSSSSSpPpppSSs',
    'sSSSSSSSpppppSSs',
    'TTTTTTTTTTTTTTTT',   // zócalo
    'xhhhhhhhhhhhhhhh',
    'HHHHHHHHHHHHHHHH'
  ]
};

// Sede del partido (5×5): bloque de hormigón simétrico con columnas, bandera
// roja sobre la puerta y ventanales en las alas (arte con `sym`).
ART.party_hq = {
  tiles: { w: 5, h: 5 },
  art: [
    sym('TTTTTTTTTT'),   // cornisa
    sym('SSSSSSSSSS'),   // friso
    sym('sSSSSSSSSS'),
    sym('spEpSSSSSS'),   // ventanales de las alas
    sym('spEpSSSSSS'),
    sym('sSSSSSSSff'),   // bandera roja
    sym('sSSSSSSSFF'),
    sym('sSSSSSSSSS'),
    sym('spEpSSSSSS'),
    sym('spEpSSSSSS'),
    sym('sSSSSSSSSS'),
    sym('sSSSSSSSpp'),   // puerta central
    sym('sSSSSSSSpp'),
    sym('sSSSSSSSpp'),
    sym('sSSSSSSSpp'),
    sym('sSSSSSSSpp'),
    sym('TTTTTTTTTT'),   // zócalo
    sym('tttttttttt'),
    sym('xhhhhhhhhh'),
    sym('HHHHHHHHHH')
  ]
};

// ── Utilidades ──────────────────────────────────────────────────────────────
function gridOf(spec) {
  // El ANCHO manda (marca la escala): rejilla = huella × densidad.
  // El ALTO puede ser mayor que la huella: pozos, torres, atalayas y farolas
  // sobresalen hacia arriba sin deformarse.
  const fac = spec.refined || 1;
  const gw = spec.tiles.w * DENSITY * fac;
  const footprintH = spec.tiles.h * DENSITY * fac;
  const gh = Math.max(footprintH, (spec.art || []).length);
  return { gw, gh, footprintH };
}

// ── Refinado ×2 (densidad 8) ────────────────────────────────────────────────
// El suelo, el empedrado del camino y las transiciones se generan a resolución
// de celda (32 px), pero los edificios iban a densidad 4: cada píxel de arte
// medía 4 px en pantalla y, al lado del camino, parecían de otro juego.
//
// Este paso duplica la rejilla (cada carácter → bloque 2×2, o sea 2 px en
// pantalla) y encima pinta fábrica: hiladas horizontales cada 4 px, llagas
// verticales alternas (para que se lea el ladrillo) y un dither de tonos.
const DARKER = {
  W: 'w', w: 'd', d: 'B', b: 'B', B: 'T', y: 'Z', z: 'Z', Z: 'z',
  r: 'R', R: 'k', k: 'm', x: 'H', h: 'H', H: 'X', X: 'X',
  s: 't', S: 's', t: 'T', T: 'T', g: 'G', G: 'q', c: 'q', o: 'O', O: 'O',
  m: 'M', M: 'M', p: 'P', v: 'P'
};
const PALER = {
  W: 'y', w: 'W', d: 'w', b: 'w', B: 'b', Z: 'z', z: 'y', y: 'y',
  r: 'R', R: 'r', x: 'h', h: 'x', H: 'h', s: 'S', t: 's', g: 'c', G: 'g', c: 'g'
};

// Grupo de material de cada carácter: sirve para saber dónde acaba una fábrica y
// empieza otra (muro/tejado, hueco, piedra, terreno…) y rematar bien los bordes.
const MAT = {
  '.': 0,
  w: 1, W: 1, d: 1, b: 1, B: 1, z: 1, Z: 1, y: 1,     // fábrica: adobe, yeso, encalado
  r: 2, R: 2, k: 2, m: 2, M: 2,                       // caña, madera, vigas
  p: 3, P: 3, v: 3, V: 3, n: 3, i: 3, I: 3,           // huecos y ventanas
  s: 4, S: 4, t: 4, T: 4,                             // piedra y metal
  a: 5, A: 5, l: 5,                                   // agua
  g: 6, G: 6, c: 6, q: 6,                             // vegetación
  o: 7, O: 7, u: 7, U: 7, e: 7, E: 7, f: 7, F: 7,     // varios
  h: 8, H: 8, x: 8, X: 8                              // terreno
};
const matOf = (ch) => (ch === undefined || ch === null || MAT[ch] === undefined) ? -1 : MAT[ch];

function refineArt(art, F, opts) {
  const fac = F || 4;
  // Frecuencia de las juntas, en píxeles del arte REFINADO: por defecto una hilada
  // y una llaga por píxel de arte original (course = fac). El zigurat usa juntas
  // más separadas porque su dibujo ya trae escalinatas y hornacinas de 1 px.
  const course = (opts && opts.coursing) || fac;
  const llagaMod = (opts && opts.llaga) || course;
  const H = art.length, W = art[0].length;
  const out = [];
  for (let y = 0; y < H * fac; y++) out.push(new Array(W * fac).fill('.'));
  // El tamaño en pantalla manda: un edificio se dibuja ocupando su huella, así
  // que el píxel de arte mide (tileSize × huella) / ancho_arte. Con la rejilla
  // base (densidad 4) medía 12 px en pantalla; al ×8 mide 1,5 px, y el motor lo
  // REDUCE al solar con remuestreo suave: de ahí el grano fino.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = art[y][x];
      const mat = matOf(ch);
      // Bordes de material: si el bloque de arriba es de otra fábrica (tejado,
      // terreno, hueco…), su primera fila es un remate iluminado (coping, dintel,
      // alféizar); si el de abajo es distinto, la última fila es base en sombra.
      const upDiff = y > 0 && mat !== matOf(art[y - 1][x]);
      const downDiff = y < H - 1 && mat !== matOf(art[y + 1][x]);
      for (let dy = 0; dy < fac; dy++) {
        for (let dx = 0; dx < fac; dx++) {
          const gy = y * fac + dy, gx = x * fac + dx;
          let c = ch;
          if (ch !== '.' && ch !== 'P') {
            const hilada = (gy % course) === course - 1;                          // junta horizontal
            const llaga = ((gx + 2 * Math.floor(gy / course)) % llagaMod) === 2;   // junta vertical alterna
            if (upDiff && dy === 0) c = PALER[ch] || ch;                          // remate claro del borde
            else if (downDiff && dy === fac - 1) c = DARKER[ch] || ch;            // base en sombra
            else if (hilada) c = DARKER[ch] || ch;
            else if (llaga) c = DARKER[ch] || ch;
            else if (dy === fac - 1 && dx === fac - 1 && PALER[ch] && ((x + y) % 2 === 0)) c = PALER[ch];
          }
          out[gy][gx] = c;
        }
      }
    }
  }
  return out.map(r => r.join(''));
}

// ── Refinado del repertorio completo (densidad 32 = ×8 sobre la rejilla base) ──
// El arte se escribe a mano a densidad 4 (el «esquema» del edificio) y aquí se
// lleva al óctuple añadiendo fábrica de verdad: hiladas, llagas alternas, remates
// claros en los bordes de material y bases en sombra. El motor lo REDUCE después
// al tamaño del solar, así que en pantalla el grano pasa de 12 px a 1,5 px.
const REFINE_FAC = 8;
const REFINE_HOUSING = [
  'house', 'house_small', 'house_large', 'house_garden', 'house_isolated',
  'hut', 'reed_hut', 'mesopotamian_house', 'longhouse'
];
const REFINE_CIVIC = [
  'stone_house', 'temple', 'market', 'granary', 'mesopotamian_baths',
  'mesopotamian_villa_detailed', 'pottery', 'sheepfold', 'well', 'fountain',
  'watchtower', 'tower', 'dock', 'lamp_post', 'cueva'
];
const REFINE_WALLS = [
  'wall_segment_h', 'wall_segment_v', 'wall_tower', 'mesopotamian_gate_v', 'mesopotamian_arch'
];
const REFINE_SOVIET = [
  'soviet_block', 'foundry_module', 'factory', 'state_warehouse', 'party_hq'
];
for (const name of [...REFINE_HOUSING, ...REFINE_CIVIC, ...REFINE_WALLS, ...REFINE_SOVIET]) {
  const spec = ART[name];
  if (!spec || !Array.isArray(spec.art) || !spec.art.length) continue;
  const gw = spec.tiles.w * DENSITY;
  if (spec.art[0].length > gw) {
    console.log('AVISO ' + name + ': ' + spec.art[0].length + ' columnas de arte para una rejilla de ' + gw + '; se queda a densidad 4');
    continue;
  }
  spec.art = refineArt(spec.art, REFINE_FAC);
  spec.refined = REFINE_FAC;
}

// El zigurat se construye por código a 48 px para 12 celdas. Va al óctuple con las
// juntas cada 16 px (una hilada cada 2 px del arte original): es un monumento con
// escalinatas y hornacinas de 1 px y no admite trama fina encima.
if (ART.ziggurat && Array.isArray(ART.ziggurat.art)) {
  ART.ziggurat.art = refineArt(ART.ziggurat.art, REFINE_FAC, { coursing: 2 * REFINE_FAC, llaga: 2 * REFINE_FAC });
  ART.ziggurat.refined = REFINE_FAC;
}

// Convierte el arte a la lista [x, y, color] que espera el motor.
function toPixels(spec, palette) {
  const { gw, gh } = gridOf(spec);
  const pixels = [];
  for (let y = 0; y < spec.art.length; y++) {
    const row = spec.art[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const col = palette[ch];
      if (col === undefined) throw new Error('carácter sin color en la paleta: "' + ch + '"');
      if (col) pixels.push([x, y, col]);
    }
  }
  return pixels;
}

// Comprueba que cada rejilla tiene el tamaño exacto de su huella.
function validate() {
  const errors = [];
  for (const [name, spec] of Object.entries(ART)) {
    const { gw, gh, footprintH } = gridOf(spec);
    if (!spec.art || !spec.art.length) { errors.push(name + ': sin arte'); continue; }
    if (spec.art.length < footprintH) errors.push(name + ': ' + spec.art.length + ' filas, la huella necesita ' + footprintH);
    if (spec.art.length > footprintH * 3) errors.push(name + ': sobresale demasiado (' + spec.art.length + ' filas para una huella de ' + footprintH + ')');
    spec.art.forEach((row, i) => {
      if (row.length > gw) errors.push(name + ' fila ' + i + ': ' + row.length + ' columnas, se esperaban ' + gw);
      for (const ch of row) if (PALETTE[ch] === undefined) errors.push(name + ' fila ' + i + ': carácter desconocido "' + ch + '"');
    });
    const last = spec.art[spec.art.length - 1] || '';
    if (/^\.*$/.test(last)) errors.push(name + ': la última fila está vacía (el edificio flotaría)');
  }
  return errors;
}

// Rellena por la derecha con '.' las filas cortas (el arte ya apoya abajo).
function normalize(spec) {
  const { gw } = gridOf(spec);
  return spec.art.map(r => r.length >= gw ? r.slice(0, gw) : r + '.'.repeat(gw - r.length));
}

// Versión oscurecida del arte (para mesopotamian_house_shaded).
function shadeHex(hex, factor) {
  if (typeof hex !== 'string' || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function shadePixels(pixels, factor) {
  const cache = new Map();
  const shade = (hex) => {
    if (cache.has(hex)) return cache.get(hex);
    const out = shadeHex(hex, factor);
    cache.set(hex, out);
    return out;
  };
  return pixels.map(p => [p[0], p[1], shade(p[2])]);
}

// ── Volumen isométrico (2.5D): YA NO SE GRABA EN EL JSON ────────────────────
// El volumen (bajar el alzado, levantar el pretil hacia las esquinas y pintar el
// tejado encima) es una DEFORMACIÓN pensada para la vista isométrica, y en la
// vista de arriba —la que viene por defecto— estropeaba el edificio (con el
// tejado en pico parece una tienda de campaña). Como el JSON es uno solo para las
// dos vistas, el volumen se aplica **al vuelo en el motor y sólo en isométrico**:
//
//   engine/building-volume.js   →  addIsometricVolume() + VOLUMEN (ajustes)
//   engine/game-engine.js       →  getSpriteSourceBitmap() lo aplica si viewMode === 'iso'
//
// Así el JSON guarda el ALZADO original (lo que se ve en la vista de arriba, que
// es la que el juego usa de serie) y en isométrico se le añade el cuerpo. De paso
// el fichero vuelve a ser un 30 % más pequeño (el volumen era ~3.000 px por
// edificio).
//
// Para ajustarlo sin tocar código:  MESO_DEBUG.testDraw.volumen({ pendiente: 0.45 })
// o, en la consola, `MESO_DEBUG.testDraw.volumen({ activo: false })` para apagarlo.
// Alinea un icono existente: quita el hueco vacío de abajo subiendo el arte.
function alignIcon(def) {
  const pixels = def.pixels || [];
  if (!pixels.length) return { moved: 0, def };
  const gw = def.gridW || def.grid || 9;
  const gh = def.gridH || def.grid || 9;
  let maxY = 0;
  pixels.forEach(p => { if (p[1] > maxY) maxY = p[1]; });
  const gap = gh - 1 - maxY;
  if (gap <= 0) return { moved: 0, def };
  return { moved: gap, def: { ...def, pixels: pixels.map(p => [p[0], p[1] + gap, p[2]]) } };
}

// Iconos que NO son entidades del mundo (objetos de inventario, banderas de UI):
// se dibujan centrados en su recuadro, así que bajarlos los descentraría.
const ALIGN_SKIP = new Set(['makarov_pm', 'ussr_flag', 'ma_g']);

// Serializa con el MISMO formato que tenía el fichero (indentación de 2 y los
// píxeles agrupados por fila): así el diff de git sólo muestra los sprites que
// realmente cambian, en vez de reescribir el fichero entero.
function serialize(icons) {
  const names = Object.keys(icons);
  const lines = ['{', '  "icons": {'];
  names.forEach((name, ni) => {
    const def = icons[name] || {};
    lines.push('    "' + name + '": {');
    const kv = ['      "grid": ' + def.grid];
    if (def.gridW || def.gridH) {
      kv.push('      "gridW": ' + (def.gridW || def.grid));
      kv.push('      "gridH": ' + (def.gridH || def.grid));
    }
    kv.forEach(l => lines.push(l + ','));
    lines.push('      "pixels": [');
    const byRow = new Map();
    (def.pixels || []).forEach(p => {
      if (!Array.isArray(p)) return;
      if (!byRow.has(p[1])) byRow.set(p[1], []);
      byRow.get(p[1]).push('[' + p[0] + ',' + p[1] + ',"' + p[2] + '"]');
    });
    const rows = [...byRow.keys()].sort((a, b) => a - b).map(y => byRow.get(y).join(','));
    const wrapped = [];
    let cur = '';
    rows.forEach((r, i) => {
      const piece = (i < rows.length - 1) ? r + ',' : r;
      if (cur && (cur + piece).length > 100) { wrapped.push(cur); cur = piece; }
      else cur = cur ? cur + piece : piece;
    });
    if (cur) wrapped.push(cur);
    wrapped.forEach(l => lines.push('        ' + l));
    lines.push('      ]');
    lines.push('    }' + (ni < names.length - 1 ? ',' : ''));
  });
  lines.push('  }', '}');
  return lines.join('\n') + '\n';
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const doAlign = args.includes('--align');
  const dumpIdx = args.indexOf('--dump');
  const library = JSON.parse(fs.readFileSync(PIXEL_FILE, 'utf8'));
  const icons = library.icons || {};

  if (dumpIdx >= 0) {
    const names = args.slice(dumpIdx + 1);
    for (const n of (names.length ? names : Object.keys(ART))) {
      const spec = ART[n] || (icons[n] ? { tiles: null, art: null } : null);
      if (spec && !spec.art) {
        const def = icons[n];
        const gw = def.gridW || def.grid, gh = def.gridH || def.grid;
        const grid = Array.from({ length: gh }, () => new Array(gw).fill('.'));
        (def.pixels || []).forEach(([x, y, c]) => { if (grid[y] && grid[y][x] !== undefined) grid[y][x] = '#'; });
        console.log('=== ' + n + ' (JSON ' + gw + 'x' + gh + ')');
        grid.forEach(r => console.log('  ' + r.join('')));
        continue;
      }
      const rows = normalize(spec);
      const { gw, gh } = gridOf(spec);
      console.log('=== ' + n + '  ' + spec.tiles.w + 'x' + spec.tiles.h + ' celdas → ' + gw + 'x' + gh + ' px');
      rows.forEach(r => console.log('  ' + r));
    }
    return;
  }

  const errors = validate();
  if (errors.length) {
    console.log('ERRORES DE ARTE (' + errors.length + '):');
    errors.forEach(e => console.log('  - ' + e));
    if (!dry) { console.log('No se ha escrito nada.'); process.exitCode = 1; return; }
  }

  let written = 0;
  for (const [name, spec] of Object.entries(ART)) {
    const rows = normalize(spec);
    const { gw, gh, footprintH } = gridOf(spec);
    if (rows.length !== gh) { console.log('AVISO: ' + name + ' tiene ' + rows.length + ' filas tras normalizar (se esperaban ' + gh + ')'); continue; }
    const pixels = toPixels({ ...spec, art: rows }, PALETTE);
    // El volumen 2.5D NO se graba: lo añade el motor y sólo en vista isométrica
    // (ver la nota de arriba y `engine/building-volume.js`).
    icons[name] = { grid: Math.max(gw, gh), gridW: gw, gridH: gh, pixels };
    written++;
  }
  // Variante sombreada de la casa mesopotámica (el motor la busca aparte)
  if (icons.mesopotamian_house) {
    icons.mesopotamian_house_shaded = {
      grid: icons.mesopotamian_house.grid,
      gridW: icons.mesopotamian_house.gridW,
      gridH: icons.mesopotamian_house.gridH,
      pixels: shadePixels(icons.mesopotamian_house.pixels, 0.78)
    };
    written++;
  }
  // Superbloque soviético: tenía sprite propio (5×5) pero sin vía de dibujo
  if (!icons.soviet_superblock && icons.soviet_superblock_b) {
    icons.soviet_superblock = JSON.parse(JSON.stringify(icons.soviet_superblock_b));
    written++;
  }

  // Alineación del resto de sprites (quita el hueco de abajo que los hacía flotar)
  const aligned = [];
  if (doAlign) {
    for (const [name, def] of Object.entries(icons)) {
      if (ART[name] || name === 'mesopotamian_house_shaded' || ALIGN_SKIP.has(name)) continue;
      const res = alignIcon(def);
      if (res.moved > 0) { icons[name] = res.def; aligned.push(name + ' +' + res.moved); }
    }
  }

  console.log('Sprites generados: ' + written + ' (' + Object.keys(ART).length + ' de arte propio' +
    (icons.mesopotamian_house_shaded ? ' + variante sombreada' : '') + ')');
  console.log('El JSON guarda el ALZADO original: el volumen 2.5D lo aplica el motor en la vista isométrica.');
  console.log('Iconos alineados a la línea de suelo: ' + aligned.length);
  if (aligned.length) console.log('  ' + aligned.join(', '));

  if (dry) { console.log('(--dry: no se ha escrito el fichero)'); return; }
  fs.writeFileSync(PIXEL_FILE, serialize(icons), 'utf8');
  console.log('Escrito ' + path.relative(ROOT, PIXEL_FILE));
}

main();
