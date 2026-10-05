/* ═══════════════════════════════════════════════════════════════════════════
   SIGILO — zona vigilada, coberturas y conos de visión
   ───────────────────────────────────────────────────────────────────────────
   Un sistema «a lo mafia»: una zona acotada (un almacén del recaudador, un
   puesto de control…) con gente vigilando, coberturas por las que esconderse y
   un medidor de sospecha. Cada vigía (y cada enemigo del mundo) mira en un CONO
   (ángulo + alcance) que NO atraviesa lo que bloquea el paso.

   OJO, decisión del usuario: **los conos no se dibujan en el juego normal**
   («el rango de visión no se debería ver en ningún modo que no sea el que se
   activa pulsando la U»). En partida sólo se enseña el MEDIDOR de sospecha de
   los vigías de la zona; las áreas de visión se ven con la tecla `U`
   (`dibujarVisionEnemigos`), que las pinta en rojo sobre el mundo en blanco y
   negro durante 2 s (10 s de cooldown).

   Reglas del sistema:
   · La vista de un vigía es un cono (ángulo + alcance) y NO atraviesa lo que
     bloquea el paso (muros, cajas, árboles, rocas). El jugador está a salvo si
     hay algo en medio.
   · El medidor sube según lo cerca que esté, si corre y si va de frente; baja
     si va agachado o pegado a una cobertura. Al llenarse salta la ALARMA: todos
     los vigías van al último sitio donde te vieron y hay que salir de la zona
     y esperar a que se calme para volver a intentarlo.
   · El ruido también cuenta: una piedra lanzada al otro lado de una tapia
     manda a los vigías a mirar allí (para eso está el lanzamiento con trazo).

   Este módulo no toca el mundo por su cuenta: todo lo que necesita (leer el
   mapa, escribir edificios, crear entidades, avisar por pantalla) entra por
   `deps`, igual que en los demás módulos del motor.
   ═══════════════════════════════════════════════════════════════════════════ */

