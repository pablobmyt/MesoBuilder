// engine/observatory.js
// ─────────────────────────────────────────────────────────────────────────────
// EL OBSERVATORIO: el cielo de Mesopotamia visto desde la cúpula.
//
// No es un panel más del HUD: es una VISTA. Se abre pulsando E junto a un
// observatorio construido y sustituye el mundo por el cielo nocturno, con una
// lente circular (el ocular) por la que se mueve la bóveda celeste.
//
// CÓMO SE APUNTA
//   · Arrastrar con el ratón (o WASD / flechas) mueve el cielo dentro de la lente.
//   · La RUEDA cambia el campo de visión (acercar/alejar).
//   · Cuando una constelación queda bajo la mira, el anillo de alineación se
//     cierra solo: al completarse queda FIJADA.
//
// QUÉ PASA AL FIJAR UNA CONSTELACIÓN (esto es lo «progresivo»)
//   1. Sus estrellas se encienden una a una y sus líneas se van dibujando.
//   2. En el panel de la derecha aparece el nombre, primero el sumerio
//      (MUL.MUL, GÍR.TAB…) y después el moderno.
//   3. El relato se escribe solo, letra a letra, como si lo copiara un escriba.
//   4. Los «datos de la tablilla» van cayendo de uno en uno.
//   5. Al terminar queda REGISTRADA en `localStorage['meso.observatorio.estrellas']`
//      y la primera observación de cada una da experiencia.
//
// El cielo se ve mejor DE NOCHE: de día está lavado y la lectura avanza a la
// mitad de velocidad. Así el ciclo de día y noche del juego sirve para algo más
// que para oscurecer la pantalla.
//
// Todo el dibujado va sobre el mismo `ctx` del juego y con las mismas
// convenciones que el mapa cenital (`drawWorldMapOverlay`): nada de DOM, nada de
// animaciones fuera del bucle de dibujado.
// ─────────────────────────────────────────────────────────────────────────────

const DOS_PI = Math.PI * 2;
const CLAVE_REGISTRO = 'meso.observatorio.estrellas';

// Dimensiones del «cielo» en unidades de campo. Es un lienzo imaginario mucho más
// ancho que alto: la lente enseña una ventana de él y hay que moverse para
// recorrerlo (por eso apuntar tiene sentido).
//
// OJO con estas dos medidas: `CAMPO_ALTO` es IGUAL a `VENTANA_BASE`, así que con
// el aumento mínimo la lente abarca el cielo entero de arriba abajo y el apuntado
// vertical queda clavado en el centro (el eje que se recorre es el horizontal).
// Al acercar la vista entran los desplazamientos verticales. Si `CAMPO_ALTO`
// fuese mayor que la ventana, las constelaciones de los bordes NO se podrían
// centrar nunca (el apuntado se recorta al campo) y el anillo de alineación no
// llegaría a cerrarse: quedaban figuras imposibles de fijar.
const CAMPO_ANCHO = 4200;
const CAMPO_ALTO = 1150;
const VENTANA_BASE = 1150;      // unidades de campo que abarca la lente
const FOV_MIN = 1.0;
const FOV_MAX = 2.1;
const VELOCIDAD_APUNTADO = 620; // unidades de campo por segundo con el teclado
const VELOCIDAD_INERCIA = 2.6;  // frenado de la inercia al soltar el arrastre
// Las figuras se dibujan algo MÁS GRANDES que sus coordenadas de datos (±90):
// con el aumento mínimo, un patrón de 180 unidades ocupa unos 100 px dentro de una
// lente de 320, y el león o el escorpión se quedaban en un sello diminuto. Las
// coordenadas de datos no se tocan (de ellas depende el apuntado): el tamaño es
// cosa del dibujo.
const ESCALA_FIGURA = 1.55;

