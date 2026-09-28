GUION NARRATIVO — ADAPA Y EL DILUVIO
=====================================
Operación Zigurat · canon único · revisión 2026-09-28

Este documento sustituye a los dos borradores que había sueltos (el de
«Operación Zigurat» y la sinopsis del MANUAL). Los unifica con lo que el motor
ya cuenta de verdad, y marca cada cosa con su estado:

  ✅ implementado en el juego        🟡 escrito, pendiente de meter en el motor
  ◇ propuesta (para decidir)         ❌ contradicción detectada y resuelta aquí

Documento hermano: **`docs/IDEAS-Y-BOCETOS.md`** (bocetos, dudas y propuestas
abiertas: la aparición de Kidu, el puente entre capítulos, semillas y diálogos
en borrador). Lo que allí no esté marcado como decidido, aquí no es canon.

QUÉ HABÍA Y QUÉ FALTABA (para revisar)
--------------------------------------
- ✅ Existe una historia jugable con tres actos y tres épocas (Mesopotamia,
  URSS, medieval), prólogo en casa, NPCs de historia y cinemáticas de misión.
- ❌ Los dos borradores no coincidían: uno hablaba de un pulso geomagnético de
  1926 en Novozarya y otro de un diluvio anunciado en Kidu-Lam. Se resuelven
  aquí: **es la misma anomalía vista desde las dos épocas** (ver Premisa).
- ❌ El borrador largo tenía sistemas (confianza, memoria de Adapa, tres rutas)
  que no existen en el motor. Aquí quedan marcados 🟡 con lo que haría falta.
- 🟡 Faltaba guion escrito para los Actos II y III: había esbozo, no escenas.
- ✅ El prólogo en casa (el campo, la familia, el briefing militar) está
  implementado, pero era muy mandón: sólo dejaba seguir «preparar cultivo». Ya
  no: los objetivos se pueden cambiar (tecla O), apartar (Shift+O) o completar
  en otro orden (objetivos libres). Ver §7.1.

Premisa
-------
Un pulso geomagnético en 1926, durante una prueba hidroeléctrica soviética en
Novozarya, activa una anomalía en los sedimentos del río. La señal no abre un
portal fantástico: desincroniza zonas concretas del valle y hace que dos capas
de tiempo coexistan durante breves ventanas. En la capa antigua aparece
Mesopotamia tardía (Nínagara, el rey Ur-Nammu); en la moderna, la URSS de
entreguerras (Novozarya). Los personajes no «viajan» con luces ni magia:
atraviesan corredores donde la geología, el agua y el frío alteran relojes,
brújulas y memoria operativa.

Y hay una segunda lectura, que es la que sostiene el juego: **Adapa ya ha
cruzado antes**. El prólogo en casa (el campo, la familia, las patrullas) es
uno de esos cruces, y por eso el jugador repite gestos que no recuerda haber
hecho. La anomalía no es un portal: es una grieta que va gastando a quien la
usa.

Tono
----
Extraño pero realista: ingeniería hidráulica, comunicaciones, logística, clima
extremo, decisiones políticas y supervivencia civil. Nada de magia explícita:
lo raro se explica con instrumentos, o no se explica.

Reglas del fenómeno temporal
----------------------------
1) Las ventanas se abren cerca de cauces, esclusas y depósitos de arcilla.
2) Cuanto mayor el caudal, mayor la deriva temporal.
3) Los objetos masivos no cruzan bien; personas y mensajes sí, si van por rutas
   estables. De ahí que la logística (no la fuerza) sea la mecánica central.
4) Cada cruce deja ruido en radio y «ecos» de arquitectura en el terreno
   (justifica el zigurat hidráulico y los restos soviéticos enterrados).
5) Cada cruce le cuesta memoria a Adapa (§7.3).