export function createStealthSystem(deps) {
  const D = deps || {};
  const call = (fn, ...args) => { try { return (typeof fn === 'function') ? fn(...args) : undefined; } catch (e) { return undefined; } };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  // ── Ajustes ──────────────────────────────────────────────────────────────
  const CFG = {
    fovTranquilo: 0.95,   // radianes (≈54°) de barrido normal
    fovAlerta: 1.75,      // al sospechar/alerta abre más el cono (≈100°)
    alcanceTranquilo: 8.5,
    alcanceAlerta: 11.5,
    velocidad: 0.95,      // llenado del medidor por segundo a media distancia
    decaimiento: 0.42,    // vaciado por segundo cuando no te ve
    sospecha: 0.34,       // a partir de aquí el vigía se gira y se acerca
    alarmaMs: 18000,      // lo que dura la alarma antes de volver a la calma
    pasoRayo: 0.4,        // muestreo del rayo de visión (celdas)
    rayosHaz: 18,         // rayos con los que se dibuja el cono del modo visión (U)
    cadaDeteccion: 150,   // ms entre comprobaciones de visión (a 60 fps sobra)
    // Los vigilantes de FUERA de la zona (guardias de pueblos y puertas) son
    // muchos (200+ en un mundo grande), así que se comprueban más espaciado: no
    // se nota y el coste baja a la mitad.
    cadaDeteccionCampo: 260,
    radio: 3.4            // radio (celdas) del medidor de la zona al centro
  };

  let zona = null;
  let mision = null;
  let cobertura = null;          // { c, r, fuente, desde }
  let ultimoChequeo = 0;
  let acumulador = 0;            // dt acumulado para no comprobar la vista cada fotograma
  let ultimoChequeoCampo = 0;    // idem para los vigilantes de fuera de la zona
  let acumuladorCampo = 0;
  let ultimoSincronizadoCampo = 0;
  let campoActivo = true;        // visión de los vigilantes de fuera de la zona
  let ultimoAviso = 0;
  let contadorRuidos = 0;
  let campo = [];                // vigías FUERA de la zona (guardias, enemigos, hostiles)

  // ── ¿QUIÉN tiene visión de verdad? ───────────────────────────────────────
  // El campo de visión NO es para cualquier NPC: sólo para los que son un
  // peligro real. Un aldeano, un mercader o un escriba pasean sin cono.
  //
  //  · guardias y soldados (por oficio),
  //  · los vigías de la zona de sigilo,
  //  · enemigos de la historia (flag `_enemigoHistoria`),
  //  · cualquiera a quien hayamos AGREDIDO o que se haya ENFADADO
  //    (`_hostile`, `_alertedAt`, `_angry`: los pone el sistema de reacción al
  //    disparo y de alerta de vecinos),
  //  · los enemigos «de torre» (array `enemies`).
  const TIPOS_PELIGROSOS = new Set([
    'guard', 'guardia', 'gate_guard', 'soldier', 'soldado', 'officer', 'oficial',
    'commander', 'comandante', 'commissar', 'comisario', 'militia', 'milicia',
    'watchman', 'vigilante', 'patrol', 'patrulla', 'bandit', 'bandido', 'brigand',
    'mercenary', 'mercenario', 'thug', 'maton', 'bouncer', 'bodyguard', 'enforcer',
    'hunter', 'cazador', 'gangster', 'mafioso', 'raider', 'beast'
  ]);

  function esEnemigoConVision(ent) {
    try {
      if (!ent) return false;
      if (ent._vigia) return true;                                  // vigía de la zona
      if (ent.kind === 'enemy' || ent.isEnemy) return true;          // enemigos de torre
      if (String(ent.id || '').startsWith('enemy-')) return true;    // enemigos de torre (sin `kind`)
      if (ent._enemigoHistoria) return true;                         // enemigo del guion
      if (ent._hostile || ent._angry || ent._alertedAt) return true;  // le hemos agredido / se ha enfadado
      const t = String(ent.npcType || ent.type || '').toLowerCase();
      if (TIPOS_PELIGROSOS.has(t)) return true;
      if (t && /guard|soldad|soldier|offic|commiss|militia|bandid|brigand|mercenar|thug|maton|enforcer|patrol|cazador|hunter|raider|beast/.test(t)) return true;
      return false;
    } catch (e) { return false; }
  }

  // Hacia dónde mira una entidad que NO es un vigía nuestro: se deduce de su
  // movimiento y, si está parada, de su dirección (`dir`).
  function anguloDe(ent) {
    try {
      if (ent.moveTarget) return Math.atan2(ent.moveTarget.y - ent.y, ent.moveTarget.x - ent.x);
      const d = String(ent.dir || 'down');
      if (d === 'left') return Math.PI;
      if (d === 'right') return 0;
      if (d === 'up') return -Math.PI / 2;
      return Math.PI / 2;
    } catch (e) { return Math.PI / 2; }
  }

  // Registro de los que tienen visión fuera de la zona: se crean y se retiran
  // solos según quién siga siendo peligroso (si un aldeano se calma, pierde el
  // cono; si le agredes, lo recupera).
  function sincronizarCampo() {
    try {
      const vistos = new Set();
      const p = call(D.getPlayer);
      // Índice por entidad: sin esto cada entidad recorría TODO el campo con un
      // `find` (218 NPJ × 220 vigilantes por fotograma) y se notaba en el coste.
      const porEntidad = new Map();
      for (const v of campo) if (v && v.npc) porEntidad.set(v.npc, v);
      const considerar = (ent) => {
        if (!ent || ent === p) return;
        if (ent._vigia) return;   // los de la zona tienen su propia evaluación (y su alarma)
        if (ent._deadUntil && Date.now() < ent._deadUntil) return;   // un cadáver no mira
        if (!esEnemigoConVision(ent)) return;
        let v = porEntidad.get(ent);
        if (!v) {
          v = {
            npc: ent,
            nombre: ent.name || 'Enemigo',
            mirando: anguloDe(ent),
            fov: CFG.fovTranquilo,
            alcance: CFG.alcanceTranquilo,
            estado: 'tranquilo',
            deteccion: 0,
            vio: false,
            campo: true,
            teVe: false
          };
          campo.push(v);
        }
        vistos.add(v);
      };
      const lista = call(D.getEntities) || [];
      for (const ent of lista) considerar(ent);
      const enemigos = call(D.getEnemies) || [];
      for (const ent of enemigos) considerar(ent);
      campo = campo.filter(v => v && vistos.has(v));
    } catch (e) {}
  }

  // ── Utilidades de mapa ───────────────────────────────────────────────────
  // Celdas que cortan la vista: se piden al motor EN BLOQUE (una pasada sobre
  // las entidades) y se guardan 250 ms. Antes cada muestra de cada rayo
  // preguntaba por una celda y el motor recorría todas las entidades: con 200
  // vigilantes eso era medio millón de comprobaciones por segundo.
  let indice = null;
  function refrescarIndice(p) {
    const alc = 26;
    const x = (p && p.x) || 0, y = (p && p.y) || 0;
    const minC = Math.floor(x) - alc, maxC = Math.floor(x) + alc;
    const minR = Math.floor(y) - alc, maxR = Math.floor(y) + alc;
    let set = null;
    try { set = call(D.indiceBloqueantes, minC, minR, maxC, maxR); } catch (e) {}
    indice = { set: (set instanceof Set) ? set : new Set(), at: Date.now(), minC, minR, maxC, maxR };
  }
  function esBloqueante(c, r) {
    // Fuera del mapa o edificio: se contesta al momento (barato y exacto).
    const cols = Number(call(D.getCols)) || 0, rows = Number(call(D.getRows)) || 0;
    if (c < 0 || r < 0 || c >= cols || r >= rows) return true;
    if (call(D.hayEdificio, c, r)) return true;
    // Árboles, rocas grandes y bultos: por el índice.
    const ahora = Date.now();
    if (!indice || ahora - indice.at > 250) refrescarIndice(call(D.getPlayer));
    if (c < indice.minC || c > indice.maxC || r < indice.minR || r > indice.maxR) {
      // Fuera de la ventana indexada (sólo pasa con haces lejanos): se pregunta
      // al motor para no perder ningún obstáculo.
      return !!call(D.bloqueaVista, c, r);
    }
    return indice.set.has(c + ',' + r);
  }
  const esCaminable = (c, r) => !!call(D.esCaminable, c, r);
  const limite = () => ({ cols: Number(call(D.getCols)) || 0, rows: Number(call(D.getRows)) || 0 });

  // ¿Hay algo que corte la vista entre dos puntos? Se muestrea el segmento: es
  // más barato y más estable que un trazado de Bresenham con diagonales.
  function vistaLibre(x1, y1, x2, y2) {
    const d = dist(x1, y1, x2, y2);
    if (d < 0.35) return true;
    const pasos = Math.ceil(d / CFG.pasoRayo);
    for (let i = 1; i < pasos; i++) {
      const t = i / pasos;
      const c = Math.floor(x1 + (x2 - x1) * t);
      const r = Math.floor(y1 + (y2 - y1) * t);
      if (esBloqueante(c, r)) return false;
    }
    return true;
  }

  // ¿Qué hay delante de un punto, en dirección `ang`? Se usa para recortar el
  // haz contra los muros: devuelve la distancia (en celdas) al primer choque.
  function alcanceHastaChoque(x, y, ang, alcanceMax) {
    const paso = Math.max(0.22, CFG.pasoRayo * 0.7);
    for (let d = 0.35; d <= alcanceMax; d += paso) {
      const c = Math.floor(x + Math.cos(ang) * d);
      const r = Math.floor(y + Math.sin(ang) * d);
      if (esBloqueante(c, r)) return Math.max(0.3, d - paso * 0.5);
    }
    return alcanceMax;
  }

  // ── Zona ─────────────────────────────────────────────────────────────────
  // Busca un claro razonable cerca del jugador: ni dentro de una casa, ni en el
  // agua, y con la mayoría de las celdas libres alrededor.
  function buscarSitio(opts) {
    const o = opts || {};
    const { cols, rows } = limite();
    const p = call(D.getPlayer) || { x: 0, y: 0 };
    const ancho = o.ancho || 26, alto = o.alto || 20;
    const minDist = o.minDist || 16, maxDist = o.maxDist || 46;
    let mejor = null, mejorPuntos = -1e9;
    for (let intento = 0; intento < 260; intento++) {
      const ang = Math.random() * Math.PI * 2;
      const d = minDist + Math.random() * (maxDist - minDist);
      const cx = Math.round((p.x || 0) + Math.cos(ang) * d);
      const cy = Math.round((p.y || 0) + Math.sin(ang) * d);
      if (cx - ancho / 2 < 2 || cy - alto / 2 < 2) continue;
      if (cx + ancho / 2 >= cols - 2 || cy + alto / 2 >= rows - 2) continue;
      let libres = 0, agua = 0, edificios = 0, total = 0;
      for (let r = cy - alto / 2; r <= cy + alto / 2; r += 2) {
        for (let c = cx - ancho / 2; c <= cx + ancho / 2; c += 2) {
          total++;
          if (typeof D.esAgua === 'function' && call(D.esAgua, c, r)) { agua++; continue; }
          if (call(D.hayEdificio, c, r)) { edificios++; continue; }
          if (esCaminable(c, r)) libres++;
        }
      }
      if (!total) continue;
      const fracLibre = libres / total;
      if (agua / total > 0.04) continue;                 // que no haya río por medio
      // Se premia el claro amplio y no estar pegado a un pueblo (el recinto se
      // levanta a mano, así que pisar una manzana sería un desastre).
      const puntos = fracLibre * 10 - (edificios / total) * 6;
      if (puntos > mejorPuntos) { mejorPuntos = puntos; mejor = { cx, cy }; }
      if (puntos > 9.2) break;
    }
    if (!mejor) mejor = { cx: Math.round((p.x || 0) + 22), cy: Math.round((p.y || 0) + 8) };
    return { cx: clamp(Math.round(mejor.cx), 16, Math.max(16, cols - 17)), cy: clamp(Math.round(mejor.cy), 14, Math.max(14, rows - 15)), ancho, alto };
  }

  // Escribe un trozo de muro de muralla (ya existe el tipo y su arte). Si la
  // celda está ocupada no se toca nada: la zona se adapta, no aplasta.
  function ponerMuro(c, r, orient) {
    try {
      if (call(D.hayEdificio, c, r)) return false;
      if (typeof D.ponerEdificio === 'function') { call(D.ponerEdificio, c, r, 'wall_segment', orient); return true; }
    } catch (e) {}
    return false;
  }

  function ponerCobertura(c, r, tipo) {
    // Cajas, tinajas y carros son entidades ambientales: se ven y se chocan con
    // ellas (y por tanto cortan la vista), sin necesidad de tocar la rejilla.
    try {
      if (call(D.hayEdificio, c, r)) return false;
      if (typeof D.crearAmbient === 'function') {
        const ent = call(D.crearAmbient, tipo, c, r, 0.95, { _cobertura: true });
        return !!ent;
      }
    } catch (e) {}
    return false;
  }

  function ponerRoca(c, r) {
    try {
      if (call(D.hayEdificio, c, r)) return false;
      const ent = call(D.colocarRecurso, c, r, 'boulder');
      if (ent) { try { ent._cobertura = true; } catch (e) {} return true; }
    } catch (e) {}
    return false;
  }

  function ponerArbol(c, r) {
    try {
      if (call(D.hayEdificio, c, r)) return false;
      const ent = call(D.colocarArbol, c, r);
      if (ent) { try { ent._cobertura = true; } catch (e) {} return true; }
    } catch (e) {}
    return false;
  }

  // ── Vigías ───────────────────────────────────────────────────────────────
  function crearVigia(c, r, ruta, opts) {
    const o = opts || {};
    const nombre = o.nombre || 'Vigía';
    const npc = call(D.crearGuardia, nombre, c, r, { npcType: 'guard' });
    if (!npc) return null;
    try {
      npc._vigia = true;
      npc._keepPost = true;
      npc._storyLines = null;
      npc.isStoryNPC = false;
      npc.hp = npc.hp || 30;
      npc._zonaSigiloId = zona ? zona.id : null;
    } catch (e) {}
    const vigia = {
      npc,
      nombre,
      ruta: Array.isArray(ruta) && ruta.length ? ruta.map(p => ({ c: p.c, r: p.r })) : [{ c, r }],
      rutaOriginal: null,
      indice: 0,
      mirando: o.mirando != null ? o.mirando : Math.PI / 2,
      giro: o.giro || 0,                 // rad/s del barrido cuando está parado
      barrido: 0,
      fov: CFG.fovTranquilo,
      alcance: CFG.alcanceTranquilo,
      estado: 'tranquilo',
      deteccion: 0,
      vio: false,
      ultimaVez: null,                   // { x, y } donde te vio por última vez
      pausa: o.pausa || 0,
      avisoAt: 0,
      golpeAt: 0
    };
    if (zona) zona.vigias.push(vigia);
    return vigia;
  }

  // Ordena a un vigía que vaya a un punto (reutiliza el movimiento de los NPC:
  // se le cambia la ruta por un único punto y el bucle de entidades lo pasea).
  function mandarA(vigia, x, y) {
    try {
      const npc = vigia.npc;
      if (!vigia.rutaOriginal) vigia.rutaOriginal = vigia.ruta.map(p => ({ c: p.c, r: p.r }));
      const destino = call(D.buscarCaminable, Math.floor(x), Math.floor(y), 6) || { col: Math.floor(x), row: Math.floor(y) };
      npc.patrolRoute = [{ c: destino.col, r: destino.row }];
      npc.patrolIndex = 0;
      npc.patrolLoop = true;
      npc.patrolPauseMs = 300;
      npc.nextMove = Date.now();
    } catch (e) {}
  }

  function devolverARuta(vigia) {
    try {
      if (!vigia.rutaOriginal) return;
      const npc = vigia.npc;
      npc.patrolRoute = vigia.rutaOriginal.map(p => ({ c: p.c, r: p.r }));
      npc.patrolIndex = 0;
      npc.patrolLoop = true;
      npc.patrolPauseMs = 1400;
      npc.nextMove = Date.now() + 900;
      vigia.rutaOriginal = null;
    } catch (e) {}
  }

  function construirZona(opts) {
    const o = opts || {};
    // Los vigías de una zona ANTERIOR dejan de serlo. La zona se vuelve a levantar
    // en cada partida (y la partida guardada conserva a sus guardias), así que si
    // no se sueltan se acumulan guardias «vigías» sin zona que nadie evalúa: ni
    // visión ni ronda. En cuanto se construye la zona nueva, sólo sus vigías
    // llevan la marca.
    try {
      const lista = call(D.getEntities) || [];
      for (const ent of lista) {
        if (ent && ent._vigia) { ent._vigia = false; delete ent._keepPost; }
      }
    } catch (e) {}
    if (zona && zona.vigias) zona.vigias.length = 0;
    const sitio = (o.centro && Number.isFinite(o.centro.cx)) ? { cx: o.centro.cx, cy: o.centro.cy, ancho: o.ancho || 26, alto: o.alto || 20 } : buscarSitio(o);
    const hw = Math.floor(sitio.ancho / 2), hh = Math.floor(sitio.alto / 2);
    const cx = sitio.cx, cy = sitio.cy;
    const epoca = String(call(D.getEpoca) || 'mesopotamia');
    const nombre = o.nombre || (epoca === 'urss' ? 'Puesto de control del distrito' : 'Almacén del recaudador');
    zona = {
      id: 'zona_sigilo_' + Date.now().toString(36),
      nombre,
      cx, cy,
      minC: cx - hw, maxC: cx + hw, minR: cy - hh, maxR: cy + hh,
      vigias: [],
      coberturas: [],
      objetivo: { c: cx, r: cy },
      alarma: false,
      alarmaHasta: 0,
      juegos: 0,
      completada: false,
      detectado: false,
      construida: true,
      epoca
    };

    // ── 1. Cerco: muros con dos vanos (la puerta principal y una tronera) ──
    const puertaC = cx - 2;                    // vano sur (por donde se entra)
    const troneraR = cy - hh;                  // vano norte (salida de emergencia)
    for (let c = zona.minC; c <= zona.maxC; c++) {
      for (const r of [zona.minR, zona.maxR]) {
        const esVano = (r === zona.maxR && (c === puertaC || c === puertaC + 1)) || (r === zona.minR && c === cx + 3);
        if (esVano) continue;
        ponerMuro(c, r, 'h');
      }
    }
    for (let r = zona.minR; r <= zona.maxR; r++) {
      for (const c of [zona.minC, zona.maxC]) {
        if (c === zona.minC && r === troneraR) continue;
        ponerMuro(c, r, 'v');
      }
    }

    // ── 2. Naves y puestos de dentro (edificios de la época) ──────────────
    const paleta = (call(D.getPaletaConstruccion) || []).filter(t => typeof t === 'string');
    const naveA = paleta.includes('granary') ? 'granary' : (paleta.includes('state_warehouse') ? 'state_warehouse' : null);
    const naveB = paleta.includes('house') ? 'house' : (paleta.includes('soviet_block') ? 'soviet_block' : null);
    if (naveA && typeof D.ponerEdificio === 'function') call(D.ponerEdificio, cx - 6, cy - 5, naveA);
    if (naveB && typeof D.ponerEdificio === 'function') call(D.ponerEdificio, cx + 4, cy - 4, naveB);
    if (naveB && typeof D.ponerEdificio === 'function' && Math.random() < 0.6) call(D.ponerEdificio, cx - 8, cy + 4, naveB);

    // ── 3. Coberturas repartidas: cajas, rocas, árboles ───────────────────
    const sitiosCubiertos = [
      [cx - 1, cy + 2], [cx + 1, cy + 3], [cx - 3, cy + 1], [cx + 3, cy + 1],
      [cx - 5, cy - 1], [cx + 5, cy + 2], [cx - 6, cy + 6], [cx + 6, cy + 5],
      [cx, cy - 2], [cx - 2, cy - 6], [cx + 3, cy - 7], [cx + 7, cy - 1]
    ];
    sitiosCubiertos.forEach((par, i) => {
      const c = par[0], r = par[1];
      if (call(D.hayEdificio, c, r)) return;
      const tipo = i % 3 === 0 ? 'crate_stack' : (i % 3 === 1 ? 'amphora' : 'barrel');
      if (ponerCobertura(c, r, tipo)) { zona.coberturas.push({ c, r }); return; }
      if (ponerRoca(c, r)) zona.coberturas.push({ c, r });
    });
    [[cx + 8, cy + 7], [cx - 9, cy - 2], [cx + 9, cy - 5], [cx - 7, cy + 8]].forEach(par => {
      if (ponerArbol(par[0], par[1])) zona.coberturas.push({ c: par[0], r: par[1] });
    });

    // ── 4. El botín (el objetivo de la misión) ────────────────────────────
    zona.objetivo = { c: cx + 1, r: cy };
    if (typeof D.marcarObjetivo === 'function') call(D.marcarObjetivo, zona.objetivo.c, zona.objetivo.r, zona);

    // ── 5. Vigías: dos que pasean por dentro y uno que barre desde la puerta ─
    crearVigia(puertaC, zona.maxR - 1, [{ c: puertaC, r: zona.maxR - 1 }, { c: puertaC + 3, r: zona.maxR - 3 }], { nombre: 'Portero', mirando: -Math.PI / 2, pausa: 1600 });
    crearVigia(cx - 4, cy + 3, [
      { c: cx - 4, r: cy + 3 }, { c: cx + 4, r: cy + 3 }, { c: cx + 5, r: cy - 3 }, { c: cx - 4, r: cy - 3 }
    ], { nombre: 'Ronda de patio', giro: 0.5 });
    crearVigia(cx + 6, cy - 6, [{ c: cx + 6, r: cy - 6 }, { c: cx - 6, r: cy - 5 }], { nombre: 'Ronda del fondo', giro: 0.4 });
    if ((zona.maxC - zona.minC) >= 24) {
      crearVigia(cx, cy - 6, [{ c: cx - 2, r: cy - 7 }, { c: cx + 2, r: cy - 7 }], { nombre: 'Ronda del almacén', giro: 0.3 });
    }

    call(D.registrar, `Zona vigilada «${nombre}» levantada en ${cx},${cy} con ${zona.vigias.length} vigías.`);
    return zona;
  }

  // ── Coberturas ───────────────────────────────────────────────────────────
  // No hay «objetos cobertura» con lista propia: un sitio es cobertura si tiene
  // algo que corta la vista justo al lado. Así cualquier tapia, caja o árbol del
  // mapa (no sólo los de la zona) sirve para esconderse.
  function buscarCoberturaCerca(x, y, radio) {
    const r0 = Math.floor(y), c0 = Math.floor(x);
    const R = Math.max(1, Math.round(radio || 1.6));
    let mejor = null, mejorD = 1e9;
    for (let r = r0 - R; r <= r0 + R; r++) {
      for (let c = c0 - R; c <= c0 + R; c++) {
        if (!esCaminable(c, r)) continue;
        // ¿tiene un obstáculo pegado en alguna de las 4 direcciones?
        let tapado = null;
        for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          if (esBloqueante(c + dc, r + dr)) { tapado = { c: c + dc, r: r + dr }; break; }
        }
        if (!tapado) continue;
        const d = dist(c + 0.5, r + 0.5, x, y);
        if (d < mejorD) { mejorD = d; mejor = { c, r, fuente: tapado }; }
      }
    }
    return mejor;
  }

  function entrarEnCobertura(x, y, radio) {
    const sitio = buscarCoberturaCerca(
      Number.isFinite(x) ? x : (call(D.getPlayer) || {}).x,
      Number.isFinite(y) ? y : (call(D.getPlayer) || {}).y,
      radio
    );
    if (!sitio) return null;
    cobertura = { c: sitio.c, r: sitio.r, fuente: sitio.fuente, desde: Date.now() };
    if (typeof D.moverJugador === 'function') call(D.moverJugador, sitio.c, sitio.r);
    call(D.notificar, 'Te arrimas a una cobertura. Desde aquí no te ven: sigue con Ctrl para salir.');
    call(D.sfx, 'footstep');
    return cobertura;
  }

  function salirDeCobertura(silencioso) {
    if (!cobertura) return false;
    cobertura = null;
    if (!silencioso) call(D.notificar, 'Sales de la cobertura.');
    return true;
  }

  const enCobertura = () => !!cobertura;
  const datosCobertura = () => (cobertura ? { c: cobertura.c, r: cobertura.r, fuente: { ...cobertura.fuente } } : null);

  // ¿La cobertura tapa de verdad la mirada de este vigía? (según de qué lado venga)
  function coberturaProtegeDe(vigia) {
    if (!cobertura || !vigia) return false;
    const p = call(D.getPlayer) || { x: 0, y: 0 };
    const px = (p.x || 0) + 0.5, py = (p.y || 0) + 0.5;
    const nx = vigia.npc.x, ny = vigia.npc.y;
    // El obstáculo está entre el jugador y el vigía si la mirada directa pasa
    // por su celda: se comprueba con el muestreo del rayo.
    return !vistaLibre(px, py, nx, ny);
  }

  // ── Ruido (piedras lanzadas, pasos, gritos) ──────────────────────────────
  function hacerRuido(x, y, radio, fuerza) {
    if (!zona || !zona.vigias.length) return 0;
    const r = Math.max(1, Number(radio) || 6);
    const f = clamp(Number(fuerza) || 0.6, 0.1, 1);
    let avisados = 0;
    for (const v of zona.vigias) {
      const d = dist(x, y, v.npc.x, v.npc.y);
      if (d > r) continue;
      avisados++;
      v.estado = v.estado === 'alerta' ? 'alerta' : 'sospecha';
      v.deteccion = Math.max(v.deteccion, clamp(0.3 + f * (1 - d / r) * 0.55, 0, 0.92));
      v.ultimaVez = { x, y };
      v.ruido = { x, y, at: Date.now() };
      v.avisoAt = Date.now();
    }
    if (avisados) {
      contadorRuidos++;
      call(D.registrar, `Ruido en ${Math.round(x)},${Math.round(y)}: ${avisados} vigía(s) miran hacia allí.`);
      const p = call(D.getPlayer);
      if (p && dist(x, y, p.x, p.y) < 7 && Date.now() - ultimoAviso > 2500) {
        ultimoAviso = Date.now();
        call(D.notificar, avisados === 1 ? 'Un vigía ha oído algo.' : `${avisados} vigías miran hacia el ruido.`);
      }
    }
    return avisados;
  }

  // ── Mirada de los vigías ─────────────────────────────────────────────────
  function actualizarMirada(v, dt, p) {
    const npc = v.npc;
    const x = npc.x, y = npc.y;
    if (v.estado === 'alerta' || v.estado === 'sospecha') {
      const objetivo = v.ultimaVez || { x: p.x + 0.5, y: p.y + 0.5 };
      const deseada = Math.atan2(objetivo.y - y, objetivo.x - x);
      let dif = ((deseada - v.mirando + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      v.mirando += dif * Math.min(1, dt * 6);
      return;
    }
    // Tranquilo: si anda, mira hacia donde va; si está parado, barre la vista.
    if (npc.moveTarget) {
      const deseada = Math.atan2(npc.moveTarget.y - y, npc.moveTarget.x - x);
      let dif = ((deseada - v.mirando + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      v.mirando += dif * Math.min(1, dt * 3.4);
    } else if (v.giro) {
      v.barrido += dt * v.giro;
      const base = v.mirandoBase != null ? v.mirandoBase : (v.mirandoBase = v.mirando);
      v.mirando = base + Math.sin(v.barrido) * 0.9;
    }
  }

  // ── Visión y medidor ─────────────────────────────────────────────────────
  // `enZona` decide dos cosas: si la alerta la mantiene el reloj de la zona y si
  // al calmarse hay que devolver al vigía a su ronda (los de fuera no tienen
  // ronda que devolver).
  function evaluarVigia(v, dt, p, enZona) {
    const npc = v.npc;
    const px = (p.x || 0) + 0.5, py = (p.y || 0) + 0.5;
    const d = dist(px, py, npc.x, npc.y);
    const alerta = v.estado === 'alerta';
    v.fov = alerta ? CFG.fovAlerta : CFG.fovTranquilo;
    v.alcance = alerta ? CFG.alcanceAlerta : CFG.alcanceTranquilo;

    let ve = false;
    if (d <= v.alcance) {
      const ang = Math.atan2(py - npc.y, px - npc.x);
      let dif = Math.abs(((ang - v.mirando + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      // Muy cerca te ve aunque no mire de frente (te oye/roza): 70° de gracia.
      const fov = d < 1.6 ? Math.max(v.fov, 2.4) : v.fov;
      if (dif <= fov / 2 && vistaLibre(npc.x, npc.y, px, py)) ve = true;
    }
    v.vio = ve;

    if (ve) {
      const cerca = 1 - d / Math.max(1, v.alcance);              // 1 pegado, 0 al borde
      let vel = CFG.velocidad * (0.55 + 1.5 * cerca);
      const agachado = !!call(D.jugadorAgachado);
      if (agachado) vel *= 0.45;
      if (cobertura) vel *= 0.5;
      if (call(D.jugadorCorriendo)) vel *= 1.4;
      if (call(D.esDeNoche)) vel *= 0.82;
      if (alerta) vel *= 1.8;
      v.deteccion = clamp(v.deteccion + vel * dt, 0, 1.2);
      v.ultimaVez = { x: px, y: py };
    } else {
      // Nadie te ve: sólo se vacía el medidor. Nada de preguntar si vas agachado,
      // corriendo o si es de noche: eso se preguntaba 200 veces por comprobación.
      v.deteccion = Math.max(0, v.deteccion - CFG.decaimiento * dt);
    }

    if (v.deteccion >= 1) {
      v.estado = 'alerta';
      v.deteccion = 1;
      return 'alarma';
    }
    if (v.deteccion >= CFG.sospecha) {
      if (v.estado !== 'alerta') {
        v.estado = 'sospecha';
        if (Date.now() - v.avisoAt > 4000) {
          v.avisoAt = Date.now();
          call(D.sfx, 'dogBark3', { volume: 0.5 });
        }
      }
      return 'sospecha';
    }
    if (v.estado === 'alerta') {
      // En la ZONA la alarma sigue viva hasta que expire su reloj; fuera, el
      // vigía se calma solo.
      if (enZona && zona && Date.now() < zona.alarmaHasta) return 'alerta';
      v.estado = 'tranquilo';
      if (enZona) devolverARuta(v);
      return 'tranquilo';
    }
    if (v.estado === 'sospecha') { v.estado = 'tranquilo'; if (enZona) devolverARuta(v); }
    return 'tranquilo';
  }

  // ── Vigilantes de FUERA de la zona ───────────────────────────────────────
  // Se les actualiza la mirada y el medidor igual que a los de la zona, pero no
  // hay alarma que disparar: si un enemigo te completa el medidor, se avisa al
  // motor (`enemigoTeVe`) y él decide (perseguir, avisar a los demás…).
  function actualizarCampo(dt, chequear, dtChequeo, p) {
    if (!campoActivo) return;
    // Rehacer la lista de vigilantes cuesta (recorre todas las entidades), así
    // que se refresca 4 veces por segundo, no en cada fotograma.
    const ahora = Date.now();
    if (ahora - (ultimoSincronizadoCampo || 0) > 250) {
      ultimoSincronizadoCampo = ahora;
      sincronizarCampo();
    } else if (!campo.length && !ultimoSincronizadoCampo) {
      sincronizarCampo();
    }
    for (const v of campo) {
      if (!v || !v.npc) continue;
      // Los que están lejos del jugador no se tocan: su cono no se ve, no puede
      // detectarle y actualizarlos costaba más que todo lo demás junto.
      const dx = v.npc.x - (p.x || 0), dy = v.npc.y - (p.y || 0);
      if (dx > 18 || dx < -18 || dy > 18 || dy < -18) { v.deteccion = 0; v.estado = 'tranquilo'; continue; }
      actualizarMirada(v, dt, p);
      if (!chequear) continue;
      const r = evaluarVigia(v, dtChequeo, p, false);
      v.teVe = v.deteccion >= 1;
      if (r === 'alarma') {
        if (!v._avisado) { v._avisado = true; call(D.enemigoTeVe, v.npc, v); }
      } else {
        v._avisado = false;
      }
    }
  }

  function dispararAlarma(v) {
    if (!zona) return;
    const primera = !zona.alarma;
    zona.alarma = true;
    zona.alarmaHasta = Date.now() + CFG.alarmaMs;
    zona.detectado = true;
    zona.ultimoVisto = v && v.ultimaVez ? { ...v.ultimaVez } : null;
    for (const otro of zona.vigias) {
      otro.estado = 'alerta';
      otro.deteccion = 1;
      if (zona.ultimoVisto) mandarA(otro, zona.ultimoVisto.x, zona.ultimoVisto.y);
    }
    if (primera) {
      call(D.sfx, 'dogGrowl', { volume: 1 });
      setTimeout(() => { try { call(D.sfx, 'dogBark2', { volume: 1 }); } catch (e) {} }, 420);
      call(D.notificar, '¡TE HAN VISTO! Sal de la zona y espera a que se calmen.');
      call(D.registrar, `Alarma en «${zona.nombre}»: te vio ${v ? v.nombre : 'un vigía'}.`);
      call(D.alarmaMision, zona);
    }
  }

  // ── Golpes al jugador cuando te alcanzan ─────────────────────────────────
  function golpearSiPegado(v, now) {
    if (v.estado !== 'alerta') return;
    const p = call(D.getPlayer);
    if (!p) return;
    const d = dist((p.x || 0) + 0.5, (p.y || 0) + 0.5, v.npc.x, v.npc.y);
    if (d > 1.25) return;
    if (now - (v.golpeAt || 0) < 2200) return;
    v.golpeAt = now;
    call(D.golpearJugador, 4, 'guardia de ' + zona.nombre);
  }

  function actualizar(dt) {
    // Los vigilantes de FUERA de la zona (guardias, enemigos, hostiles) se
    // actualizan siempre, haya zona o no: su visión no depende del recinto.
    const p0 = call(D.getPlayer);
    if (p0 && p0.col !== -999) {
      const delta0 = clamp(dt || 0.016, 0, 0.12);
      acumuladorCampo += delta0 * 1000;
      const chequear0 = (acumuladorCampo >= CFG.cadaDeteccionCampo) || !ultimoChequeoCampo;
      if (chequear0) {
        const dtCh = Math.max(0.05, Math.min(0.5, (Date.now() - (ultimoChequeoCampo || Date.now() - CFG.cadaDeteccionCampo)) / 1000));
        acumuladorCampo = 0;
        ultimoChequeoCampo = Date.now();
        actualizarCampo(delta0, true, dtCh, p0);
      } else {
        actualizarCampo(delta0, false, delta0, p0);
      }
    }
    if (!zona || !zona.construida) return;
    const now = Date.now();
    const p = call(D.getPlayer);
    if (!p || p.col === -999) return;
    const delta = clamp(dt || 0.016, 0, 0.12);

    // La mirada se reorienta siempre (es lo que se ve), pero la COMPROBACIÓN de
    // visión va a 6-7 Hz: a 60 fps el ahorro es enorme y no se nota.
    acumulador += delta * 1000;
    const chequear = (acumulador >= CFG.cadaDeteccion) || !ultimoChequeo;
    let dtChequeo = delta;
    if (chequear) {
      dtChequeo = Math.max(0.05, Math.min(0.5, (now - (ultimoChequeo || now - CFG.cadaDeteccion)) / 1000));
      acumulador = 0;
      ultimoChequeo = now;
    }

    const fueraDeZona = !dentroDeZona(p.x, p.y);

    // MODO SIGILO CON CTRL: agachado y, si hay una tapia o una caja al lado, el
    // jugador queda automáticamente arrimado a ella. Es lo que pidió el usuario:
    // las coberturas se hacen con Ctrl, sin tener que apuntar a nada. Va ANTES
    // del corte de misión porque `cobertura` también la leen los vigilantes de
    // fuera de la zona (mitad de velocidad de detección).
    const agachado = !!call(D.jugadorAgachado);
    if (agachado) {
      if (!cobertura) {
        const sitio = buscarCoberturaCerca((p.x || 0) + 0.5, (p.y || 0) + 0.5, 1.15);
        if (sitio) cobertura = { c: sitio.c, r: sitio.r, fuente: sitio.fuente, desde: now };
      } else if (!buscarCoberturaCerca((p.x || 0) + 0.5, (p.y || 0) + 0.5, 1.6)) {
        // Se ha alejado de la cobertura: deja de estar arrimado.
        cobertura = null;
      }
    } else if (cobertura) {
      cobertura = null;
    }

    // ¿Está VIVA la zona? Sólo cuando la misión de sigilo está aceptada y sin
    // terminar. Es la regla que pidió el usuario: «en los momentos normales, que
    // no estén en una misión… los enemigos sólo deberían perseguir y atacarme si
    // estoy agrediendo a alguien». La zona existe desde que empieza la partida
    // (es un sitio del mundo), así que sin misión sus guardias son guardias
    // normales: te miran, pero no te persiguen, no dan la alarma y no te pegan
    // por acercarte.
    const activa = !!(zona.sigilo && !zona.completada);
    if (!activa) {
      if (zona.alarma) {
        zona.alarma = false;
        zona.detectado = false;
        zona.alarmaHasta = 0;
        for (const v of zona.vigias) { v.estado = 'tranquilo'; devolverARuta(v); }
        call(D.registrar, `Los vigías de «${zona.nombre}» vuelven a su ronda.`);
      }
      for (const v of zona.vigias) {
        actualizarMirada(v, delta, p);
        v.deteccion = Math.max(0, v.deteccion - CFG.decaimiento * delta);
        if (v.estado !== 'tranquilo') v.estado = 'tranquilo';
      }
      zona.deteccion = 0;
      return;
    }
    if (zona.alarma && now > zona.alarmaHasta && fueraDeZona) {
      zona.alarma = false;
      zona.detectado = false;
      call(D.registrar, `Los vigías de «${zona.nombre}» vuelven a su ronda.`);
      call(D.notificar, 'Los vigías se han calmado. Puedes volver a intentarlo.');
    }

    let peor = 0;
    for (const v of zona.vigias) {
      actualizarMirada(v, delta, p);
      if (!chequear) { peor = Math.max(peor, v.deteccion); continue; }
      const r = evaluarVigia(v, dtChequeo, p, true);
      if (r === 'alarma') dispararAlarma(v);
      golpearSiPegado(v, now);
      peor = Math.max(peor, v.deteccion);
    }
    zona.deteccion = peor;

    if (zona.sigilo && !zona.completada) comprobarObjetivo(p);
  }
  function dentroDeZona(x, y) {
    if (!zona) return false;
    return x >= zona.minC - 2 && x <= zona.maxC + 2 && y >= zona.minR - 2 && y <= zona.maxR + 2;
  }

  // ── Misión de sigilo ─────────────────────────────────────────────────────
  function comprobarObjetivo(p) {
    const d = dist((p.x || 0) + 0.5, (p.y || 0) + 0.5, zona.objetivo.c + 0.5, zona.objetivo.r + 0.5);
    if (zona.alarma) return;
    if (d > 1.7) return;
    zona.completada = true;
    call(D.notificar, 'Te haces con el alijo sin que nadie te vea.');
    call(D.sfx, 'pickup');
    call(D.registrar, `Misión de sigilo cumplida en «${zona.nombre}» sin ser visto.`);
    if (mision) { try { mision.progress = mision.target || 1; } catch (e) {} }
    call(D.completarMision, mision);
    call(D.darXP, 25);
  }

  // Arma la misión (sin abrirla): la usan el diálogo —que la ofrece a mitad de
  // conversación— y `iniciarMision`. El relato y los pasos cambian según la
  // época, que aquí es lo único que se «localiza».
  function prepararMision(opts) {
    const o = opts || {};
    if (!zona || !zona.construida) construirZona(o);
    const esUrss = String(zona.epoca || '') === 'urss';
    mision = {
      id: 'sigilo_' + (zona.epoca || 'mesopotamia') + '_1',
      title: o.titulo || (esUrss ? 'Los papeles del distrito' : 'El alijo del recaudador'),
      desc: o.desc || (esUrss
        ? 'En el puesto de control guardan los papeles que te interesan. Llega hasta ellos sin que te vean; si te descubren, aléjate de la zona y espera a que se calmen.'
        : 'El recaudador guarda el alijo en un almacén vigilado. Entra, llega hasta él y sal sin que te vean; si te descubren, aléjate de la zona y espera a que se calmen.'),
      target: 1,
      progress: 0,
      watch: 'stealth',
      sigilo: true,
      isStory: false,
      isSide: true,
      done: false,
      zonaId: zona.id,
      targetCol: zona.objetivo.c,
      targetRow: zona.objetivo.r,
      radius: 1.7,
      reward: o.reward || { wheat: 6, brick: 4 }
    };
    mision._pasos = [
      'Ve a la zona vigilada. Pulsa U para ver su campo de visión en rojo (2 s, se recarga en 10).',
      'Cruza por donde no mire nadie: los muros y las cajas cortan la vista.',
      'Ctrl pegado a una tapia o una caja para arrimarte a la cobertura.',
      'Si te ven, sal de la zona y espera: la alarma se enfría en unos segundos.'
    ];
    return mision;
  }

  // El jugador ha aceptado: se enciende la zona (objetivo, alarma a cero) y se
  // abre la misión con sus pasos.
  function misionAceptada(opts) {
    const m = mision || prepararMision(opts);
    if (!zona) return false;
    zona.sigilo = true;
    zona.completada = false;
    zona.detectado = false;
    zona.alarma = false;
    zona.alarmaHasta = 0;
    zona.vigias.forEach(v => { v.estado = 'tranquilo'; v.deteccion = 0; v.ultimaVez = null; devolverARuta(v); });
    call(D.abrirMision, m, m._pasos || []);
    return true;
  }

  function iniciarMision(opts) {
    const m = prepararMision(opts);
    misionAceptada({});
    return { zona: { cx: zona.cx, cy: zona.cy }, mision: { id: m.id, title: m.title } };
  }

  function limpiar() {
    if (zona) {
      zona.vigias.forEach(v => { try { if (v.npc) v.npc._vigia = false; } catch (e) {} });
    }
    zona = null; mision = null; cobertura = null; ultimoChequeo = 0; acumulador = 0;
  }

  // ── Dibujo: haces, coberturas y medidor ──────────────────────────────────
  function colorHaz(v) {
    if (v.estado === 'alerta') return [255, 96, 78];
    if (v.estado === 'sospecha') return [255, 196, 92];
    return [255, 244, 208];
  }

  function dibujar(ctx, W, H) {
    if (!zona || !zona.construida) return;
    const w2s = D.worldToScreen;
    const tile = Number(call(D.getTileSize)) || 16;
    const p = call(D.getPlayer) || { x: 0, y: 0 };
    const ahora = Date.now();

    // 1. LOS CONOS DE VISIÓN **NO** SE DIBUJAN AQUÍ. El usuario lo dejó claro:
    // «el rango de visión no se debería ver en ningún modo que no sea el que se
    // activa pulsando la U». Así que en el juego normal sólo queda el MEDIDOR de
    // sospecha sobre la cabeza del vigía (que es información de que te están
    // viendo, no dónde alcanza su vista); los conos se ven con la tecla U
    // (`dibujarVisionEnemigos`), que es donde se pueden estudiar con calma.
    for (const v of zona.vigias) {
      const npc = v.npc;
      if (!npc) continue;
      if (v.deteccion <= 0.02) continue;
      const s = call(w2s, npc.x, npc.y);
      if (!s) continue;
      if (s.x < -120 || s.x > W + 120 || s.y < -120 || s.y > H + 120) continue;
      try {
        const [cr, cg, cb] = colorHaz(v);
        const bw = Math.max(18, tile * 1.1), bh = 3;
        const bx = s.x - bw / 2, by = s.y - tile * 1.1;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.fillRect(bx, by, bw * clamp(v.deteccion, 0, 1), bh);
        ctx.restore();
      } catch (e) {}
    }

    // 2. COBERTURAS: se marcan sólo las que están cerca (no llenar el mapa de
    // corchetes) y en especial aquella en la que está el jugador.
    try {
      ctx.save();
      ctx.lineWidth = 1.2;
      const pxc = (p.x || 0) + 0.5, pyc = (p.y || 0) + 0.5;
      const pintarCobertura = (c, r, alpha, color) => {
        const s = call(w2s, c + 0.5, r + 0.5);
        if (!s) return;
        const rad = tile * 0.34;
        ctx.strokeStyle = `rgba(${color},${alpha})`;
        ctx.beginPath();
        for (const [cx4, cy4, sx4, sy4] of [[-1, -1, 1, 1], [1, -1, -1, 1]]) {
          ctx.moveTo(s.x + cx4 * rad, s.y + cy4 * rad - 2);
          ctx.lineTo(s.x + sx4 * rad * 0.75, s.y + sy4 * rad - 2);
        }
        ctx.stroke();
      };
      for (const c of zona.coberturas) {
        if (dist(c.c + 0.5, c.r + 0.5, pxc, pyc) > 5.5) continue;
        pintarCobertura(c.c, c.r, 0.28, '230,235,245');
      }
      if (cobertura) pintarCobertura(cobertura.c, cobertura.r, 0.9, '140,220,255');
      ctx.restore();
    } catch (e) {}

    // 3. AVISO DE LA ZONA: mientras la misión está viva, un texto discreto con
    // el estado. Es lo único del sistema que se dibuja sin depender del mundo.
    try {
      if (zona.sigilo && !zona.completada && dentroDeZona(p.x, p.y)) {
        const texto = zona.alarma
          ? '¡ALARMA! Sal de la zona y espera a que se calmen'
          : (zona.deteccion > CFG.sospecha ? 'Te están mirando… busca una cobertura (Ctrl)' : `Objetivo: ${zona.nombre}`);
        // Como los conos ya no se dibujan en partida, la PRIMERA vez que se entra
        // en la zona con la misión viva se dice la tecla (y no se vuelve a decir).
        const pista = window._visionUsada ? null : 'Pulsa U para ver su campo de visión';
        ctx.save();
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const anchoPista = pista ? (() => { ctx.font = '11px sans-serif'; const w2 = ctx.measureText(pista).width; ctx.font = 'bold 13px sans-serif'; return w2; })() : 0;
        const w = Math.max(ctx.measureText(texto).width, anchoPista) + 20;
        const alto = pista ? 40 : 24;
        const x = Math.round(W / 2 - w / 2), y = 64;
        ctx.fillStyle = zona.alarma ? 'rgba(90,12,10,0.78)' : 'rgba(10,12,16,0.7)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, alto, 12); else ctx.rect(x, y, w, alto);
        ctx.fill();
        ctx.fillStyle = zona.alarma ? '#FFD0C6' : '#F2F4F8';
        ctx.fillText(texto, W / 2, y + 16);
        if (pista) {
          ctx.font = '11px sans-serif';
          ctx.fillStyle = 'rgba(255,240,200,0.78)';
          ctx.fillText(pista, W / 2, y + 32);
        }
        ctx.restore();
      }
      // El marcador del botín: un rombo dorado latiendo, visible desde lejos.
      if (zona.sigilo && !zona.completada) {
        const s = call(w2s, zona.objetivo.c + 0.5, zona.objetivo.r + 0.5);
        if (s) {
          const pulso = 0.6 + 0.4 * Math.sin(ahora / 320);
          ctx.save();
          ctx.globalAlpha = 0.35 + pulso * 0.4;
          ctx.fillStyle = '#FFD27A';
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - tile * 0.9);
          ctx.lineTo(s.x + 5, s.y - tile * 0.6);
          ctx.lineTo(s.x, s.y - tile * 0.3);
          ctx.lineTo(s.x - 5, s.y - tile * 0.6);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
    } catch (e) {}
  }

  // ── Estado para pruebas ──────────────────────────────────────────────────
  function estado() {
    if (!zona) return { construida: false };
    const p = call(D.getPlayer) || {};
    return {
      id: zona.id,
      nombre: zona.nombre,
      jugador: { x: Math.round(((p.x || 0) + 0.5) * 10) / 10, y: Math.round(((p.y || 0) + 0.5) * 10) / 10, agachado: !!call(D.jugadorAgachado) },
      centro: { cx: zona.cx, cy: zona.cy },
      limite: { minC: zona.minC, maxC: zona.maxC, minR: zona.minR, maxR: zona.maxR },
      objetivo: { ...zona.objetivo },
      vigias: zona.vigias.map(v => ({
        nombre: v.nombre,
        pos: { x: Math.round(v.npc.x * 10) / 10, y: Math.round(v.npc.y * 10) / 10 },
        mirando: Math.round(v.mirando * 100) / 100,
        fov: Math.round(v.fov * 100) / 100,
        alcance: v.alcance,
        estado: v.estado,
        deteccion: Math.round(v.deteccion * 100) / 100,
        ve: !!v.vio
      })),
      deteccion: Math.round((zona.deteccion || 0) * 100) / 100,
      alarma: !!zona.alarma,
      completada: !!zona.completada,
      sigilo: !!zona.sigilo,
      coberturas: zona.coberturas.length,
      cobertura: datosCobertura(),
      mision: mision ? { id: mision.id, title: mision.title, done: !!mision.done, progress: mision.progress } : null,
      ruidos: contadorRuidos
    };
  }

  // ── MODO VISIÓN (tecla U): los conos de TODOS los enemigos en rojo ───────
  // Se pinta sobre el fotograma en blanco y negro: relleno rojo translúcido,
  // borde brillante, la mirada marcada y un aviso encima del que ya te tiene
  // localizado. Sirve para decidir por dónde pasar antes de moverse.
  function todosLosVigilantes() {
    const out = [];
    if (zona && zona.vigias) for (const v of zona.vigias) if (v && v.npc) out.push(v);
    for (const v of campo) if (v && v.npc) out.push(v);
    return out;
  }

  function dibujarVisionEnemigos(ctx, W, H) {
    try {
      const w2s = D.worldToScreen;
      const tile = Number(call(D.getTileSize)) || 16;
      const vigilantes = todosLosVigilantes();
      // 1. Los conos, en rojo.
      for (const v of vigilantes) {
        const npc = v.npc;
        const origen = call(w2s, npc.x, npc.y);
        if (!origen) continue;
        if (origen.x < -200 || origen.x > W + 200 || origen.y < -200 || origen.y > H + 200) continue;
        const rayos = Math.max(14, CFG.rayosHaz);
        const semi = (v.fov || CFG.fovTranquilo) / 2;
        const alc = v.alcance || CFG.alcanceTranquilo;
        const puntos = [{ x: origen.x, y: origen.y }];
        for (let i = 0; i <= rayos; i++) {
          const ang = v.mirando - semi + ((semi * 2) * i) / rayos;
          const d = alcanceHastaChoque(npc.x, npc.y, ang, alc);
          const s = call(w2s, npc.x + Math.cos(ang) * d, npc.y + Math.sin(ang) * d);
          if (s) puntos.push({ x: s.x, y: s.y });
        }
        const localizado = v.deteccion >= 1;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(puntos[0].x, puntos[0].y);
        for (let i = 1; i < puntos.length; i++) ctx.lineTo(puntos[i].x, puntos[i].y);
        ctx.closePath();
        // El fondo está en blanco y negro, así que el rojo se pinta DOS veces:
        // una translúcido y otra en modo aditivo. Con una sola pasada al 20 % el
        // rojo se queda en un gris rosado y no se lee; así queda rojo de verdad.
        ctx.fillStyle = localizado ? 'rgba(255,40,40,0.42)' : 'rgba(255,60,60,0.30)';
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = localizado ? 'rgba(150,10,10,0.34)' : 'rgba(120,12,12,0.26)';
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = localizado ? 'rgba(255,120,110,0.95)' : 'rgba(255,70,70,0.75)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        // La mirada
        const fin = call(w2s, npc.x + Math.cos(v.mirando) * alc, npc.y + Math.sin(v.mirando) * alc);
        if (fin) {
          ctx.strokeStyle = 'rgba(255,180,170,0.55)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(origen.x, origen.y);
          ctx.lineTo(fin.x, fin.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
        // Marca del enemigo (un ojo/diana simple) y su nombre si te tiene cerca.
        try {
          ctx.save();
          ctx.strokeStyle = localizado ? 'rgba(255,90,80,1)' : 'rgba(255,120,110,0.9)';
          ctx.lineWidth = 1.6;
          const r = Math.max(5, tile * 0.22);
          ctx.beginPath();
          ctx.arc(origen.x, origen.y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(origen.x, origen.y, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fill();
          if (v.estado === 'alerta' || localizado) {
            ctx.font = 'bold 11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            const txt = String(v.nombre || 'Enemigo').toUpperCase();
            const w = ctx.measureText(txt).width + 12;
            ctx.fillStyle = 'rgba(40,6,6,0.72)';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(origen.x - w / 2, origen.y - r - 18, w, 15, 7);
            else ctx.rect(origen.x - w / 2, origen.y - r - 18, w, 15);
            ctx.fill();
            ctx.fillStyle = '#FFD9D4';
            ctx.fillText(txt, origen.x, origen.y - r - 7);
          }
          ctx.restore();
        } catch (e) {}
      }
      // 2. Aviso de cuántos te están viendo.
      try {
        const cuantos = vigilantes.filter(v => v.deteccion >= CFG.sospecha).length;
        ctx.save();
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const texto = cuantos
          ? `${cuantos} ${cuantos === 1 ? 'enemigo te ha localizado' : 'enemigos te han localizado'}`
          : 'Ningún enemigo te ve';
        const w = ctx.measureText(texto).width + 24;
        const x = Math.round(W / 2 - w / 2), y = 62;
        ctx.fillStyle = cuantos ? 'rgba(70,8,8,0.8)' : 'rgba(8,10,14,0.72)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, 24, 12); else ctx.rect(x, y, w, 24);
        ctx.fill();
        ctx.fillStyle = cuantos ? '#FFD2CC' : '#E8ECF2';
        ctx.fillText(texto, W / 2, y + 16);
        ctx.restore();
      } catch (e) {}
    } catch (e) {}
  }

  // Estado del modo visión (para el motor y las pruebas).
  function enemigosVisibles() {
    return todosLosVigilantes().map(v => ({
      nombre: v.nombre,
      zona: !!v.campo ? 'campo' : 'zona',
      tipo: String((v.npc && (v.npc.npcType || v.npc.type)) || '') || null,
      pos: [Math.round((v.npc.x || 0) * 10) / 10, Math.round((v.npc.y || 0) * 10) / 10],
      mirando: Math.round(v.mirando * 100) / 100,
      fov: v.fov,
      alcance: v.alcance,
      estado: v.estado,
      deteccion: Math.round(v.deteccion * 100) / 100,
      ve: !!v.vio
    }));
  }

  return {
    construirZona,
    prepararMision,
    misionAceptada,
    iniciarMision,
    actualizar,
    dibujar,
    hacerRuido,
    entrarEnCobertura,
    salirDeCobertura,
    enCobertura,
    datosCobertura,
    buscarCoberturaCerca,
    coberturaProtegeDe,
    esEnemigoConVision,
    dibujarVisionEnemigos,
    enemigosVisibles,
    campoVigias: () => campo.slice(),
    // Interruptor de la visión de los vigilantes de fuera de la zona. Está para
    // poder medir el coste (y apagarlo si algún día molesta): por defecto ON.
    campoActivo: () => campoActivo,
    setCampoActivo: (v) => { campoActivo = v !== false; return campoActivo; },
    estaDentro: (x, y) => dentroDeZona(x != null ? x : (call(D.getPlayer) || {}).x, y != null ? y : (call(D.getPlayer) || {}).y),
    vistaLibre,
    alcanceHastaChoque,
    zona: () => (zona ? { nombre: zona.nombre, centro: { cx: zona.cx, cy: zona.cy }, vigias: zona.vigias.length } : null),
    vigias: () => (zona ? zona.vigias.slice() : []),
    estado,
    limpiar,
    CFG
  };
}