// ── LAS CONSTELACIONES ──────────────────────────────────────────────────────
// Lista de estrellas de las tablillas MUL.APIN con su nombre sumerio, su
// traducción, el relato y los datos de observación. El `patron` es la figura en
// unidades de campo (±90) y `enlaces` son las líneas que la unen.
//
// `x`/`y` reparten las figuras por el campo: 340 unidades de separación en
// horizontal (todas dentro del tramo que el apuntado puede alcanzar: 575…3625)
// con ±35 de vaivén vertical para que el cielo no parezca una fila de sellos.
// El radio de la mira son 218 unidades con la vista sin acercar, así que en
// cualquier punto la figura MÁS CERCANA es una sola y sin ambigüedad.
export const CONSTELACIONES = [
  {
    id: 'mulmul', x: 620, y: 540,
    mul: 'MUL.MUL', nombre: 'Las Estrellas', moderno: 'Pléyades',
    significado: 'El racimo del rebaño', epoca: 'primavera',
    relato: 'Siete luces apretadas que los escribas llamaron «las Estrellas» sin más adorno, porque para ellos eran el rejo del toro celeste. Su salida al anochecer marcaba la siembra de la cebada; cuando se perdían al alba, el grano ya estaba en el silo.',
    datos: [
      'Salen por el este al caer la noche en primavera.',
      'Los pastores contaban con ellas los meses del rebaño.',
      'Guiaban la primera arada del año nuevo.'
    ],
    patron: [[-22, -14], [6, -30], [26, -8], [18, 20], [-6, 26], [-30, 6], [2, -2]],
    enlaces: [[0, 6], [6, 3], [3, 5]],
    destacadas: { 6: 'Alcíone' }
  },
  {
    id: 'guanna', x: 960, y: 610,
    mul: 'GU₄.AN.NA', nombre: 'El Toro del Cielo', moderno: 'Tauro',
    significado: 'La tormenta con cuernos', epoca: 'primavera',
    relato: 'Anu lo soltó contra Uruk y Gilgamesh y Enkidu lo tumbaron en la llanura. Su V de estrellas es la cara; los dos cuernos largos, la furia que no cupo en el cielo.',
    datos: [
      'Aldebarán, su ojo, es una de las luces más firmes del cielo.',
      'Su cuerno izquierdo señalaba la salida del sol de primavera.',
      'Los astrónomos de Babilonia lo usaban para fijar el equinoccio.'
    ],
    patron: [[78, -24], [46, -18], [18, -6], [0, 6], [-18, -6], [-46, -18], [-78, -26], [0, 34], [-22, 30], [22, 30]],
    enlaces: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [3, 7], [7, 8], [7, 9], [2, 8], [4, 9]],
    destacadas: { 3: 'Aldebarán' }
  },
  {
    id: 'sipazianna', x: 1300, y: 540,
    mul: 'SIPA.ZI.AN.NA', nombre: 'El Verdadero Pastor de Anu', moderno: 'Orión',
    significado: 'El pastor fiel', epoca: 'invierno',
    relato: 'Anu le confió un rebaño que no es de ovejas: los tres luceros de su cinturón son las marcas del cayado. Los caminantes se orientaban por él porque nunca abandona su puesto.',
    datos: [
      'Sus tres estrellas centrales van en línea recta: el cinturón.',
      'Marca el sur celeste: si lo ves alto, estás mirando al sur.',
      'Los pastores lo llamaban «el que vigila el rebaño del cielo».'
    ],
    patron: [[-34, -62], [34, -64], [0, -20], [-16, -24], [16, -16], [-26, 22], [26, 26], [-36, 74], [36, 78], [0, -96]],
    enlaces: [[9, 0], [9, 1], [0, 3], [1, 4], [3, 2], [4, 2], [3, 5], [4, 6], [5, 7], [6, 8]],
    destacadas: { 0: 'Betelgeuse', 1: 'Bellatrix' }
  },
  {
    id: 'sugi', x: 1640, y: 610,
    mul: 'ŠU.GI', nombre: 'El Viejo', moderno: 'Perseo',
    significado: 'El anciano encorvado', epoca: 'otoño',
    relato: 'Un viejo encorvado encendió la primera luz y la dejó en el cielo. Carga su bastón torcido y camina despacio; por eso su figura se ve como una línea que se dobla.',
    datos: [
      'Su figura curva se apoya en el cayado, la constelación GAM.',
      'Los escribas la anotaban junto a los Gemelos para contar el año.',
      'Su luz es tenue: pide cielos sin luna.'
    ],
    patron: [[-70, -30], [-40, -10], [-14, 0], [14, -6], [44, -26], [70, -52], [-8, 34], [20, 38]],
    enlaces: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [3, 7]],
    destacadas: { 4: 'Mirfak' }
  },
  {
    id: 'gam', x: 1980, y: 540,
    mul: 'GAM', nombre: 'El Cayado', moderno: 'Auriga',
    significado: 'El bastón del pastor', epoca: 'invierno',
    relato: 'El bastón del Viejo: cinco estrellas en anillo que sostienen el rebaño de estrellas. Sin el cayado, dice la tablilla, el pastor no puede cerrar la puerta del redil.',
    datos: [
      'Tiene forma de pentágono: cinco luces y cinco lados.',
      'Cierra el paso entre el Viejo y los Gemelos.',
      'Los carreteros lo usaban para orientar los carros de noche.'
    ],
    patron: [[0, -70], [-46, -16], [-26, 34], [28, 30], [46, -20], [0, -4], [0, 62]],
    enlaces: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 5], [1, 5], [4, 5], [3, 6], [2, 6]],
    destacadas: { 0: 'Capella' }
  },
  {
    id: 'mastabba', x: 2320, y: 610,
    mul: 'MAŠ.TAB.BA.GAL.GAL', nombre: 'Los Grandes Gemelos', moderno: 'Géminis',
    significado: 'Los dos porteros', epoca: 'invierno',
    relato: 'Lugal-irra y Meslamta-ea, gemelos que guardan la puerta del mundo de abajo. Uno mira al este y el otro al oeste: nadie pasa dos veces sin que lo vean.',
    datos: [
      'Dos figuras paralelas y dos cabezas alineadas.',
      'Se les rezaba antes de abrir un pozo o una tumba.',
      'Con ellos los escribas cerraban la lista de la estación.'
    ],
    patron: [[-40, -70], [-46, -20], [-42, 30], [-34, 74], [40, -68], [46, -18], [42, 32], [34, 76], [-40, -92], [40, -90]],
    enlaces: [[8, 0], [0, 1], [1, 2], [2, 3], [9, 4], [4, 5], [5, 6], [6, 7], [0, 4], [2, 6]],
    destacadas: { 8: 'Cástor', 9: 'Pólux' }
  },
  {
    id: 'urgula', x: 2660, y: 540,
    mul: 'UR.GU.LA', nombre: 'El León', moderno: 'Leo',
    significado: 'La bestia real', epoca: 'verano',
    relato: 'La bestia que ningún muro detiene; su hocico de hoz cuelga sobre la llanura y su cola no encuentra el final. Los reyes la bordaban en sus estandartes porque el león pertenece al orden del cielo.',
    datos: [
      'Su cabeza es una hoz de estrellas: el hocico del león.',
      'Sale con el calor: para los agricultores anunciaba la sequía.',
      'La tallaban en las puertas de los palacios.'
    ],
    patron: [[-86, -40], [-64, -56], [-40, -58], [-20, -44], [-12, -20], [2, 10], [34, 26], [64, 6], [40, -24], [10, -30], [86, 44], [76, 72]],
    enlaces: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 5], [7, 10], [10, 11]],
    destacadas: { 2: 'Regulus' }
  },
  {
    id: 'absin', x: 3000, y: 610,
    mul: 'AB.SIN', nombre: 'El Surco', moderno: 'Virgo',
    significado: 'La espiga de grano', epoca: 'primavera',
    relato: 'La diosa del grano trazó un surco recto en el cielo con la mano y en él nació la espiga. De la espiga salió la cebada, y de la cebada el pan, la cerveza y el contrato.',
    datos: [
      'Su estrella principal lleva el nombre del grano: la Espiga.',
      'Servía para saber cuándo empezar a regar los canales.',
      'Es la constelación del trabajo: marca la siega.'
    ],
    patron: [[-70, 40], [-40, 44], [-10, 40], [20, 30], [50, 16], [76, -4], [-10, 10], [-20, -14], [-4, -30], [14, -40]],
    enlaces: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7], [7, 8], [8, 9], [4, 9]],
    destacadas: { 5: 'Espiga' }
  },
  {
    id: 'girtab', x: 3340, y: 540,
    mul: 'GÍR.TAB', nombre: 'El Escorpión', moderno: 'Escorpio',
    significado: 'El guardián de la puerta del sol', epoca: 'verano',
    relato: 'Hombre escorpión: medio cuerpo arriba, medio abajo, con el aguijón cargado. Se le puso a vigilar la puerta por la que el sol entra en el mundo oscuro, y a Gilgamesh le franqueó el paso sin pedirle nada.',
    datos: [
      'Su aguijón apunta al centro de la Vía Láctea.',
      'Sus pinzas abren el camino al Surco.',
      'Guarda la puerta de la montaña de Mashu.'
    ],
    patron: [[-80, -30], [-58, -44], [-36, -40], [-30, -16], [-34, 12], [-20, 40], [4, 58], [30, 62], [50, 44], [56, 16], [-58, -10], [-46, 10]],
    enlaces: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [3, 10], [4, 11]],
    destacadas: { 6: 'Antares' }
  }
];