Personajes del canon ✅
-----------------------
| Personaje | Época | Papel | Estado |
|---|---|---|---|
| Adapa | — | El jugador. Cazador superviviente de Kidu-Lam. Enlace entre capas | ✅ |
| Kishdu el Anciano | Mesopotamia | Encarga el aviso: «Los ríos hablan. El tiempo llega.» | ✅ |
| Sacerdotisa Enlil-Ama | Mesopotamia | Autoridad de Nínagara; pide el ritual (5 cebada + 3 piedra) | ✅ |
| Escriba Imitti | Mesopotamia | Lore y pistas; tablillas con los presagios | ✅ |
| Gavril Denisov | URSS | El anciano soviético; misma escena, otro idioma | ✅ |
| Comisaria Irina Markova | URSS | Autoridad del distrito; pragmática, pide víveres | ✅ |
| Arkady Volkov | URSS | Archivo técnico; documenta las crecidas | ✅ |
| Oficial Kozlov | URSS | Mercado negro; vende la Makarov PM (Acto II) | 🟡 |
| Teniente Sargón / Cabo Naram | Prólogo | Patrulla que interroga a Adapa en casa | ✅ |
| Familia de Adapa (madre, hermana, padre) | Prólogo | El único vínculo que aún lo ancla | ✅ |
| **Kidu** (el perro) | — | Compañero de Adapa. **No aparece hasta el capítulo 2** (ver `docs/IDEAS-Y-BOCETOS.md`). Es lo que sobrevivió de Kidu-Lam, igual que Adapa | 🟡 |

> Ojo con los nombres, que se parecen a propósito: **Kidu-Lam** es la aldea,
> **Kishdu** es el anciano que encarga el aviso y **Kidu** es el perro. El perro
> no se cruza en el camino hasta el capítulo 2; los capítulos 0 y 1 se juegan sin
> compañero (la ausencia se puede oír, ver el boceto A del documento de ideas).

───────────────────────────────────────────────────────────────
ACTO I — LA CASA Y EL AVISO ✅
Objetivo narrativo: confirmar que la anomalía es real.
Objetivo jugable: aprender el bucle básico (labor, casa, aviso, viaje).
───────────────────────────────────────────────────────────────

ESCENA 1 · El campo, al atardecer ✅ (prólogo, objetivos libres)
Adapa trabaja la tierra junto a casa. No hay diálogo: el juego deja al jugador
hacer CUALQUIERA de estas cosas antes de la noche, y puede cambiar de idea
cuando quiera (tecla O):

  · Preparar cultivo — equipa la azada y labra una parcela junto a casa.
  · Reconocer los alrededores — aléjate 24 celdas y mira el minimapa.
  · Hacer acopio — reúne 5 de madera y 5 de piedra.
  · Hablar con tu familia — acércate a la puerta de casa.

Intención: que el prólogo no sea un pasillo («no todo el rato plantar semillas»).
Las cuatro tareas se completan solas al cumplirse su condición y el jugador
avanza con la que prefiera.

ESCENA 2 · La familia, dentro de casa ✅
Entrar en casa dispara el único diálogo doméstico del prólogo. Es la escena que
más pesa en el Acto IV, porque aquí se decide qué recuerda Adapa:

  MADRE: Por fin volviste... Estamos muy preocupados. Afuera hay patrullas extrañas.
  HERMANA: Hoy notamos algo raro en el campo. Como si alguien lo hubiera tocado.
  ADAPA: No os preocupéis. He labrado la tierra y sembrado lo que pude. Es un buen comienzo.
  PADRE: Bien hecho, pero no es suficiente. Debes descansar esta noche en casa.
  ADAPA: Tendré cuidado. Mañana seguiré trabajando el campo.

ESCENA 3 · La noche y el briefing militar ✅
Al dormir, la casa se rodea de una patrulla. Teniente Sargón y Cabo Naram
interrogan a Adapa: han visto «restos que no son de esta aldea» y hablan de un
aviso que corre por el valle. Es la primera prueba de que algo no encaja, y el
primer momento en que el juego menciona el diluvio.

ESCENA 4 · Kishdu el Anciano ✅
En las ruinas de Kidu-Lam (los graneros quemados por los raiders de Gutium):

  KISHDU: Adapa... menos mal que sigues vivo.
  KISHDU: Los raiders de Gutium quemaron los graneros anoche. Casi no quedan provisiones.
  KISHDU: Pero hay algo más urgente. He leído los presagios en las estrellas y en el cauce del río.
  KISHDU: En cuarenta días, el río crecerá como no se recuerda. Vendrá una gran crecida.
  KISHDU: Debes viajar al norte, a Nínagara, la ciudad del rey Ur-Nammu.
  KISHDU: Busca a la sacerdotisa del templo. Entrégale este mensaje: «Los ríos hablan. El tiempo llega.»
  KISHDU: No pierdas tiempo. El futuro de nuestra gente está en tus manos, Adapa.
  [ Misión: Viaja a Nínagara y habla con la Sacerdotisa del Templo ]

(Antes de la misión hay una intro cinemática de tres fases con el título
«ADAPA Y EL DILUVIO», y se puede saltar con cualquier tecla.)

