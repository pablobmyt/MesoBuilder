# TODO

## Pendiente pedido: SONIDOS DE STOCK para las acciones importantes

Añadir sonidos libres de derechos (o generados) para, como mínimo:

* **Jugador**: acariciar al perro (Kidu + Adapa), montar/bajar del caballo,
  galope, comer, beber, sentarse, saludar/festejar/bailar, coger algo del suelo.
* **Mundo**: cosechar trigo, labrar con la azada, talar/romper hierbajos,
  construir/martillar, puerta al entrar en casa, cambio de día.
* **Combate**: golpe dado, golpe recibido (variante según la zona herida), muerte
  de un enemigo, disparo de la Makarov.
* **Interfaz**: abrir/cerrar paneles (inventario, acciones, ficha de jugador),
  aceptar/rechazar misión, subir de nivel.

Encaje: el motor ya tiene `SoundManager` (Web Audio) y `data/Sounds/`. Conviene un
`engine/sfx.js` con un mapa `nombre → { url, vol, rate }`, precarga perezosa y un
`playSfx('cosechar')` llamado desde los mismos sitios que hoy llaman a `notify()`
o `fx.*`, más volumen en Ajustes y `data/Sounds/CREDITOS.md` con la procedencia.

## Otros pendientes

* **Arranque: el último segundo del terreno.** Ya sólo se pinta la caché de la
  vista activa (~1,0–1,5 s) y mientras se pinta se enseña «Generando mundo…» en
  vez de medio mundo. Lo que queda: pintar primero SÓLO la zona visible y el
  resto en segundo plano (la caché se vuelca entera, así que habría que partirla
  por regiones o añadir una caché «parcial» que se vaya completando).
* Al redimensionar la ventana, recolocar el panel flotante de recursos si quedó
  fuera de la pantalla (hoy sólo se ajusta al cargar la posición guardada).
* Vista de espaldas para conejo, zorro, perro y lobo (el personaje y el caballo ya
  la tienen; son ~3 líneas por especie en `engine/animal-art.js`).
* Regar cultivos con un cubo (hoy la humedad sale de estar junto al río).
* Aviso en el diario cuando una misión secundaria es un encargo espontáneo.