// ── Ruido determinista ──────────────────────────────────────────────────────
// El cielo es el mismo cada partida (y cada vez que se abre): nada de
// Math.random, que haría que las estrellas bailasen al volver a mirar.
function semillaRnd(semilla) {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const TONOS_ESTRELLA = ['#FFFFFF', '#E8F0FF', '#FFF6DC', '#FFE9C8', '#DCE8FF'];

// Cielo de fondo: estrellas sueltas + la banda lechosa de la Vía Láctea (que en
// Mesopotamia era «el río del cielo»).
function crearEstrellasFondo() {
  const out = [];
  const rnd = semillaRnd(0x5EED1A7);
  for (let i = 0; i < 900; i++) {
    out.push({
      x: rnd() * CAMPO_ANCHO,
      y: rnd() * CAMPO_ALTO,
      b: 0.22 + rnd() * 0.78,
      tam: rnd() < 0.07 ? 2 : 1,
      fase: rnd() * DOS_PI,
      ritmo: 0.6 + rnd() * 1.8,
      tono: TONOS_ESTRELLA[Math.floor(rnd() * TONOS_ESTRELLA.length)]
    });
  }
  // Banda de la Vía Láctea: cruza el campo en diagonal con más densidad.
  for (let i = 0; i < 520; i++) {
    const t = rnd();
    const x = t * CAMPO_ANCHO;
    const centro = CAMPO_ALTO * (0.30 + 0.34 * t);
    const desvio = (rnd() + rnd() + rnd() - 1.5) * 190;
    out.push({
      x, y: Math.max(0, Math.min(CAMPO_ALTO, centro + desvio)),
      b: 0.12 + rnd() * 0.42,
      tam: 1,
      fase: rnd() * DOS_PI,
      ritmo: 0.5 + rnd() * 1.6,
      tono: rnd() < 0.4 ? '#CFE0FF' : '#FFFFFF'
    });
  }
  return out;
}

// ── Sprite provisional del edificio ─────────────────────────────────────────
// El observatorio se dibuja con la librería de píxeles como cualquier otro
// edificio, así que necesita SU entrada (`observatory`). Esto es sólo un
// marcador de posición decente: en cuanto se recorte el PNG en el editor de
// entidades (`data/sheets/Observatorio.png` → `observatory_sup`/`_iso`), el
// motor prefiere el arte del PNG y este se queda sin usar.
export function registerObservatorySprite(lib) {
  try {
    if (!lib || lib.observatory) return false;
    const GW = 32, GH = 30;
    const px = [];
    const pon = (x, y, c, ancho) => { for (let k = 0; k < (ancho || 1); k++) px.push([x + k, y, c]); };
    const fila = (y, x0, ancho, c) => pon(x0, y, c, ancho);
    const ADOBE = '#C8A84B', ADOBE_OSC = '#A8863A', ADOBE_CLARO = '#DCC178';
    const LADRILLO = '#8B6914', CUPULA = '#2E3A54', CUPULA_CLARO = '#46557A';
    const ORO = '#E8C55C', BRONCE = '#B8860B', NOCHE = '#0E1830';

    // Terraza escalonada: dos cuerpos anchos a la base (como los templos de la
    // llanura) y encima la torre.
    fila(29, 4, GW - 8, '#6E5312');
    fila(28, 4, GW - 8, LADRILLO);
    fila(27, 4, GW - 8, ADOBE_OSC);
    fila(26, 7, GW - 14, LADRILLO);
    fila(25, 7, GW - 14, ADOBE);

    // Cuerpo de la torre, con aparejo de ladrillo (filas alternas marcadas) para
    // que se lea la fábrica y no un bloque plano.
    for (let y = 14; y <= 24; y++) {
      for (let x = 10; x <= 21; x++) {
        const borde = (x === 10 || x === 21);
        const marca = (y % 2 === 0 && x % 3 === 0) || (y % 3 === 0 && x % 4 === 1);
        px.push([x, y, borde ? ADOBE_OSC : (marca ? ADOBE_CLARO : ADOBE)]);
      }
    }

    // Cúpula: casquete de anchos crecientes hacia abajo (arriba estrecha).
    const CUPULA_FILAS = [[6, 4], [7, 6], [8, 8], [9, 10], [10, 12], [11, 12]];
    for (const [y, ancho] of CUPULA_FILAS) {
      const x0 = 16 - Math.floor(ancho / 2);
      for (let x = x0; x < x0 + ancho; x++) {
        const borde = (x === x0 || x === x0 + ancho - 1);
        px.push([x, y, borde ? CUPULA : CUPULA_CLARO]);
      }
    }
    // Cornisa dorada bajo la cúpula
    fila(12, 9, 14, BRONCE);
    fila(13, 9, 14, LADRILLO);

    // La RANURA del telescopio: un corte vertical en la cúpula por el que se ve
    // la noche. Es lo que hace que la cúpula se lea como observatorio.
    for (let y = 7; y <= 11; y++) { px.push([15, y, NOCHE]); px.push([16, y, NOCHE]); }
    px.push([15, 6, NOCHE]); px.push([16, 6, NOCHE]);
    // Instrumento dorado asomando por la ranura (el tubo apunta al cielo).
    px.push([15, 5, BRONCE]); px.push([16, 5, ORO]);
    px.push([15, 4, ORO]); px.push([16, 4, ORO]);

    // Asta con banderín
    px.push([16, 3, LADRILLO]);
    pon(17, 3, '#9E2A2B', 3);
    pon(17, 4, '#9E2A2B', 2);

    // Escalera de acceso por la derecha
    for (let i = 0; i < 4; i++) fila(24 - i, 22 + i, 3, ADOBE_CLARO);

    // Puerta en el frente
    for (let y = 20; y <= 24; y++) pon(12, y, '#3A2A12', 3);
    fila(19, 12, 3, LADRILLO);

    // Farol junto a la puerta (con su chispa de luz)
    px.push([9, 22, BRONCE]); px.push([9, 21, '#FFD27A']);

    lib.observatory = { gridW: GW, gridH: GH, pixels: px, freeHeight: true };
    return true;
  } catch (e) {
    return false;
  }
}

// ── Utilidades de dibujo ────────────────────────────────────────────────────
function rectRedondeado(g, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y); g.arcTo(x + w, y, x + w, y + rr, rr);
  g.lineTo(x + w, y + h - rr); g.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  g.lineTo(x + rr, y + h); g.arcTo(x, y + h, x, y + h - rr, rr);
  g.lineTo(x, y + rr); g.arcTo(x, y, x + rr, y, rr);
  g.closePath();
}