ESCENA 5 · El camino a Nínagara ✅
Mundo abierto: asentamientos, ríos con puentes, caminantes del yermo que piden
cosas raras («ve a ver qué hace mi hijo en la cueva»). El escriba Imitti, en el
barrio administrativo de la capital, aporta el lore:

  IMITTI: Las tablillas de arcilla guardan la memoria de Nínagara desde hace trescientos años.
  IMITTI: Se dice que cada gran diluvio es precedido por señales: peces muertos, estorninos volando al sur.
  IMITTI: ¿Has visto tales señales en tu camino aquí desde el sur?
  IMITTI: El conocimiento es el escudo más potente contra el caos. No lo olvides.

ESCENA 6 · La Sacerdotisa Enlil-Ama ✅
En el templo (o en el zigurat del núcleo, si el urbanismo lo colocó ahí):

  ENLIL-AMA: Forastero, este es el templo sagrado de Enlil. Habla con respeto.
  ENLIL-AMA: ¿Un mensaje de Kidanu? Dame un momento...
  ENLIL-AMA: «Los ríos hablan. El tiempo llega.» Por los dioses...
  ENLIL-AMA: Los presagios eran ciertos. El gran diluvio se aproxima.
  ENLIL-AMA: El rey Ur-Nammu debe preparar los diques y los graneros elevados.
  ENLIL-AMA: Pero primero necesitamos el ritual de protección. Las ofrendas al dios son esenciales.
  ENLIL-AMA: Trae al templo cinco haces de cebada y tres piedras del río para el altar.
  [ Misión: Reúne 5 cebada + 3 piedra para el ritual del templo ]

Cierre del Acto I ✅: al entregar las ofrendas se dispara la cinemática de
capítulo («¡Nínagara ha sido salvada!») y arranca el Acto II.

───────────────────────────────────────────────────────────────
ACTO II — LOGÍSTICA CONTRA EL TIEMPO ✅ (esbozo jugable)
Pregunta que responde: ¿qué necesita la gente para pasar la semana?
───────────────────────────────────────────────────────────────

ESCENA 7 · Nínagara: el ritual ✅ (capítulo 2 de Mesopotamia)
La sacerdotisa no pide fe, pide logística: cinco haces de cebada y tres piedras
del río. Al entregarlos se consume la ofrenda, se estabiliza el cauce y cae la
cinemática de capítulo. La lección narrativa es deliberada: **en este juego se
salva gente con suministros, no con milagros**.

ESCENA 8 · Novozarya: el trato en la oscuridad 🟡 (capítulo 2 de URSS)
Misma estructura, otra moral. Markova pide víveres para activar «el plan» y, en
paralelo, el oficial Kozlov ofrece una Makarov PM a cambio de 3 de comida y 2 de
piedra: llevar armas a la frontera es decisión del jugador, no del guion. El
detalle de la pistola está en el apéndice del final.

ESCENA 9 ◇ · La crecida anunciada
El sistema de avisos se rompe: el mismo mensaje llega por radio en 1926 y por
señales del río en 2350 a.C. Es el momento de decir en voz alta lo que el
jugador ya sospecha: las dos ciudades están en el mismo valle, separadas solo
por un desfase de tiempo. **Sugerencia**: que lo descubra el jugador leyendo una
tablilla escrita con la letra de Adapa, no un NPC explicándolo.

───────────────────────────────────────────────────────────────
ACTO III — SINCRONÍA DE LA CRECIDA 🟡 (por escribir)
Pregunta que responde: ¿qué infraestructura evita el colapso?
───────────────────────────────────────────────────────────────

Crisis de tres botones (estructura cerrada y fácil de implementar):

  · **Presa** (Novozarya): aguanta el caudal, pero ahoga los canales de Nínagara.
  · **Zigurat** (Nínagara): derivación hidráulica que salva los dos valles, pero
    deja la presa soviética sin margen.
  · **Equilibrio**: puentes esclusa y obras mixtas; más lento, más caro y más
    frágil, pero es la única ruta donde nadie sale perdiendo del todo.

Jugable: defensa en varias zonas a la vez, priorización de infraestructuras y
evacuación con reloj. Aquí el jugador ya no aprende el bucle: lo usa con prisa.

═══════════════════════════════════════════════════════════════════════════════

ACTO IV — Ecos Persistentes (Final Abierto) 🟡
Objetivo narrativo: la anomalía no desaparece; se convierte en infraestructura.

Cierre ideal

No se «vence al tiempo»: se estabiliza una frontera frágil entre épocas. El
final no es heroico-místico sino operativo: menos muertos, más rutas abiertas y
una ciudad que sigue funcionando al amanecer.

