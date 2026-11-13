// engine/game-engine-story-utils.js
// ─────────────────────────────────────────────────────────────────────────────
// DATOS Y ARTE DEL GUION, sin estado del motor.
//
// Extraído de `game-engine.js` (29.000 líneas). Las cuatro funciones de aquí son
// PURAS (0 variables libres): los textos por época, el guion de las escenas del
// mapa, las misiones de la historia y el dibujo de la bandera del relato de
// arranque. Se pueden mover sin `deps`, sin fábrica y sin riesgo.
//
// Herramienta para comprobar esto antes de mover algo más:
//   node tools/refactor-deps.mjs engine/game-engine.js --faciles 0
// ─────────────────────────────────────────────────────────────────────────────

// Animación de construcción de la bandera (relato de arranque de la URSS).
export function drawAnimatedUSSRFlagSequence(ctx, W, H, t, isLastPhase) {
  // USSR flag construction animation
  const flagCx = W / 2;
  const flagCy = H / 2 - 60;
  const flagWidth = 180;
  const flagHeight = 120;

  // Animation progress (0 to 1)
  const animDuration = isLastPhase ? 3000 : 2800;
  const animProgress = Math.min(1, t / animDuration);

  // Phase 1: Red background appears
  ctx.fillStyle = '#E63946';
  ctx.fillRect(flagCx - flagWidth/2, flagCy - flagHeight/2, flagWidth * Math.min(1, animProgress * 1.2), flagHeight);

  // Phase 2: Yellow hammer and sickle appear (after 40% done)
  if (animProgress > 0.4) {
    const hammerProgress = Math.min(1, (animProgress - 0.4) / 0.4);
    ctx.fillStyle = '#FFD60A';
    ctx.globalAlpha = 0.9;

    // Draw simplified hammer
    const hammerX = flagCx - 40;
    const hammerY = flagCy - 20;
    const hammerSize = 25 * hammerProgress;

    // Hammer handle
    ctx.fillRect(hammerX, hammerY + hammerSize * 0.6, hammerSize * 0.8, hammerSize * 0.4);
    // Hammer head
    ctx.fillRect(hammerX - hammerSize * 0.3, hammerY, hammerSize * 0.8, hammerSize * 0.5);

    // Draw simplified sickle (crescent)
    const sickleX = flagCx + 35;
    const sickleY = flagCy - 15;
    const sickleRadius = 20 * hammerProgress;

    ctx.beginPath();
    ctx.arc(sickleX, sickleY, sickleRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD60A';
    ctx.fill();

    // Inner arc to create sickle shape
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.96;
    ctx.beginPath();
    ctx.arc(sickleX + sickleRadius * 0.4, sickleY, sickleRadius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0;
  }

  // Phase 3: Star appears at top (after 70% done)
  if (animProgress > 0.7) {
    const starProgress = Math.min(1, (animProgress - 0.7) / 0.3);
    ctx.fillStyle = '#FFD60A';
    ctx.globalAlpha = starProgress;

    // Draw 5-pointed star
    const starX = flagCx;
    const starY = flagCy - flagHeight/2 + 25;
    const starSize = 18 * starProgress;

    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const radius = i % 2 === 0 ? starSize : starSize * 0.4;
      const x = starX + radius * Math.cos(angle);
      const y = starY + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  // At the end, show title text
  if (animProgress > 0.85) {
    const textAlpha = Math.min(1, (animProgress - 0.85) / 0.15);
    ctx.globalAlpha = textAlpha * 0.8;
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px serif';
    ctx.fillStyle = '#FFD60A';
    ctx.fillText('NOVOZARYA', flagCx, H / 2 + 80);
    ctx.font = '14px serif';
    ctx.fillStyle = 'rgba(255,214,10,0.7)';
    ctx.fillText('Under construction. The future is yours to build.', flagCx, H / 2 + 110);
    ctx.globalAlpha = 1.0;
  }
}

// ── INTRODUCCIÓN AL MUNDO (última fase del relato de arranque) ───────────────
// Pedido: «hacer una breve introducción al mundo cuando comienza una partida,
// mostrando sitios importantes y contando el contexto». El contenido sale del
// canon narrativo (docs/GUION-NARRATIVO.md) y va POR ÉPOCA, para que el jugador
// sepa qué lugares le esperan y qué está en juego antes de tomar el control.
export function introWorldBriefing(epoch) {
  if (epoch === 'urss') {
    return {
      titulo: 'NOVOZARYA Y ALREDEDORES',
      contexto: [
        'Nieve, acero y una red frágil de trenes y hornos: el distrito depende',
        'de que los suministros sigan llegando antes de la ventisca.'
      ],
      lugares: [
        { n: 'Novozarya', d: 'tu pueblo: la central, el koljós y las casas de los obreros.' },
        { n: 'El río Don', d: 'la vía de agua que trae la crecida anunciada.' },
        { n: 'La estación', d: 'único enlace con el distrito; si se corta, queda aislado.' },
        { n: 'La comisaría', d: 'Markova manda aquí: sin su permiso no hay víveres.' }
      ]
    };
  }
  if (epoch === 'medieval') {
    return {
      titulo: 'EL REINO DEL NORTE',
      contexto: [
        'Caminos, ríos y aldeas que viven del clima y del comercio.',
        'Las murallas protegen, pero la tormenta que viene no entiende de muros.'
      ],
      lugares: [
        { n: 'Tu casa', d: 'el hogar que debes asegurar antes de partir.' },
        { n: 'El priorato', d: 'donde el anciano leyó las señales en el cielo.' },
        { n: 'Las villas del norte', d: 'adonde debe llegar el aviso a tiempo.' }
      ]
    };
  }
  return {
    titulo: 'EL MUNDO DE MESOPOTAMIA',
    contexto: [
      'El Éufrates crece cada primavera: quien controla el agua, controla la cosecha.',
      'Aldeas de barro y cebada viven a la sombra de las ciudades amuralladas.'
    ],
    lugares: [
      { n: 'Kidu-Lam', d: 'tu aldea: la casa de tu familia, los graneros y el pozo.' },
      { n: 'El Éufrates', d: 'el río que da de comer y que ahora anuncia la gran crecida.' },
      { n: 'Nínagara', d: 'la ciudad del rey Ur-Nammu, al norte: adonde debes llevar el aviso.' },
      { n: 'El templo de Enlil', d: 'la sacerdotisa Enlil-Ama guarda allí los presagios.' }
    ]
  };
}

// Guion de las «escenas del mapa» (los textos que salen al llegar a un sitio).
export function getMapSceneScript(trigger) {
  try {
    const epochNow = window._currentEpoch || 'mesopotamia';
    const name = (trigger && trigger.villageName) || 'el lugar';
    switch ((trigger && trigger.scriptId) || '') {
      case 'origin-memory':
        if (epochNow === 'urss') {
          return [
            'Las brasas se han apagado, pero el olor a combustible mojado sigue en el aire.',
            `Aquí empezó todo: ${name} aún resiste entre nieve, barro y silencio.`,
            'Las tablas chamuscadas y los sacos rotos recuerdan por qué no puedes detenerte.',
            'Cada hora que pierdes aquí acerca la crecida a quienes aún dependen de ti.'
          ];
        }
        if (epochNow === 'medieval') {
          return [
            'Los cercados rotos y las cenizas hablan por sí solas.',
            `En ${name}, el saqueo aún parece reciente.`,
            'No queda gloria aquí: solo la obligación de seguir el camino y avisar al norte.',
            'Tus pasos pesan, pero la tormenta pesará más si nadie actúa.'
          ];
        }
        return [
          'La tierra conserva huellas de la incursión y del fuego.',
          `Las ruinas de ${name} te recuerdan la deuda que has jurado saldar.`,
          'No puedes reconstruir este lugar todavía, pero sí impedir que el diluvio borre otros.',
          'Respiras hondo. El camino al norte sigue abierto.'
        ];
      case 'capital-arrival':
        if (epochNow === 'urss') {
          return [
            `Los accesos de ${name} están saturados de camiones, centinelas y órdenes gritadas al viento.`,
            'Detrás de los focos y las garitas, toda la ciudad funciona como una máquina a punto de romperse.',
            'Aquí se decidirá si la región aguanta la crecida o cae en el desorden.',
            'Debes entrar, escuchar y convencer a quien todavía conserve mando.'
          ];
        }
        if (epochNow === 'medieval') {
          return [
            `Las murallas de ${name} se alzan sobre el camino como una promesa de refugio.`,
            'Mercaderes, monjes y guardias cruzan las puertas sin saber que la tormenta ya viene.',
            'Si el prior escucha tu aviso, aún habrá tiempo para preparar graneros y barcas.',
            'Si no, toda esta villa acabará aislada.'
          ];
        }
        return [
          `Nínagara — ${name} para sus gentes — respira bajo polvo, bronce y plegarias.`,
          'Las puertas monumentales y los patios abarrotados esconden una ciudad confiada.',
          'Nadie aquí imagina todavía la magnitud del diluvio.',
          'Tu aviso debe llegar al templo antes de que el río hable más alto que tú.'
        ];
      case 'trading-post-rumors':
        if (epochNow === 'urss') {
          return [
            'Bajo los toldos se cambian latas, piezas de motor y rumores por igual.',
            'Un carretero jura haber visto el canal del norte reventar dos compuertas en una sola noche.',
            'Otro habla de convoyes militares saliendo al amanecer hacia una base del distrito.',
            'Si necesitas información, este puesto comercial oye antes que nadie el crujido del sistema.'
          ];
        }
        if (epochNow === 'medieval') {
          return [
            'Los viajeros regatean pan, hierro y noticias con el mismo gesto cansado.',
            'Un peregrino habla de puentes anegados río arriba; un carretero menciona un fuerte movilizado.',
            'Las rutas aún no están cortadas, pero el miedo ya viaja más rápido que las mulas.',
            'Aquí las historias son advertencias si sabes escuchar.'
          ];
        }
        return [
          'Las caravanas traen sal, grano y presagios.',
          'Los mercaderes hablan de niveles extraños en el río y de campamentos reforzando rutas al norte.',
          'A veces el comercio detecta antes que los reyes cuándo el mundo está a punto de cambiar.',
          'Quizá convenga seguir esas voces antes de que el camino desaparezca.'
        ];
      case 'military-perimeter':
        if (epochNow === 'urss') {
          return [
            `La base de ${name} no parece un barrio: parece una orden convertida en hormigón.`,
            'Las patrullas siguen rutas precisas, los focos barren el fango y cada garita observa el canal.',
            'Aquí el distrito guarda combustible, radios y hombres suficientes para sostener una retirada o imponer disciplina.',
            'Si la situación empeora, este lugar será bisagra entre evacuación y ley marcial.'
          ];
        }
        if (epochNow === 'medieval') {
          return [
            `El fuerte de ${name} domina la llanura con una calma áspera.`,
            'Centinelas recorren almenas y patio interior mientras los establos y almacenes se preparan para un asedio.',
            'No es una villa: es una frontera armada, lista para cerrar el paso o abrir un corredor de auxilio.',
            'Si el reino cae en pánico, aquí se decidirá quién cruza y quién queda atrás.'
          ];
        }
        return [
          `La guarnición de ${name} ha convertido la ribera en un tablero de vigilancia.`,
          'Arqueros, torres y depósitos protegidos anuncian que el poder también teme al agua.',
          'No es un mercado ni un templo: es un punto de contención, hecho para resistir y mandar.',
          'Tal vez, cuando llegue el caos, la salvación pase primero por aquí.'
        ];
      case 'river-crossing':
        if (epochNow === 'urss') {
          return [
            'El canal central baja cargado de hielo oscuro, troncos y basura de media región.',
            'Si esta corriente sube un palmo más, las orillas empezarán a tragarse caminos y depósitos.',
            'Ahora mismo el mapa aún respira; pronto podría convertirse en una cadena de islas rotas.',
            'Necesitas aliados antes de que el agua decida por todos.'
          ];
        }
        if (epochNow === 'medieval') {
          return [
            'El agua corre más rápida de lo que debería para esta estación.',
            'Los juncos se inclinan como si ya conocieran la tormenta que viene detrás.',
            'Cruzar todavía es posible. Mañana, quizá no.',
            'Memoriza el cauce: pronto será juez del viaje.'
          ];
        }
        return [
          'El río parece tranquilo solo a distancia.',
          'De cerca, el barro reciente y la corriente tensa cuentan otra historia.',
          'Los ancianos tenían razón: las aguas están reuniendo fuerza.',
          'Cuando vuelvas por aquí, este paso quizá ya no exista.'
        ];
      default:
        return ['El lugar guarda más historia de la que muestra a simple vista.'];
    }
  } catch (e) {
    return ['El lugar guarda más historia de la que muestra a simple vista.'];
  }
}

// Misiones del guion por época (la lista se indexa por capítulo).
export function buildStoryQuestsForEpoch(epochId) {
  if (epochId === 'urss') {
    return [
      null,
      { id: 'story_ch1', title: 'Orden de Emergencia',
        desc: 'Reúnete en Novozarya con la comisaria del distrito y activa el protocolo de invierno.',
        target: 1, progress: 0, reward: { food: 2, stone: 1 },
        watch: null, isStory: true },
      { id: 'story_ch2', title: 'El Trato en la Oscuridad',
        desc: 'Busca al oficial Kozlov en el mercado negro de Novozarya. A cambio de 3 comida y 2 piedra, te entregar\u00e1 una Makarov PM con 8 balas. Protege el convoy de suministros.',
        target: 5, progress: 0, reward: { food: 3, stone: 2, makarov_pm: 1, makarov_ammo: 8 },
        watch: null, isStory: true },
      { id: 'story_ch3', title: '¡Novozarya aguanta el frente!',
        desc: 'El pueblo ha resistido la tormenta: la red de suministro sigue en pie.',
        target: 1, progress: 1, reward: {},
        watch: null, isStory: true, done: true }
    ];
  }
  if (epochId === 'medieval') {
    return [
      null,
      { id: 'story_ch1', title: 'El aviso del anciano',
        desc: 'Viaja a Norhaven y habla con el prior del templo.',
        target: 1, progress: 0, reward: { food: 2, stone: 1 },
        watch: null, isStory: true },
      { id: 'story_ch2', title: 'Ritual de protección',
        desc: 'Lleva al templo 5 comida y 3 piedra.',
        target: 8, progress: 0, reward: { food: 5, stone: 2 },
        watch: null, isStory: true },
      { id: 'story_ch3', title: '¡Norhaven ha sido salvada!',
        desc: 'El ritual se ha completado y la villa está preparada.',
        target: 1, progress: 1, reward: {},
        watch: null, isStory: true, done: true }
    ];
  }
  return [
    null,
    { id: 'story_ch1', title: 'El aviso del Anciano',
      desc: 'Viaja a Nínagara y habla con la Sacerdotisa del Templo.',
      target: 1, progress: 0, reward: { food: 2, stone: 1 },
      watch: null, isStory: true },
    { id: 'story_ch2', title: 'El Ritual de Protección',
      desc: 'Lleva al templo 5 comida y 3 piedra. Habla con la Sacerdotisa.',
      target: 8, progress: 0, reward: { food: 5, stone: 2 },
      watch: null, isStory: true },
    { id: 'story_ch3', title: '¡Nínagara ha sido salvada!',
      desc: 'El ritual de Enlil se ha completado. El diluvio ha sido contenido.',
      target: 1, progress: 1, reward: {},
      watch: null, isStory: true, done: true }
  ];
}