function envolver(g, texto, ancho) {
  const palabras = String(texto || '').split(/\s+/);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? actual + ' ' + p : p;
    if (g.measureText(prueba).width > ancho && actual) { lineas.push(actual); actual = p; }
    else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

// Texto que se escribe solo: devuelve el trozo ya «copiado» y si ha terminado.
function textoProgresivo(texto, progreso) {
  const total = String(texto || '');
  const n = Math.max(0, Math.min(total.length, Math.floor(progreso * total.length)));
  return { visible: total.slice(0, n), completo: n >= total.length };
}

// Interpolación suave para las apariciones.
function suavizar(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
// Progreso de un tramo dentro de la revelación (0 antes, 1 después).
function tramo(revelado, desde, hasta) {
  if (revelado <= desde) return 0;
  if (revelado >= hasta) return 1;
  return (revelado - desde) / Math.max(0.0001, hasta - desde);
}

// ── El observatorio ─────────────────────────────────────────────────────────
export function createObservatory(deps = {}) {
  const notificar = typeof deps.notificar === 'function' ? deps.notificar : () => {};
  const registrar = typeof deps.registrar === 'function' ? deps.registrar : () => {};
  const recompensa = typeof deps.recompensa === 'function' ? deps.recompensa : null;
  const guardar = typeof deps.guardar === 'function' ? deps.guardar : () => {};
  const getHora = typeof deps.getHora === 'function' ? deps.getHora : () => 22;
  const getEpoch = typeof deps.getEpoch === 'function' ? deps.getEpoch : () => 'mesopotamia';
  const sonido = typeof deps.sfx === 'function' ? deps.sfx : () => {};

  const estrellas = crearEstrellasFondo();
  const descubiertas = new Set();

  const est = {
    abierto: false,
    abiertoEn: 0,
    apX: CAMPO_ANCHO * 0.5,
    apY: CAMPO_ALTO * 0.5,
    fov: 1,
    vx: 0, vy: 0,
    arrastrando: false,
    ultimoPuntero: null,
    candidata: null,      // constelación bajo la mira ahora mismo
    fijada: null,         // constelación fijada (su información se está revelando)
    alineacion: 0,        // 0..1, cuánto lleva la candidata centrada
    revelado: 0,          // 0..1, cuánto se ha revelado la información de la fijada
    destello: 0,          // fogonazo al fijar
    estrellaFugaz: null,
    proximaFugaz: 0,
    tUltimo: 0,
    teclas: new Set(),
    layout: null,
    // Trazado de la última pasada: lo usan el ratón y el teclado.
    proyectadas: []
  };

  // ── Registro de constelaciones descubiertas ───────────────────────────────
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE_REGISTRO) || '[]');
    if (Array.isArray(guardadas)) guardadas.forEach((id) => descubiertas.add(String(id)));
  } catch (e) { /* sin registro: se empieza de cero */ }

  function persistirRegistro() {
    try { localStorage.setItem(CLAVE_REGISTRO, JSON.stringify(Array.from(descubiertas))); } catch (e) {}
  }

  // ── Hora del mundo y cielo ────────────────────────────────────────────────
  // De noche el cielo está limpio y la lectura avanza entera; de día está lavado
  // (azul pálido, estrellas apagadas) y avanza a la mitad.
  function esDeNoche() {
    const h = Number(getHora());
    if (!Number.isFinite(h)) return true;
    return h < 5.5 || h > 19.5;
  }
  function factorLuz() { return esDeNoche() ? 1 : 0.62; }
  function etiquetaHora() {
    const h = Number(getHora()) || 0;
    const hh = String(Math.floor(h)).padStart(2, '0');
    const mm = String(Math.floor((h % 1) * 60)).padStart(2, '0');
    return hh + ':' + mm;
  }

  // ── Apuntado ──────────────────────────────────────────────────────────────
  function ventana() {
    return VENTANA_BASE / Math.max(FOV_MIN, Math.min(FOV_MAX, est.fov));
  }

  function limitarApuntado() {
    const v = ventana();
    const semiX = Math.min(CAMPO_ANCHO / 2, v / 2);
    const semiY = Math.min(CAMPO_ALTO / 2, v / 2);
    est.apX = Math.max(semiX, Math.min(CAMPO_ANCHO - semiX, est.apX));
    est.apY = Math.max(semiY, Math.min(CAMPO_ALTO - semiY, est.apY));
  }

  // Posición en pantalla de un punto del campo, con el trazado actual.
  function aPantalla(x, y, lay) {
    const L = lay || est.layout;
    if (!L) return { x: 0, y: 0 };
    return { x: L.cx + (x - est.apX) * L.escala, y: L.cy + (y - est.apY) * L.escala };
  }

  function radioMira(lay) {
    const L = lay || est.layout;
    if (!L) return 0;
    // 0,38 del radio de la lente: en unidades de campo son 0,19 × ventana, o sea
    // 218 con la vista sin acercar. Con las figuras a 340 de separación, siempre
    // hay UNA sola candidata: la más cercana al centro. Al acercar (la ventana se
    // estrecha) la mira se vuelve más estricta, como en un telescopio de verdad.
    return L.R * 0.38;
  }

  // Constelación más cercana al centro de la mira (dentro del radio de mira).
  function constelacionBajoLaMira() {
    const L = est.layout;
    if (!L) return null;
    let mejor = null, mejorD = Infinity;
    const rMax = radioMira(L);
    for (const c of CONSTELACIONES) {
      const p = aPantalla(c.x, c.y, L);
      const d = Math.hypot(p.x - L.cx, p.y - L.cy);
      if (d < mejorD) { mejorD = d; mejor = c; }
    }
    return (mejor && mejorD <= rMax) ? mejor : null;
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────
  function abrir(opts) {
    try {
      if (est.abierto) return true;
      est.abierto = true;
      est.abiertoEn = Date.now();
      est.tUltimo = Date.now();
      est.vx = est.vy = 0;
      est.arrastrando = false;
      est.ultimoPuntero = null;
      est.alineacion = 0;
      est.destello = 0;
      est.proximaFugaz = Date.now() + 2500 + Math.random() * 4000;
      est.teclas.clear();
      const o = opts || {};
      // Si se entra por una puerta concreta, se abre mirando a donde estaba.
      if (Number.isFinite(o.x) && Number.isFinite(o.y)) { est.apX = o.x; est.apY = o.y; }
      else { est.apX = CAMPO_ANCHO * 0.5; est.apY = CAMPO_ALTO * 0.5; }
      limitarApuntado();
      // Al abrir, se deja el registro estelar a la vista para recordar lo hecho.
      const n = descubiertas.size;
      notificar('Observatorio abierto · ' + n + '/' + CONSTELACIONES.length + ' constelaciones en tus tablillas');
      if (!esDeNoche()) notificar('El cielo está lavado por el sol: se lee despacio. Vuelve de noche.');
      try { document.body.classList.add('observatorio-abierto'); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }

  function cerrar(silencioso) {
    try {
      if (!est.abierto) return false;
      est.abierto = false;
      est.arrastrando = false;
      est.teclas.clear();
      try { document.body.classList.remove('observatorio-abierto'); } catch (e) {}
      if (!silencioso) {
        const n = descubiertas.size;
        notificar('Cierras la cúpula · ' + n + '/' + CONSTELACIONES.length + ' constelaciones registradas');
      }
      guardar();
      return true;
    } catch (e) { return false; }
  }

  function estaAbierto() { return !!est.abierto; }

  // ── Entrada de teclado ────────────────────────────────────────────────────
  // Devuelve true si consume la tecla (el motor no debe procesarla).
  function manejarTecla(e) {
    try {
      if (!est.abierto || !e) return false;
      const k = String(e.key || '').toLowerCase();
      const code = String(e.code || '');
      if (k === 'escape' || k === 'q' || code === 'KeyQ') { cerrar(); return true; }
      if (code === 'KeyE' || k === 'enter') {
        // Con una figura fijada y a medio leer, la tecla COMPLETA la lectura (nadie
        // quiere esperar 6 s por constelación). Sin nada fijado, cierra el anillo de
        // la que esté bajo la mira sin esperar a que se cierre solo.
        if (est.fijada && est.revelado < 1) { est.revelado = 1; return true; }
        const c = constelacionBajoLaMira();
        if (c && est.alineacion < 1) { est.alineacion = 1; }
        return true;
      }
      if (code === 'KeyR') { est.fov = 1; limitarApuntado(); return true; }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].indexOf(code) >= 0) {
        est.teclas.add(code);
        return true;
      }
      // Cualquier otra tecla mientras se observa el cielo se ignora a propósito:
      // en la cúpula no se construye, no se tala y no se abre el inventario.
      return true;
    } catch (err) { return false; }
  }

  function manejarTeclaSoltada(e) {
    try {
      if (e && e.code) est.teclas.delete(String(e.code));
    } catch (err) {}
  }

  // ── Entrada de ratón (el motor le pasa su propio `getCanvasPointerPosition`) ─
  function manejarPunteroAbajo(ptr) {
    if (!est.abierto || !ptr) return false;
    est.arrastrando = true;
    est.ultimoPuntero = { x: ptr.x, y: ptr.y };
    est.vx = est.vy = 0;
    return true;
  }

  function manejarPunteroArriba() {
    if (!est.abierto) return false;
    est.arrastrando = false;
    est.ultimoPuntero = null;
    return true;
  }

  function manejarPunteroMueve(ptr) {
    if (!est.abierto || !ptr) return false;
    if (est.arrastrando && est.ultimoPuntero && est.layout) {
      const esc = Math.max(0.05, est.layout.escala);
      const dx = (ptr.x - est.ultimoPuntero.x) / esc;
      const dy = (ptr.y - est.ultimoPuntero.y) / esc;
      est.apX -= dx; est.apY -= dy;
      // Inercia: al soltar, el cielo sigue un poco (da peso al instrumento).
      est.vx = -dx; est.vy = -dy;
      limitarApuntado();
    }
    est.ultimoPuntero = { x: ptr.x, y: ptr.y };
    return true;
  }

  function manejarRueda(deltaY) {
    try {
      if (!est.abierto) return false;
      const d = Number(deltaY) || 0;
      est.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, est.fov * (d > 0 ? 0.92 : 1.08)));
      limitarApuntado();
      return true;
    } catch (e) { return false; }
  }

  // ── Actualización ─────────────────────────────────────────────────────────
  function actualizar() {
    if (!est.abierto) return;
    const ahora = Date.now();
    const dt = Math.max(0, Math.min(0.1, (ahora - (est.tUltimo || ahora)) / 1000));
    est.tUltimo = ahora;

    // Teclado: apuntado continuo
    const t = est.teclas;
    let mx = 0, my = 0;
    if (t.has('ArrowLeft') || t.has('KeyA')) mx -= 1;
    if (t.has('ArrowRight') || t.has('KeyD')) mx += 1;
    if (t.has('ArrowUp') || t.has('KeyW')) my -= 1;
    if (t.has('ArrowDown') || t.has('KeyS')) my += 1;
    if (mx || my) {
      const inv = (Math.hypot(mx, my) || 1);
      est.apX += (mx / inv) * VELOCIDAD_APUNTADO * dt;
      est.apY += (my / inv) * VELOCIDAD_APUNTADO * dt;
      est.vx = 0; est.vy = 0;
      limitarApuntado();
    } else if (!est.arrastrando && (Math.abs(est.vx) > 0.5 || Math.abs(est.vy) > 0.5)) {
      // Inercia del arrastre
      est.apX += est.vx * dt * 8;
      est.apY += est.vy * dt * 8;
      const f = Math.exp(-VELOCIDAD_INERCIA * dt);
      est.vx *= f; est.vy *= f;
      limitarApuntado();
    }

    // Fogonazo de fijado
    if (est.destello > 0) est.destello = Math.max(0, est.destello - dt * 1.6);

    // Estrella fugaz de vez en cuando (sólo de noche).
    if (esDeNoche() && ahora >= est.proximaFugaz) {
      est.proximaFugaz = ahora + 6000 + Math.random() * 12000;
      est.estrellaFugaz = {
        x: 120 + Math.random() * (CAMPO_ANCHO - 240),
        y: 60 + Math.random() * (CAMPO_ALTO - 120),
        ang: Math.PI * (0.15 + Math.random() * 0.5),
        nacida: ahora, vida: 900
      };
    }
    if (est.estrellaFugaz && (ahora - est.estrellaFugaz.nacida) > est.estrellaFugaz.vida) est.estrellaFugaz = null;

    // Alineación: la candidata bajo la mira se «fija» si se mantiene centrada.
    const bajo = constelacionBajoLaMira();
    if (bajo && bajo !== est.fijada) {
      if (est.candidata !== bajo) { est.candidata = bajo; est.alineacion = 0; }
      const factor = 1 + (est.fov - 1) * 0.6;       // con más aumento, cuesta más
      est.alineacion = Math.min(1, est.alineacion + dt * 0.62 * factor * factorLuz());
      if (est.alineacion >= 1) fijar(bajo);
    } else if (bajo && bajo === est.fijada) {
      est.candidata = bajo;
      est.alineacion = 1;
    } else {
      // Fuera de la mira: si no se había fijado, el anillo se abre rápido.
      est.candidata = null;
      if (est.alineacion > 0 && est.alineacion < 1) est.alineacion = Math.max(0, est.alineacion - dt * 1.5);
      if (est.alineacion >= 1) est.alineacion = 0;
    }

    // Revelación progresiva de la constelación fijada.
    if (est.fijada) {
      const base = 1 / 6;                            // ~6 s de lectura a velocidad normal
      est.revelado = Math.min(1, est.revelado + dt * base * factorLuz());
      if (est.revelado >= 1 && !descubiertas.has(est.fijada.id)) registrarDescubrimiento(est.fijada);
    }
  }

  function fijar(c) {
    try {
      if (!c) return;
      est.fijada = c;
      est.revelado = 0;
      est.destello = 1;
      sonido('uiClick');
      registrar('Apuntas a ' + c.mul + ' · «' + c.nombre + '»');
    } catch (e) {}
  }

  function registrarDescubrimiento(c) {
    try {
      descubiertas.add(c.id);
      persistirRegistro();
      const primera = descubiertas.size;
      notificar('«' + c.nombre + '» queda registrada en tus tablillas (' + primera + '/' + CONSTELACIONES.length + ')');
      registrar('Observación anotada: ' + c.moderno + ' (' + c.mul + ').');
      if (recompensa) { try { recompensa(c, { total: primera, constelaciones: CONSTELACIONES.length }); } catch (e) {} }
      guardar();
    } catch (e) {}
  }

  // ── Dibujado ──────────────────────────────────────────────────────────────
  function calcularLayout(W, H) {
    const ancho = W >= 900;
    if (ancho) {
      const R = Math.max(90, Math.min(H * 0.40, W * 0.30));
      const panelW = Math.max(320, Math.min(430, W * 0.30));
      return {
        ancho: true,
        cx: Math.round(R + Math.max(26, W * 0.035)),
        cy: Math.round(H * 0.47),
        R,
        panel: { x: Math.round(W - panelW - Math.max(20, W * 0.025)), y: 58, w: panelW, h: Math.max(160, H - 116) }
      };
    }
    const R = Math.max(80, Math.min(W * 0.44, H * 0.30));
    const py = Math.round(R * 2 + 74);
    return {
      ancho: false, cx: Math.round(W / 2), cy: Math.round(R + 44), R,
      panel: { x: 18, y: py, w: W - 36, h: Math.max(120, H - py - 52) }
    };
  }

  function dibujar(g, W, H) {
    try {
      if (!est.abierto) return;
      const L = calcularLayout(W, H);
      L.escala = (2 * L.R) / ventana();
      est.layout = L;

      const noche = esDeNoche();
      dibujarFondoCupula(g, W, H, L, noche);
      dibujarOcular(g, W, H, L, noche);
      dibujarCartaEstelar(g, L, W, H);
      dibujarPanel(g, L, H, noche);
      dibujarPie(g, W, H, L, noche);
    } catch (e) { /* nunca debe romper el fotograma */ }
  }

  function dibujarFondoCupula(g, W, H, L, noche) {
    g.save();
    // Dentro de la cúpula: casi negro, con el resplandor cálido del farol.
    const fondo = g.createLinearGradient(0, 0, 0, H);
    fondo.addColorStop(0, noche ? '#05070E' : '#0A1220');
    fondo.addColorStop(1, noche ? '#0B0F1A' : '#141C2A');
    g.fillStyle = fondo;
    g.fillRect(0, 0, W, H);
    // Costillas de la cúpula: arcos concéntricos muy tenues alrededor del ocular.
    g.strokeStyle = noche ? 'rgba(120,150,200,0.07)' : 'rgba(120,150,200,0.10)';
    g.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      g.beginPath();
      g.arc(L.cx, L.cy, L.R * (1.25 + i * 0.34), 0, DOS_PI);
      g.stroke();
    }
    const farol = g.createRadialGradient(W * 0.5, H * 1.05, 10, W * 0.5, H * 1.05, H * 0.75);
    farol.addColorStop(0, 'rgba(220,150,50,0.16)');
    farol.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = farol;
    g.fillRect(0, 0, W, H);
    g.restore();
  }

  function dibujarOcular(g, W, H, L, noche) {
    g.save();
    // ── La lente: todo el cielo se dibuja recortado al círculo ──
    g.beginPath();
    g.arc(L.cx, L.cy, L.R, 0, DOS_PI);
    g.clip();

    const cielo = g.createRadialGradient(L.cx, L.cy, L.R * 0.1, L.cx, L.cy, L.R * 1.05);
    if (noche) {
      cielo.addColorStop(0, '#0A1226');
      cielo.addColorStop(0.6, '#060B18');
      cielo.addColorStop(1, '#03060F');
    } else {
      cielo.addColorStop(0, '#2C4A72');
      cielo.addColorStop(0.65, '#1D3350');
      cielo.addColorStop(1, '#122036');
    }
    g.fillStyle = cielo;
    g.fillRect(L.cx - L.R, L.cy - L.R, L.R * 2, L.R * 2);

    const ahora = Date.now();
    const brillo = noche ? 1 : 0.22;

    // Vía Láctea: velo lechoso en diagonal (de día ni se ve).
    if (noche) {
      g.save();
      g.translate(L.cx - est.apX * L.escala, L.cy - est.apY * L.escala);
      g.rotate(-0.42);
      const banda = g.createLinearGradient(0, -230, 0, 230);
      banda.addColorStop(0, 'rgba(150,180,255,0)');
      banda.addColorStop(0.5, 'rgba(150,180,255,0.075)');
      banda.addColorStop(1, 'rgba(150,180,255,0)');
      g.fillStyle = banda;
      g.fillRect(-5000, -230, 10000, 460);
      g.restore();
    }

    // Estrellas de fondo (parpadean con su propio ritmo).
    for (let i = 0; i < estrellas.length; i++) {
      const s = estrellas[i];
      const p = aPantalla(s.x, s.y, L);
      if (p.x < L.cx - L.R - 4 || p.x > L.cx + L.R + 4 || p.y < L.cy - L.R - 4 || p.y > L.cy + L.R + 4) continue;
      const titileo = 0.72 + 0.28 * Math.sin(ahora * 0.001 * s.ritmo + s.fase);
      const a = Math.max(0.04, s.b * titileo * brillo);
      g.fillStyle = s.tono;
      g.globalAlpha = a;
      g.fillRect(Math.round(p.x), Math.round(p.y), s.tam, s.tam);
    }
    g.globalAlpha = 1;

    // Estrella fugaz
    if (est.estrellaFugaz) {
      const f = est.estrellaFugaz;
      const vida = (ahora - f.nacida) / f.vida;
      const p = aPantalla(f.x, f.y, L);
      const largo = 90 * (1 - Math.abs(vida - 0.5) * 2);
      const gx = Math.cos(f.ang), gy = Math.sin(f.ang);
      const trazo = g.createLinearGradient(p.x, p.y, p.x - gx * largo, p.y - gy * largo);
      trazo.addColorStop(0, 'rgba(255,255,240,' + (0.9 * brillo).toFixed(2) + ')');
      trazo.addColorStop(1, 'rgba(255,255,240,0)');
      g.strokeStyle = trazo;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - gx * largo, p.y - gy * largo);
      g.stroke();
    }

    // Constelaciones: las ya registradas van algo más brillantes.
    const tClave = ahora * 0.0016;
    for (let ci = 0; ci < CONSTELACIONES.length; ci++) {
      const c = CONSTELACIONES[ci];
      const esFijada = est.fijada && est.fijada.id === c.id;
      const esCandidata = est.candidata && est.candidata.id === c.id;
      const descubierta = descubiertas.has(c.id);
      const foco = esFijada ? 1 : (esCandidata ? 0.55 + est.alineacion * 0.45 : (descubierta ? 0.30 : 0.14));
      const base = foco * brillo;

      // Cuánto de la figura está dibujada: sólo se despliega al fijarla.
      const progresoLineas = esFijada ? suavizar(tramo(est.revelado, 0.02, 0.30)) : 0;

      // Puntos de la figura, agrandados para el dibujo (ver ESCALA_FIGURA).
      const ex = (dx) => c.x + dx * ESCALA_FIGURA;
      const ey = (dy) => c.y + dy * ESCALA_FIGURA;

      // Líneas
      if (progresoLineas > 0.01) {
        g.save();
        g.strokeStyle = 'rgba(255,214,130,' + (0.55 * base).toFixed(3) + ')';
        g.lineWidth = esFijada ? 1.6 : 1;
        const total = c.enlaces.length;
        for (let i = 0; i < total; i++) {
          const cuantas = progresoLineas * total;
          if (i >= cuantas) break;
          const alpha = Math.min(1, cuantas - i);
          const a1 = c.patron[c.enlaces[i][0]], a2 = c.patron[c.enlaces[i][1]];
          if (!a1 || !a2) continue;
          const p1 = aPantalla(ex(a1[0]), ey(a1[1]), L);
          const p2 = aPantalla(ex(a2[0]), ey(a2[1]), L);
          g.globalAlpha = alpha;
          g.beginPath();
          g.moveTo(p1.x, p1.y);
          g.lineTo(p2.x, p2.y);
          g.stroke();
        }
        g.restore();
      }

      // Estrellas de la figura: al fijarla se encienden una a una.
      const totalEstrellas = c.patron.length;
      const cuantasEstrellas = esFijada ? Math.ceil(suavizar(tramo(est.revelado, 0.0, 0.26)) * totalEstrellas) : totalEstrellas;
      for (let i = 0; i < totalEstrellas; i++) {
        if (i >= cuantasEstrellas) break;
        const st = c.patron[i];
        const p = aPantalla(ex(st[0]), ey(st[1]), L);
        const titileo = 0.85 + 0.15 * Math.sin(tClave * (1 + (i % 5) * 0.3) + i);
        const alfa = Math.min(1, Math.max(0.12, base * 1.25 * titileo));
        const radio = esFijada ? 2.6 : (esCandidata ? 2.2 : 1.6);
        // Halo suave: dos círculos concéntricos, sin filtros (más rápido).
        g.globalAlpha = alfa * 0.18;
        g.fillStyle = '#FFE7AE';
        g.beginPath(); g.arc(p.x, p.y, radio * 3.1, 0, DOS_PI); g.fill();
        g.globalAlpha = alfa;
        g.fillStyle = '#FFF8E2';
        g.beginPath(); g.arc(p.x, p.y, radio, 0, DOS_PI); g.fill();
      }
      g.globalAlpha = 1;

      // Nombres de las estrellas destacadas, sólo con la figura ya revelada.
      if (esFijada && est.revelado > 0.34 && c.destacadas) {
        g.save();
        g.font = '10px ui-monospace, monospace';
        g.fillStyle = 'rgba(255,225,160,0.78)';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        for (const idx of Object.keys(c.destacadas)) {
          const st = c.patron[Number(idx)];
          if (!st) continue;
          const p = aPantalla(ex(st[0]), ey(st[1]), L);
          g.globalAlpha = suavizar(tramo(est.revelado, 0.34, 0.5));
          g.fillText(String(c.destacadas[idx]), p.x + 7, p.y - 7);
        }
        g.restore();
      }
    }

    // Fogonazo al fijar (un latido de luz desde el centro de la mira).
    if (est.destello > 0) {
      g.globalAlpha = est.destello * 0.35;
      const fg = g.createRadialGradient(L.cx, L.cy, 0, L.cx, L.cy, L.R);
      fg.addColorStop(0, 'rgba(255,235,180,0.9)');
      fg.addColorStop(1, 'rgba(255,235,180,0)');
      g.fillStyle = fg;
      g.fillRect(L.cx - L.R, L.cy - L.R, L.R * 2, L.R * 2);
      g.globalAlpha = 1;
    }

    // Viñeteado de la lente (bordes oscurecidos).
    const vin = g.createRadialGradient(L.cx, L.cy, L.R * 0.72, L.cx, L.cy, L.R);
    vin.addColorStop(0, 'rgba(0,0,0,0)');
    vin.addColorStop(1, 'rgba(0,0,0,0.72)');
    g.fillStyle = vin;
    g.fillRect(L.cx - L.R, L.cy - L.R, L.R * 2, L.R * 2);
    g.restore();

    // ── Aro de bronce y retícula ──
    g.save();
    g.strokeStyle = '#8B6914';
    g.lineWidth = Math.max(5, L.R * 0.045);
    g.beginPath(); g.arc(L.cx, L.cy, L.R, 0, DOS_PI); g.stroke();
    g.strokeStyle = 'rgba(232,197,92,0.85)';
    g.lineWidth = Math.max(1, L.R * 0.012);
    g.beginPath(); g.arc(L.cx, L.cy, L.R, 0, DOS_PI); g.stroke();
    g.beginPath(); g.arc(L.cx, L.cy, L.R + Math.max(5, L.R * 0.045), 0, DOS_PI); g.stroke();
    // Marcas cada 15° y numeradas cada 90°, como en un instrumento de latón.
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * DOS_PI - Math.PI / 2;
      const gordo = (i % 6 === 0);
      const r0 = L.R + Math.max(5, L.R * 0.045);
      const largo = gordo ? L.R * 0.07 : L.R * 0.035;
      g.strokeStyle = gordo ? 'rgba(255,214,130,0.9)' : 'rgba(232,197,92,0.45)';
      g.lineWidth = gordo ? 2 : 1;
      g.beginPath();
      g.moveTo(L.cx + Math.cos(a) * r0, L.cy + Math.sin(a) * r0);
      g.lineTo(L.cx + Math.cos(a) * (r0 + largo), L.cy + Math.sin(a) * (r0 + largo));
      g.stroke();
    }
    g.font = 'bold 11px ui-monospace, monospace';
    g.fillStyle = 'rgba(255,214,130,0.8)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const rLetras = L.R + Math.max(16, L.R * 0.13);
    [['N', -Math.PI / 2], ['E', 0], ['S', Math.PI / 2], ['O', Math.PI]].forEach(([t, a]) => {
      g.fillText(t, L.cx + Math.cos(a) * rLetras, L.cy + Math.sin(a) * rLetras);
    });

    // Retícula: cruz fina con hueco en el centro + corchetes de mira.
    const r = radioMira(L);
    g.strokeStyle = 'rgba(180,215,255,0.30)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(L.cx - r * 1.5, L.cy); g.lineTo(L.cx - r * 0.35, L.cy);
    g.moveTo(L.cx + r * 0.35, L.cy); g.lineTo(L.cx + r * 1.5, L.cy);
    g.moveTo(L.cx, L.cy - r * 1.5); g.lineTo(L.cx, L.cy - r * 0.35);
    g.moveTo(L.cx, L.cy + r * 0.35); g.lineTo(L.cx, L.cy + r * 1.5);
    g.stroke();
    g.strokeStyle = 'rgba(255,214,130,0.55)';
    g.lineWidth = 1.4;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      const x0 = L.cx + sx * r, y0 = L.cy + sy * r;
      g.beginPath();
      g.moveTo(x0 + sx * r * 0.4, y0); g.lineTo(x0, y0); g.lineTo(x0, y0 + sy * r * 0.4);
      g.stroke();
    });

    // Anillo de alineación: se cierra solo cuando la figura queda centrada.
    if (est.alineacion > 0.01) {
      g.strokeStyle = est.alineacion >= 1 ? 'rgba(155,226,111,0.95)' : 'rgba(255,214,130,0.9)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(L.cx, L.cy, r, -Math.PI / 2, -Math.PI / 2 + DOS_PI * est.alineacion);
      g.stroke();
      g.globalAlpha = 0.14;
      g.strokeStyle = '#FFD27A';
      g.lineWidth = 1;
      g.beginPath(); g.arc(L.cx, L.cy, r, 0, DOS_PI); g.stroke();
      g.globalAlpha = 1;
    }

    // Rótulo de lo que hay bajo la mira.
    const bajo = constelacionBajoLaMira();
    if (bajo) {
      const fijada = est.fijada && est.fijada.id === bajo.id && est.alineacion >= 1;
      const texto = fijada ? (bajo.mul + ' · «' + bajo.nombre + '»') : bajo.moderno;
      const sub = fijada ? '' : 'alineando… ' + Math.round(est.alineacion * 100) + '%';
      g.font = 'bold 13px ui-monospace, monospace';
      const ancho = Math.max(g.measureText(texto).width, g.measureText(sub).width) + 18;
      const bx = L.cx - ancho / 2, by = L.cy + L.R * 0.60;
      g.fillStyle = 'rgba(6,10,20,0.82)';
      rectRedondeado(g, bx, by, ancho, sub ? 40 : 24, 6);
      g.fill();
      g.strokeStyle = fijada ? 'rgba(155,226,111,0.7)' : 'rgba(255,214,130,0.5)';
      g.lineWidth = 1;
      g.stroke();
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = fijada ? '#BDF0A0' : '#FFD27A';
      g.fillText(texto, L.cx, by + (sub ? 13 : 12));
      if (sub) {
        g.font = '10px ui-monospace, monospace';
        g.fillStyle = 'rgba(200,220,255,0.72)';
        g.fillText(sub, L.cx, by + 28);
      }
    }
    g.restore();
  }

  // Carta estelar: el campo entero en miniatura con lo ya registrado y la ventana
  // actual marcada. Es lo que «integra» el apuntado: siempre se sabe dónde se está.
  // Va en la esquina inferior izquierda de la PANTALLA (no dentro de la lente): al
  // ser una ventana estrecha y alta, dentro del ocular caía sobre el aro de latón.
  function dibujarCartaEstelar(g, L, W, H) {
    try {
      const w = Math.min(230, Math.max(150, W * 0.19));
      const h = w * (CAMPO_ALTO / CAMPO_ANCHO);
      const x = 24;
      const y = H - h - 44;
      g.save();
      g.fillStyle = 'rgba(6,10,20,0.78)';
      rectRedondeado(g, x, y, w, h, 5);
      g.fill();
      g.strokeStyle = 'rgba(255,214,130,0.35)';
      g.lineWidth = 1;
      g.stroke();
      const sx = (w - 10) / CAMPO_ANCHO, sy = (h - 10) / CAMPO_ALTO;
      for (const c of CONSTELACIONES) {
        const cx2 = x + 5 + c.x * sx, cy2 = y + 5 + c.y * sy;
        const conocida = descubiertas.has(c.id);
        g.fillStyle = conocida ? '#E8C55C' : 'rgba(180,200,230,0.35)';
        g.beginPath(); g.arc(cx2, cy2, conocida ? 2.2 : 1.4, 0, DOS_PI); g.fill();
      }
      // Ventana actual
      const v = ventana();
      const semiX = Math.min(CAMPO_ANCHO, v) * sx;
      const semiY = Math.min(CAMPO_ALTO, v) * sy;
      g.strokeStyle = 'rgba(180,215,255,0.55)';
      g.lineWidth = 1;
      g.strokeRect(x + 5 + est.apX * sx - semiX / 2, y + 5 + est.apY * sy - semiY / 2, semiX, semiY);
      g.font = '9px ui-monospace, monospace';
      g.fillStyle = 'rgba(255,214,130,0.7)';
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillText('CARTA ESTELAR', x + 7, y - 12);
      g.restore();
    } catch (e) {}
  }

  function dibujarPanel(g, L, H, noche) {
    try {
      const P = L.panel;
      g.save();
      // Marco del panel: tablilla de arcilla con borde dorado.
      const fondo = g.createLinearGradient(P.x, P.y, P.x, P.y + P.h);
      fondo.addColorStop(0, 'rgba(26,22,14,0.96)');
      fondo.addColorStop(1, 'rgba(16,14,10,0.96)');
      g.fillStyle = fondo;
      rectRedondeado(g, P.x, P.y, P.w, P.h, 8);
      g.fill();
      g.strokeStyle = 'rgba(255,210,122,0.75)';
      g.lineWidth = 2;
      g.stroke();
      g.strokeStyle = 'rgba(255,210,122,0.18)';
      g.lineWidth = 1;
      rectRedondeado(g, P.x + 5, P.y + 5, P.w - 10, P.h - 10, 6);
      g.stroke();

      const pad = 16;
      let y = P.y + pad + 4;
      const anchoTexto = P.w - pad * 2;
      g.textAlign = 'left';
      g.textBaseline = 'top';

      const c = est.fijada;
      if (!c) {
        g.font = 'bold 13px ui-monospace, monospace';
        g.fillStyle = '#FFD27A';
        g.fillText('TABLILLA DE OBSERVACIÓN', P.x + pad, y);
        y += 24;
        g.font = '13px sans-serif';
        g.fillStyle = 'rgba(240,235,215,0.9)';
        const intro = envolver(g, 'Apunta con la mira a una figura del cielo y manténla centrada. Cuando el anillo se cierre, la tablilla te contará qué es.', anchoTexto);
        intro.forEach((l) => { g.fillText(l, P.x + pad, y); y += 19; });
        y += 10;
        // Registro: lista de lo ya observado y lo que falta.
        g.font = 'bold 11px ui-monospace, monospace';
        g.fillStyle = 'rgba(255,214,130,0.85)';
        g.fillText('REGISTRO · ' + descubiertas.size + '/' + CONSTELACIONES.length, P.x + pad, y);
        y += 18;
        g.font = '12px sans-serif';
        for (const k of CONSTELACIONES) {
          if (y > P.y + P.h - 22) break;
          const conocida = descubiertas.has(k.id);
          g.fillStyle = conocida ? '#BDF0A0' : 'rgba(200,205,220,0.42)';
          g.fillText((conocida ? '● ' : '○ ') + k.moderno + (conocida ? '  · ' + k.mul : ''), P.x + pad, y);
          y += 17;
        }
        g.restore();
        return;
      }

      const r = est.revelado;
      // 1) Nombre sumerio
      const a1 = suavizar(tramo(r, 0.02, 0.10));
      if (a1 > 0) {
        g.globalAlpha = a1;
        g.font = 'bold 15px ui-monospace, monospace';
        g.fillStyle = '#E8C55C';
        g.fillText(c.mul, P.x + pad, y);
        g.textAlign = 'right';
        g.font = 'bold 11px ui-monospace, monospace';
        g.fillStyle = descubiertas.has(c.id) ? '#BDF0A0' : 'rgba(200,205,220,0.6)';
        g.fillText(descubiertas.has(c.id) ? 'REGISTRADA' : 'SIN REGISTRAR', P.x + P.w - pad, y + 3);
        g.textAlign = 'left';
        g.globalAlpha = 1;
      }
      y += 24;

      // 2) Traducción + nombre moderno
      const a2 = suavizar(tramo(r, 0.09, 0.17));
      if (a2 > 0) {
        g.globalAlpha = a2;
        g.font = 'bold 17px sans-serif';
        g.fillStyle = '#F5ECD7';
        g.fillText('«' + c.nombre + '»', P.x + pad, y);
        g.font = '12px sans-serif';
        g.fillStyle = 'rgba(200,205,220,0.72)';
        g.fillText(c.moderno + '  ·  ' + c.significado, P.x + pad, y + 22);
        g.globalAlpha = 1;
        y += 46;
        g.strokeStyle = 'rgba(255,210,122,0.25)';
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(P.x + pad, y - 6); g.lineTo(P.x + P.w - pad, y - 6); g.stroke();
      } else {
        y += 6;
      }

      // 3) Relato, escrito letra a letra
      const tramoRelato = tramo(r, 0.15, 0.62);
      if (tramoRelato > 0) {
        const { visible, completo } = textoProgresivo(c.relato, tramoRelato);
        g.font = '13px sans-serif';
        g.fillStyle = 'rgba(240,235,215,0.94)';
        const lineas = envolver(g, visible, anchoTexto);
        lineas.forEach((l) => {
          if (y > P.y + P.h - 60) return;
          g.fillText(l, P.x + pad, y);
          y += 19;
        });
        // Cursor del escriba
        if (!completo && y <= P.y + P.h - 60) {
          const ultima = lineas[lineas.length - 1] || '';
          const cx2 = P.x + pad + g.measureText(ultima).width + 2;
          g.fillStyle = 'rgba(255,214,130,' + (0.35 + 0.45 * Math.abs(Math.sin(Date.now() / 260))).toFixed(2) + ')';
          g.fillRect(cx2, y - 17, 6, 13);
        }
      }

      // 4) Datos de la tablilla, uno a uno
      if (r > 0.66) {
        y += 8;
        for (let i = 0; i < c.datos.length; i++) {
          const ap = suavizar(tramo(r, 0.68 + i * 0.08, 0.74 + i * 0.08));
          if (ap <= 0) continue;
          if (y > P.y + P.h - 30) break;
          const desplazado = (1 - ap) * 14;
          g.globalAlpha = ap;
          g.font = 'bold 11px ui-monospace, monospace';
          g.fillStyle = '#E8C55C';
          g.fillText('·', P.x + pad + desplazado, y + 1);
          g.font = '12px sans-serif';
          g.fillStyle = 'rgba(225,232,245,0.9)';
          const lineas = envolver(g, c.datos[i], anchoTexto - 14);
          lineas.forEach((l, li) => {
            if (li === 0) g.fillText(l, P.x + pad + 12 + desplazado, y);
            else { y += 17; g.fillText(l, P.x + pad + 12 + desplazado, y); }
          });
          y += 20;
          g.globalAlpha = 1;
        }
      }

      // 5) Pie de tablilla
      if (r > 0.94) {
        g.globalAlpha = suavizar(tramo(r, 0.94, 1));
        g.font = '11px ui-monospace, monospace';
        g.fillStyle = 'rgba(255,214,130,0.8)';
        g.fillText('Estación: ' + c.epoca + '  ·  Observada a las ' + etiquetaHora(), P.x + pad, P.y + P.h - 26);
        g.globalAlpha = 1;
      }
      g.restore();
    } catch (e) {}
  }

  function dibujarPie(g, W, H, L, noche) {
    try {
      g.save();
      g.font = '12px ui-monospace, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillStyle = 'rgba(255,214,130,0.82)';
      const controles = 'Arrastra o WASD/flechas: apuntar  ·  Rueda: acercar  ·  E: fijar / completar  ·  R: reencuadrar  ·  Esc: cerrar';
      g.fillText(controles, W / 2, H - 10);
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillStyle = noche ? 'rgba(180,215,255,0.75)' : 'rgba(255,190,150,0.85)';
      g.fillText((noche ? 'CIELO NOCTURNO' : 'CIELO DIURNO · lavado') + '  ·  ' + etiquetaHora() + '  ·  aumento ×' + est.fov.toFixed(2) + '  ·  ' + getEpoch(), 24, 22);
      // Aviso de la época: el observatorio es cosa de Mesopotamia.
      if (getEpoch() === 'urss') {
        g.fillStyle = 'rgba(255,140,120,0.9)';
        g.fillText('La cúpula es mesopotámica: en la era soviética las tablillas duermen en un museo.', 24, 40);
      }
      g.restore();
    } catch (e) {}
  }

  // ── API ───────────────────────────────────────────────────────────────────
  return {
    abrir,
    cerrar,
    estaAbierto,
    manejarTecla,
    manejarTeclaSoltada,
    manejarPunteroAbajo,
    manejarPunteroArriba,
    manejarPunteroMueve,
    manejarRueda,
    actualizar,
    dibujar,
    // Consultas para pruebas y para el depurador del juego.
    constelaciones: () => CONSTELACIONES.map((c) => ({ id: c.id, mul: c.mul, nombre: c.nombre, moderno: c.moderno })),
    descubiertas: () => Array.from(descubiertas),
    // Apunta el telescopio a una constelación por id (pruebas / depuración).
    apuntarA: (id) => {
      const c = CONSTELACIONES.find((x) => x.id === id);
      if (!c) return null;
      est.apX = c.x; est.apY = c.y;
      limitarApuntado();
      return { x: est.apX, y: est.apY };
    },
    // Fija la que esté bajo la mira sin esperar al anillo (pruebas).
    fijarAhora: () => {
      const c = constelacionBajoLaMira();
      if (!c) return null;
      fijar(c);
      return c.id;
    },
    // Avanza la revelación a mano (pruebas): evita esperar 8 s por constelación.
    revelarAhora: () => { est.revelado = 1; if (est.fijada && !descubiertas.has(est.fijada.id)) registrarDescubrimiento(est.fijada); return est.revelado; },
    // Vacía el registro estelar (pruebas: ver el estado «sin registrar»).
    olvidarTodo: () => { descubiertas.clear(); persistirRegistro(); return true; },
    estado: () => ({
      abierto: est.abierto, apX: Math.round(est.apX), apY: Math.round(est.apY), fov: +est.fov.toFixed(2),
      alineacion: +est.alineacion.toFixed(2), revelado: +est.revelado.toFixed(2),
      candidata: est.candidata ? est.candidata.id : null,
      fijada: est.fijada ? est.fijada.id : null,
      objetivo: constelacionBajoLaMira() ? constelacionBajoLaMira().id : null,
      deNoche: esDeNoche(), descubiertas: Array.from(descubiertas)
    })
  };
}