Y queda la pregunta, que es el verdadero cierre:
«Si Adapa es un eco de una decisión, ¿qué decisión soy yo?»

Las tres rutas (se eligen en la crisis del Acto III):

RUTA A · Presa
  → Novozarya consolida poder tecnológico. La URSS reclama el zigurat como
    «patrimonio de Moscú».
  → Enlil-Ama se retira a los templos interiores. El comercio entre épocas se
    industrializa.
  → Adapa aparece cada equinoccio en los dos lugares, aún sin saber qué es.
  → Epílogo: el jugador recibe una transmisión de radio de hace 2150 años
    pidiendo ayuda.

RUTA B · Zigurat
  → Nínagara asciende en importancia. Las técnicas de agua mesopotámicas salvan a
    las dos ciudades.
  → Markova es destituida. La URSS negocia con el Consejo Eufratiano como
    iguales.
  → Las visiones de Adapa se vuelven más frecuentes. A veces habla sumerio.
  → Epílogo: encuentran máquinas soviéticas enterradas en arcilla de 2150 a.C.

RUTA C · Equilibrio
  → Las dos ciudades negocian una frontera temporal. Los puentes esclusa se
    estabilizan.
  → Adapa acaba de guardia fronterizo, olvidando su verdadera naturaleza.
  → Markova y Enlil-Ama se reúnen cada equinoccio sin hablar, mirando el río.
  → Epílogo: en 1826 alguien encuentra el registro de Adapa en una cápsula del
    tiempo: «Si estás leyendo esto, aún no hemos decidido.»

═══════════════════════════════════════════════════════════════════════════════

SISTEMAS NARRATIVOS

7.1 Objetivos elegibles ✅ (implementado 2026-09-28)
  El panel «Objetivo activo» ya no impone uno solo. Cada objetivo se registra en
  una lista con su fuente (`mission` = historia, `free` = sugerencia del mundo) y
  el jugador decide qué sigue:
    · **O** cambia al siguiente objetivo; **Shift+O** lo aparta.
    · El panel muestra «Objetivo 2 de 4» con los botones *Cambiar*, *Ocultar* y
      *Mostrar* (recupera los apartados).
    · Los objetivos libres **se completan solos** al cumplirse su condición
      (alejarse N celdas, reunir materiales, acercarse a un sitio), así que hacer
      otra cosa también avanza el juego.
    · La misión de historia nunca se pierde: siempre está en la lista.
  API: `MESO_OBJECTIVES` (`add`, `remove`, `track`, `cycle`, `hide`, `showAll`,
  `list`). Ideas de objetivos libres para el resto del mapa: «visitar la cueva»,
  «encontrar al hijo del pastor», «llegar a la orilla oeste»…

7.2 Confianza con las autoridades 🟡
  Cada diálogo con una autoridad suma o resta confianza (0-100). Adapa empieza en
  50. Con menos de 30 la autoridad boicotea misiones; con más de 70 ofrece
  encargos secretos. Requiere: contador por autoridad dentro del guardado y ramas
  de diálogo condicionadas.

7.3 Memoria de Adapa 🟡
  Es el reloj narrativo del juego y lo que justifica el prólogo.
    · Cada cruce tras el Acto I cuesta un 5 % de memoria.
    · Al 40 % Adapa confunde identidades (ve a Markova como Enlil-Ama).
    · Al 20 % empieza a olvidar misiones: el jugador debe completarlas solo.
    · Al 0 % Adapa es una herramienta inerte y el final cambia solo.
  Requiere: barra en el HUD y enganchar los cruces (viajes entre capitales,
  ventanas temporales, cinemáticas de capítulo).

7.4 Diálogos ramificados 🟡
  Tres árboles por autoridad y acto (Markova, Enlil-Ama, Denisov/Imitti), con
  líneas exclusivas si Adapa ha cruzado N veces. Buen sitio para la primera
  decisión moral: creer a la sacerdotisa o a la comisaria sobre la causa.

Regla de escritura (aplicable a cada misión nueva)
  · Responde a una pregunta concreta: qué sabemos del fenómeno, qué necesita la
    gente esta semana, qué infraestructura evita el colapso.
  · Señala un lugar y una persona reales del mapa.
  · Su recompensa cambia algo de inmediato (acceso, seguridad, producción o
    movilidad). Si al entregarla no cambia nada, no es una misión: es un peaje.

═══════════════════════════════════════════════════════════════════════════════

NOTAS DE IMPLEMENTACIÓN Y PENDIENTES

Lo que ya está en el motor (canon, no tocar sin querer)
  1. Tres épocas con la misma estructura de capítulos: Mesopotamia (Kidu-Lam →
     Nínagara), URSS (Kidu-Lam → Novozarya) y medieval (Norhaven). Los textos se
     eligen por época en `buildStoryQuestsForEpoch()`.
  2. Prólogo en casa con máquina de estados propia (`window._homePrologue`):
     campo → familia → dormir → briefing militar → Acto I. Los objetivos libres se
     registran al empezar (ver §7.1).
  3. Capítulos: `advanceStoryChapter(n)` inyecta la misión de historia en
     `window._missions` y lanza la cinemática de capítulo; la entrega de recursos
     se comprueba en `checkChapter2Completion()`.
  4. NPCs de historia con `isStoryNPC` y sus líneas en `_storyLines`: anciano,
     sacerdotisa/comisaria, escriba, y la patrulla del prólogo. Aparecen siempre,
     aunque el planificador urbano mueva el templo (se acepta el zigurat).
  5. Objetivos elegibles (§7.1), intro cinemática de tres fases y guía de
     objetivo (brújula + marca en el suelo).

Pendientes del guion, por orden de rentabilidad
  1. **Escena 9 (la crecida anunciada)**: es la escena que une los dos borradores
     y hoy no existe. Se puede montar con un objeto (tablilla) en la capital.
  2. **Memoria de Adapa (§7.3)**: es el sistema que da sentido al prólogo.
     Empezar por la barra del HUD y descontar en las cinemáticas de capítulo.
  3. **Confianza (§7.2)**: alimenta las ramas de diálogo y los finales.
  4. **Acto III**: crisis de tres botones + el reloj. Requiere antes decidir cómo
     se viaja entre capas temporales (¿puentes esclusa como puntos fijos?).
  5. **Acto IV**: tres epílogos. Son textos, no sistemas: se pueden escribir ya y
     dejarlos listos para cuando existan las banderas.
  6. **Tutorial narrativo**: el primer acto ya es guiado, pero conviene escribir
     una línea de intención por objetivo libre para que ninguna tarea se sienta
     como relleno.

════════════════════════════════════════════════════════════════
APÉNDICE · ACTO II URSS — EL TRATO EN LA OSCURIDAD 🟡
════════════════════════════════════════════════════════════════

NUEVO ELEMENTO: Makarov PM (pistola soviética, 1926)

Origen:
  El oficial Kozlov opera en el mercado negro de Novozarya.
  Ex-cuadro del Ejercito Rojo reconvertido en traficante de armas menores.
  Aparece en Acto II cuando el jugador avanza al capitulo 2 de la historia URSS.

Obtencion:
  Al avanzar al Acto II, el juego otorga automaticamente 1 Makarov PM y 8 balas.
  Narrativa: el oficial Kozlov realiza el intercambio en el callejon del mercado.
  Precio: 3 comida + 2 piedra (representado en los recursos del quest).

Mecanica de Disparo:
  - Se equipa como cualquier arma (slot de equipo del jugador).
  - Cuando esta equipada, el cursor del juego se transforma en diana roja.
  - Click izquierdo = disparar hacia la posicion del cursor.
  - Danho base: 10 puntos (2 base + 8 bonus Makarov).
  - PRECISION POR DISTANCIA:
      Probabilidad de fallo = max(5%, min(88%, distancia_tiles x 8%))
      A 1 tile: ~8% fallo; A 5 tiles: ~40% fallo; A 10 tiles: ~80% fallo
  - Con 0 balas: aviso 'Sin municion'.

Consecuencias Narrativas:
  - Poseer la Makarov aumenta sospecha con Markova (+15 si la ve).
  - Disparar en zona controlada: -20 confianza con Markova.
  - En Acto III: pistola sirve para proteger convoy o negociar con resistencia.
  - Si no se usa al final del Acto II: Kozlov reaparece con opciones narrativas.

NPC Kozlov - oficial_estraperlo:
  Tipo: 'oficial_estraperlo' en npc-dialogues.json.
  8 frases de ambiente disponibles (discrecion, mercado negro, supervivencia).
  Sprite: merchant con contexto URSS.

Integracion en Quest:
  - Mision: El Trato en la Oscuridad (story_ch2, URSS)
  - Target: 5 recursos (3 comida + 2 piedra)
  - Reward: { food:3, stone:2, makarov_pm:1, makarov_ammo:8 }

